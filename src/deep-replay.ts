/**
 * DEEP REPLAY — the check that promotes Step 16 from limited to full verification.
 * Run: `npm run deep-replay`   (optionally `-- --configs=1,7 --out outputs/deep-replay-report.json`)
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS (QA-04, 2026-09-10)
 * ══════════════════════════════════════════════════════════════════════════════════════
 * `npm run verify` re-draws only the n = 1,000 convergence checkpoint of each Pass-1 row and holds
 * everything deeper to MUTUAL CONSISTENCY. That is honest but weak, and it was documented as
 * limitation L1 with the remedy stated as "record a deterministic Pass-1 master seed". The
 * reviewer's correction is right and it is worth stating plainly:
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
 * It is deliberately NOT part of `npm run verify` or `npm test` — it is ~600,000,000 HMACs and
 * takes tens of minutes. A verify run that silently took half an hour would just stop being run.
 * The step detail names this command instead of implying the check is unavailable.
 *
 * WHAT A ZERO-DIFFERENCE RESULT ESTABLISHES: that the committed Pass-1 statistics are the output
 * of this RNG on those seeds. It does NOT establish where the seeds came from (they are auditor
 * seeds; there is nothing to establish), nor anything about the operator — the chain to LIQD runs
 * through the 6,900/6,900 layout recomputation, not through Pass 1.
 */

import * as fs from 'fs';
import * as path from 'path';

import { revealMines } from './rng';
import { chiSquaredTest, chiSquaredPValue, lag1Autocorrelation, runsTest } from './stats';
import { GRID, MINE_COUNTS, theoreticalRTP, pairCoOccurProb } from './config';

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

/** Same convergence ladder src/simulate.ts samples. Derived, not read from the artifact. */
const CONVERGENCE_SAMPLES = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];
/** Tile the k=1 strategy opens, verbatim from src/simulate.ts. */
const FIXED_TILE = 1;

/** Tolerances. Counts are compared with `===`; the reals are float re-evaluations of the same
 *  expression in the same order, so they should be bit-identical — the gates are there to name a
 *  drift, not to absorb one. */
const TOL_CHI2 = 1e-9;
const TOL_P = 1e-12;
const TOL_R = 1e-12;

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
console.log(`  artifact: outputs/simulation-results.json (generatedAt ${sim.generatedAt ?? 'n/a'})`);
console.log(`  ${rows.length} rows × ${N.toLocaleString()} rounds, replayed from each row's OWN serverSeed/clientSeed`);
if (onlyConfigs) console.log(`  --configs filter ACTIVE: ${[...onlyConfigs].sort((a, b) => a - b).join(', ')} — this is a PARTIAL replay`);
console.log('══════════════════════════════════════════════════════════\n');

interface Diff { mineCount: number; field: string; stored: unknown; replayed: unknown }
const diffs: Diff[] = [];
const replayed: number[] = [];
const skipped: number[] = [];
const perRow: Array<Record<string, unknown>> = [];
const t0 = Date.now();

for (const r of rows) {
  const m = Number(r?.mineCount);
  if (onlyConfigs && !onlyConfigs.has(m)) { skipped.push(m); continue; }
  if (!Number.isInteger(m) || !/^[0-9a-f]{32}$/.test(r?.serverSeed ?? '') || !/^[0-9a-f]{32}$/.test(r?.clientSeed ?? '')) {
    diffs.push({ mineCount: m, field: 'row', stored: 'malformed mineCount/serverSeed/clientSeed', replayed: 'not replayable' });
    continue;
  }

  const rowStart = Date.now();
  const firstDrawFreq = new Array(GRID).fill(0);
  const firstDrawSeq = new Uint8Array(N);
  const pairCounts = m >= 2 ? new Float64Array((GRID * (GRID - 1)) / 2) : null;
  let wins = 0, nextSample = 0;
  const conv: Array<{ n: number; wins: number }> = [];

  for (let nonce = 0; nonce < N; nonce++) {
    const mines = revealMines(r.serverSeed, r.clientSeed, nonce, m);
    const first = mines[0];
    firstDrawFreq[first - 1]++;
    firstDrawSeq[nonce] = first;
    let fixedIsMine = false;
    for (const t of mines) if (t === FIXED_TILE) { fixedIsMine = true; break; }
    if (!fixedIsMine) wins++;
    if (nextSample < CONVERGENCE_SAMPLES.length && nonce + 1 === CONVERGENCE_SAMPLES[nextSample]) {
      if (CONVERGENCE_SAMPLES[nextSample] <= N) conv.push({ n: nonce + 1, wins });
      nextSample++;
    }
    if (pairCounts) {
      const sorted = mines.slice().sort((x, y) => x - y);
      for (let a = 0; a < sorted.length; a++) {
        for (let b = a + 1; b < sorted.length; b++) {
          const i = sorted[a] - 1, j = sorted[b] - 1;
          pairCounts[i * (GRID - 1) - (i * (i - 1)) / 2 + (j - i - 1)]++;
        }
      }
    }
  }

  const fd = chiSquaredTest([...firstDrawFreq], new Array(GRID).fill(N / GRID));
  let jointMaxAbsZ: number | null = null, jointPValue: number | null = null, jointPairs: number | null = null;
  if (pairCounts) {
    const q = pairCoOccurProb(m);
    const expPair = N * q, sdPair = Math.sqrt(N * q * (1 - q));
    let maxAbsZ = 0;
    for (let k = 0; k < pairCounts.length; k++) {
      const z = Math.abs((pairCounts[k] - expPair) / sdPair);
      if (z > maxAbsZ) maxAbsZ = z;
    }
    jointPairs = pairCounts.length;
    jointMaxAbsZ = maxAbsZ;
    jointPValue = Math.min(1, jointPairs * chiSquaredPValue(maxAbsZ * maxAbsZ, 1));
  }
  const seq = Array.from(firstDrawSeq) as number[];
  const layoutR1 = lag1Autocorrelation(seq);
  const layoutR1Z = layoutR1 * Math.sqrt(N);
  const { z: layoutRunsZ, pValue: layoutRunsPValue } = runsTest(seq.map(v => (v > 13 ? 1 : 0)));
  const theoRTP = theoreticalRTP(m, 1);
  const simRTP = (wins / N) * (theoRTP / ((GRID - m) / GRID));

  const cmpNum = (field: string, stored: unknown, val: number, tol: number) => {
    if (!Number.isFinite(Number(stored)) || Math.abs(Number(stored) - val) > tol) {
      diffs.push({ mineCount: m, field, stored, replayed: val });
    }
  };
  const cmpNullable = (field: string, stored: unknown, val: number | null, tol: number) => {
    if (val === null) { if (stored !== null && stored !== undefined) diffs.push({ mineCount: m, field, stored, replayed: null }); return; }
    cmpNum(field, stored, val, tol);
  };

  cmpNum('firstDrawChi2', r.firstDrawChi2, fd.chi2, TOL_CHI2);
  cmpNum('firstDrawPValue', r.firstDrawPValue, fd.pValue, TOL_P);
  if (r.firstDrawDf !== fd.df) diffs.push({ mineCount: m, field: 'firstDrawDf', stored: r.firstDrawDf, replayed: fd.df });
  cmpNullable('jointMaxAbsZ', r.jointMaxAbsZ, jointMaxAbsZ, TOL_R);
  cmpNullable('jointPValue', r.jointPValue, jointPValue, TOL_P);
  if ((r.jointPairs ?? null) !== jointPairs) diffs.push({ mineCount: m, field: 'jointPairs', stored: r.jointPairs, replayed: jointPairs });
  cmpNum('layoutR1', r.layoutR1, layoutR1, TOL_R);
  cmpNum('layoutR1Z', r.layoutR1Z, layoutR1Z, TOL_R);
  cmpNum('layoutRunsZ', r.layoutRunsZ, layoutRunsZ, TOL_R);
  cmpNum('layoutRunsPValue', r.layoutRunsPValue, layoutRunsPValue, TOL_P);
  cmpNum('simRTP', r.simRTP, simRTP, TOL_R);
  cmpNum('theoreticalRTP', r.theoreticalRTP, theoRTP, TOL_R);

  // Convergence: EVERY checkpoint, by exact integer equality. This is the arm S01 cannot survive.
  const storedConv: any[] = Array.isArray(r.convergence) ? r.convergence : [];
  if (storedConv.length !== conv.length) {
    diffs.push({ mineCount: m, field: 'convergence.length', stored: storedConv.length, replayed: conv.length });
  }
  for (const c of conv) {
    const s = storedConv.find((x: any) => x?.n === c.n);
    if (!s) diffs.push({ mineCount: m, field: `convergence[n=${c.n}]`, stored: '(absent)', replayed: c.wins });
    else if (s.wins !== c.wins) diffs.push({ mineCount: m, field: `convergence[n=${c.n}].wins`, stored: s.wins, replayed: c.wins });
  }

  replayed.push(m);
  const rowDiffs = diffs.filter(d => d.mineCount === m).length;
  perRow.push({ mineCount: m, serverSeed: r.serverSeed, clientSeed: r.clientSeed, nonceRange: [0, N - 1], differences: rowDiffs, elapsedMs: Date.now() - rowStart });
  console.log(`  ${rowDiffs === 0 ? 'MATCH   ' : 'DIFFER  '} m=${String(m).padStart(2)}  ${N.toLocaleString()} rounds  ${rowDiffs} difference(s)  ${((Date.now() - rowStart) / 1000).toFixed(1)}s`);
}

const elapsedMs = Date.now() - t0;
const full = !onlyConfigs && replayed.length === MINE_COUNTS.length && rows.length === MINE_COUNTS.length;

console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${replayed.length} of ${rows.length} rows replayed · ${(replayed.length * N).toLocaleString()} rounds · ${(elapsedMs / 1000).toFixed(1)}s`);
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
  const report = {
    generatedAt: new Date().toISOString(),
    artifact: 'outputs/simulation-results.json',
    artifactGeneratedAt: sim.generatedAt ?? null,
    roundsPerConfig: N,
    rowsInArtifact: rows.length,
    rowsReplayed: replayed.length,
    roundsReplayed: replayed.length * N,
    scope: full ? 'full' : 'partial',
    differences: diffs,
    perRow,
    elapsedMs,
    result: diffs.length === 0 ? (full ? 'PASS' : 'PASS (partial scope)') : 'FAIL',
  };
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2));
  console.log(`  Output: ${outPath}\n`);
}

if (diffs.length > 0) process.exit(1);
export {};
