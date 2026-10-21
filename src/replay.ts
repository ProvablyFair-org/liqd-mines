/**
 * REPLAY ENGINE — the experiment of record regenerated from the inputs it recorded.
 *
 * Two jobs, both run inside `npm run verify` by the worker pool in src/replay-pool.ts:
 *
 *   PASS 1 (MINES-20). One row of outputs/simulation-results.json replayed from the seed pair it
 *   records, over nonces 0 … roundsPerConfig − 1, with EXACTLY the expressions src/simulate.ts uses
 *   for that row (first-draw histogram and χ², pair co-occurrence max|z| with its within-config
 *   Bonferroni p and worst pair, lag-1 and runs statistics of the first-drawn tile values, k = 1 RTP,
 *   convergence counts). Step 16 compares every field with the row: integers and strings exactly,
 *   reals at the reproduction tolerance (src/diff.ts).
 *
 *   SERVED CONFIGS (MINES-21). One revealed epoch replayed over 10,000 nonces playing, at nonce n,
 *   the configuration the casino actually served at nonce n mod 50 (its mine count and the tiles the
 *   capture requested). Returns the 200 window returns and the early window's win bits, from which
 *   Step 17 computes the served-config cherry-pick statistic.
 *
 * WHY A PREFIX OF THE SHUFFLE. revealMines runs the whole 25-position Fisher-Yates and returns the
 * first m positions. Iteration c only swaps positions c and r ≥ c, so positions 0 … m−1 are final once
 * iteration m−1 has run: the first m draws decide the mine set and the other 25 − m draws cannot
 * touch it. `minesPrefix` runs those m draws with the adapter's own draw function
 * (generateProvablyFairNumber) and nothing else — about half the HMACs of the full shuffle, which is
 * what lets 24,000,000 rounds replay inside a verify run. It is not trusted on that argument: every
 * job ALSO computes revealMines(...).slice(0, m) for its first PREFIX_SELF_CHECK_ROUNDS rounds and
 * reports each disagreement, and a single one fails the step that scheduled the job.
 */

import { generateProvablyFairNumber, revealMines } from './rng';
import { GRID, theoreticalRTP, pairCoOccurProb, minesMultiplierExact } from './config';
import { chiSquaredTest, chiSquaredPValue, lag1Autocorrelation, runsTest } from './stats';

/** Same convergence ladder src/simulate.ts samples. */
export const CONVERGENCE_SAMPLES = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];
/** Tile the k=1 strategy opens, verbatim from src/simulate.ts. */
export const FIXED_TILE = 1;
/** Rounds per job on which the prefix shuffle is compared with the adapter's full revealMines. */
export const PREFIX_SELF_CHECK_ROUNDS = 1_000;

/** The first m tiles of the Fisher-Yates in draw order — revealMines(...).slice(0, m). */
export function minesPrefix(serverSeed: string, clientSeed: string, nonce: number, m: number): number[] {
  const tiles = Array.from({ length: GRID }, (_, i) => i + 1);
  for (let c = 0; c < m; c++) {
    const r = c + generateProvablyFairNumber(serverSeed, clientSeed, nonce, c, GRID - c);
    const t = tiles[c]; tiles[c] = tiles[r]; tiles[r] = t;
  }
  return tiles.slice(0, m);
}

function samePrefix(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface Pass1Job { kind: 'p1'; mineCount: number; serverSeed: string; clientSeed: string; rounds: number }
export interface Pass1Replay {
  kind: 'p1';
  mineCount: number;
  firstDrawChi2: number; firstDrawDf: number; firstDrawPValue: number;
  jointMaxAbsZ: number | null; jointPValue: number | null; jointPairs: number | null; jointWorstPair: string | null;
  convergence: Array<{ n: number; wins: number }>;
  layoutR1: number; layoutR1Z: number; layoutRunsZ: number; layoutRunsPValue: number;
  theoreticalRTP: number; simRTP: number;
  prefixChecked: number; prefixMismatches: number;
}

/** One Pass-1 row, replayed exactly as src/simulate.ts generates it. */
export function replayPass1(job: Pass1Job): Pass1Replay {
  const { mineCount, serverSeed, clientSeed, rounds } = job;
  const samples = CONVERGENCE_SAMPLES.filter(n => n <= rounds);
  const firstDrawFreq = new Array(GRID).fill(0);
  const firstDrawSeq = new Uint8Array(rounds);
  const pairCounts = mineCount >= 2 ? new Float64Array((GRID * (GRID - 1)) / 2) : null;
  let wins = 0, nextSample = 0, prefixChecked = 0, prefixMismatches = 0;
  const convergence: Array<{ n: number; wins: number }> = [];

  for (let nonce = 0; nonce < rounds; nonce++) {
    const mines = minesPrefix(serverSeed, clientSeed, nonce, mineCount);
    if (nonce < PREFIX_SELF_CHECK_ROUNDS) {
      prefixChecked++;
      if (!samePrefix(mines, revealMines(serverSeed, clientSeed, nonce, mineCount))) prefixMismatches++;
    }
    const first = mines[0];
    firstDrawFreq[first - 1]++;
    firstDrawSeq[nonce] = first;
    let fixedIsMine = false;
    for (const t of mines) if (t === FIXED_TILE) { fixedIsMine = true; break; }
    if (!fixedIsMine) wins++;
    if (nextSample < samples.length && nonce + 1 === samples[nextSample]) {
      convergence.push({ n: nonce + 1, wins });
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

  const fd = chiSquaredTest([...firstDrawFreq], new Array(GRID).fill(rounds / GRID));
  let jointMaxAbsZ: number | null = null, jointPValue: number | null = null, jointPairs: number | null = null;
  let jointWorstPair: string | null = null;
  if (pairCounts) {
    const q = pairCoOccurProb(mineCount);
    const expPair = rounds * q;
    const sdPair = Math.sqrt(rounds * q * (1 - q));
    let maxAbsZ = 0, worstIdx = -1;
    for (let k = 0; k < pairCounts.length; k++) {
      const z = (pairCounts[k] - expPair) / sdPair;
      if (Math.abs(z) > maxAbsZ) { maxAbsZ = Math.abs(z); worstIdx = k; }
    }
    jointPairs = pairCounts.length;
    jointPValue = Math.min(1, jointPairs * chiSquaredPValue(maxAbsZ * maxAbsZ, 1));
    jointMaxAbsZ = maxAbsZ;
    if (worstIdx >= 0) {
      let idx = 0, wi = 0, wj = 1;
      outer: for (let i = 0; i < GRID; i++) for (let j = i + 1; j < GRID; j++) { if (idx === worstIdx) { wi = i; wj = j; break outer; } idx++; }
      jointWorstPair = `${wi + 1}-${wj + 1}`;
    }
  }
  const seq = Array.from(firstDrawSeq) as number[];
  const layoutR1 = lag1Autocorrelation(seq);
  const layoutR1Z = layoutR1 * Math.sqrt(rounds);
  const { z: layoutRunsZ, pValue: layoutRunsPValue } = runsTest(seq.map(v => (v > 13 ? 1 : 0)));
  const theoRTP = theoreticalRTP(mineCount, 1);
  const simRTP = (wins / rounds) * (theoRTP / ((GRID - mineCount) / GRID));

  return {
    kind: 'p1', mineCount,
    firstDrawChi2: fd.chi2, firstDrawDf: fd.df, firstDrawPValue: fd.pValue,
    jointMaxAbsZ, jointPValue, jointPairs, jointWorstPair,
    convergence,
    layoutR1, layoutR1Z, layoutRunsZ, layoutRunsPValue,
    theoreticalRTP: theoRTP, simRTP,
    prefixChecked, prefixMismatches,
  };
}

/** A configuration the casino served: its mine count and the tiles the capture asked to open, in order. */
export interface ServedConfig { m: number; plan: number[] }
export interface ServedJob {
  kind: 'served'; epoch: number; serverSeed: string; clientSeed: string;
  configs: ServedConfig[]; nonces: number;
}
export interface ServedReplay {
  kind: 'served'; epoch: number;
  /** Σ return (multiplier paid per unit staked) of each window of configs.length nonces, in nonce order. */
  windowReturns: number[];
  /** 1 if the early-window round at nonce i is a win, else 0 — i = 0 … configs.length − 1. */
  earlyWins: number[];
  prefixChecked: number; prefixMismatches: number;
}

/**
 * One revealed epoch over `nonces` nonces. Nonce n plays configs[n mod W] (W = configs.length):
 * the round wins when none of the planned tiles is a mine, and returns minesMultiplierExact(m, k)
 * with k = plan length; a loss returns 0.
 */
export function replayServedEpoch(job: ServedJob): ServedReplay {
  const W = job.configs.length;
  const windows = Math.floor(job.nonces / W);
  const windowReturns = new Array<number>(windows).fill(0);
  const earlyWins: number[] = [];
  const mults = job.configs.map(c => minesMultiplierExact(c.m, c.plan.length));
  let prefixChecked = 0, prefixMismatches = 0;
  for (let nonce = 0; nonce < windows * W; nonce++) {
    const cfg = job.configs[nonce % W];
    const mines = minesPrefix(job.serverSeed, job.clientSeed, nonce, cfg.m);
    if (nonce < PREFIX_SELF_CHECK_ROUNDS) {
      prefixChecked++;
      if (!samePrefix(mines, revealMines(job.serverSeed, job.clientSeed, nonce, cfg.m))) prefixMismatches++;
    }
    let win = true;
    for (const t of cfg.plan) if (mines.includes(t)) { win = false; break; }
    windowReturns[Math.floor(nonce / W)] += win ? mults[nonce % W] : 0;
    if (nonce < W) earlyWins.push(win ? 1 : 0);
  }
  return { kind: 'served', epoch: job.epoch, windowReturns, earlyWins, prefixChecked, prefixMismatches };
}
