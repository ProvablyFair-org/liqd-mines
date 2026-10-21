/**
 * Deliberate writer for outputs/rtp-convergence.html — run: `npm run chart`
 *
 * Rebuilds the RTP-convergence page from the COMMITTED outputs/simulation-results.json with the
 * same renderer src/simulate.ts uses (src/convergence-chart.ts). It draws no seed and runs no
 * round: every point on the page is derived from the committed Pass-1 rows' `convergence`
 * checkpoints, so the page can be rebuilt on any machine without changing a single figure.
 *
 * Where it writes follows src/write-figures.ts: outputs/run/ by default, because
 * outputs/rtp-convergence.html is an artifact of record SHA-256 pinned in src/pins.ts
 * ARTIFACT_PINS (MINES-27). Rebuilding it in place is the deliberate
 * `OUT_DIR=outputs npm run chart`, followed by a re-pin in the same diff.
 *
 *   --check   write nothing; exit 1 unless the committed page is exactly what this renders.
 *
 * It writes and reports. It does not score anything, and it never claims a verdict.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

import { MINE_COUNTS } from './config';
import { renderConvergenceChart, loadChartJs, convergenceSamples, type ConvergenceRow } from './convergence-chart';

const ROOT = path.join(__dirname, '..');
const SIM_PATH = path.join(ROOT, 'outputs', 'simulation-results.json');
const PAGE_OF_RECORD = path.join(ROOT, 'outputs', 'rtp-convergence.html');
const OUT_DIR = process.env.OUT_DIR ? path.resolve(ROOT, process.env.OUT_DIR) : path.join(ROOT, 'outputs', 'run');
const CHECK = process.argv.includes('--check');

const die = (msg: string): never => { console.error(`  [chart] ${msg}`); process.exit(1); };

const sim = JSON.parse(fs.readFileSync(SIM_PATH, 'utf8'));
const p1 = sim?.pass1_fresh_seeds;
if (!p1 || !Array.isArray(p1.results)) die('outputs/simulation-results.json has no pass1_fresh_seeds.results');

const roundsPerConfig = Number(p1.roundsPerConfig);
if (!Number.isInteger(roundsPerConfig) || roundsPerConfig <= 0) die(`pass1_fresh_seeds.roundsPerConfig is ${JSON.stringify(p1.roundsPerConfig)}`);
const configCount = Number(p1.configs);
if (configCount !== MINE_COUNTS.length || p1.results.length !== configCount) {
  die(`the committed run has configs=${p1.configs} and ${p1.results.length} rows; this renderer plots ${MINE_COUNTS.length} mineCount configurations`);
}

// Every row must carry every sample point the run recorded — nothing is filled in.
const samples = convergenceSamples(roundsPerConfig);
const results: ConvergenceRow[] = p1.results.map((r: any) => {
  if (!Number.isInteger(r?.mineCount) || !Array.isArray(r?.convergence)) die(`a Pass-1 row lacks mineCount or convergence: ${JSON.stringify(r).slice(0, 120)}`);
  const ns = r.convergence.map((c: any) => c.n);
  if (JSON.stringify(ns) !== JSON.stringify(samples)) die(`mineCount ${r.mineCount}: convergence n = ${JSON.stringify(ns)}, expected ${JSON.stringify(samples)}`);
  for (const c of r.convergence) if (!Number.isInteger(c.wins) || c.wins < 0 || c.wins > c.n) die(`mineCount ${r.mineCount}: wins ${JSON.stringify(c.wins)} at n=${c.n}`);
  return { mineCount: r.mineCount, convergence: r.convergence };
});

let chartJs: string;
try { chartJs = loadChartJs(); } catch (e) { die((e as Error).message); throw e; }

const html = renderConvergenceChart({ configCount, roundsPerConfig, samples, results }, chartJs);
const sha = createHash('sha256').update(html).digest('hex');

if (CHECK) {
  const committed = fs.readFileSync(PAGE_OF_RECORD, 'utf8');
  if (committed !== html) die(`outputs/rtp-convergence.html is NOT what outputs/simulation-results.json renders to (rendered sha256 ${sha})`);
  console.log(`  [chart] OK: outputs/rtp-convergence.html is the rendering of outputs/simulation-results.json (sha256 ${sha}, ${Buffer.byteLength(html)} bytes)`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'rtp-convergence.html');
fs.writeFileSync(out, html);
console.log(`  [chart] wrote ${path.relative(ROOT, out)} — sha256 ${sha}, ${Buffer.byteLength(html)} bytes`);
