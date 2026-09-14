/**
 * LIQD Mines — Monte-Carlo simulation (Pass 1 + Pass 2).
 *
 * Mine placement is a CONSTRAINED multinomial: exactly m mines among 25 tiles, so the
 * 25 per-tile mine counts sum to n·m and are negatively correlated — they are NOT 25
 * independent cells. Testing them as independent (df=24) is the wrong null; at high
 * mineCount the statistic pins near its floor and cannot reject. Pass 1 therefore tests
 * the RNG the way it is actually drawn:
 *
 * Pass 1 — per-config seeds expanded from the run's recorded masterSeed (QA-05), mineCount 1..24:
 *   1. First-draw uniformity (scored): the FIRST drawn mine tile (revealMines[0]) is a
 *      single uniform draw over 25 tiles per round — a proper single-outcome multinomial,
 *      so df=24 is CORRECT here. Chi² of the first-drawn-tile histogram vs N/25.
 *   2. Pairwise co-occurrence joint test (scored, m≥2): counts how often each unordered
 *      tile pair are BOTH mines; compared to the hypergeometric expectation
 *      N·pairCoOccurProb(m), standardized by the exact binomial SD and tested as max|z|
 *      over the 300 pairs (Bonferroni within config). Catches joint bias the marginals miss at low
 *      and moderate mineCount; at very high m the pair counts become a deterministic function of
 *      the tile counts, so there the test coincides with a marginal test rather than adding to it.
 *   3. Serial tests of FIRST-DRAWN TILE VALUES (scored): lag-1 autocorrelation + runs test on the
 *      SEQUENCE OF FIRST-DRAWN TILE VALUES (1..25 integers, not a single "tile 1" bit).
 *   Plus the simulated k=1 RTP vs theoreticalRTP(m,1) (informational aggregate).
 *   FWER: Bonferroni α/24. Serial z-critical from inverseCriticalZ(0.01/24).
 *
 * Pass 2 — casino seeds from the captured dataset's revealed serverSeeds:
 *   Early window = nonces 0..49 (the real served depth per epoch); late window = 50..9999.
 *   Statistic = first-draw uniformity chi² over the window. At n=50 with 25 cells the
 *   expected count is 2 (<5), so the analytic chi² distribution is invalid — the null is
 *   built by a PARAMETRIC BOOTSTRAP: for each mineCount present, 10,000 fair replicates of
 *   50 first-draws over 25 tiles (via revealMines with seeds expanded from the recorded
 *   masterSeed, so the null itself is replayable — QA-05) give the
 *   empirical first-draw-chi² distribution. Each captured seed's early-window chi² → an
 *   empirical p from that bootstrap. Cherry-pick flag if earlyBootstrapP<0.05 AND lateP≥0.05.
 *
 * Output: outputs/simulation-results.json, outputs/rtp-convergence.html
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomBytes, createHash } from 'node:crypto';

import { revealMines, deriveSeedHex, isMasterSeed, SEED_DERIVATION_VERSION } from './rng';
import { loadDataset } from './loader';
import { EXPECTED_DATASET_HASH } from './pins';
import {
  combination,
  chiSquaredTest,
  chiSquaredPValue,
  lag1Autocorrelation,
  runsTest,
  inverseCriticalZ,
} from './stats';
import { GRID, MINE_COUNTS, theoreticalRTP, pairCoOccurProb } from './config';

// ── Config + constants ──────────────────────────────────────────────────────────

const ROUNDS_PER_CONFIG = Number(process.env.ROUNDS_PER_CONFIG) || 1_000_000;
const PASS2_NONCES = Number(process.env.PASS2_NONCES) || 10_000;
const PASS2_EARLY = 50;                 // real served depth per epoch (nonces 0..49)
const BOOTSTRAP_REPS = Number(process.env.BOOTSTRAP_REPS) || 10_000;

/**
 * QA-05 — the run's MASTER SEED. Fresh 32 random bytes by default (never a pinned array), or
 * `SIM_MASTER_SEED` when a third party is REPLAYING a recorded run. It is written into the
 * artifact, and every throwaway seed below — Pass-1 per-config seeds and every Pass-2 bootstrap
 * replicate — is expanded from it by the versioned, domain-separated derivation in src/rng.ts.
 *
 * Consequence, which is the whole point: two runs with the same master seed produce the SAME
 * bootstrap null and therefore the same `earlyBootstrapP` for every epoch, so that value stops
 * being an assertion the verifier can only bounds-check.
 */
const MASTER_SEED = (() => {
  const supplied = process.env.SIM_MASTER_SEED;
  if (supplied !== undefined) {
    if (!isMasterSeed(supplied)) {
      console.error(`  [ERROR] SIM_MASTER_SEED must be 32–128 lowercase hex characters; got ${JSON.stringify(supplied)}`);
      process.exit(1);
    }
    return supplied;
  }
  return randomBytes(32).toString('hex');
})();

const INPUTS_RECORDED_AT = new Date().toISOString();
const DATASET_PATH = path.join(__dirname, '..', 'data', 'mines-master-6900bets.json');

// ── Dataset pin enforced BEFORE any work happens (P0-4) ────────────────────────
// The pinned loader used to be called at the top of Pass 2 — i.e. AFTER the ~30-minute
// Pass-1 loop had already run and scored all 24 configs. An edited dataset therefore cost
// half an hour before it aborted, and MANIFEST's claim that the hash is checked "at the
// start of the simulation stage" was false as written. loadDataset() exits(1) on any
// mismatch, so placing it here means an un-repinned edit aborts before the PASS 1 banner
// prints and before a single round is drawn. The pin itself has one definition, src/pins.ts
// (P1-9) — imported here and by tests/verify.ts, never re-typed.
const ds = loadDataset(DATASET_PATH, EXPECTED_DATASET_HASH) as unknown as {
  seeds: { epoch: number; hashedServerSeed: string; serverSeed: string | null; clientSeed: string }[];
  bets: { hashedServerSeed: string; mineCount: number }[];
};
const mineCountByHash = new Map<string, number>();
for (const b of ds.bets) if (!mineCountByHash.has(b.hashedServerSeed)) mineCountByHash.set(b.hashedServerSeed, b.mineCount);
const revealedSeeds = ds.seeds.filter(s => s.serverSeed);
console.log(`  Dataset pin verified before Pass 1: ${ds.bets.length} bets, ${revealedSeeds.length} revealed seeds\n`);

/** Sample points for the RTP-convergence chart (cumulative, per config). */
const CONVERGENCE_SAMPLES = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000]
  .filter(n => n <= ROUNDS_PER_CONFIG);

// ── Progress bar ──────────────────────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinIdx = 0;
let lastProgressLine = '';
let spinnerTimer: ReturnType<typeof setInterval> | null = null;

function startSpinner(): void {
  if (spinnerTimer) return;
  spinnerTimer = setInterval(() => {
    if (!lastProgressLine) return;
    spinIdx++;
    const spin = SPINNER[spinIdx % SPINNER.length];
    const updated = lastProgressLine.replace(/^(\r  )./, `$1${spin}`);
    process.stdout.write(updated);
  }, 120);
}

function stopSpinner(): void {
  if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null; }
}

function progressBar(current: number, total: number, label: string, startMs: number, width = 30): void {
  const ratio = Math.min(total > 0 ? current / total : 0, 1);
  const filled = Math.round(ratio * width);
  const bar = '━'.repeat(filled) + '╌'.repeat(width - filled);
  const pct = (ratio * 100).toFixed(0).padStart(3);
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const eta = current > 0 ? (((Date.now() - startMs) / current) * (total - current) / 1000).toFixed(0) : '?';
  const spin = SPINNER[spinIdx % SPINNER.length];
  lastProgressLine = `\r  ${spin} ${bar} ${pct}% | ${current}/${total} | ${label} | ${elapsed}s elapsed ~ ${eta}s left`;
  process.stdout.write(lastProgressLine);
}

function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

// ── Chi² helpers ────────────────────────────────────────────────────────────────

/**
 * First-draw uniformity chi² over 25 tiles: single-outcome-per-round multinomial.
 * At the Pass-2 early-window n=50, chiSquaredTest pools the end cells (expected 2 → <5),
 * yielding a nonstandard statistic — valid here only because the Pass-2 empirical p-value
 * runs the observed value and every bootstrap replicate through this identical pooling
 * (symmetry), not because the analytic chi² distribution applies (FIX-5).
 */
function firstDrawChi2(freq: number[], n: number): { chi2: number; df: number; pValue: number } {
  return chiSquaredTest([...freq], new Array(GRID).fill(n / GRID));
}

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 1 — Fresh random seeds
// ══════════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(60));
console.log('  LIQD MINES — PASS 1: fresh random seeds');
console.log(`  ${MINE_COUNTS.length} configs (mineCount 1..24) × ${ROUNDS_PER_CONFIG.toLocaleString()} rounds`);
console.log('═'.repeat(60) + '\n');

interface Pass1Result {
  mineCount: number;
  serverSeed: string;
  clientSeed: string;
  // First-draw uniformity (scored, df=24)
  firstDrawChi2: number;
  firstDrawDf: number;
  firstDrawPValue: number;
  // Pairwise co-occurrence joint test (scored, m>=2; null for m=1)
  jointMaxAbsZ: number | null;
  jointPValue: number | null;
  jointPairs: number | null;
  jointWorstPair: string | null;
  // Serial tests of first-drawn tile VALUES (scored) — NOT whole-layout coverage (L8)
  layoutR1: number;
  layoutR1Z: number;
  layoutRunsZ: number;
  layoutRunsPValue: number;
  // RTP (informational aggregate)
  theoreticalRTP: number;
  simRTP: number;
  /** cumulative (n, wins) checkpoints for the convergence chart */
  convergence: Array<{ n: number; wins: number }>;
}

const pass1Results: Pass1Result[] = [];
const pass1Start = Date.now();
progressBar(0, MINE_COUNTS.length, 'starting...', pass1Start);
startSpinner();

// Fixed tile the k=1 strategy always opens (1-indexed tile 1).
const FIXED_TILE = 1;

for (let ci = 0; ci < MINE_COUNTS.length; ci++) {
  const mineCount = MINE_COUNTS[ci];

  // QA-05: expanded from MASTER_SEED, domain-separated per mineCount, so the SELECTION of these
  // seeds is replayable too. The seeds themselves were already recorded per row (and are what
  // src/deep-replay.ts replays); this makes the choice of them auditable as well.
  const serverSeed = deriveSeedHex(MASTER_SEED, `pass1-server:m=${mineCount}`, 0);
  const clientSeed = deriveSeedHex(MASTER_SEED, `pass1-client:m=${mineCount}`, 0);

  const firstDrawFreq = new Array(GRID).fill(0);          // index 0 = tile 1, ... tile 25
  const firstDrawSeq = new Uint8Array(ROUNDS_PER_CONFIG); // first-drawn tile VALUE per round
  // Pairwise co-occurrence: flat upper-triangular counts. pairIndex(i,j) for i<j.
  const pairCounts = mineCount >= 2 ? new Float64Array((GRID * (GRID - 1)) / 2) : null;
  let wins = 0;
  const convCheckpoints: Array<{ n: number; wins: number }> = [];
  let nextSample = 0;

  for (let nonce = 0; nonce < ROUNDS_PER_CONFIG; nonce++) {
    const mines = revealMines(serverSeed, clientSeed, nonce, mineCount);
    const first = mines[0];
    firstDrawFreq[first - 1]++;
    firstDrawSeq[nonce] = first;                           // 1..25 tile value
    if (first !== FIXED_TILE) {
      // FIXED_TILE not the first mine — but the k=1 win condition is: FIXED_TILE is safe.
    }
    // k=1 strategy: open FIXED_TILE, win iff it is NOT a mine.
    let fixedIsMine = false;
    for (const t of mines) if (t === FIXED_TILE) { fixedIsMine = true; break; }
    if (!fixedIsMine) wins++;

    // convergence checkpoint: cumulative wins at this sample size
    if (nextSample < CONVERGENCE_SAMPLES.length && nonce + 1 === CONVERGENCE_SAMPLES[nextSample]) {
      convCheckpoints.push({ n: nonce + 1, wins });
      nextSample++;
    }

    if (pairCounts) {
      // Count every unordered mine pair {i,j} (0-indexed tiles a<b).
      const sorted = mines.slice().sort((x, y) => x - y);
      for (let a = 0; a < sorted.length; a++) {
        for (let b = a + 1; b < sorted.length; b++) {
          const i = sorted[a] - 1, j = sorted[b] - 1; // i<j
          // upper-tri flat index for (i,j), i<j, over GRID tiles:
          const idx = i * (GRID - 1) - (i * (i - 1)) / 2 + (j - i - 1);
          pairCounts[idx]++;
        }
      }
    }
  }

  // 1. First-draw uniformity (df=24, proper single-outcome multinomial).
  const fd = firstDrawChi2(firstDrawFreq, ROUNDS_PER_CONFIG);

  // 2. Pairwise co-occurrence joint test — max standardized deviation over the 300 pairs.
  //
  // CALIBRATION NOTE (this replaces an earlier, mis-calibrated chi-squared form):
  // each pair's co-occurrence count is BINOMIAL(N, q), q = pairCoOccurProb(m) — it is NOT a
  // multinomial cell. A Pearson statistic Σ(O−E)²/E therefore does NOT follow χ²(299): with
  // Var(O) = Nq(1−q), each term has mean (1−q), so E[Σ] = 300·(1−q). That decays from ~299
  // at m=2 to ~24 at m=24, so comparing to χ²(299) made the test progressively powerless
  // exactly where mine density is highest (it reported p≈1.0000 for any input at m≥21).
  //
  // Correct form: standardize each pair by its own binomial SD, z = (O − Nq)/√(Nq(1−q)),
  // and test the LARGEST |z| across the 300 pairs with a Bonferroni correction over pairs.
  // z² ~ χ²(1) ASYMPTOTICALLY (the normal approximation to a discrete binomial count — not an
  // exact law; P1-6), so the two-sided per-pair p is chiSquaredPValue(z², 1). Here Nq ≥ 3,333
  // at the least-frequent pair (m=2), so the approximation error is orders of magnitude below
  // the Bonferroni threshold this p is compared against. The reported jointPValue keeps the
  // same meaning and scale as before
  // (a per-config p compared against α and the across-config Bonferroni α).
  let jointMaxAbsZ: number | null = null, jointPValue: number | null = null, jointPairs: number | null = null;
  let jointWorstPair: string | null = null;
  if (pairCounts) {
    const q = pairCoOccurProb(mineCount);
    const expPair = ROUNDS_PER_CONFIG * q;
    const sdPair = Math.sqrt(ROUNDS_PER_CONFIG * q * (1 - q));
    let maxAbsZ = 0, worstIdx = -1;
    for (let k = 0; k < pairCounts.length; k++) {
      const z = (pairCounts[k] - expPair) / sdPair;
      if (Math.abs(z) > maxAbsZ) { maxAbsZ = Math.abs(z); worstIdx = k; }
    }
    const nPairs = pairCounts.length;
    // Bonferroni across the pairs within this config; clamped to 1.
    jointPValue = Math.min(1, nPairs * chiSquaredPValue(maxAbsZ * maxAbsZ, 1));
    jointMaxAbsZ = maxAbsZ;
    jointPairs = nPairs;
    // decode worst pair index -> (i,j) for reporting
    if (worstIdx >= 0) {
      let idx = 0, wi = 0, wj = 1;
      outer: for (let i = 0; i < GRID; i++) for (let j = i + 1; j < GRID; j++) { if (idx === worstIdx) { wi = i; wj = j; break outer; } idx++; }
      jointWorstPair = `${wi + 1}-${wj + 1}`;
    }
  }

  // 3. Serial tests of first-drawn tile VALUES (1..25 integers). One integer per round: this is
  //    NOT whole-layout serial coverage, and QA-09 requires it not to be described as such (L8).
  const seq = Array.from(firstDrawSeq) as number[];
  const layoutR1 = lag1Autocorrelation(seq);
  const layoutR1Z = layoutR1 * Math.sqrt(ROUNDS_PER_CONFIG);
  // Runs test needs a 2-level series: split first-drawn value about its median (13).
  const median = 13; // tiles 1..25; below/above midpoint
  const runSeq = seq.map(v => (v > median ? 1 : 0));
  const { z: layoutRunsZ, pValue: layoutRunsP } = runsTest(runSeq);

  // Simulated k=1 RTP (informational aggregate).
  const winRate = wins / ROUNDS_PER_CONFIG;
  const theoRTP = theoreticalRTP(mineCount, 1);
  const multiplier1 = theoRTP / ((GRID - mineCount) / GRID);
  const simRTP = winRate * multiplier1;

  pass1Results.push({
    mineCount, serverSeed, clientSeed,
    firstDrawChi2: fd.chi2, firstDrawDf: fd.df, firstDrawPValue: fd.pValue,
    jointMaxAbsZ, jointPValue, jointPairs, jointWorstPair,
    convergence: convCheckpoints,
    layoutR1, layoutR1Z, layoutRunsZ, layoutRunsPValue: layoutRunsP,
    theoreticalRTP: theoRTP, simRTP,
  });

  progressBar(ci + 1, MINE_COUNTS.length, `mineCount=${mineCount}`, pass1Start);
}

stopSpinner();
clearLine();
progressBar(MINE_COUNTS.length, MINE_COUNTS.length, 'done', pass1Start);
process.stdout.write('\n');

// ── Pass 1 summary ────────────────────────────────────────────────────────────

const pass1ElapsedMs = Date.now() - pass1Start;
const N = MINE_COUNTS.length;
const bonAlpha = 0.01 / N;
const bonZCrit = inverseCriticalZ(bonAlpha);

const firstDrawFailsAtAlpha01 = pass1Results.filter(r => r.firstDrawPValue < 0.01).length;
const firstDrawFailsBonferroni = pass1Results.filter(r => r.firstDrawPValue < bonAlpha).length;

const jointConfigs = pass1Results.filter(r => r.jointPValue !== null);
const jointFailsAtAlpha01 = jointConfigs.filter(r => (r.jointPValue as number) < 0.01).length;
const jointFailsBonferroni = jointConfigs.filter(r => (r.jointPValue as number) < bonAlpha).length;

const layoutSerialFailsUncorrected = pass1Results.filter(r => Math.abs(r.layoutR1Z) > 1.96 || r.layoutRunsPValue < 0.01).length;
const layoutSerialFailsBonferroni = pass1Results.filter(r => Math.abs(r.layoutR1Z) > bonZCrit || r.layoutRunsPValue < bonAlpha).length;

const meanSimRTP = pass1Results.reduce((s, r) => s + r.simRTP, 0) / pass1Results.length;
const meanTheoRTP = pass1Results.reduce((s, r) => s + r.theoreticalRTP, 0) / pass1Results.length;

console.log('');
console.log(`  FWER: Bonferroni α/N = ${bonAlpha.toExponential(3)} (N=${N})`);
console.log(`  First-draw uniformity (df=24): ${firstDrawFailsAtAlpha01}/${N} fail at α=0.01 · ${firstDrawFailsBonferroni}/${N} at Bonferroni`);
{
  const worstZ = jointConfigs.reduce((mx, r) => Math.max(mx, r.jointMaxAbsZ ?? 0), 0);
  console.log(`  Pairwise co-occurrence joint (m≥2, ${jointConfigs.length} configs, max|z| over 300 pairs): ${jointFailsAtAlpha01}/${jointConfigs.length} at α=0.01 · ${jointFailsBonferroni}/${jointConfigs.length} at Bonferroni · largest |z| across all configs ${worstZ.toFixed(2)}`);
}
console.log(`  Layout serial (first-drawn tile values): ${layoutSerialFailsUncorrected}/${N} uncorrected (|r₁z|>1.96 or runs p<0.01) · ${layoutSerialFailsBonferroni}/${N} at Bonferroni (|r₁z|>${bonZCrit.toFixed(3)})`);
console.log(`  Mean simulated RTP (k=1): ${(meanSimRTP * 100).toFixed(4)}%  (theoretical ${(meanTheoRTP * 100).toFixed(4)}%)`);
console.log(`  Time: ${(pass1ElapsedMs / 1000).toFixed(1)}s\n`);

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 2 — Casino seeds (cherry-pick test, bootstrap null over 0..49 window)
// ══════════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(60));
console.log('  LIQD MINES — PASS 2: casino seeds (cherry-pick, 0..49 bootstrap null)');
console.log('═'.repeat(60) + '\n');

interface Pass2SeedResult {
  epoch: number;
  hashedServerSeed: string;
  mineCount: number;
  earlyChi2: number;
  earlyBootstrapP: number;
  lateChi2: number;
  latePValue: number;
  cherryPickFlag: boolean;
}

const pass2Results: Pass2SeedResult[] = [];
let seedsTested = 0;
let cherryPickFlags = 0;

// The revealed casino seeds + a representative mineCount per epoch were read at the TOP of
// this file, through the SHA-256-pinned loader (loader.ts, exits(1) on any un-repinned edit)
// and BEFORE Pass 1 ran — see the P0-4 note there. Nothing is re-read here.

// ── Bootstrap the first-draw-chi² null ONCE per distinct mineCount in the seed set ──
// The early window is n=50 first-draws over 25 tiles (expected count 2 per cell), so the
// analytic chi² is invalid. Build the empirical null: BOOTSTRAP_REPS fair replicates of 50
// first-draws (revealMines[0]) with throwaway random seeds, sorted ascending for lookup.
const presentMineCounts = Array.from(new Set(revealedSeeds.map(s => mineCountByHash.get(s.hashedServerSeed) ?? 3)));
const bootstrapNull = new Map<number, Float64Array>(); // mineCount -> sorted chi² stats

const bootStart = Date.now();
progressBar(0, presentMineCounts.length, 'bootstrapping null...', bootStart);
startSpinner();
for (let mi = 0; mi < presentMineCounts.length; mi++) {
  const mc = presentMineCounts[mi];
  const stats = new Float64Array(BOOTSTRAP_REPS);
  for (let rep = 0; rep < BOOTSTRAP_REPS; rep++) {
    // Versioned domains and replicate indices determine every bootstrap seed pair.
    const bs = deriveSeedHex(MASTER_SEED, `pass2-bootstrap-server:m=${mc}`, rep);
    const bc = deriveSeedHex(MASTER_SEED, `pass2-bootstrap-client:m=${mc}`, rep);
    const freq = new Array(GRID).fill(0);
    for (let nonce = 0; nonce < PASS2_EARLY; nonce++) {
      const mines = revealMines(bs, bc, nonce, mc);
      freq[mines[0] - 1]++;
    }
    stats[rep] = firstDrawChi2(freq, PASS2_EARLY).chi2;
  }
  stats.sort();
  bootstrapNull.set(mc, stats);
  progressBar(mi + 1, presentMineCounts.length, `mineCount=${mc}`, bootStart);
}
stopSpinner();
clearLine();
progressBar(presentMineCounts.length, presentMineCounts.length, 'null ready', bootStart);
process.stdout.write('\n');

/** Empirical upper-tail p from the sorted bootstrap null: fraction of replicates ≥ stat. */
function bootstrapP(sorted: Float64Array, stat: number): number {
  // count replicates >= stat
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < stat) lo = mid + 1; else hi = mid; }
  const ge = sorted.length - lo;
  return (ge + 1) / (sorted.length + 1); // add-one smoothing (never exactly 0)
}

const pass2Start = Date.now();
progressBar(0, revealedSeeds.length, 'starting...', pass2Start);
startSpinner();

for (let si = 0; si < revealedSeeds.length; si++) {
  const s = revealedSeeds[si];
  const mineCount = mineCountByHash.get(s.hashedServerSeed) ?? 3;

  const earlyFreq = new Array(GRID).fill(0);   // first-drawn tile, nonces 0..49
  const lateFreq = new Array(GRID).fill(0);    // first-drawn tile, nonces 50..PASS2_NONCES-1
  for (let nonce = 0; nonce < PASS2_NONCES; nonce++) {
    const mines = revealMines(s.serverSeed as string, s.clientSeed, nonce, mineCount);
    if (nonce < PASS2_EARLY) earlyFreq[mines[0] - 1]++;
    else lateFreq[mines[0] - 1]++;
  }

  const earlyChi2 = firstDrawChi2(earlyFreq, PASS2_EARLY).chi2;
  const earlyP = bootstrapP(bootstrapNull.get(mineCount) as Float64Array, earlyChi2);
  // Late window is large (n = PASS2_NONCES-50 = 9,950 first-draws, expected ~398/cell) →
  // analytic chi² is valid there.
  const lateRes = firstDrawChi2(lateFreq, PASS2_NONCES - PASS2_EARLY);
  const lateP = lateRes.pValue;

  const flag = earlyP < 0.05 && lateP >= 0.05;
  if (flag) cherryPickFlags++;
  seedsTested++;

  pass2Results.push({
    epoch: s.epoch, hashedServerSeed: s.hashedServerSeed, mineCount,
    earlyChi2, earlyBootstrapP: earlyP, lateChi2: lateRes.chi2, latePValue: lateP, cherryPickFlag: flag,
  });

  progressBar(si + 1, revealedSeeds.length, `epoch ${s.epoch}`, pass2Start);
}

stopSpinner();
clearLine();
progressBar(revealedSeeds.length, revealedSeeds.length, 'done', pass2Start);
process.stdout.write('\n');

const pass2ElapsedMs = Date.now() - pass2Start;
// Nominal flag model: 0.05 × 0.95 = 0.0475 per seed; not a calibrated combined probability.
const expectedFlags = seedsTested * 0.05 * 0.95;
function binomSurvival(k: number, n: number, p: number): number {
  let cum = 0;
  for (let i = 0; i < k; i++) cum += combination(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  return 1 - cum;
}
const cherryPickSurvival = binomSurvival(cherryPickFlags, seedsTested, 0.0475);

console.log('');
console.log(`  Bootstrap null: ${BOOTSTRAP_REPS.toLocaleString()} reps × ${presentMineCounts.length} mineCounts (n=${PASS2_EARLY} first-draws/rep)`);
console.log(`  Seeds tested: ${seedsTested} × ${PASS2_NONCES.toLocaleString()} nonces (early 0..${PASS2_EARLY - 1}, late ${PASS2_EARLY}..${PASS2_NONCES - 1})`);
console.log(`  Cherry-pick flags: ${cherryPickFlags} (expected ~${expectedFlags.toFixed(1)} by chance; binomial survival P=${cherryPickSurvival.toFixed(4)})`);
console.log(`  Time: ${(pass2ElapsedMs / 1000).toFixed(1)}s\n`);

// ── Write outputs ─────────────────────────────────────────────────────────────

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

const output = {
  audit: 'LIQD Mines',
  generatedAt: new Date().toISOString(),
  algorithm: 'HMAC-SHA256 (key = hex-decoded serverSeed); sequential Fisher-Yates over 25 tiles, cursor = currentMine, range 25→1; first mineCount tiles are the mines in draw order; payout = minesMultiplierExact(mineCount, tilesRevealed) (exact, credited; the displayed multiplier field is floored 2-dp, cosmetic)',
  houseEdge: 0.01,
  // QA-05: the run's master seed and the versioned expansion every throwaway seed came from.
  // Present from 2026-09-10 onward; ABSENT in artifacts produced before that date, which is why
  // tests/steps/simulation.ts classifies both paths as optional-attested rather than required.
  masterSeed: MASTER_SEED,
  seedDerivation: SEED_DERIVATION_VERSION,
  pass1_fresh_seeds: {
    description: "New simulation seeds are expanded from the recorded masterSeed using the versioned derivation in src/rng.ts. Pass 1 evaluates the auditor's implementation. Each row retains its server and client seed inputs. Tests cover first-drawn tile uniformity, pairwise mine co-occurrence, and serial statistics of first-drawn tile values. For each of the 300 tile pairs, the uniform independent-round model gives X ~ Binomial(N,q), q = m(m-1)/(25*24). The test standardizes the count and uses a normal approximation, equivalently a chi-square approximation for Z^2, with Bonferroni adjustment across pairs and configurations. First-draw uniformity uses a chi-square approximation to multinomial counts. These are approximate thresholds. Serial checks use lag-one correlation and a runs test of the first drawn tile. RTP is evaluated at one reveal.",
    configs: N,
    roundsPerConfig: ROUNDS_PER_CONFIG,
    totalRounds: N * ROUNDS_PER_CONFIG,
    executionTimeMs: pass1ElapsedMs,
    bonferroniAlpha: bonAlpha,
    bonferroniZCritical: bonZCrit,
    // First-draw uniformity (scored)
    firstDrawChi2FailsAtAlpha01: firstDrawFailsAtAlpha01,
    firstDrawChi2FailsBonferroni: firstDrawFailsBonferroni,
    // Pairwise co-occurrence joint (scored)
    jointConfigsTested: jointConfigs.length,
    jointFailsAtAlpha01: jointFailsAtAlpha01,
    jointFailsBonferroni: jointFailsBonferroni,
    jointMaxAbsZAcrossConfigs: jointConfigs.reduce((mx, r) => Math.max(mx, r.jointMaxAbsZ ?? 0), 0),
    // First-drawn-tile serial (scored) — not whole-layout coverage (L8)
    layoutSerialFailsUncorrected: layoutSerialFailsUncorrected,
    layoutSerialFailsBonferroni: layoutSerialFailsBonferroni,
    // RTP (informational)
    meanSimulatedRTP: meanSimRTP,
    meanTheoreticalRTP: meanTheoRTP,
    results: pass1Results,
  },
  pass2_casino_seeds: {
    description: "Captured revealed server seeds are evaluated over the declared early and late nonce windows. Each bootstrap replicate is derived from the recorded masterSeed, bootstrapSeedDerivation, and replicate index. Repeating with SIM_MASTER_SEED and the same parameters rebuilds the null and its earlyBootstrapP values. Late-window p-values use a chi-square approximation. This diagnostic evaluates the specified early-window first-draw imbalance. Mitigation against choosing a server seed for a known client input requires a binding server commitment before the operator learns an unpredictable client seed, with those inputs bound to the round. Player control alone does not establish these conditions.",
    noncesPerSeed: PASS2_NONCES,
    earlyWindow: [0, PASS2_EARLY - 1],
    lateWindow: [PASS2_EARLY, PASS2_NONCES - 1],
    bootstrapReps: BOOTSTRAP_REPS,
    bootstrapSeedDerivation: SEED_DERIVATION_VERSION,
    bootstrapMineCounts: presentMineCounts.sort((a, b) => a - b),
    seeds_tested: seedsTested,
    cherryPickFlags,
    expectedFlagsByChance: expectedFlags,
    cherryPickSurvivalP: cherryPickSurvival,
    executionTimeMs: pass2ElapsedMs,
    results: pass2Results,
  },
};

const simulationBytes = Buffer.from(JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(OUTPUTS_DIR, 'simulation-results.json'), simulationBytes);

// Retain the null and provenance so the separate Python implementation can replay this run.
const orderedMineCounts = [...presentMineCounts].sort((a, b) => a - b);
const nullBytes = Buffer.alloc(orderedMineCounts.length * BOOTSTRAP_REPS * 8);
for (const [mi, mc] of orderedMineCounts.entries()) {
  const stats = bootstrapNull.get(mc)!;
  for (let i = 0; i < stats.length; i++) nullBytes.writeDoubleLE(stats[i], (mi * BOOTSTRAP_REPS + i) * 8);
}
fs.writeFileSync(path.join(OUTPUTS_DIR, 'bootstrap-nulls.float64le'), nullBytes);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const provenance = {
  format: 'liqd-mines-simulation-provenance-v1',
  dataset: { file: 'data/mines-master-6900bets.json', sha256: EXPECTED_DATASET_HASH },
  simulation: { file: 'outputs/simulation-results.json', sha256: digest(simulationBytes) },
  pass1: {
    inputSource: 'pass1_fresh_seeds.results[].serverSeed and clientSeed',
    masterSeedScope: true, analysisRecordedAt: output.generatedAt,
    configurations: N, roundsPerConfiguration: ROUNDS_PER_CONFIG,
    replayCommand: 'npm run deep-replay', report: 'outputs/deep-replay-report.json',
  },
  pass2: {
    inputSource: 'captured revealed server seeds plus deterministic bootstrap seed derivation',
    masterSeed: MASTER_SEED, masterSeedScope: 'Both passes in this full simulation run',
    seedDerivation: SEED_DERIVATION_VERSION, inputsRecordedAt: INPUTS_RECORDED_AT,
    bootstrapRepsPerMineCount: BOOTSTRAP_REPS, mineCounts: orderedMineCounts,
    earlyWindow: output.pass2_casino_seeds.earlyWindow, lateWindow: output.pass2_casino_seeds.lateWindow,
    noncesPerSeed: PASS2_NONCES,
    serverDomain: 'pass2-bootstrap-server:m={mineCount}', clientDomain: 'pass2-bootstrap-client:m={mineCount}',
    derivedSeedBytes: 16, replicateIndex: [0, BOOTSTRAP_REPS - 1],
    pValueRule: '(count(null statistic >= observed statistic) + 1) / (bootstrapReps + 1)',
    nullStatistics: orderedMineCounts.length * BOOTSTRAP_REPS,
    nullFile: 'outputs/bootstrap-nulls.float64le', nullSHA256: digest(nullBytes),
    nullFormat: 'Sorted IEEE-754 float64 little-endian, one block per mine count in ascending order',
    replayCommand: 'npm run bootstrap-replay', report: 'outputs/bootstrap-replay-report.json',
    recordingNote: 'Inputs are retained for replay. Repository metadata does not independently authenticate recording time.',
  },
};
fs.writeFileSync(path.join(OUTPUTS_DIR, 'simulation-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');

// ── RTP convergence chart (data embedded; Chart.js loaded from the jsDelivr CDN) ──
// Pooled k=1 RTP across all 24 configs at each sample size, with a ±2·SE band.
// SE = sigma/sqrt(n) (Standard ERROR, not standard deviation) per the audit standard.

const convSamples = CONVERGENCE_SAMPLES;
const convergenceSeries = convSamples.map((n) => {
  // pooled RTP = mean over configs of (winRate_m(n) * multiplier(m,1)); each config
  // contributes equal weight. Variance of a single round's payout for config m is
  // p(1-p)*mult^2; pooled SE uses the mean of per-config variances / (configs * n).
  let sumRTP = 0, sumVar = 0, k = 0;
  for (const r of pass1Results) {
    const cp = r.convergence.find((c) => c.n === n);
    if (!cp) continue;
    const p = cp.wins / n;
    // exact k=1 payout multiplier for this config: theoreticalRTP = winProb × mult
    const winProb = (GRID - r.mineCount) / GRID;
    const m1 = theoreticalRTP(r.mineCount, 1) / winProb;
    sumRTP += p * m1;
    sumVar += p * (1 - p) * m1 * m1;
    k++;
  }
  const meanRTP = k ? sumRTP / k : 0;
  const se = k ? Math.sqrt(sumVar / (k * k * n)) : 0;   // SE of the mean across configs
  return { n, rtp: meanRTP * 100, se: se * 100 };
});

const finalConv = convergenceSeries.length ? convergenceSeries[convergenceSeries.length - 1] : { n: 0, rtp: 0, se: 0 };

const chartHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LIQD Mines — RTP Convergence (${MINE_COUNTS.length} configs × ${ROUNDS_PER_CONFIG.toLocaleString()} rounds)</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; padding: 24px; }
  .container { max-width: 1100px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e0e0e0; padding: 32px; }
  h1 { text-align: center; font-size: 16px; font-weight: 600; color: #333; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; }
  .sub { text-align: center; font-size: 12px; color: #777; margin-bottom: 24px; }
  .chart-wrap { position: relative; height: 420px; }
  .final-box { display: inline-block; border: 2px solid #4caf50; border-radius: 8px; padding: 10px 20px; margin-top: 20px; }
  .final-box .label { font-size: 13px; color: #666; }
  .final-box .value { font-size: 22px; font-weight: 700; color: #2e7d32; }
  .legend { text-align: center; margin-top: 12px; font-size: 13px; color: #666; }
  .legend span { margin: 0 12px; }
  .legend .dot { display: inline-block; width: 12px; height: 3px; vertical-align: middle; margin-right: 4px; }
</style>
</head>
<body>
<div class="container">
  <h1>LIQD Mines — RTP Convergence</h1>
  <div class="sub">Pooled single-tile (k=1) RTP across all ${MINE_COUNTS.length} mineCount configurations · fresh crypto-random seeds per config · band = ±2 &times; Standard Error (&sigma;/&radic;n)</div>
  <div class="chart-wrap"><canvas id="chart"></canvas></div>
  <div class="legend">
    <span><span class="dot" style="background:#1565c0"></span> Pooled simulated RTP</span>
    <span><span class="dot" style="background:rgba(229,115,115,0.5)"></span> &plusmn;2 SE band</span>
    <span><span class="dot" style="background:#e57373"></span> Theoretical 99.0000%</span>
  </div>
  <div style="text-align:right; margin-top:8px;">
    <div class="final-box">
      <span class="label">Final pooled RTP (${ROUNDS_PER_CONFIG.toLocaleString()} rounds/config):</span>
      <span class="value">${finalConv.rtp.toFixed(4)}%</span>
    </div>
  </div>
</div>
<script>
const data = ${JSON.stringify(convergenceSeries.map((d) => ({ x: d.n, y: d.rtp, se: d.se })))};
const theoretical = 99.0;
const labels = data.map(d => d.x >= 1e6 ? (d.x/1e6) + 'M' : (d.x/1e3) + 'K');
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: { labels, datasets: [
    { label: 'Upper', data: data.map(d => d.y + 2*d.se), borderColor: 'transparent', backgroundColor: 'rgba(229,115,115,0.10)', fill: '+1', pointRadius: 0, tension: 0.3 },
    { label: 'Lower', data: data.map(d => d.y - 2*d.se), borderColor: 'transparent', backgroundColor: 'rgba(229,115,115,0.10)', fill: false, pointRadius: 0, tension: 0.3 },
    { label: 'Theoretical (99.0000%)', data: data.map(() => theoretical), borderColor: '#e57373', borderWidth: 2, borderDash: [8,4], fill: false, pointRadius: 0 },
    { label: 'Pooled RTP', data: data.map(d => d.y), borderColor: '#1565c0', borderWidth: 2.5, fill: false, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#1565c0', tension: 0.3 },
  ] },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        title: (items) => labels[items[0].dataIndex] + ' rounds per config',
        label: (item) => item.datasetIndex === 3
          ? 'Pooled RTP: ' + item.parsed.y.toFixed(4) + '% (\u00b12 SE: \u00b1' + (2*data[item.dataIndex].se).toFixed(4) + ')'
          : item.datasetIndex === 2 ? 'Theoretical: 99.0000%' : null,
      } },
    },
    scales: {
      x: { title: { display: true, text: 'Rounds per configuration', font: { size: 12 } } },
      y: { ticks: { callback: v => v.toFixed(2) + '%' } },
    },
  },
});
<\/script>
</body>
</html>`;

fs.writeFileSync(path.join(OUTPUTS_DIR, 'rtp-convergence.html'), chartHTML);

console.log('═'.repeat(60));
console.log('  Written: outputs/simulation-results.json');
console.log('  Written: outputs/rtp-convergence.html');
console.log('═'.repeat(60) + '\n');

export {};
