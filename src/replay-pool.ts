/**
 * REPLAY WORKER POOL — runs src/replay.ts jobs in parallel child processes of the verifier.
 *
 * The replay is ~24,000,000 Pass-1 rounds plus 138 × 10,000 served-config rounds: minutes on one
 * core, so it is fanned out. Scored steps are synchronous, so the parent runs a small orchestrator
 * synchronously (`node -e`, below); the orchestrator starts `width` worker children and collects
 * their results. A worker is THIS SAME ENTRY SCRIPT re-run with PF_REPLAY_WORKER=1 — tests/verify.ts
 * under ts-node, or the zero-install bundle verify.js — so the job code is identical in both, and
 * `npm test` needs nothing installed. tests/verify.ts calls runWorkerIfRequested() before it reads
 * or writes anything, so a worker never scores a step. Jobs travel over stdin/stdout, not the
 * environment (the served-config jobs carry every captured plan).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { replayPass1, replayServedEpoch } from './replay';
import type { Pass1Job, Pass1Replay, ServedJob, ServedReplay } from './replay';

export type ReplayJob = Pass1Job | ServedJob;
export type ReplayResult = Pass1Replay | ServedReplay;

/** Worker side: if this process is a replay worker, run the jobs on stdin, print the results, exit. */
export function runWorkerIfRequested(): void {
  if (process.env.PF_REPLAY_WORKER !== '1') return;
  const jobs: Array<{ id: number; job: ReplayJob }> = JSON.parse(fs.readFileSync(0, 'utf8'));
  const out = jobs.map(({ id, job }) => ({
    id, result: job.kind === 'p1' ? replayPass1(job) : replayServedEpoch(job),
  }));
  writeAllSync(JSON.stringify(out));
  process.exit(0);
}

/**
 * Write the whole result to fd 1 before the worker exits. `process.stdout.write` to a pipe can return
 * before the bytes are written, and `process.exit` then drops the rest: on the ubuntu-latest runner
 * (2026-09-28, run 36476074178) a worker's result arrived cut at 146,176 bytes and Steps 16–17 failed
 * on a JSON parse error, while the same code passed on macOS. A synchronous loop cannot be cut short.
 */
function writeAllSync(s: string): void {
  const buf = Buffer.from(s, 'utf8');
  let off = 0;
  while (off < buf.length) {
    try {
      off += fs.writeSync(1, buf, off, buf.length - off);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EAGAIN') throw e;
    }
  }
}

/** How to re-run the entry script that is running now — ts-node source or the zero-install bundle. */
function selfInvocation(): { cmd: string; args: string[] } {
  const script = path.resolve(process.argv[1]);
  const execArgv = process.execArgv.filter(a => !a.startsWith('--inspect'));
  const hasTsNode = execArgv.some(a => a.includes('ts-node'));
  const args = script.endsWith('.ts') && !hasTsNode
    ? ['-r', 'ts-node/register/transpile-only', ...execArgv, script]
    : [...execArgv, script];
  return { cmd: process.execPath, args };
}

const ORCHESTRATOR = `
const { spawn } = require('child_process');
let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  const { self, buckets } = JSON.parse(input);
  Promise.all(buckets.filter(b => b.length).map(b => new Promise((resolve, reject) => {
    const child = spawn(self.cmd, self.args, { env: { ...process.env, PF_REPLAY_WORKER: '1' }, stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', c => { out += c; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error('replay worker exited ' + code)));
    child.stdin.end(JSON.stringify(b));
  }))).then(r => { process.stdout.write(JSON.stringify(r.flat())); })
    .catch(e => { process.stderr.write(String(e) + '\\n'); process.exit(1); });
});
`;

/** Relative cost of a job, for balancing: HMAC draws ≈ rounds × mines drawn per round. */
function cost(job: ReplayJob): number {
  if (job.kind === 'p1') return job.rounds * (job.mineCount + 2 + (job.mineCount * (job.mineCount - 1)) / 50);
  const meanM = job.configs.reduce((s, c) => s + c.m, 0) / Math.max(1, job.configs.length);
  return job.nonces * (meanM + 2);
}

/**
 * How many worker processes to run. Default: one per CPU. `PF_REPLAY_WORKERS=<n>` (a positive
 * integer) caps it — for a shared machine, or for the mutation and forgery batteries, which run one
 * full verify per entry (QA 2026-10-02, A6). The width changes only how the jobs are split across
 * processes, never what is replayed or compared.
 */
export function replayWidth(): number {
  const cpus = os.cpus().length;
  const env = process.env.PF_REPLAY_WORKERS;
  if (env === undefined || env === '') return cpus;
  const n = Number(env);
  if (!Number.isInteger(n) || n < 1) throw new Error(`PF_REPLAY_WORKERS must be a positive integer, got ${JSON.stringify(env)}`);
  return Math.min(n, Math.max(1, cpus));
}

/**
 * Parent side: run every job to completion, synchronously, and return the results in job order.
 * Buckets are balanced longest-job-first. Throws if any worker fails or a result is missing — the
 * caller turns that into a FAIL, never into a smaller replay.
 */
export function runReplayJobs(jobs: ReplayJob[], width = replayWidth()): ReplayResult[] {
  if (jobs.length === 0) return [];
  const w = Math.max(1, Math.min(jobs.length, width));
  const buckets: Array<Array<{ id: number; job: ReplayJob }>> = Array.from({ length: w }, () => []);
  const load = new Array<number>(w).fill(0);
  const order = jobs.map((job, id) => ({ id, job })).sort((a, b) => cost(b.job) - cost(a.job));
  for (const item of order) {
    let k = 0;
    for (let i = 1; i < w; i++) if (load[i] < load[k]) k = i;
    buckets[k].push(item);
    load[k] += cost(item.job);
  }
  const r = spawnSync(process.execPath, ['-e', ORCHESTRATOR], {
    input: JSON.stringify({ self: selfInvocation(), buckets }),
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`replay orchestrator exited ${r.status}${r.error ? `: ${r.error.message}` : ''}`);
  const flat: Array<{ id: number; result: ReplayResult }> = JSON.parse(r.stdout);
  const byId = new Map(flat.map(x => [x.id, x.result]));
  return jobs.map((_, id) => {
    const res = byId.get(id);
    if (!res) throw new Error(`replay job ${id} returned no result`);
    return res;
  });
}
