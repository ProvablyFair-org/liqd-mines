import * as fs from 'fs';
import * as path from 'path';

import {
  GRID, HOUSE_EDGE, PUBLISHED_RTP, EDGE_NUM, EDGE_DEN, MINE_COUNTS,
  winProbability, minesMultiplier, minesMultiplierExact, theoreticalRTP, displayPayoutRTP,
} from './config';
import { revealMines, sameMines, moduloRejectionCensus, expectedModuloRejections } from './rng';
import { falseAlarmAccounting, ENFORCED_ROUNDS_PER_CONFIG } from './false-alarm';
import type { Bet, Seed } from './types';

/** Filename of the derived-figure artifact, in ONE place (both the writer and Step 19 use it). */
export const AUDIT_FIGURES_FILE = 'audit-figures.json';

export interface FiguresInput {
  bets: Bet[];
  seeds: Seed[];
  seedMap: Map<string, string>;
  phaseD: Bet[];
  outputsDir: string;
  datasetSha256: string;
}

/**
 * Derived-figure artifact — outputs/audit-figures.json.
 *
 * G-PRODUCING: every quantitative claim in the report must be EMITTED by a committed pipeline
 * step and copied from its artifact, never typed. `verification-results.json` does not satisfy
 * that on its own: its `detail` fields are hand-authored strings, so a figure interpolated into
 * a step label is only ever as good as the code that wrote the label — a literal typed into a
 * detail string "traces" to itself. (That laundering is exactly why the framework's prose check
 * EXCLUDES verification-results.json from its list of producing artifacts.)
 *
 * This module is the answer: plain NUMBER leaves computed from src/config.ts, the pinned dataset
 * and the simulation artifact, with no prose around them. Every multiplier, RTP, residual and
 * statistic the report quotes should be findable in the output as a number.
 *
 * WHY IT LIVES HERE RATHER THAN INLINE IN tests/verify.ts. The first version wrote this file at
 * the end of the run and never read it back — which made it a write-only artifact that nothing
 * validated, and the framework's forged-artifact gate said so immediately: hand-edit
 * audit-figures.json and the suite still printed 21/21 Full Pass, because no step had any opinion
 * about its contents. It is now computed HERE, called from two places, and **Step 19 re-derives
 * it and compares it to the copy on disk before this run overwrites it** — so an edited artifact
 * hard-fails the next `npm run verify`. Everything in it is a pure function of guarded inputs
 * (src/config.ts, the SHA-256-pinned dataset, outputs/simulation-results.json), which is exactly
 * what makes that comparison meaningful rather than circular.
 *
 * `generatedAt` is deliberately NOT part of this object: it is stamped by the writer and skipped
 * by the comparison, because a timestamp that differs on every run would make the check useless.
 */
export function computeAuditFigures(input: FiguresInput): Record<string, unknown> {
  const { bets, seeds, seedMap, phaseD, outputsDir, datasetSha256 } = input;
const referenceGrid: Array<Record<string, number>> = [];
for (const m of MINE_COUNTS) {
  for (let k = 1; k <= GRID - m; k++) {
    referenceGrid.push({
      mineCount: m,
      tilesRevealed: k,
      winProbability: winProbability(m, k),
      multiplierExact: minesMultiplierExact(m, k),
      multiplierDisplayed: minesMultiplier(m, k),
      theoreticalRTP: theoreticalRTP(m, k),
    });
  }
}

// Settlement floor: the credited amount is floor8(stake × multExact), so the SETTLED RTP is
// strictly below the theoretical (1 − edge). Worst case per stake actually used in the capture,
// in exact BigInt arithmetic. (Same computation as Step 10's emitted clause.)
const stakesUsed = [...new Set(bets.map(b => Number(b.betAmount)))].filter(a => Number.isFinite(a) && a > 0).sort((a, b) => a - b);
const settlementFloor = stakesUsed.map(stake => {
  const stakeUnits = BigInt(Math.round(stake * 1e8));
  let worst = { stake, mineCount: 0, tilesRevealed: 0, deficitOfTurnover: 0, settledRTP: PUBLISHED_RTP };
  for (const m of MINE_COUNTS) {
    for (let k = 1; k <= GRID - m; k++) {
      // H-H: EDGE_NUM/EDGE_DEN, derived from HOUSE_EDGE — this was a third `99n/100n` literal.
      let num = EDGE_NUM, den = EDGE_DEN;
      for (let i = 0; i < k; i++) { num *= BigInt(GRID - i); den *= BigInt(GRID - m - i); }
      const exactUnits = stakeUnits * num;
      const fracUnits = Number(exactUnits - (exactUnits / den) * den) / Number(den);
      const deficit = winProbability(m, k) * (fracUnits / 1e8) / stake;
      if (Number.isFinite(deficit) && deficit > worst.deficitOfTurnover) {
        worst = { stake, mineCount: m, tilesRevealed: k, deficitOfTurnover: deficit, settledRTP: PUBLISHED_RTP - deficit };
      }
    }
  }
  return worst;
});

// Client-seed format, distinctness, and nibble frequencies describe the recorded
// strings. They do not authenticate the generator used at capture time.
// See AUDIT_CONTEXT.md#outcomes-and-client-seeds.
const clientSeeds = seeds.map(s => s.clientSeed);
const auditSeeds = clientSeeds.filter(c => /^audit[0-9a-f]{12}$/.test(c));
const nibbleFreq = new Array(16).fill(0);
for (const c of auditSeeds) for (const ch of c.slice(5)) nibbleFreq[parseInt(ch, 16)]++;
const nibbleN = auditSeeds.length * 12;
const nibbleExp = nibbleN / 16;
const nibbleChi2 = nibbleExp > 0 ? nibbleFreq.reduce((s, o) => s + ((o - nibbleExp) ** 2) / nibbleExp, 0) : 0;

// Live aggregate (variance illustration only — RTP evidence is the theoretical leg + simulation).
// H-E (QA 2026-09-09): these two reductions were bare `s + Number(b.field)`. One row whose
// betAmount is not numeric turned the published `liveRTPPercent` into NaN — silently, because a
// NaN serialises to `null` in JSON and every comparison it reaches is false. The non-finite rows
// are COUNTED and emitted alongside the totals rather than being coerced away: Step 8 hard-fails
// when either count is non-zero, and a reader of this artifact can see that it was zero.
const nonFiniteBetAmounts = bets.filter(b => !Number.isFinite(Number(b.betAmount))).length;
const nonFiniteWinAmounts = bets.filter(b => !Number.isFinite(Number(b.winningAmount))).length;
const wagered = bets.reduce((s, b) => s + (Number.isFinite(Number(b.betAmount)) ? Number(b.betAmount) : 0), 0);
const returned = bets.reduce((s, b) => s + (Number.isFinite(Number(b.winningAmount)) ? Number(b.winningAmount) : 0), 0);
const wins = bets.filter(b => b.result === 'won').length;

// Pass-1 pooled SE of the mean across configs, recomputed here from src/config.ts (the same
// quantity the convergence chart's ±2·SE band uses) plus the committed run's z against it.
let simFigures: Record<string, unknown> | null = null;
// The artifact's own Pass-1 depth, used by the false-alarm accounting to decide which
// convergence checkpoints of the fixed ladder exist. Defaults to the enforced floor when there
// is no artifact to read.
let simRoundsPerConfig = ENFORCED_ROUNDS_PER_CONFIG;
const simPath = path.join(outputsDir, 'simulation-results.json');
if (fs.existsSync(simPath)) {
  const sim = JSON.parse(fs.readFileSync(simPath, 'utf-8'));
  const rows: any[] = sim?.pass1_fresh_seeds?.results ?? [];
  const N = Number(sim?.pass1_fresh_seeds?.roundsPerConfig);
  if (Number.isFinite(N) && N > 0) simRoundsPerConfig = N;
  if (rows.length > 0 && Number.isFinite(N) && N > 0) {
    let sumVar = 0;
    const perConfigZ = rows.map(r => {
      const p = (GRID - r.mineCount) / GRID;
      const mult = minesMultiplierExact(r.mineCount, 1);
      sumVar += p * (1 - p) * mult * mult;
      return { mineCount: r.mineCount, z: (r.simRTP - theoreticalRTP(r.mineCount, 1)) / (mult * Math.sqrt((p * (1 - p)) / N)) };
    });
    const meanSim = rows.reduce((s, r) => s + r.simRTP, 0) / rows.length;
    const pooledSE = Math.sqrt(sumVar / (rows.length * rows.length * N));
    simFigures = {
      configs: rows.length,
      roundsPerConfig: N,
      meanSimulatedRTP: meanSim,
      pooledSEPercentagePoints: pooledSE * 100,
      twoSEBandPercentagePoints: 2 * pooledSE * 100,
      // The convergence chart's final ±2·SE interval, in percent — the interval evidence.md
      // states contains the theoretical 99.0000%. Recomputed the way the CHART computes it,
      // from the observed win rate at the last checkpoint (p̂, not the theoretical p), so this
      // is the same number the chart plots rather than a near-miss recomputation of it.
      ...(() => {
        let sumRTP = 0, sumVar = 0, k = 0;
        for (const r of rows) {
          const cp = (r.convergence ?? []).find((c: any) => c.n === N);
          if (!cp) continue;
          const pHat = cp.wins / N;
          const m1 = theoreticalRTP(r.mineCount, 1) / ((GRID - r.mineCount) / GRID);
          sumRTP += pHat * m1;
          sumVar += pHat * (1 - pHat) * m1 * m1;
          k++;
        }
        if (k === 0) return {};
        const chartMean = sumRTP / k;
        const chartSE = Math.sqrt(sumVar / (k * k * N));
        return {
          chartFinalRTPPercent: chartMean * 100,
          chartFinalSEPercentagePoints: chartSE * 100,
          chartFinalBandLowerPercent: (chartMean - 2 * chartSE) * 100,
          chartFinalBandUpperPercent: (chartMean + 2 * chartSE) * 100,
        };
      })(),
      meanZAgainstTheory: (meanSim - PUBLISHED_RTP) / pooledSE,
      absMeanZAgainstTheory: Math.abs((meanSim - PUBLISHED_RTP) / pooledSE),
      perConfigZ,
      maxAbsPerConfigZ: Math.max(...perConfigZ.map(x => Math.abs(x.z))),
    };
  }
}

  return {
    datasetSha256,
  note: 'Derived scalars emitted so the report cites numbers a pipeline step produced, never numbers a person typed. NUMBER leaves only — no interpreted prose.',
  houseEdge: HOUSE_EDGE,
  referenceGrid,
  referenceGridSummary: {
    cells: referenceGrid.length,
    minTheoreticalRTP: Math.min(...referenceGrid.map(c => c.theoreticalRTP)),
    maxTheoreticalRTP: Math.max(...referenceGrid.map(c => c.theoreticalRTP)),
    cellsOffTarget: referenceGrid.filter(c => Math.abs(c.theoreticalRTP - PUBLISHED_RTP) > 1e-9).length,
    nonFiniteCells: referenceGrid.filter(c => !Number.isFinite(c.theoreticalRTP)).length,
  },
  settlementFloor,
  // Whole-dataset client-seed controls and the captured Phase-D summary.
  clientSeedControls: (() => {
    let tested = 0, emptyRepro = 0, wrongRepro = 0;
    for (const b of bets) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) continue;
      tested++;
      if (sameMines(revealMines(ss, '', b.nonce, b.mineCount), b.mineTiles)) emptyRepro++;
      if (sameMines(revealMines(ss, 'wrong-client-seed-test', b.nonce, b.mineCount), b.mineTiles)) wrongRepro++;
    }
    return {
      tested,
      emptySeedReproduces: emptyRepro,
      emptySeedReproducesPercent: (emptyRepro / tested) * 100,
      wrongSeedReproduces: wrongRepro,
      wrongSeedReproducesPercent: (wrongRepro / tested) * 100,
      changedUnderWrongSeed: tested - wrongRepro,
      changedUnderWrongSeedPercent: ((tested - wrongRepro) / tested) * 100,
    };
  })(),
  // The producing artifact for the "0 of 172,500 draws rejected" sentence that appears in eight
  // chapters. It is the EVIDENCE FOR AN ASSUMPTION'S UNTESTABILITY, not evidence for the
  // assumption: a census of zero against an expectation of ~2e-4 is precisely why this capture
  // cannot witness the maxFair branch, in either direction. Every chapter that mentions the
  // rejection ceiling must say so.
  moduloBiasRejectionCensus: (() => {
    let draws = 0, rejections = 0, roundsScanned = 0;
    for (const b of bets) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) continue;
      const c = moduloRejectionCensus(ss, b.clientSeed, b.nonce);
      draws += c.draws; rejections += c.rejections; roundsScanned++;
    }
    const expected = expectedModuloRejections(roundsScanned);
    return {
      roundsScanned,
      drawsScanned: draws,
      rejectionsObserved: rejections,
      rejectionsExpected: expected,
      // Chance that a capture this size witnesses the branch even once, if the operator does
      // implement it: 1 − e^(−λ). This is the number that makes "unexercised" a measurement.
      probabilityCaptureWitnessesBranch: 1 - Math.exp(-expected),
    };
  })(),
  phaseDTimestampPatternEpochs: (() => {
    // ══════════════════════════════════════════════════════════════════════════════════
    //  QA-06 (2026-09-10) — ALL TEN PHASE-D EPOCHS, 120–129, NOT NINE
    // ══════════════════════════════════════════════════════════════════════════════════
    // This filter read `b.epoch >= 121` until 2026-09-10, on the argument that epoch 120 was the
    // FIRST occurrence of the `pfaudit-<stamp>-<epoch>` pattern and so could not have been
    // predicted from it. That argument does not survive being written down: it grants epoch 120
    // an unpredictability assurance on the strength of its position in a sequence, not on the
    // strength of anything about how its client seed was constructed. Every one of the ten seeds
    // is `pfaudit-1785428583504-<epoch>` — one fixed stamp and the epoch number — and the stamp
    // is recorded 5,250.153 s BEFORE epoch 120's own commitment (`seeds[119].at`). Whether the
    // operator could in fact have derived it is unknown and is NOT claimed either way; what is
    // claimed is only that the CONSTRUCTION does not deny foreknowledge, and that is as true of
    // the first element as of the other nine.
    //
    // The field is named for the construction (`TimestampPattern`) rather than for an operator
    // capability (`PredictableSeed`), because the dataset witnesses the former and cannot witness
    // the latter. Historical bet seeds are NOT edited — only which epochs this group names.
    const sub = phaseD.filter(b => b.epoch >= 120 && b.epoch <= 129);
    // Count non-finite money fields so they cannot silently blank a reported total.
    const fin = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const nonFinite = sub.filter(b => !Number.isFinite(Number(b.betAmount)) || !Number.isFinite(Number(b.winningAmount))).length;
    const staked = sub.reduce((s, b) => s + fin(b.betAmount), 0);
    const credited = sub.reduce((s, b) => s + fin(b.winningAmount), 0);
    return { epochs: new Set(sub.map(b => b.epoch)).size, bets: sub.length, staked, credited, netToPlayer: credited - staked, nonFiniteMoneyRows: nonFinite };
  })(),
  clientSeedProvenance: {
    epochs: clientSeeds.length,
    auditFormatSeeds: auditSeeds.length,
    distinctAuditFormatSeeds: new Set(auditSeeds).size,
    customPhaseDSeeds: clientSeeds.filter(c => /^pfaudit-/.test(c)).length,
    hexNibblesSampled: nibbleN,
    hexNibbleChi2: nibbleChi2,
    hexNibbleDf: 15,
  },
  liveAggregate: {
    bets: bets.length,
    wins,
    losses: bets.length - wins,
    winRate: wins / bets.length,
    wagered,
    returned,
    liveRTP: returned / wagered,
    liveRTPPercent: (returned / wagered) * 100,
    // H-E: rows excluded from the two money totals above because their field is not a finite
    // number. Both must be 0 in a delivered capture; Step 8 hard-fails otherwise.
    nonFiniteBetAmounts,
    nonFiniteWinAmounts,
  },
  // Counterfactual payout from the displayed multiplier. This is an analytical
  // comparison; the captured settlements are checked against the exact multiplier.
  flooredDisplayCounterfactual: (() => {
    const rows = [] as Array<Record<string, number>>;
    let worst = { mineCount: 0, tilesRevealed: 0, edge: 0, lossPerDollar: 0 };
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        const exact = minesMultiplierExact(m, k);
        const disp = minesMultiplier(m, k);
        if (!Number.isFinite(exact) || !Number.isFinite(disp)) continue;
        // QA-03: the counterfactual RTP is an exact rational (`displayPayoutRTP`), not a binary64
        // product of two rounded factors. At m=1,k=10 the float form returned an edge of
        // 1.0000000000000009e-2 for a cell whose exact edge is 1%.
        const edge = 1 - displayPayoutRTP(m, k);           // effective edge if the display were paid
        rows.push({ mineCount: m, tilesRevealed: k, multiplierExact: exact, multiplierDisplayed: disp, lossPerUnitStake: exact - disp, effectiveEdgeIfDisplayPaid: edge, effectiveEdgeIfDisplayPaidPercent: edge * 100 });
        if (edge > worst.edge) worst = { mineCount: m, tilesRevealed: k, edge, lossPerDollar: exact - disp };
      }
    }
    const at010 = rows.map(r => ({ ...r, lossOn010Stake: 0.10 * r.lossPerUnitStake }));
    // The worst edge is attained at SEVERAL cells, not one: the multiplier product telescopes, so
    // (m=1,k=4) and (m=4,k=1) carry the same exact multiplier and the same effective edge. The
    // report's worked example uses (m=4,k=1); every tied cell is recorded here so the two do not
    // read as different figures.
    const tied = rows.filter(r => Math.abs(r.effectiveEdgeIfDisplayPaid - worst.edge) < 1e-12)
      .map(r => ({ mineCount: r.mineCount, tilesRevealed: r.tilesRevealed }));
    return {
      worstMineCount: worst.mineCount,
      worstTilesRevealed: worst.tilesRevealed,
      worstEffectiveEdge: worst.edge,
      worstEffectiveEdgePercent: worst.edge * 100,
      worstLossOn010Stake: 0.10 * worst.lossPerDollar,
      worstCellsTiedAtThisEdge: tied,
      cells: at010,
    };
  })(),
  // ── QA-02b/QA-02c — the false-alarm accounting, EMITTED rather than typed ────────────────
  // Reproducibility quotes this figure for the chance that a clean re-run trips at least one
  // scored threshold. THREE versions have now been withdrawn: "roughly 5%" (never calibrated),
  // "at most ≈6%" (it counted the runs test as ONE arm although Step 16 rejects two DISJOINT
  // p-value regions for it, and it omitted the 5·SE screens), and — on 2026-09-11 — the
  // *language* of "at most ≈7%", because a sum of NOMINAL levels is not an upper bound on
  // anything. See src/false-alarm.ts, which computes the counterexample that proves it.
  //
  // ONE calculation, two readers: this artifact and the Step-16 detail string in
  // outputs/verification-results.json both come from falseAlarmAccounting(). Until 2026-09-11
  // the verifier still emitted a five-arm "≤ 5%" sentence while this file computed eight arms,
  // so the report and its own executable source disagreed.
  falseAlarmAccounting: falseAlarmAccounting(
    Number.isFinite(simRoundsPerConfig) && simRoundsPerConfig > 0 ? simRoundsPerConfig : ENFORCED_ROUNDS_PER_CONFIG),
  simulation: simFigures,
};
}
