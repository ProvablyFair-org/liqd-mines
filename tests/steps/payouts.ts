/**
 * Steps 7–10: Payout Verification
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { minesMultiplierRational, minesMultiplier, minesMultiplierExact, theoreticalRTP, winProbability, MINE_COUNTS, GRID, HOUSE_EDGE, PUBLISHED_RTP, EDGE_NUM, EDGE_DEN, edgeRationalIsExact, MAX_ODDS_DECLARED } from '../../src/config';
import { chiSquaredPValue } from '../../src/stats';

/**
 * Pre-registered significance level for the live-sample fit (MINES-22). The fit is informational:
 * a p-value below this FLAGs, it never fails. Fixed here, before the statistic is read.
 */
const LIVE_FIT_ALPHA = 1e-3;
import {
  EXPECTED_BETS, EXPECTED_SEEDS, EXPECTED_EPOCH_SIZE, SUPPLEMENT_GAME_SETTINGS, SUPPLEMENT_CAPTURE_DATE,
  SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW, SUPPLEMENT_HISTORY_GAME_SETTINGS, SUPPLEMENT_HISTORY_CAPTURE_DATE,
  SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW, SUPPLEMENT_HISTORY_WINS,
} from '../../src/pins';
import { computeRtpClaim, RTP_CLAIM, RTP_CLAIM_PAGE_RANGE } from '../../src/rtp-settings';

/**
 * Exact floor8 credit in integer 1e-8 units, via BigInt RATIONAL arithmetic (0 tolerance).
 * floor8(stake × multExact) where multExact = (1 − HOUSE_EDGE)·Π_{i=0}^{k-1} (25-i)/(25-m-i).
 * Because it is exact integer division (floor), an equality test against the credited
 * winningAmount catches BOTH under- and over-credit at the 1e-8 resolution — which a ±2e-8
 * residual band does not (a uniform ±1e-8 shift sits inside that band). Returns null for an
 * impossible depth (k>25−m) so the caller flags it instead of dividing by zero.
 *
 * The retention factor is EDGE_NUM/EDGE_DEN, derived from HOUSE_EDGE in src/config.ts, and not
 * a local `let num = 99n, den = 100n` — a BigInt literal has no textual relationship to the
 * audited edge, and duplicating it decouples this arm from the constant it is meant to test.
 * Mutating HOUSE_EDGE to 0.02 against such a literal leaves this arm reporting 0 violations
 * while the residual arm beside it counts thousands: the tightest test in the suite would be
 * measuring a number the audit had stopped using.
 */
function floor8CreditUnits(betAmount: number, mineCount: number, k: number): bigint | null {
  if (k < 1 || k > GRID - mineCount) return null;
  const stakeUnits = BigInt(Math.round(betAmount * 1e8));
  let num = EDGE_NUM, den = EDGE_DEN;
  for (let i = 0; i < k; i++) { num *= BigInt(GRID - i); den *= BigInt(GRID - mineCount - i); }
  return (stakeUnits * num) / den;   // integer division = floor8(stake × multExact) in 1e-8 units
}

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seeds, phaseA } = ctx;
  // G-BIND: the expected total is EXPECTED_BETS from src/pins.ts — a CODE constant — not
  // `seeds.length × 50`. Both operands of that product come out of the dataset being scored, so
  // a coherent shrink (drop an epoch, drop its seed, fix the header, re-pin) moves the
  // expectation with the evidence and the coverage guard never notices. A row count derived
  // from the rows is not a population guard.
  const expectedBets = EXPECTED_BETS;
  // Kept as a reported cross-check: the pinned plan must also equal seeds × epoch size, so a
  // disagreement between the plan and the shipped seed set is visible rather than silent.
  const planConsistent = EXPECTED_SEEDS * EXPECTED_EPOCH_SIZE === EXPECTED_BETS;

  // ── Step 7: Displayed multiplier field ────────────────────────────────────────
  // SCOPE (2026-09-26): Steps 7 and 8 score the AUDITED dataset only — `bets` is
  // data/mines-master-6900bets.json, bound to EXPECTED_BETS. The v3 multi-reveal supplement is
  // scored by Step 22 (tests/steps/supplement.ts) against the same two rules; on its 2026-09-26
  // capture (dated history since 2026-10-03) the served display and credit sat one cent / one 1e-8
  // unit below them at two cells (MANIFEST DL-14, DL-15), on the scored 2026-10-03 capture at none.
  // The `multiplier` field liqd returns for the fairness panel is the DISPLAY value —
  // still floored to 2 decimals: minesMultiplier(m,k) == floor2(exact). It is no longer
  // the value used to compute the payout (see Step 8); it now UNDERSTATES the credited
  // amount (player-favourable, cosmetic). We confirm the field equals the floored value.
  // For LOST bets there is no payout: `multiplier` is omitted and winningAmount == 0.
  // NON-FINITE REFERENCE GUARD (applied at every site the reference formula gates a
  // scored step — Steps 7, 8, 10 here and Step 15 in phase-e.ts). `Math.abs(NaN − x) > eps` is
  // FALSE, so a NaN coming out of OUR OWN minesMultiplier/minesMultiplierExact/theoreticalRTP
  // silently scores as agreement. That is not a fairness question about the operator — it means
  // the auditor's reference is corrupt and every comparison downstream is vacuous, so it is
  // counted separately and hard-FAILS rather than joining the ordinary mismatch tally.
  let wonChecked = 0, wonErrors = 0, lostChecked = 0, lostErrors = 0, displayBelowPaid = 0;
  let s7NonFiniteRef = 0;
  for (const b of bets) {
    if (b.result === 'won') {
      wonChecked++;
      const display = minesMultiplier(b.mineCount, b.openTiles.length);      // floored
      const exact = minesMultiplierExact(b.mineCount, b.openTiles.length);   // credited
      if (!Number.isFinite(display) || !Number.isFinite(exact)) { s7NonFiniteRef++; continue; }
      if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(display - b.multiplier) > 1e-9) wonErrors++;
      if (b.multiplier !== undefined && b.multiplier + 1e-9 < exact) displayBelowPaid++;
    } else {
      lostChecked++;
      if ((b.multiplier ?? 0) !== 0 || Number(b.winningAmount) !== 0) lostErrors++;
    }
  }
  // Coverage guard: the checked count must equal the DERIVED expected total (seeds × 50),
  // not bets.length — s7Covered = wonChecked + lostChecked equals bets.length by construction,
  // so comparing to bets.length is tautological. A short/altered dataset (fewer bets than
  // seeds×50) must FAIL, not vacuously pass on `errors === 0`.
  const s7Covered = wonChecked + lostChecked;
  const s7 = step(7, 'Displayed Multiplier Field (floored, cosmetic)',
    wonErrors === 0 && lostErrors === 0 && s7NonFiniteRef === 0 && s7Covered === expectedBets ? 'PASS' : 'FAIL',
    `SCOPE: the audited dataset (data/mines-master-6900bets.json) only — the v3 multi-reveal supplement's displayed multipliers are Step 22, against the same rule; `
      + `${s7Covered}/${expectedBets} bets checked; ${wonChecked} wins: displayed multiplier == floor2(exact) at 1e-9 (${wonErrors} mismatches); `
      + `${displayBelowPaid} wins where the displayed field is below the exact reference multiplier; reported settlement amounts are checked separately in Step 8; `
      + `${lostChecked} losses: no payout — multiplier 0/absent and winningAmount == 0 (${lostErrors} violations); `
      + `reference-formula integrity: ${s7NonFiniteRef} wins where minesMultiplier/minesMultiplierExact returned a non-finite value (a NaN/Infinity in the auditor's own reference makes every comparison here vacuous — hard fail, not a mismatch)`,
  );

  // ── Step 8: Payout math (uses the EXACT multiplier that is CREDITED) + label check ─
  // Wins: betAmount × minesMultiplierExact(m,k) == winningAmount (2e-8). The credited
  // amount is the FULL-PRECISION multiplier, NOT the floored display field — a prior
  // capture (July) paid the floored amount (~98.78% RTP); liqd now pays exact. Losses: 0.
  // (betAmount is mixed-typed — number on wins, decimal string on losses — coerce with Number().)
  // Win-condition consistency: a 'won' round must open NO mine tile; a 'lost' round must
  // open at least one. Without this, a mislabelled result would still pass the payout math
  // (the layout recomputes and the credit is "consistent with the label"). Folded into
  // Step 8 rather than a new step (no new scored step).
  // Tolerance: liqd floors the CREDITED amount at the 8th decimal, so a legitimate win
  // sits at most 1e-8 below betAmount × exact. The gate is 2e-8 — just above that floor,
  // and 50× tighter than the old 1e-6 (which was ~116× coarser than the largest residual
  // it was cited as establishing). The credit-floor residuals themselves are measured and
  // emitted below, so the report's residual figures have a producing artifact.
  const S8_TOL = 2e-8;
  let payErrors = 0, paidExact = 0, paidFloored = 0, labelViolations = 0, s8Covered = 0;
  let maxResidual = 0, flooredBelowExact = 0, totalShortfall = 0, totalStaked = 0;
  let floor8Violations = 0, offGridCredits = 0, s8NonFiniteRef = 0;
  let nonFiniteStakes = 0, nonFiniteCredits = 0, firstNonFiniteMoney = '';
  let firstOffGrid = '';
  for (const b of bets) {
    s8Covered++;
    // MONEY IS SUMMED ONLY AFTER IT IS PROVEN TO BE A NUMBER.
    // Written as `totalStaked += Number(b.betAmount)` with no finiteness test, and with the loss
    // branch below guarding only `winAmt`, one loss row carrying `betAmount: "not-a-number"`
    // poisons the running total: the suite prints `$NaN wagered` in the Live RTP
    // line and still exits as a pass (measured: Conditional Pass 20/21, exit 0). Every
    // comparison a NaN reaches is FALSE, so an unguarded accumulator does not merely print
    // badly — it removes the arithmetic that was supposed to be the check.
    const stakeNum = Number(b.betAmount);
    const winAmtNum = Number(b.winningAmount);
    if (!Number.isFinite(stakeNum)) {
      nonFiniteStakes++;
      if (!firstNonFiniteMoney) firstNonFiniteMoney = `bet ${b.id}: betAmount ${JSON.stringify(b.betAmount)}`;
    } else {
      totalStaked += stakeNum;
    }
    if (!Number.isFinite(winAmtNum)) {
      nonFiniteCredits++;
      if (!firstNonFiniteMoney) firstNonFiniteMoney = `bet ${b.id}: winningAmount ${JSON.stringify(b.winningAmount)}`;
    }
    const winAmt = winAmtNum;
    const mineSet = new Set<number>(b.mineTiles);
    const openedMine = b.openTiles.some((t: number) => mineSet.has(t));
    if (b.result === 'won') {
      if (openedMine) labelViolations++;              // won yet opened a mine
      const exact = minesMultiplierExact(b.mineCount, b.openTiles.length);
      const bet = Number(b.betAmount);
      // A non-finite reference multiplier makes `Math.abs(residual) > TOL` false, so the
      // bet would score as an EXACT payout. The auditor's own formula being corrupt hard-fails.
      if (!Number.isFinite(exact)) { s8NonFiniteRef++; continue; }
      const residual = bet * exact - winAmt;          // > 0 ⇒ credited below the exact value
      // ON-GRID CHECK, BEFORE any rounding. The floor8 identity below multiplies by 1e8
      // and ROUNDS, so a credit carrying a NINTH decimal (one part in ten of a ledger unit)
      // rounds onto the grid and passes. USDC is credited in 1e-8 units; a value with a ninth
      // decimal is not a quantity the ledger can hold, and it is checked here on its own terms.
      // Compared as a scaled integer with a tolerance far tighter than one 1e-8 unit but loose
      // enough for double-precision representation of the decimal literal (a 1e-9 offset shows
      // up as 0.1 grid units — 100,000× the 1e-6 gate).
      if (Number.isFinite(winAmt)) {
        const units = winAmt * 1e8;
        if (Math.abs(units - Math.round(units)) > 1e-6) {
          offGridCredits++;
          if (!firstOffGrid) firstOffGrid = `bet ${b.id}: winningAmount ${b.winningAmount} is ${(units).toFixed(6)} units of 1e-8`;
        }
      }
      // Exact-floor8 identity (0 tolerance, rational): winningAmount in 1e-8 units must EQUAL
      // floor8(stake × multExact). Unlike the ±2e-8 band below, this rejects a uniform ±1e-8
      // under/over-credit. Only meaningful for a finite credit at a legal depth.
      if (Number.isFinite(winAmt) && Number.isFinite(bet)) {
        const credUnits = floor8CreditUnits(bet, b.mineCount, b.openTiles.length);
        if (credUnits === null || BigInt(Math.round(winAmt * 1e8)) !== credUnits) floor8Violations++;
      }
      if (!Number.isFinite(winAmt) || !Number.isFinite(bet)) {
        // Non-numeric credit/stake: the `Math.abs(residual) > TOL` test is NaN-blind (NaN > x
        // is false), so a non-finite value would silently score as an exact payout. Fail it.
        payErrors++;
      } else if (Math.abs(residual) > S8_TOL) {
        // fall back: is it the OLD floored-payout behaviour? (should not occur post-fix)
        if (Math.abs(bet * minesMultiplier(b.mineCount, b.openTiles.length) - winAmt) <= 1e-6) paidFloored++;
        else payErrors++;
      } else {
        paidExact++;
        if (Math.abs(residual) > maxResidual) maxResidual = Math.abs(residual);
        if (residual > 1e-12) { flooredBelowExact++; totalShortfall += residual; }
      }
    } else {
      if (!openedMine) labelViolations++;             // lost yet opened no mine
      // A loss pays EXACTLY zero. A gate of `Math.abs(winAmt) > 1e-6` is 100 ledger units wide:
      // a loss credited one single 1e-8 unit — a real credit, on the grid — sits inside it, and
      // Step 8 scores PASS while the verdict flips through Step 7. That case is
      // tests/forgeries.ts D06, which asserts WHICH step must fire, not just the verdict.
      // There is no rounding to accommodate here: zero is representable exactly.
      if (!Number.isFinite(winAmt) || winAmt !== 0) payErrors++;
    }
  }
  // Coverage guard: s8Covered (incremented once per bet) must equal the DERIVED expected
  // total (seeds × 50), not bets.length — comparing to bets.length is tautological. A short
  // dataset scores fewer than seeds×50 and must FAIL.
  const s8FullCoverage = s8Covered === expectedBets;
  // A floor8 violation (over- or under-credit at the 1e-8 unit) is a real payout fault, not a
  // benign rounding artifact — it hard-fails, exactly like a payErrors/label violation.
  // A floored credit, an off-grid credit and a non-finite reference are all HARD failures; only
  // `paidFloored` alone (which cannot co-occur with a clean floor8 tally) could ever be a FLAG.
  // A non-finite stake or credit anywhere in the dataset, and a turnover total that did not
  // come out finite, are hard failures on their own terms — not a printing problem. The report
  // quotes `$X staked` and a shortfall ratio computed from it; if that denominator is not a
  // number, every figure downstream of it is vacuous rather than wrong.
  const moneyFinite = nonFiniteStakes === 0 && nonFiniteCredits === 0
    && Number.isFinite(totalStaked) && totalStaked > 0 && Number.isFinite(totalShortfall);
  const s8Hard = payErrors > 0 || labelViolations > 0 || floor8Violations > 0
    || offGridCredits > 0 || s8NonFiniteRef > 0 || !s8FullCoverage
    || !moneyFinite || !planConsistent;
  const s8 = step(8, 'Payout Math + Win-Condition (wins: betAmount × EXACT multiplier == winningAmount; losses: 0; label ⇔ mine opened)',
    !s8Hard && paidFloored === 0 ? 'PASS' : (s8Hard ? 'FAIL' : 'FLAG'),
    `SCOPE: the audited dataset (data/mines-master-6900bets.json) only — the v3 multi-reveal supplement's credits are Step 22, against the same rule; `
      + `${s8Covered}/${expectedBets} bets at 2e-8 (expected total pinned in src/pins.ts EXPECTED_BETS, a code constant — not seeds×50 read from the dataset${planConsistent ? '' : `; PLAN INCONSISTENT: ${EXPECTED_SEEDS}×${EXPECTED_EPOCH_SIZE} != ${EXPECTED_BETS}`}) (credit floored at the 8th decimal): ${paidExact} wins matching the exact-multiplier settlement within the stated residual tolerance, `
      + `${paidFloored} wins matching only the displayed-multiplier payout candidate, ${payErrors} errors; `
      + `exact floor8 identity (winningAmount == floor8(stake × multExact) in BigInt rational arithmetic, 0 tolerance — rejects ±1e-8 over/under-credit): ${floor8Violations} violations; `
      + `on-grid check applied BEFORE any rounding (winningAmount × 1e8 must already be an integer — a ninth decimal cannot be held in a 1e-8 ledger and must not be rounded onto the grid by the identity above): ${offGridCredits} off-grid credits${firstOffGrid ? ` (first: ${firstOffGrid})` : ''}; `
      + `reference-formula integrity: ${s8NonFiniteRef} wins where minesMultiplierExact returned a non-finite value (hard fail — the auditor's reference is corrupt, not the operator's payout); `
      + `money-field integrity: ${nonFiniteStakes} bets whose betAmount is not a finite number, ${nonFiniteCredits} whose winningAmount is not${firstNonFiniteMoney ? ` (first: ${firstNonFiniteMoney})` : ''} — hard fail, because a NaN entering the turnover total makes every ratio computed from it vacuous rather than wrong; `
      + `credit-floor residuals: max ${maxResidual.toExponential(3)}, ${flooredBelowExact} wins below the unrounded value, `
      + `total shortfall $${totalShortfall.toExponential(3)} on $${Number.isFinite(totalStaked) ? totalStaked.toFixed(2) : 'NOT-FINITE'} staked (${moneyFinite ? (totalShortfall / totalStaked).toExponential(1) : 'n/a — turnover not finite'} of turnover); `
      + `win-condition consistency (won ⇔ no mine opened): ${labelViolations} label violations. `
      + `SEVERITY OF A SHORT CREDIT: here a win credited one 1e-8 unit below floor8(stake × exact) is a floor8 violation and HARD-FAILS this step (MINES-11 HARD_FAIL as written; forgery D26); this dataset has ${floor8Violations} such wins. `
      + `The scored ${SUPPLEMENT_CAPTURE_DATE} supplement gives a short credit the same severity: its declared gap is ${SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW}, so one FAILs Step 22. `
      + `OPEN RULING 2 (profile owner: is a win credited 1e-8 short a FAIL or a FLAG?) now bears only on how the dated history is classed — the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture's ${SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW} short credits in ${SUPPLEMENT_HISTORY_WINS} wins, held at a Step 22 FLAG from 2026-10-01 to 2026-10-03 (Step 22 arm k, MANIFEST DL-14) — not on this step's status or the verdict`,
  );

  // ── Step 9: Config completeness (Phase A: 24 mineCounts × 200) ────────────────
  const PHASE_A_PER_MC = 200;
  const expectedPhaseA = MINE_COUNTS.length * PHASE_A_PER_MC;
  const perMineCount = new Map<number, number>();
  for (const b of phaseA) perMineCount.set(b.mineCount, (perMineCount.get(b.mineCount) ?? 0) + 1);
  const missing = MINE_COUNTS.filter(m => !perMineCount.has(m));
  const wrongCount = MINE_COUNTS.filter(m => (perMineCount.get(m) ?? 0) !== PHASE_A_PER_MC);
  // Coverage guard: the total Phase-A count must equal 24 × 200, not merely "no missing".
  const s9CoverageOk = phaseA.length === expectedPhaseA;

  // ── Step 9, live-sample fit arm (MINES-22) ─────────────────────────────────────────────
  // Two goodness-of-fit statistics on the CAPTURED rounds, against pure combinatorics:
  //   (a) the first-drawn mine position (mineTiles[0], draw order) over all bets, against the
  //       uniform lattice on 25 tiles — chi-squared on 24 df;
  //   (b) the win count in every (mineCount, planned reveals) group, against the binomial with
  //       p = winProbability(m, reveals) = C(25−m,k)/C(25,k) — the sum of squared binomial
  //       z-scores, chi-squared on (number of groups) df.
  // Either p-value below the pre-registered LIVE_FIT_ALPHA is reported as INFO — MINES-22 is policy
  // INFORMATIONAL (2026-09-29): never a FLAG, never counted, verdict unchanged. The config half
  // (MINES-15) and the fit's own population still FLAG. Live data is a variance illustration, never
  // RTP evidence; the RTP evidence is Steps 8, 10 and 16.
  const firstCounts = new Array<number>(GRID + 1).fill(0);
  let firstN = 0;
  for (const b of ctx.bets) {
    const t = b.mineTiles[0];
    if (Number.isInteger(t) && t >= 1 && t <= GRID) { firstCounts[t]++; firstN++; }
  }
  const eFirst = firstN / GRID;
  let chiFirst = 0;
  for (let t = 1; t <= GRID; t++) chiFirst += (firstCounts[t] - eFirst) ** 2 / eFirst;
  const pFirst = firstN > 0 ? chiSquaredPValue(chiFirst, GRID - 1) : NaN;
  const groups = new Map<string, { m: number; k: number; n: number; w: number }>();
  for (const b of ctx.bets) {
    const key = `${b.mineCount}|${b.reveals}`;
    const g = groups.get(key) ?? { m: b.mineCount, k: b.reveals, n: 0, w: 0 };
    g.n++; if (b.result === 'won') g.w++;
    groups.set(key, g);
  }
  let chiWin = 0, maxAbsZ = 0, worstGroup = '', degenerate = 0;
  for (const g of groups.values()) {
    const p = winProbability(g.m, g.k);
    const v = g.n * p * (1 - p);
    if (!(v > 0)) { degenerate++; continue; }
    const z = (g.w - g.n * p) / Math.sqrt(v);
    chiWin += z * z;
    if (Math.abs(z) > maxAbsZ) { maxAbsZ = Math.abs(z); worstGroup = `m=${g.m},k=${g.k} (${g.w}/${g.n} vs ${(g.n * p).toFixed(1)} expected)`; }
  }
  const dfWin = groups.size - degenerate;
  const pWin = dfWin > 0 ? chiSquaredPValue(chiWin, dfWin) : NaN;
  const liveFitPopOk = firstN === expectedBets && Number.isFinite(pFirst) && Number.isFinite(pWin);
  const liveFitStatOk = pFirst >= LIVE_FIT_ALPHA && pWin >= LIVE_FIT_ALPHA;
  const s9 = step(9, 'Config Completeness (Phase A: 24 mineCounts × 200)',
    !(missing.length === 0 && wrongCount.length === 0 && s9CoverageOk && liveFitPopOk) ? 'FLAG'
      : liveFitStatOk ? 'PASS' : 'INFO',
    `Phase A: ${perMineCount.size}/${MINE_COUNTS.length} mineCounts present, each with ${PHASE_A_PER_MC} bets (${phaseA.length}/${expectedPhaseA} total)`
      + (missing.length > 0 ? `; missing: ${missing.slice(0, 5).join(', ')}` : '')
      + (wrongCount.length > 0 ? `; wrong count: ${wrongCount.slice(0, 5).map(m => `${m}=${perMineCount.get(m)}`).join(', ')}` : '')
      + `. Live-sample fit (informational; pre-registered deviation level p < ${LIVE_FIT_ALPHA}, reported as INFO, never counted): first-drawn mine position over ${firstN}/${expectedBets} captured layouts vs the uniform 25-tile lattice, chi² ${chiFirst.toFixed(3)} on ${GRID - 1} df, p = ${pFirst.toFixed(4)}; `
      + `win counts in ${groups.size} (mineCount, planned reveals) groups vs the binomial at winProbability(m,k), Σz² ${chiWin.toFixed(3)} on ${dfWin} df, p = ${pWin.toFixed(4)}, largest |z| ${maxAbsZ.toFixed(3)} at ${worstGroup || 'n/a'}. A variance illustration of the live sample, not RTP evidence.`,
  );

  // ── Step 10: House edge / RTP (closed-form identity, per-config, anti-circular) ─
  // CLOSED-FORM IDENTITY — the THEORETICAL leg, NOT a re-derivation from live data.
  // theoreticalRTP(m,k) = winProbability(m,k) × minesMultiplierExact(m,k); the combinatorial
  // winProbability and the exact multiplier's fair factor are reciprocals, so this equals
  // (1 − edge) = 99.00% for every (m,k) BY CONSTRUCTION — it cannot, alone, detect a live
  // regression. The EMPIRICAL proof that liqd credits the exact multiplier (vs the ~98.78%
  // floored payout of a prior capture) is Step 8 (winningAmount). We exercise k=1 for all m
  // AND the Phase-E depths (m=3, k=2..5) so k>1 is checked too.
  const rtpCases: Array<[number, number]> = [];
  for (const m of MINE_COUNTS) rtpCases.push([m, 1]);
  for (let k = 2; k <= 5; k++) rtpCases.push([3, k]);
  let minRTP = Infinity, maxRTP = -Infinity, sumRTP = 0;
  let caseNonFinite = 0;
  for (const [m, k] of rtpCases) {
    const rtp = theoreticalRTP(m, k);
    // Min/max comparisons SKIP a NaN (both `<` and `>` are false), and the flat99 test
    // below is a pair of `>=`/`<=` that a NaN also slips through. Count it explicitly.
    if (!Number.isFinite(rtp)) { caseNonFinite++; continue; }
    if (rtp < minRTP) minRTP = rtp;
    if (rtp > maxRTP) maxRTP = rtp;
    sumRTP += rtp;
  }
  const meanRTP = sumRTP / rtpCases.length;
  // PASS if every (m,k) sits at a clean 99.00% (1 − houseEdge), within fp tolerance.
  // With every case non-finite, minRTP stays +Infinity and maxRTP stays −Infinity, and
  // both bounds below are vacuously satisfied. Require finiteness and full case coverage first.
  const flat99 = caseNonFinite === 0 && Number.isFinite(minRTP) && Number.isFinite(maxRTP)
    && minRTP >= PUBLISHED_RTP - 1e-9 && maxRTP <= PUBLISHED_RTP + 1e-9;
  // Coverage guard: N cases is derived (all mineCounts at k=1 + the Phase-E k=2..5 depths),
  // never a canned constant — a step that scored 0 cases must not pass vacuously.
  const expectedCases = MINE_COUNTS.length + 4;
  const coverageOk = rtpCases.length === expectedCases;

  // FULL-GRID reference sweep: evaluate the closed-form identity at ALL 300 legal (m,k) cells
  // (m=1..24, k=1..25−m), not only the 28 live-witnessed depths above. This asserts the
  // AUDITOR'S REFERENCE FORMULA is a clean (1−edge) at every reachable depth, so a corrupted
  // reference multiplier at a cell no captured bet ever won (e.g. a 70% cell) is caught here.
  // NOTE: this is a property of the reference formula, NOT evidence about the operator — 275 of
  // the 300 cells have no live payout (only 25/300 are data-witnessed, via Step 8). Deeper live
  // coverage is deferred to a future capture (recommendation A1).
  //
  // NON-FINITE IS A DIFFERENT FAULT CLASS FROM "OFF 99%". `Math.abs(NaN − 0.99) > 1e-9`
  // is FALSE, so unguarded, a NaN out of the auditor's own minesMultiplierExact counts as
  // an ON-target cell and the step prints "300/300 clean" with the verdict still Full Pass —
  // executed as `minesMultiplierExact(4,2) → NaN`. The min/max accumulators
  // skip NaN for the same reason. A cell whose reference RTP is 70% is a formula DEVIATION and
  // FLAGs (Conditional Pass); a cell whose reference RTP is not a number means the reference
  // itself is corrupt and every other comparison in this suite that uses it is vacuous — that
  // hard-FAILS.
  let allCells = 0, allCellsOff = 0, allCellsNonFinite = 0, allMin = Infinity, allMax = -Infinity;
  let firstNonFinite = '';
  for (const m of MINE_COUNTS) {
    for (let k = 1; k <= GRID - m; k++) {
      const rtp = theoreticalRTP(m, k);
      allCells++;
      if (!Number.isFinite(rtp)) {
        allCellsNonFinite++;
        if (!firstNonFinite) firstNonFinite = `m=${m},k=${k} → ${rtp}`;
        continue;
      }
      if (rtp < allMin) allMin = rtp;
      if (rtp > allMax) allMax = rtp;
      if (Math.abs(rtp - PUBLISHED_RTP) > 1e-9) allCellsOff++;
    }
  }
  const EXPECTED_ALL_CELLS = 300;
  const allCellsOk = allCells === EXPECTED_ALL_CELLS && allCellsOff === 0 && allCellsNonFinite === 0;

  // SETTLEMENT-FLOOR RTP DEFICIT (emitted so the report's "99.0000% to four decimals" sentence
  // has a producing artifact — G-PRODUCING). The theoretical identity above is exact; the
  // CREDITED amount is floor8(stake × multExact), so the settled RTP is strictly below
  // (1 − edge) by the expected discarded fraction of a 1e-8 unit:
  //     deficit(m,k,stake) = P(win) × frac(stakeUnits × num / den) / (stake × 1e8)
  // computed in BigInt so the fraction is exact. Worst case over all 300 cells at the smallest
  // stake the capture actually used.
  //
  // THE STAKE COMES FROM THE BETS, NOT FROM THE HEADER.
  // Reading `ctx.meta.phases[*].amount` takes an unvalidated field out of the evidence file.
  // Setting those five amounts to 1000 and re-pinning produces a PASSING Step 10 printing "at the
  // capture's smallest stake ($1000.00, read from meta.phases)" — a sentence quoted verbatim in
  // the former report chapters (now MANIFEST.md). The settled-RTP deficit
  // scales with 1/stake, so a doctored header does not merely mislabel the figure, it shrinks it.
  // src/figures.ts was already computing the same quantity from `bets[].betAmount`; the two paths
  // disagreeing is itself a finding, so they are compared rather than one being deleted.
  const betStakes = [...new Set(bets.map(b => Number(b.betAmount)))]
    .filter(a => Number.isFinite(a) && a > 0).sort((a, z) => a - z);
  const headerStakes = Object.values((ctx.meta?.phases ?? {}) as Record<string, { amount?: number }>)
    .map(p => Number(p?.amount)).filter(a => Number.isFinite(a) && a > 0);
  const headerMinStake = headerStakes.length > 0 ? Math.min(...headerStakes) : 0;
  const minStake = betStakes.length > 0 ? betStakes[0] : 0;
  // The header is a CLAIM about the capture; the bets are the capture. They must agree, and a
  // disagreement hard-fails: a meta block describing stakes the bets do not contain means the
  // file's header and its records are describing two different captures (G-BIND).
  const stakeSourcesAgree = minStake > 0 && Math.abs(headerMinStake - minStake) < 1e-12;
  let floorDeficit = 0, floorWorst = '';
  if (minStake > 0) {
    const stakeUnits = BigInt(Math.round(minStake * 1e8));
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        let num = EDGE_NUM, den = EDGE_DEN;
        for (let i = 0; i < k; i++) { num *= BigInt(GRID - i); den *= BigInt(GRID - m - i); }
        const exactUnits = stakeUnits * num;
        const creditedUnits = exactUnits / den;                       // floor8, exact
        const fracUnits = Number(exactUnits - creditedUnits * den) / Number(den);
        const deficit = winProbability(m, k) * (fracUnits / 1e8) / minStake;
        if (Number.isFinite(deficit) && deficit > floorDeficit) {
          floorDeficit = deficit;
          floorWorst = `m=${m},k=${k}`;
        }
      }
    }
  }
  // Any non-finite value anywhere in the reference sweep, the case list, or the per-bet
  // comparisons above is a corrupt-reference hard fail.
  // The BigInt retention factor must exactly represent HOUSE_EDGE. If it does not, the
  // floor8 identity in Step 8 is silently testing a different edge from the one under audit —
  // the same fault class as a NaN in the reference formula, and scored the same way. Checked
  // here rather than thrown at import, so it surfaces as a scored step rather than as a run
  // that never happened.
  const edgeRationalOk = edgeRationalIsExact();
  const referenceCorrupt = allCellsNonFinite > 0 || caseNonFinite > 0 || !edgeRationalOk;
  // A header/bets stake disagreement is a dataset-integrity fault, in the same class as a
  // corrupt reference — the step's settlement-floor figure would be computed for a capture that
  // did not happen. It hard-fails rather than flagging.
  const stakeSourceFault = !stakeSourcesAgree;
  // The summary clause is INTERPOLATED from meanRTP and GATED on flat99, so it can
  // never contradict the numbers it sits next to. Under a mutated house edge the clause
  // reports the actual (deviating) RTP instead of a hardcoded "clean 99.0000%".
  const edgePct = ((1 - meanRTP) * 100).toFixed(2);
  const isFlat = (maxRTP - minRTP) <= 1e-9;
  const rtpClause = flat99
    ? `a clean ${(meanRTP * 100).toFixed(4)}% for every (m,k) (closed-form edge exactly ${edgePct}%), because the exact multiplier makes the CLOSED FORM identically (1 − edge) — the settlement floor can reduce the return, quantified next. `
    : isFlat
      ? `a flat ${(meanRTP * 100).toFixed(4)}% for every (m,k) (effective edge ${edgePct}%) — uniform, but NOT the audited 99.0000% (1 − edge). `
      : `NOT flat: RTP varies across (m,k) — range ${(minRTP * 100).toFixed(4)}%–${(maxRTP * 100).toFixed(4)}%, mean ${(meanRTP * 100).toFixed(4)}% (effective edge ${edgePct}%); the closed-form (1 − edge) identity does not hold at 99.0000% under this config. `;
  // ── Step 10, monotonicity arm (MINES-14, FLAG policy) and the cap half (DISCLOSED, NOT SCORED) ──
  // (a) SCORED. The multiplier must be STRICTLY increasing in depth k for every fixed m, and in mine
  //     count m for every fixed k, across the whole legal grid — compared as exact rationals
  //     (minesMultiplierRational, BigInt cross-multiplication), so a tie cannot hide in a float.
  //     The 300-cell RTP sweep above would pass a non-monotone ladder whose cells all sat at 99%.
  // (b) NOT SCORED SINCE 2026-10-15 — the cap half of MINES-14 (MANIFEST DL-7). Two decisions of
  //     that date settle it. The profile owner ruled that payout caps are excluded from the audit
  //     (as on Duel: "Max win cap enforcement — not embedded in game logic") and multiplier caps
  //     stay in scope. LIQD stated, relayed the same morning, that Mines has had no multiplier cap
  //     since the end of August 2026 (the 10,000× setting removed from the configuration), and that
  //     what remains is a per-round payout limit: the round ends and pays the full multiplier for
  //     the tiles already revealed. So there is no multiplier cap to score on the scored build (its
  //     2026-10-03 settings records carry no maxOdds — src/pins.ts SUPPLEMENT_GAME_SETTINGS, bound
  //     to the data by Step 22), and the round payout limit (maxExposure 50000, exposureSource
  //     "global") is a payout cap, excluded. The figures below are still COMPUTED and printed as
  //     disclosure — the July build's maxOdds 10000 on the audited dataset's records, the quoted
  //     multipliers against it, the later builds' settings — and none of them moves the status.
  //
  // FLAG REASONS are printed as fixed codes at the end of the detail, so a mutation that targets one
  // arm can assert THAT arm fired (tests/mutations.ts expectDetail).
  let monoPairs = 0, monoViolations = 0, firstMonoViolation = '';
  const rat = (m: number, k: number) => minesMultiplierRational(m, k);
  const lessThan = (a: { num: bigint; den: bigint }, b: { num: bigint; den: bigint }) => a.num * b.den < b.num * a.den;
  for (const m of MINE_COUNTS) {
    for (let k = 1; k < GRID - m; k++) {
      const a = rat(m, k), b = rat(m, k + 1);
      monoPairs++;
      if (!a || !b || !lessThan(a, b)) { monoViolations++; if (!firstMonoViolation) firstMonoViolation = `depth: m=${m}, k=${k}→${k + 1}`; }
    }
  }
  for (let k = 1; k <= GRID - 2; k++) {
    for (let m = 1; m + 1 <= GRID - k; m++) {
      const a = rat(m, k), b = rat(m + 1, k);
      monoPairs++;
      if (!a || !b || !lessThan(a, b)) { monoViolations++; if (!firstMonoViolation) firstMonoViolation = `mine count: k=${k}, m=${m}→${m + 1}`; }
    }
  }
  const EXPECTED_MONO_PAIRS = 276 + 276;   // 300 − 24 depth steps, and the same count in m
  const monotoneOk = monoViolations === 0 && monoPairs === EXPECTED_MONO_PAIRS;
  let quotedChecked = 0, quotedAboveCap = 0, maxQuoted = 0;
  const settingsCaps = new Set<number>();
  const auditedSettingsKeys = new Set<string>();
  let settingsRecords = 0;
  for (const b of bets) {
    const raw = (b as unknown as { currentGameSettings?: unknown }).currentGameSettings;
    if (raw != null) {
      settingsRecords++;
      try {
        const gs = typeof raw === 'string' ? JSON.parse(raw) : raw;
        settingsCaps.add(Number((gs as { maxOdds?: unknown }).maxOdds));
        for (const k of Object.keys(gs as object)) auditedSettingsKeys.add(k);
      } catch { settingsCaps.add(NaN); }
    }
    if (b.result !== 'won') continue;
    const served = Number(b.multiplier);
    const credited = Number(b.winningAmount) / Number(b.betAmount);
    for (const q of [served, credited]) {
      quotedChecked++;
      if (!Number.isFinite(q) || q > MAX_ODDS_DECLARED) quotedAboveCap++;
      else if (q > maxQuoted) maxQuoted = q;
    }
  }
  const capsAgree = settingsRecords > 0 && settingsCaps.size === 1 && settingsCaps.has(MAX_ODDS_DECLARED);
  // The supplement build's settings (declared in src/pins.ts, bound to the data by Step 22).
  let suppMaxOdds: unknown;
  try { suppMaxOdds = (JSON.parse(SUPPLEMENT_GAME_SETTINGS.value) as { maxOdds?: unknown }).maxOdds; } catch { suppMaxOdds = NaN; }
  const suppCapAgree = SUPPLEMENT_GAME_SETTINGS.records > 0 && Number(suppMaxOdds) === MAX_ODDS_DECLARED;
  // Keys today's supplement build serves that the audited build's records do not — printed, not scored.
  let suppExtra: Array<[string, unknown]> = [];
  try { suppExtra = Object.entries(JSON.parse(SUPPLEMENT_GAME_SETTINGS.value) as Record<string, unknown>).filter(([k]) => !auditedSettingsKeys.has(k)); } catch { suppExtra = []; }
  // The dated history's settings (2026-09-26, bound by Step 22 arm k) — printed, not scored.
  let histMaxOdds: unknown;
  try { histMaxOdds = (JSON.parse(SUPPLEMENT_HISTORY_GAME_SETTINGS.value) as { maxOdds?: unknown }).maxOdds; } catch { histMaxOdds = NaN; }
  let refAboveCap = 0;
  for (const m of MINE_COUNTS) for (let k = 1; k <= GRID - m; k++) if (minesMultiplierExact(m, k) > MAX_ODDS_DECLARED) refAboveCap++;
  const quotedOk = quotedAboveCap === 0 && quotedChecked > 0;
  const monoDetail = ` Monotonicity (FLAG policy, scored): the exact multiplier is strictly increasing in depth and in mine count over ${monoPairs}/${EXPECTED_MONO_PAIRS} adjacent legal cell pairs (exact rational comparison) — ${monoViolations} violations${firstMonoViolation ? ` (first: ${firstMonoViolation})` : ''}. `
    + `Caps (MINES-14 cap half, MANIFEST DL-7) — DISCLOSED, NOT SCORED since 2026-10-15: payout caps are excluded from the audit and multiplier caps stay in scope (profile owner, 2026-10-15); LIQD states that Mines has had no multiplier cap since the end of August 2026 (the 10,000× setting removed from the configuration) and that a per-round payout limit ends the round and pays the full multiplier for the tiles already revealed (operator statement, 2026-10-15, quoted in MANIFEST DL-7). `
    + `Scored build: the ${SUPPLEMENT_CAPTURE_DATE} supplement's ${SUPPLEMENT_GAME_SETTINGS.records} settles carry ${SUPPLEMENT_GAME_SETTINGS.value} (src/pins.ts SUPPLEMENT_GAME_SETTINGS, bound to the data by Step 22), ${suppMaxOdds === undefined ? 'no maxOdds key — no multiplier cap, as stated' : `maxOdds ${JSON.stringify(suppMaxOdds)}`}; `
    + `keys those records carry that the audited build's do not: ${suppExtra.map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ') || 'none'} — maxExposure is the round payout limit LIQD describes, excluded (payout-limit enforcement is not tested; no captured round reached it). `
    + `History, printed and not scored: the audited dataset (captured 2026-07-30) — ${[...settingsCaps].join(', ') || 'none'} on ${settingsRecords} settles (the July build's maxOdds, src/config.ts MAX_ODDS_DECLARED ${MAX_ODDS_DECLARED}×: ${capsAgree ? 'agree' : 'DISAGREE'}); every multiplier the operator quoted in it lies within that July setting: ${quotedChecked - quotedAboveCap}/${quotedChecked} (served field and credited ratio on every win; largest ${maxQuoted}×; ${quotedOk ? 'within' : 'NOT within'}); `
    + `the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture's ${SUPPLEMENT_HISTORY_GAME_SETTINGS.records} settles carried ${SUPPLEMENT_HISTORY_GAME_SETTINGS.value}, ${histMaxOdds === undefined ? 'no maxOdds key either' : `maxOdds ${JSON.stringify(histMaxOdds)}`} (bound to its records by Step 22 (k)); `
    + `the reference formula exceeds the July 10,000× setting at ${refAboveCap} of the 300 legal cells, none reached by a captured bet; the live page read 2026-10-01 advertises a 5,148,297× top payout (evidence/rtp-page-labels-2026-10-01.json), the uncapped exact multiplier at m=12, k=13. `
    + `Cap figures as computed (not scored): quoted within the July setting ${quotedOk ? 'yes' : 'no'}, audited settings single-valued at it ${capsAgree ? 'yes' : 'no'}, scored build carries it ${suppCapAgree ? 'yes' : 'no'}.`;

  // ── Step 10, RTP claim — OPEN RULING 1 (computed and printed, never scored here) ──────────
  // The held claim is RTP_CLAIM (flat 99%), scored by the RTP-CLAIM gate in tests/verify.ts. The
  // page's other statement is run through the same rule so its outcome is a measurement, not prose.
  let rulingOne = '';
  try {
    const alt = computeRtpClaim(RTP_CLAIM_PAGE_RANGE);
    const rc = alt.rangeChecks.map(c => `${c.id === 'published-min-vs-true-min' ? 'published min' : 'published max'} ${c.publishedPct}% vs true ${c.truePct}% (${c.gapPp} pp, ${c.outcome})`).join('; ');
    rulingOne = ` RTP claim — OPEN RULING 1 (profile owner: which statement on LIQD's page is LIQD held to?): the held claim is the page's flat ${RTP_CLAIM.kind === 'flat' ? `${(Number(RTP_CLAIM.rtp) * 100).toFixed(2)}%` : RTP_CLAIM.kind} ("99% RTP at every setting"; scored by the RTP-CLAIM gate printed after the steps). `
      + `The same page states a realised edge "between 0.64% and 1.44%" (RTP ${(Number((RTP_CLAIM_PAGE_RANGE as { min: string }).min) * 100).toFixed(2)}%–${(Number((RTP_CLAIM_PAGE_RANGE as { max: string }).max) * 100).toFixed(2)}%); run through the same rule (${alt.rule} ${alt.ruleVersion.split(' ')[0]}, band ${alt.bandPp} pp) as a range claim it would ${alt.outcome}: ${rc}. Printed for the ruling, not scored.`;
  } catch (e: any) {
    rulingOne = ` RTP claim — OPEN RULING 1: the page's range statement could not be evaluated (${e?.message ?? e}).`;
  }

  const flagReasons: string[] = [];
  if (!flat99) flagReasons.push('RTP-NOT-FLAT');
  if (!coverageOk) flagReasons.push('CASE-COVERAGE');
  if (!allCellsOk) flagReasons.push('GRID-OFF');
  if (!monotoneOk) flagReasons.push('NON-MONOTONE');
  // Cap half not scored (2026-10-15): payout caps excluded, no multiplier cap on the scored build.
  const s10Fail = referenceCorrupt || stakeSourceFault;

  const s10 = step(10, 'House Edge / RTP Audit (closed-form identity, per-config, anti-circular)',
    s10Fail ? 'FAIL' : (flagReasons.length === 0 ? 'PASS' : 'FLAG'),
    `Closed-form identity theoreticalRTP(m,k) = winProbability(m,k) × minesMultiplierExact(m,k) (winProbability = pure C(25-m,k)/C(25,k) combinatorics), checked for m=1..24 at k=1 and Phase-E depths (m=3, k=1..5) — ${rtpCases.length}/${expectedCases} cases: `
      + `RTP range ${(minRTP * 100).toFixed(4)}%–${(maxRTP * 100).toFixed(4)}%, mean ${(meanRTP * 100).toFixed(4)}% — ${rtpClause}`
      + `Full-grid reference sweep: all ${allCells}/${EXPECTED_ALL_CELLS} legal (m,k) cells (k=1..25−m) evaluate to 99.0000% within 1e-9 (${allCellsOff} off), range ${(allMin * 100).toFixed(4)}%–${(allMax * 100).toFixed(4)}% — this checks the reference formula at every reachable depth, NOT the operator (25/300 cells are live-witnessed via Step 8; 275 formula-only; additional settlement coverage is planned for production). `
      + `Settlement floor: the identity above is the THEORETICAL leg; the amount actually credited is floor8(stake × multExact), so settled RTP is at most (1 − edge), with equality when no fractional settlement unit is discarded. Worst case over all ${EXPECTED_ALL_CELLS} cells at the capture's smallest stake ($${minStake.toFixed(2)}, DERIVED from the ${betStakes.length} distinct betAmount values in the pinned bets — ${betStakes.map(s => `$${s.toFixed(2)}`).join(', ')} — not read from meta.phases; the header's own smallest amount is $${headerMinStake.toFixed(2)} and the two ${stakeSourcesAgree ? 'agree' : 'DISAGREE — hard fail: the dataset header describes stakes its bets do not contain'}): ${floorWorst || 'n/a'} loses ${floorDeficit.toExponential(3)} of turnover → settled RTP ${((1 - HOUSE_EDGE - floorDeficit) * 100).toFixed(7)}%, i.e. ${((1 - HOUSE_EDGE) * 100).toFixed(4)}% to four decimals. `
      + `Edge-rational integrity: EDGE_NUM/EDGE_DEN = ${Number(EDGE_NUM)}/${Number(EDGE_DEN)} ${edgeRationalOk ? 'exactly represents' : 'DOES NOT represent'} (1 − HOUSE_EDGE) = ${1 - HOUSE_EDGE} — the BigInt factor the floor8 credit identity in Step 8 divides by. A factor that only approximates the audited edge makes that identity measure a different edge, silently. `
      + `Reference-formula integrity: ${allCellsNonFinite + caseNonFinite} cells returned a non-finite value${firstNonFinite ? ` (first: ${firstNonFinite})` : ''} — a NaN/Infinity here is NOT an "off 99%" deviation (which FLAGs); it means the auditor's own reference is corrupt and every comparison built on it is vacuous, so it hard-FAILS. `
      + `This is the uncapped reference calculation; Step 8 independently checks the recorded winningAmount at captured winning configurations. The displayed multiplier field is still floored — cosmetic (Step 7).`
      + monoDetail
      + rulingOne
      + ` FLAG REASONS: ${s10Fail ? 'n/a (hard fail)' : (flagReasons.join(', ') || 'none')}.`,
  );

  return [s7, s8, s9, s10];
}
