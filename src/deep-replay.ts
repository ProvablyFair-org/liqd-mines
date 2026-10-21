/**
 * DEEP REPLAY — the check that promotes Step 16 from limited to full verification.
 * Run: `npm run deep-replay`   (optionally `-- --configs=1,7 --out outputs/deep-replay-report.json`)
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS
 * ══════════════════════════════════════════════════════════════════════════════════════
 * `npm run verify` re-draws only the n = 1,000 convergence checkpoint of each Pass-1 row and holds
 * everything deeper to MUTUAL CONSISTENCY. That is honest but weak, and it is documented as
 * limitation DL-1. The remedy is NOT "record a deterministic Pass-1 master seed", and it is worth
 * stating plainly why:
 *
 *   A MASTER SEED WAS NEVER REQUIRED TO REPLAY THESE ROWS. Every Pass-1 row already records the
 *   serverSeed and clientSeed it was drawn with, and the nonce range is 0 .. roundsPerConfig−1 by
 *   construction. Those ARE the replay inputs. A master seed would only regenerate the SELECTION
 *   of the 24 seed pairs — useful for auditing how the seeds were chosen, irrelevant to whether
 *   the statistics follow from them.
 *
 * So this command replays all 24 × 1,000,000 rounds from the artifact's own stored seeds, using
 * exactly the expressions src/simulate.ts used, and compares EVERY deep statistic and EVERY
 * convergence count. It is READ-ONLY: it never writes outputs/simulation-results.json and never
 * writes outputs/audit-figures.json. It writes a report only when `--out` names a path.
 *
 * SINCE 2026-09-24 THE SAME REPLAY RUNS INSIDE `npm run verify` (Step 16, MINES-20): the engine is
 * src/replay.ts and the parallel worker pool src/replay-pool.ts, shared by this command. This
 * command remains the stand-alone form that writes a report (outputs/deep-replay-report.json, a
 * pinned artifact of record — no timestamps, no timings) when `--out` names a path.
 *
 * WHAT A ZERO-DIFFERENCE RESULT ESTABLISHES: that the committed Pass-1 statistics are the output
 * of this RNG on those seeds. It does NOT establish where the seeds came from (they are auditor
 * seeds; there is nothing to establish), nor anything about the operator — the chain to LIQD runs
 * through the 6,900/6,900 layout recomputation, not through Pass 1.
 */

import * as fs from 'fs';
import * as path from 'path';

import { runWorkerIfRequested, runReplayJobs } from './replay-pool';
import type { Pass1Replay } from './replay';
import { MINE_COUNTS } from './config';
import { numbersAgree } from './diff';

// Worker branch: this script is re-run as a replay worker by the pool; a worker exits here.
runWorkerIfRequested();

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
const SIM_PATH = path.join(OUTPUTS_DIR, 'simulation-results.json');

const argv = process.argv.slice(2);
/** Accepts BOTH `--name=value` and `--name value`. */
const argOf = (name: string): string | null => {
  const eq = argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return null;
};
const onlyConfigs = (() => {
  const raw = argOf('configs');
  if (!raw) return null;
  const list = raw.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n));
  return list.length > 0 ? new Set(list) : null;
})();
const outPath = argOf('out');

if (!fs.existsSync(SIM_PATH)) {
  console.error('  [ERROR] outputs/simulation-results.json not found — nothing to replay.');
  process.exit(1);
}
const sim = JSON.parse(fs.readFileSync(SIM_PATH, 'utf-8'));
const P1 = sim?.pass1_fresh_seeds ?? {};
const rows: any[] = Array.isArray(P1.results) ? P1.results : [];
const N = Number(P1.roundsPerConfig);

if (rows.length === 0 || !Number.isFinite(N) || N <= 0) {
  console.error('  [ERROR] the artifact carries no replayable Pass-1 rows.');
  process.exit(1);
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — PASS 1 DEEP REPLAY (read-only)');
console.log(`  ${rows.length} rows × ${N.toLocaleString()} rounds, replayed from each row's OWN serverSeed/clientSeed`);
if (onlyConfigs) console.log(`  --configs filter ACTIVE: ${[...onlyConfigs].sort((a, b) => a - b).join(', ')} — this is a PARTIAL replay`);
console.log('══════════════════════════════════════════════════════════\n');

interface Diff { mineCount: number; field: string; stored: unknown; replayed: unknown }
const diffs: Diff[] = [];
const replayedMs: number[] = [];
const skipped: number[] = [];
const perRow: Array<Record<string, unknown>> = [];
const t0 = Date.now();

const hex32 = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
const todo = rows.filter(r => !(onlyConfigs && !onlyConfigs.has(Number(r?.mineCount))));
for (const r of rows) if (onlyConfigs && !onlyConfigs.has(Number(r?.mineCount))) skipped.push(Number(r?.mineCount));
const good = todo.filter(r => Number.isInteger(r?.mineCount) && hex32(r?.serverSeed) && hex32(r?.clientSeed));
for (const r of todo) if (!good.includes(r)) diffs.push({ mineCount: Number(r?.mineCount), field: 'row', stored: 'malformed mineCount/serverSeed/clientSeed', replayed: 'not replayable' });
const results = runReplayJobs(good.map(r => ({ kind: 'p1' as const, mineCount: r.mineCount, serverSeed: r.serverSeed, clientSeed: r.clientSeed, rounds: N }))) as Pass1Replay[];

good.forEach((r, i) => {
  const m = r.mineCount as number;
  const x = results[i];
  const before = diffs.length;
  // Integers and strings exactly; reals at the reproduction tolerance (src/diff.ts).
  for (const f of ['firstDrawDf', 'jointPairs', 'jointWorstPair'] as const) {
    if ((r[f] ?? null) !== x[f]) diffs.push({ mineCount: m, field: f, stored: r[f], replayed: x[f] });
  }
  for (const f of ['firstDrawChi2', 'firstDrawPValue', 'jointMaxAbsZ', 'jointPValue', 'layoutR1', 'layoutR1Z',
    'layoutRunsZ', 'layoutRunsPValue', 'simRTP', 'theoreticalRTP'] as const) {
    const a = r[f], b = x[f];
    if (a === null || b === null ? a !== b : !(typeof a === 'number' && numbersAgree(a, b as number))) {
      diffs.push({ mineCount: m, field: f, stored: a, replayed: b });
    }
  }
  // Convergence: EVERY checkpoint, by exact integer equality.
  const storedConv: any[] = Array.isArray(r.convergence) ? r.convergence : [];
  if (storedConv.length !== x.convergence.length) {
    diffs.push({ mineCount: m, field: 'convergence.length', stored: storedConv.length, replayed: x.convergence.length });
  }
  for (const c of x.convergence) {
    const s = storedConv.find((y: any) => y?.n === c.n);
    if (!s) diffs.push({ mineCount: m, field: `convergence[n=${c.n}]`, stored: '(absent)', replayed: c.wins });
    else if (s.wins !== c.wins) diffs.push({ mineCount: m, field: `convergence[n=${c.n}].wins`, stored: s.wins, replayed: c.wins });
  }
  if (x.prefixMismatches > 0) diffs.push({ mineCount: m, field: 'prefixSelfCheck', stored: 'revealMines prefix', replayed: `${x.prefixMismatches} disagreement(s)` });
  replayedMs.push(m);
  const rowDiffs = diffs.length - before;
  perRow.push({ mineCount: m, serverSeed: r.serverSeed, clientSeed: r.clientSeed, nonceRange: [0, N - 1], differences: rowDiffs });
  console.log(`  ${rowDiffs === 0 ? 'MATCH   ' : 'DIFFER  '} m=${String(m).padStart(2)}  ${N.toLocaleString()} rounds  ${rowDiffs} difference(s)`);
});

const full = !onlyConfigs && replayedMs.length === MINE_COUNTS.length && rows.length === MINE_COUNTS.length;

console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${replayedMs.length} of ${rows.length} rows replayed · ${(replayedMs.length * N).toLocaleString()} rounds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  ${diffs.length} difference(s)`);
if (diffs.length > 0) {
  for (const d of diffs.slice(0, 40)) console.log(`    m=${d.mineCount} ${d.field}: stored ${d.stored} vs replayed ${d.replayed}`);
  if (diffs.length > 40) console.log(`    … and ${diffs.length - 40} more`);
}
console.log(full
  ? '  SCOPE: FULL — every Pass-1 row, every round, every deep statistic and convergence count.'
  : `  SCOPE: PARTIAL — ${skipped.length} row(s) skipped. This does NOT establish the artifact as a whole.`);
console.log(`  RESULT: ${diffs.length === 0 ? (full ? 'DEEP REPLAY PASS (zero differences, full scope)' : 'zero differences over the replayed subset') : 'DEEP REPLAY FAIL'}`);
console.log('══════════════════════════════════════════════════════════\n');

if (outPath) {
  // No run metadata (MINES-27): no timestamp and no timings, so a re-run reproduces the bytes.
  const report = {
    artifact: 'outputs/simulation-results.json',
    roundsPerConfig: N,
    rowsInArtifact: rows.length,
    rowsReplayed: replayedMs.length,
    roundsReplayed: replayedMs.length * N,
    scope: full ? 'full' : 'partial',
    differences: diffs,
    perRow,
    result: diffs.length === 0 ? (full ? 'PASS' : 'PASS (partial scope)') : 'FAIL',
  };
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2));
  console.log(`  Output: ${outPath}\n`);
}

if (diffs.length > 0) process.exit(1);
export {};
