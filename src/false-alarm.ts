/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE FALSE-ALARM ACCOUNTING — ONE CALCULATION, READ BY THE REPORT AND BY THE VERIFIER
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS IS. A NOMINAL accounting of the chance that a clean re-run of `npm test` trips at
 * least one scored statistical threshold in Steps 16–17. It enumerates every rejection arm the
 * code actually implements, attaches each arm's nominal level, and sums them.
 *
 * WHAT THIS IS NOT — AND THIS IS THE POINT OF THE FILE.
 *
 *   1. It is NOT a calibrated rate. Nothing in this repository measures the real rate.
 *   2. It is NOT an upper bound, and it must not be described as one. A union bound is valid
 *      under arbitrary dependence, but only if each summand is an actual probability or a valid
 *      upper bound on one. These summands are NOMINAL levels of screens applied to DISCRETE
 *      statistics through CONTINUOUS approximations, and a nominal level of that kind can sit
 *      BELOW the screen's true rejection probability.
 *
 *      That is not a theoretical worry; it is measured, by this module, in `notAnUpperBound`.
 *      A round-5 reviewer executed it on 2026-09-11 and it is reproduced here in exact integer
 *      arithmetic: at the n = 1,000 convergence checkpoint with mineCount = 24, ideal play gives
 *      X ~ Binomial(1000, 1/25); the implemented 5·SE rule rejects exactly when X ≤ 9 or
 *      X ≥ 71; summing those binomial terms exactly gives 3.702523820906331e-6 against the
 *      normal-tail nominal of 5.742100266381556e-7 — 6.448× larger. The nominal does not bound
 *      that screen. Two earlier figures in this package ("roughly 5%", then "at most ≈6%") were
 *      withdrawn for being wrong; the third was withdrawn for being called a bound.
 *
 * WHAT WOULD REPLACE IT. A calibrated combined false-alarm rate needs a retained null-calibration
 * run — many complete Pass-1/Pass-2 executions on a generator known to be fair, with fixed and
 * recorded inputs — reported as a point estimate WITH an uncertainty interval. That has not been
 * done and no number here is offered in its place.
 *
 * WHERE A VALID BOUND IS AVAILABLE, IT IS GIVEN. The 5·SE convergence screens (arm 8) are the
 * one family whose null law is exactly known: each checkpoint count is Binomial(n, p) under a
 * fair generator. `validBounds` carries a genuine distribution-free upper bound for that family
 * (Bernstein), and `notAnUpperBound.perConfig` carries the EXACT probability at n = 1,000. Arms
 * 1–7 have no valid bound in this package, and the total is therefore nominal, full stop.
 *
 * WHY IT IS A MODULE. Until 2026-09-11 the accounting lived twice: `src/figures.ts` computed
 * eight arms while `tests/steps/simulation.ts` interpolated a five-arm "≤ 5%" sentence into the
 * Step-16 detail that is published in `outputs/verification-results.json`. The report and its
 * own executable source disagreed. One export, two readers, no drift.
 */

import { GRID, MINE_COUNTS } from './config';
import { normalTwoSidedP } from './stats';

/** The uncorrected family level src/simulate.ts screens Pass 1 at. */
export const FALSE_ALARM_ALPHA = 0.01;

/** Step 17's single scored arm: cherry-pick survival over the whole seed set. */
export const CHERRY_PICK_ALPHA = 0.01;

/** The 5·SE convergence / RTP-band gate in tests/steps/simulation.ts. */
export const SE_SCREEN_Z = 5;

/** The fixed convergence ladder src/simulate.ts samples (filtered to n ≤ roundsPerConfig). */
export const CONVERGENCE_LADDER = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

/** The enforced Pass-1 floor — the rounds-per-config every shipped artifact must meet. */
export const ENFORCED_ROUNDS_PER_CONFIG = 1_000_000;

/** The checkpoint at which the exact binomial counterexample is computed. */
export const EXACT_CHECKPOINT_N = 1_000;

export interface FalseAlarmArm {
  arm: number;
  name: string;
  screen: string;
  tests: number;
  nominalEach: number;
  nominalTotal: number;
}

/**
 * The EXACT rejection probability of the implemented 5·SE convergence screen at one checkpoint,
 * under the ideal null.
 *
 * The screen is `|wins/n − p| > z·√(p(1−p)/n)` with `p = (GRID − m)/GRID`, evaluated in IEEE
 * doubles exactly as tests/steps/simulation.ts evaluates it — so the rejection SET is found by
 * replaying that same floating-point predicate over every attainable count, not by inverting it
 * algebraically. The probability of that set is then computed in exact integer arithmetic:
 *
 *     P(X = w) = C(n,w) · (GRID−m)^w · m^(n−w) / GRID^n
 *
 * with BigInt numerators and the `GRID^n` denominator, so there is no cancellation and no
 * floating-point tail error. The upper tail is taken as `GRID^n − Σ_{w < wHigh}` rather than as
 * a sum of ~n terms, which is the same integer and far cheaper.
 */
export function exactSeScreenRejection(n: number, mineCount: number, z: number = SE_SCREEN_Z) {
  const p = (GRID - mineCount) / GRID;
  const se = Math.sqrt((p * (1 - p)) / n);
  const threshold = z * se;

  // The rejection set, found by replaying the implemented predicate.
  let rejectAtOrBelow = -1;          // largest w below the mean that rejects
  let rejectAtOrAbove = n + 1;       // smallest w above the mean that rejects
  for (let w = 0; w <= n; w++) {
    if (!(Math.abs(w / n - p) > threshold)) continue;
    if (w / n < p) rejectAtOrBelow = w;
    else if (rejectAtOrAbove === n + 1) rejectAtOrAbove = w;
  }

  const a = BigInt(GRID - mineCount);   // successes weight
  const b = BigInt(mineCount);          // failures weight
  const N = BigInt(n);
  const DEN = BigInt(GRID) ** N;

  // C(n,w)·a^w·b^(n−w), stepped exactly: the binomial recurrence divides without remainder, and
  // b^(n−w) divides by b without remainder.
  let C = 1n;
  let A = 1n;
  let B = b ** N;
  let cumulative = 0n;      // Σ_{w ≤ current} term
  let lowTail = 0n;
  let belowHigh = 0n;       // Σ_{w < rejectAtOrAbove} term
  for (let w = 0; w <= n; w++) {
    if (w > 0) {
      C = (C * BigInt(n - w + 1)) / BigInt(w);
      A = A * a;
      B = B / b;
    }
    cumulative += C * A * B;
    if (w === rejectAtOrBelow) lowTail = cumulative;
    if (w === rejectAtOrAbove - 1) belowHigh = cumulative;
    if (w >= rejectAtOrAbove - 1 && w >= rejectAtOrBelow) break;
  }
  if (rejectAtOrBelow < 0) lowTail = 0n;
  if (rejectAtOrAbove > n) belowHigh = DEN;

  const NUM = lowTail + (DEN - belowHigh);
  const SCALE = 10n ** 60n;
  const exact = Number((NUM * SCALE) / DEN) / 1e60;

  const nominal = normalTwoSidedP(z);
  return {
    n,
    mineCount,
    winProbability: p,
    fiveSeThreshold: threshold,
    rejectAtOrBelow,
    rejectAtOrAbove,
    exactRejectionProbability: exact,
    nominalRejectionProbability: nominal,
    exactOverNominal: exact / nominal,
  };
}

/**
 * A DISTRIBUTION-FREE VALID upper bound on the rejection probability of one 5·SE convergence
 * screen — Bernstein's inequality for a sum of n i.i.d. Bernoulli(p) indicators:
 *
 *     P(|X − np| ≥ t) ≤ 2·exp( − (t²/2) / (np(1−p) + t/3) )
 *
 * evaluated at `t = z·√(np(1−p))`, which is exactly the implemented screen's boundary. Unlike
 * the nominal normal tail this IS an upper bound, at every n, with no appeal to asymptotics — it
 * is simply a much weaker one (≈1.06e-4 at n=1,000/m=24 against an exact 3.70e-6).
 */
export function bernsteinSeScreenBound(n: number, mineCount: number, z: number = SE_SCREEN_Z): number {
  const p = (GRID - mineCount) / GRID;
  const sigma = Math.sqrt(n * p * (1 - p));
  const t = z * sigma;
  return Math.min(1, 2 * Math.exp(-((t * t) / 2) / (sigma * sigma + t / 3)));
}

/**
 * The complete accounting, computed from code constants. `roundsPerConfig` selects which
 * checkpoints of the fixed ladder exist (simulate.ts samples the ladder filtered to n ≤ N).
 */
export function falseAlarmAccounting(roundsPerConfig: number = ENFORCED_ROUNDS_PER_CONFIG) {
  const configs = MINE_COUNTS.length;
  const alpha = FALSE_ALARM_ALPHA;
  const bonAlpha = alpha / configs;
  const jointConfigs = configs - 1;               // m=1 has no tile PAIR to co-occur
  const checkpoints = CONVERGENCE_LADDER.filter(n => n <= roundsPerConfig);
  const seScreenNominalEach = normalTwoSidedP(SE_SCREEN_Z);

  const bonferroniArms: FalseAlarmArm[] = ([
    [1, 'firstDraw-upper', 'firstDrawPValue < α/24', configs],
    [2, 'firstDraw-lower', 'firstDrawPValue > 1 − α/24', configs],
    [3, 'pairwiseJoint-upper', 'jointPValue < α/24 (already Bonferroni-corrected across the 300 within-config pairs)', jointConfigs],
    [4, 'serialLag1-twoSided', '|r₁z| > the α/24 two-sided critical', configs],
    [5, 'serialRuns-upper', 'layoutRunsPValue < α/24', configs],
    [6, 'serialRuns-lower', 'layoutRunsPValue > 1 − α/24', configs],
  ] as [number, string, string, number][]).map(([arm, name, screen, tests]) => ({
    arm, name, screen, tests, nominalEach: bonAlpha, nominalTotal: tests * bonAlpha,
  }));

  const cherryPickArm: FalseAlarmArm = {
    arm: 7,
    name: 'cherryPickSurvival',
    screen: 'cherryPickSurvivalP < 0.01 (Step 17, one arm over the whole seed set)',
    tests: 1,
    nominalEach: CHERRY_PICK_ALPHA,
    nominalTotal: CHERRY_PICK_ALPHA,
  };

  const seScreenArm: FalseAlarmArm = {
    arm: 8,
    name: 'convergence-5SE',
    screen: `|wins/n − p| > ${SE_SCREEN_Z}·√(p(1−p)/n) at each checkpoint of the ladder`,
    tests: configs * checkpoints.length,
    nominalEach: seScreenNominalEach,
    nominalTotal: configs * checkpoints.length * seScreenNominalEach,
  };

  const arms = [...bonferroniArms, cherryPickArm, seScreenArm];
  const bonferroniTests = bonferroniArms.reduce((s, a) => s + a.tests, 0);
  const bonferroniNominal = bonferroniArms.reduce((s, a) => s + a.nominalTotal, 0);
  const totalNominal = arms.reduce((s, a) => s + a.nominalTotal, 0);

  // The counterexample, RECOMPUTED here rather than quoted — every config at the shallowest
  // checkpoint, where the normal approximation to a discrete count is at its worst.
  const perConfig = MINE_COUNTS.map(m => exactSeScreenRejection(EXACT_CHECKPOINT_N, m));
  const exactSum = perConfig.reduce((s, r) => s + r.exactRejectionProbability, 0);
  const nominalSum = perConfig.length * seScreenNominalEach;
  // `>=` so a tie resolves to the LAST config. m=1 and m=24 are exact mirrors of one another
  // (Binomial(n, 24/25) is the reflection of Binomial(n, 1/25)), and m=24 is the case the
  // round-5 reviewer executed, so the detail string quotes the one that was independently run.
  const worst = perConfig.reduce((w, r) => (r.exactOverNominal >= w.exactOverNominal ? r : w), perConfig[0]);

  // A valid (Bernstein) union bound for arm 8 only — the one family with a known null law.
  const arm8ValidUnionUpperBound = MINE_COUNTS.reduce(
    (s, m) => s + checkpoints.reduce((t, n) => t + bernsteinSeScreenBound(n, m), 0), 0);

  return {
    status: 'NOMINAL ACCOUNTING under the stated approximations — NOT an upper bound and NOT a calibrated rate',
    alpha,
    bonferroniAlpha: bonAlpha,
    roundsPerConfig,
    convergenceCheckpoints: checkpoints,
    arms,
    bonferroniTests,
    bonferroniNominal,
    cherryPickNominal: cherryPickArm.nominalTotal,
    seScreenZ: SE_SCREEN_Z,
    seScreenNominalEach,
    seScreenTests: seScreenArm.tests,
    seScreenNominal: seScreenArm.nominalTotal,
    totalNominal,
    totalNominalPercent: totalNominal * 100,

    // Why the total is not labelled a bound. Executed, not asserted.
    notAnUpperBound: {
      what: 'the nominal normal-tail level of the 5·SE screen is BELOW its exact binomial rejection probability, so the nominal levels summed above are not upper bounds on the screens they describe',
      checkpointN: EXACT_CHECKPOINT_N,
      method: 'exact integer arithmetic over C(n,w)·(25−m)^w·m^(n−w) / 25^n, rejection set replayed from the implemented floating-point predicate',
      exactSumAtCheckpoint: exactSum,
      nominalSumAtCheckpoint: nominalSum,
      exactOverNominalAtCheckpoint: exactSum / nominalSum,
      worstConfig: worst,
      perConfig,
    },

    // Where a mathematically valid bound IS available, it is given — and it covers arm 8 alone.
    validBounds: {
      method: "Bernstein's inequality for a sum of n i.i.d. Bernoulli(p) indicators, evaluated at the implemented 5·SE boundary",
      coversArms: [8],
      arm8UnionUpperBound: arm8ValidUnionUpperBound,
      arm8NominalForComparison: seScreenArm.nominalTotal,
      note: 'arms 1–7 (chi-square, pairwise-joint, serial lag-1, runs, cherry-pick survival) have no valid upper bound in this package, so the TOTAL above stays nominal',
      totalWithArm8BoundedValidly: bonferroniNominal + cherryPickArm.nominalTotal + arm8ValidUnionUpperBound,
    },

    // Withdrawn figures, emitted so each correction reads as a difference rather than an assertion.
  };
}

export type FalseAlarmAccounting = ReturnType<typeof falseAlarmAccounting>;
