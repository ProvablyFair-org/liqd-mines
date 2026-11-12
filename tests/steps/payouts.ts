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
  EXPECTED_BETS, EXPECTED_SEEDS, EPOCH_PLAN, PROD_DEPTHS, PROD_PER_SETTING, PHASE_D_PER_SETTING, TOPUP_MINE_COUNTS,
  TOPUP_PER_MINE_COUNT, PHASE_C_SETTING, PHASE_C_ROUNDS, SETTINGS_PLAN, PLAYED_CELLS, PROD_GAME_SETTINGS,
  PROD_CAPTURES, PROD_WALLET_CURRENCY, PROD_WALLET_BELOW_EXACT, PROD_WALLET_BELOW_EXACT_TOTAL_UNITS,
  PROD_HOST, PROD_ON_GRID_TOLERANCE, PROD_AUTO_FINISH_ROUNDS, BOOKED_BELOW_UNROUNDED,
} from '../../src/pins';
import { decimalUnits } from '../../src/prod-capture';
import { computeRtpClaim, RTP_CLAIM, RTP_CLAIM_PAGE_RANGE } from '../../src/rtp-settings';

/**
 * THE BOOKED-AMOUNT RULE (measured on the three production captures): LIQD books a win's `winningAmount`
 * in the fiat the round was staked in (CAD in capture 1, USD in captures 2 and 3) as
 * floor2(betAmount × exact multiplier) — the exact rational
 * product floored to cents. Computed here in BigInt RATIONAL arithmetic (0 tolerance), in integer
 * cents: floor(stakeCents × num / den) with mult = num/den = EDGE_NUM/EDGE_DEN · Π (25−i)/(25−m−i).
 * Because it is exact integer division (floor), an equality test against the recorded amount
 * catches BOTH under- and over-statement at the cent. Returns null for an impossible depth
 * (k > 25 − m) or a stake that is not a whole number of cents, so the caller fails it instead of
 * dividing by zero or rounding a stake onto the grid.
 *
 * The retention factor is EDGE_NUM/EDGE_DEN, derived from HOUSE_EDGE in src/config.ts, and not a
 * local `99n/100n` — a BigInt literal has no textual relationship to the audited edge, and
 * duplicating it decouples this arm from the constant it is meant to test.
 *
 * The USDT wallet field of the reply is a different amount under a different rule
 * (floor8(betAmountWallet × floor8(mult))), carried only in the raw capture: Step 22.
 */
export const FIAT_SCALE = 100n;          // cents
function floor2BookedCents(betAmount: number, mineCount: number, k: number): bigint | null {
  if (k < 1 || k > GRID - mineCount) return null;
  const c = betAmount * 100;
  if (!Number.isFinite(c) || Math.abs(c - Math.round(c)) > PROD_ON_GRID_TOLERANCE) return null;
  const stakeCents = BigInt(Math.round(c));
  let num = EDGE_NUM, den = EDGE_DEN;
  for (let i = 0; i < k; i++) { num *= BigInt(GRID - i); den *= BigInt(GRID - mineCount - i); }
  return (stakeCents * num) / den;   // integer division = floor2(stake × multExact) in cents
}

export function run(ctx: VerifyContext): StepResult[] {
  const { bets } = ctx;
  // G-BIND: the expected total is EXPECTED_BETS from src/pins.ts — a CODE constant — not
  // `seeds.length × epoch size`. Both operands of that product come out of the dataset being scored, so
  // a coherent shrink (drop an epoch, drop its seed, fix the header, re-pin) moves the
  // expectation with the evidence and the coverage guard never notices. A row count derived
  // from the rows is not a population guard.
  const expectedBets = EXPECTED_BETS;
  // Kept as a reported cross-check: the pinned epoch plan must also sum to the pinned population, so a
  // disagreement between the plan and the shipped seed set is visible rather than silent.
  const planConsistent = EPOCH_PLAN.length === EXPECTED_SEEDS && EPOCH_PLAN.reduce((a, e) => a + e.size, 0) === EXPECTED_BETS;

  // ── Step 7: Displayed multiplier field ────────────────────────────────────────
  // SCOPE: the scored production dataset (EXPECTED_BETS rounds). The `multiplier` field LIQD returns
  // on a win is the DISPLAY value, floored to 2 decimals: minesMultiplier(m,k) == floor2(exact), k =
  // the tiles opened. It is not the wallet field of the reply (Step 22) and it UNDERSTATES the
  // exact multiplier wherever the exact value is not a whole number of cents. For LOST bets there is
  // no payout: `multiplier` is omitted and winningAmount == 0.
  // NON-FINITE REFERENCE GUARD (applied at every site the reference formula gates a scored step —
  // Steps 7, 8, 10 here and Step 15 in phase-e.ts). `Math.abs(NaN − x) > eps` is FALSE, so a NaN
  // coming out of OUR OWN minesMultiplier/minesMultiplierExact/theoreticalRTP silently scores as
  // agreement. That means the auditor's reference is corrupt and every comparison downstream is
  // vacuous, so it is counted separately and hard-FAILS rather than joining the ordinary mismatch tally.
  let wonChecked = 0, wonErrors = 0, lostChecked = 0, lostErrors = 0, displayBelowPaid = 0;
  let s7NonFiniteRef = 0;
  for (const b of bets) {
    if (b.result === 'won') {
      wonChecked++;
      const display = minesMultiplier(b.mineCount, b.openTiles.length);      // floored
      const exact = minesMultiplierExact(b.mineCount, b.openTiles.length);   // exact
      if (!Number.isFinite(display) || !Number.isFinite(exact)) { s7NonFiniteRef++; continue; }
      if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(display - b.multiplier) > 1e-9) wonErrors++;
      if (b.multiplier !== undefined && b.multiplier + 1e-9 < exact) displayBelowPaid++;
    } else {
      lostChecked++;
      if ((b.multiplier ?? 0) !== 0 || Number(b.winningAmount) !== 0) lostErrors++;
    }
  }
  // Coverage guard: the checked count must equal EXPECTED_BETS (a code constant), not bets.length —
  // wonChecked + lostChecked equals bets.length by construction, so comparing to it is tautological.
  const s7Covered = wonChecked + lostChecked;
  const s7 = step(7, 'Displayed Multiplier Field (floored, cosmetic)',
    wonErrors === 0 && lostErrors === 0 && s7NonFiniteRef === 0 && s7Covered === expectedBets ? 'PASS' : 'FAIL',
    `SCOPE: the scored production dataset (${PROD_HOST}); `
      + `${s7Covered}/${expectedBets} bets checked; ${wonChecked} wins: displayed multiplier == floor2(exact) at the opened depth, at 1e-9 (${wonErrors} mismatches); `
      + `${displayBelowPaid} wins where the displayed field is below the exact reference multiplier (for example 1.12 displayed for the exact 1.125 at 3 mines, one tile; the booked amount there is the exact 11.25 on a 10.00 stake); the booked amounts are checked in Step 8 and the USDT wallet fields in Step 22; `
      + `${lostChecked} losses: no payout — multiplier 0/absent and winningAmount == 0 (${lostErrors} violations); `
      + `reference-formula integrity: ${s7NonFiniteRef} wins where minesMultiplier/minesMultiplierExact returned a non-finite value (a NaN/Infinity in the auditor's own reference makes every comparison here vacuous — hard fail, not a mismatch)`,
  );

  // ── Step 8: Recorded payout (fiat, cents) + label check ──────────────────────────
  // Wins: winningAmount == floor2(betAmount × exact multiplier), in BigInt cents, 0 tolerance —
  // LIQD's booked amount in the fiat the round was staked in (the row's fiatCurrency). Losses: exactly 0.
  // Win-condition consistency: a 'won' round must open NO mine tile; a 'lost' round must open at
  // least one — otherwise a mislabelled result would still pass the payout math. A band check sits
  // beside the identity: the recorded amount must lie in [stake × exact − 0.01, stake × exact], the
  // only interval a cent floor can produce; a win outside it that equals the stake × DISPLAYED
  // multiplier floored to cents is counted separately.
  const S8_TOL = 0.01 + 1e-9;
  let payErrors = 0, paidExact = 0, paidFloored = 0, labelViolations = 0, s8Covered = 0;
  let maxResidual = 0, flooredBelowExact = 0, totalShortfall = 0, totalStaked = 0;
  // Money is totalled PER BOOKED FIAT and never across them: capture 1 is booked in CAD, captures 2 and
  // 3 in USD, and nothing is converted. Cents, as BigInt.
  const byFiat = new Map<string, { rounds: number; wins: number; stakedCents: bigint; paidCents: bigint; below: number; droppedUnits: bigint }>();
  const byCapture = new Map<number, { wins: number; below: number; droppedUnits: bigint; stakedCents: bigint; paidCents: bigint; fiats: Set<string> }>();
  let fiatOff = 0, firstFiatOff = '';
  let floorViolations = 0, offGridAmounts = 0, s8NonFiniteRef = 0;
  let nonFiniteStakes = 0, nonFiniteAmounts = 0, firstNonFiniteMoney = '';
  let firstOffGrid = '', firstFloorViolation = '';
  for (const b of bets) {
    s8Covered++;
    // MONEY IS SUMMED ONLY AFTER IT IS PROVEN TO BE A NUMBER. One loss row carrying
    // `betAmount: "not-a-number"` would otherwise poison the running total while the suite still
    // exits as a pass.
    const stakeNum = Number(b.betAmount);
    const winAmtNum = Number(b.winningAmount);
    if (!Number.isFinite(stakeNum)) {
      nonFiniteStakes++;
      if (!firstNonFiniteMoney) firstNonFiniteMoney = `bet ${b.id}: betAmount ${JSON.stringify(b.betAmount)}`;
    } else {
      totalStaked += stakeNum;
    }
    if (!Number.isFinite(winAmtNum)) {
      nonFiniteAmounts++;
      if (!firstNonFiniteMoney) firstNonFiniteMoney = `bet ${b.id}: winningAmount ${JSON.stringify(b.winningAmount)}`;
    }
    const winAmt = winAmtNum;
    // The booked fiat of the row must be the fiat the plan gives its capture.
    const planFiat = EPOCH_PLAN[b.epoch]?.fiat;
    if (b.fiatCurrency !== planFiat) { fiatOff++; if (!firstFiatOff) firstFiatOff = `bet ${b.id}: booked in ${JSON.stringify(b.fiatCurrency)}, plan ${planFiat}`; }
    const ff = byFiat.get(b.fiatCurrency) ?? { rounds: 0, wins: 0, stakedCents: 0n, paidCents: 0n, below: 0, droppedUnits: 0n };
    const cc = byCapture.get(b.capture) ?? { wins: 0, below: 0, droppedUnits: 0n, stakedCents: 0n, paidCents: 0n, fiats: new Set<string>() };
    ff.rounds++; cc.fiats.add(b.fiatCurrency);
    if (Number.isFinite(stakeNum)) { const sc = BigInt(Math.round(stakeNum * 100)); ff.stakedCents += sc; cc.stakedCents += sc; }
    if (Number.isFinite(winAmtNum)) { const pc = BigInt(Math.round(winAmtNum * 100)); ff.paidCents += pc; cc.paidCents += pc; }
    if (b.result === 'won' && Number.isFinite(stakeNum) && Number.isFinite(winAmtNum)) {
      // Disclosure (2) of src/pins.ts: the unrounded amount floor8(stake × exact) against the booked cents.
      const r = minesMultiplierRational(b.mineCount, b.openTiles.length);
      ff.wins++; cc.wins++;
      if (r) {
        const unrounded = (BigInt(Math.round(stakeNum * 100)) * 1_000_000n * r.num) / r.den;
        const booked = BigInt(Math.round(winAmtNum * 100)) * 1_000_000n;
        if (unrounded > booked) { ff.below++; cc.below++; ff.droppedUnits += unrounded - booked; cc.droppedUnits += unrounded - booked; }
      }
    }
    byFiat.set(b.fiatCurrency, ff); byCapture.set(b.capture, cc);
    const mineSet = new Set<number>(b.mineTiles);
    const openedMine = b.openTiles.some((t: number) => mineSet.has(t));
    if (b.result === 'won') {
      if (openedMine) labelViolations++;              // won yet opened a mine
      const exact = minesMultiplierExact(b.mineCount, b.openTiles.length);
      const bet = Number(b.betAmount);
      if (!Number.isFinite(exact)) { s8NonFiniteRef++; continue; }
      const residual = bet * exact - winAmt;          // >= 0 ⇒ recorded at or below the exact value
      // ON-GRID CHECK, BEFORE any rounding: a recorded fiat amount is a whole number of cents. A value
      // with a third decimal would otherwise be rounded onto the grid by the identity below.
      if (Number.isFinite(winAmt)) {
        const units = winAmt * 100;
        if (Math.abs(units - Math.round(units)) > PROD_ON_GRID_TOLERANCE) {
          offGridAmounts++;
          if (!firstOffGrid) firstOffGrid = `bet ${b.id}: winningAmount ${b.winningAmount} is ${units.toFixed(6)} cents`;
        }
      }
      // Exact floor2 identity (0 tolerance, rational).
      if (Number.isFinite(winAmt) && Number.isFinite(bet)) {
        const credCents = floor2BookedCents(bet, b.mineCount, b.openTiles.length);
        const recCents = BigInt(Math.round(winAmt * 100));
        if (credCents === null || recCents !== credCents) {
          floorViolations++;
          if (!firstFloorViolation) firstFloorViolation = `bet ${b.id} (m=${b.mineCount}, k=${b.openTiles.length}): recorded ${b.winningAmount}, rule ${credCents === null ? 'n/a' : (Number(credCents) / 100).toFixed(2)}`;
          // Does it match the stake × DISPLAYED multiplier floored to cents instead? Counted only where that
          // candidate differs from the rule: at a 0.10 stake the two candidates coincide on most cells, so a
          // match there would say nothing.
          const dispCents = BigInt(Math.floor(bet * 100 * minesMultiplier(b.mineCount, b.openTiles.length) + 1e-9));
          if (recCents === dispCents) paidFloored++;
        }
      }
      // The band test is a second, independent arm on the FLOAT reference (minesMultiplierExact): an amount
      // outside [stake × exact − 0.01, stake × exact] is an error, whatever else it matches.
      if (!Number.isFinite(winAmt) || !Number.isFinite(bet)) {
        payErrors++;
      } else if (residual < -1e-9 || residual > S8_TOL) {
        payErrors++;
      } else {
        paidExact++;
        if (Math.abs(residual) > maxResidual) maxResidual = Math.abs(residual);
        if (residual > 1e-12) { flooredBelowExact++; totalShortfall += residual; }
      }
    } else {
      if (!openedMine) labelViolations++;             // lost yet opened no mine
      // A loss records EXACTLY zero; zero is representable exactly, there is nothing to round.
      if (!Number.isFinite(winAmt) || winAmt !== 0) payErrors++;
    }
  }
  const s8FullCoverage = s8Covered === expectedBets;
  const moneyFinite = nonFiniteStakes === 0 && nonFiniteAmounts === 0
    && Number.isFinite(totalStaked) && totalStaked > 0 && Number.isFinite(totalShortfall);
  // The per-capture booked totals and the booked-below-unrounded disclosure must equal the declaration
  // (src/pins.ts PROD_CAPTURES, BOOKED_BELOW_UNROUNDED): a moved figure is a different dataset.
  const cents = (c: bigint) => `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;
  const units8 = (u: bigint) => `${u / 100_000_000n}.${String(u % 100_000_000n).padStart(8, '0')}`;
  const bookedDeclOk = PROD_CAPTURES.every(c => {
    const g = byCapture.get(c.capture), d = BOOKED_BELOW_UNROUNDED.find(x => x.capture === c.capture);
    return !!g && !!d && g.wins === c.wins && g.stakedCents === c.bookedStakedCents && g.paidCents === c.bookedPaidCents
      && g.below === d.wins && g.droppedUnits === d.droppedUnits && g.fiats.size === 1 && g.fiats.has(c.fiat);
  }) && byCapture.size === PROD_CAPTURES.length;
  const s8Hard = payErrors > 0 || labelViolations > 0 || floorViolations > 0
    || offGridAmounts > 0 || s8NonFiniteRef > 0 || !s8FullCoverage
    || !moneyFinite || !planConsistent || fiatOff > 0 || !bookedDeclOk;
  const fiatLine = [...byFiat].sort(([a], [z]) => a.localeCompare(z)).map(([f, x]) =>
    `${f}: ${x.rounds} rounds, ${cents(x.stakedCents)} staked, ${cents(x.paidCents)} booked as won over ${x.wins} wins`).join('; ');
  const captureLine = PROD_CAPTURES.map(c => {
    const g = byCapture.get(c.capture);
    return g ? `capture ${c.capture} (${c.fiat}): ${g.below} of ${g.wins} wins booked below the unrounded amount, ${units8(g.droppedUnits)} ${c.fiat} dropped in total (booked ${cents(g.paidCents)} of ${cents(g.stakedCents)} staked)` : `capture ${c.capture}: NO ROWS`;
  }).join('; ');
  const s8 = step(8, 'Payout Math + Win-Condition (wins: winningAmount == floor2(betAmount × EXACT multiplier), the booked fiat amount; losses: 0; label ⇔ mine opened)',
    !s8Hard && paidFloored === 0 ? 'PASS' : (s8Hard ? 'FAIL' : 'FLAG'),
    `SCOPE: the scored production dataset (${PROD_HOST}), the amounts LIQD BOOKED in the fiat each round was staked in (CAD in capture 1, USD in captures 2 and 3; nothing converted); the ${PROD_WALLET_CURRENCY} wallet field of each reply is Step 22; `
      + `${s8Covered}/${expectedBets} bets (expected total pinned in src/pins.ts EXPECTED_BETS, a code constant${planConsistent ? '' : '; PLAN INCONSISTENT: EPOCH_PLAN does not sum to EXPECTED_BETS'}): `
      + `exact floor2 identity (winningAmount == floor2(stake × multExact) in BigInt cents, 0 tolerance — rejects a one-cent over- or under-statement): ${floorViolations} violations${firstFloorViolation ? ` (first: ${firstFloorViolation})` : ''}; `
      + `${paidExact} wins inside the cent-floor band [stake × exact − 0.01, stake × exact], ${paidFloored} wins matching only the stake × displayed multiplier floored to cents, ${payErrors} errors; `
      + `on-grid check applied BEFORE any rounding (winningAmount × 100 must already be an integer): ${offGridAmounts} off-grid amounts${firstOffGrid ? ` (first: ${firstOffGrid})` : ''}; `
      + `booked fiat = the plan's for the row's capture: ${bets.length - fiatOff}/${bets.length}${firstFiatOff ? ` (first: ${firstFiatOff})` : ''}; `
      + `reference-formula integrity: ${s8NonFiniteRef} wins where minesMultiplierExact returned a non-finite value (hard fail — the auditor's reference is corrupt, not the operator's payout); `
      + `money-field integrity: ${nonFiniteStakes} bets whose betAmount is not a finite number, ${nonFiniteAmounts} whose winningAmount is not${firstNonFiniteMoney ? ` (first: ${firstNonFiniteMoney})` : ''} — hard fail; `
      + `booked totals per fiat (never summed across currencies): ${fiatLine}; `
      + `THE BOOKED WIN IS FLOORED TO THE CENT, THE WALLET FIELD IS NOT — ${captureLine} — ${bookedDeclOk ? 'equal to' : 'NOT EQUAL TO'} the declaration (src/pins.ts PROD_CAPTURES, BOOKED_BELOW_UNROUNDED). `
      + `On the USD captures the served rate is 1.00000000, so the amount dropped is the amount by which the wallet fields exceed the booked wins (Step 22 scores the wallet fields); the scored captures read no balance, and which amount moves the balance is Step 23 (the balance check of 12 November 2026: the wallet field); `
      + `largest cent-floor residual ${maxResidual.toFixed(8)} of the booked fiat, ${flooredBelowExact} wins below the unrounded value; `
      + `win-condition consistency (won ⇔ no mine opened): ${labelViolations} label violations. `
      + `SEVERITY OF A SHORT AMOUNT: a win booked one cent below floor2(stake × exact) is a violation of the declared rule and HARD-FAILS this step (MINES-11 HARD_FAIL as written); this dataset has ${floorViolations}. `
      + `The wallet leg is held to LIQD's measured rule floor8(betAmountWallet × floor8(exact)) in Step 22, where the ${PROD_WALLET_BELOW_EXACT} wins whose wallet field is one 1e-8 ${PROD_WALLET_CURRENCY} unit below floor8(betAmountWallet × exact) (${PROD_WALLET_BELOW_EXACT_TOTAL_UNITS} units in total, all in capture 1) are DISCLOSED, not a deviation (ruling 2, MANIFEST "Rulings"): a floor at 1e-8 produced by LIQD's declared 8-decimal rule moves no status`,
  );

  // ── Step 9: Config completeness (the production plan, every phase) ──────────────────
  // The plan is bound in source (src/pins.ts SETTINGS_PLAN), never read from the dataset: every
  // (phase id, mineCount, depth) setting it names must carry exactly its planned rounds, and no round
  // may sit at a setting outside it. Depth is the recorded plan (`reveals`); Step 20 binds it to the
  // tiles opened. MINES-15's floor — every mine count 1…24 played at least 50 times in phase A — is
  // asserted from the rows: phase A plays 5 mine counts × 1,000 and the top-up (A+) the other 19 × 50.
  const planCells = [...SETTINGS_PLAN.keys()];
  const perCell = new Map<string, number>();
  for (const b of bets) { const key = `${b.phaseId}|${b.mineCount}:${b.reveals}`; perCell.set(key, (perCell.get(key) ?? 0) + 1); }
  const missing = planCells.filter(c => !perCell.has(c));
  const wrongCount = planCells.filter(c => (perCell.get(c) ?? 0) !== SETTINGS_PLAN.get(c));
  const offPlan = [...perCell.keys()].filter(c => !SETTINGS_PLAN.has(c));
  const planTotal = [...SETTINGS_PLAN.values()].reduce((a, n) => a + n, 0);
  const phaseAByMineCount = new Map<number, number>();
  for (const b of bets) if (b.phase === 'A') phaseAByMineCount.set(b.mineCount, (phaseAByMineCount.get(b.mineCount) ?? 0) + 1);
  const MINES15_FLOOR = TOPUP_PER_MINE_COUNT;
  const belowFloor = MINE_COUNTS.filter(m => (phaseAByMineCount.get(m) ?? 0) < MINES15_FLOOR);
  // Coverage guard: the plan must sum to the pinned population, not merely "no missing".
  const s9CoverageOk = planTotal === expectedBets && bets.length === expectedBets && belowFloor.length === 0;

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
  const s9 = step(9, `Config Completeness (the production plan: ${planCells.length} phase settings, every mine count)`,
    !(missing.length === 0 && wrongCount.length === 0 && offPlan.length === 0 && s9CoverageOk && liveFitPopOk) ? 'FLAG'
      : liveFitStatOk ? 'PASS' : 'INFO',
    `Plan (src/pins.ts SETTINGS_PLAN — code constants): phase A, the 20 multi-reveal settings (mine counts ${Object.keys(PROD_DEPTHS).join(', ')} × 4 depths: ${Object.entries(PROD_DEPTHS).map(([m, ks]) => `${m}: ${ks.join('/')}`).join(' · ')}) × ${PROD_PER_SETTING}; phase D, the same 20 settings × ${PHASE_D_PER_SETTING}; phase A+ (the top-up), the other ${TOPUP_MINE_COUNTS.length} mine counts (${TOPUP_MINE_COUNTS.join(', ')}) at one tile × ${TOPUP_PER_MINE_COUNT}; phase C, ${PHASE_C_SETTING.mineCount} mines at one tile × ${PHASE_C_ROUNDS}; `
      + `${planCells.length - missing.length}/${planCells.length} settings present, ${planCells.length - wrongCount.length}/${planCells.length} with exactly their planned rounds, ${offPlan.length} settings outside the plan (${bets.length}/${planTotal} rounds)`
      + (missing.length > 0 ? `; missing: ${missing.slice(0, 5).join(', ')}` : '')
      + (wrongCount.length > 0 ? `; wrong count: ${wrongCount.slice(0, 5).map(c => `${c}=${perCell.get(c) ?? 0}`).join(', ')}` : '')
      + (offPlan.length > 0 ? `; off plan: ${offPlan.slice(0, 5).join(', ')}` : '')
      + `. Every mine count 1…24 in phase A (A and A+): ${MINE_COUNTS.length - belowFloor.length}/${MINE_COUNTS.length} with at least ${MINES15_FLOOR} rounds (fewest ${Math.min(...MINE_COUNTS.map(m => phaseAByMineCount.get(m) ?? 0))})${belowFloor.length ? ` — BELOW: ${belowFloor.join(', ')}` : ''}. ${PLAYED_CELLS.length} of the 300 legal (mine count, depth) cells were played; the reference formula covers the rest (Step 10)`
      + `. Live-sample fit (informational; pre-registered deviation level p < ${LIVE_FIT_ALPHA}, reported as INFO, never counted): first-drawn mine position over ${firstN}/${expectedBets} captured layouts vs the uniform 25-tile lattice, chi² ${chiFirst.toFixed(3)} on ${GRID - 1} df, p = ${pFirst.toFixed(4)}; `
      + `win counts in ${groups.size} (mineCount, planned reveals) groups vs the binomial at winProbability(m,k), Σz² ${chiWin.toFixed(3)} on ${dfWin} df, p = ${pWin.toFixed(4)}, largest |z| ${maxAbsZ.toFixed(3)} at ${worstGroup || 'n/a'}. A variance illustration of the live sample, not RTP evidence.`,
  );

  // ── Step 10: House edge / RTP (closed-form identity, per-config, anti-circular) ─
  // CLOSED-FORM IDENTITY — the THEORETICAL leg, NOT a re-derivation from live data.
  // theoreticalRTP(m,k) = winProbability(m,k) × minesMultiplierExact(m,k); the combinatorial
  // winProbability and the exact multiplier's fair factor are reciprocals, so this equals
  // (1 − edge) = 99.00% for every (m,k) BY CONSTRUCTION — it cannot, alone, detect a live
  // regression. The EMPIRICAL checks of what LIQD records and pays are Step 8 (the fiat amount)
  // and Step 22 (the USDT wallet). We exercise k=1 for all m AND the 20 multi-reveal settings, so the
  // depths played (1 … 15) are checked too.
  const rtpCases: Array<[number, number]> = [];
  for (const m of MINE_COUNTS) rtpCases.push([m, 1]);
  for (const [m, ks] of Object.entries(PROD_DEPTHS)) for (const k of ks) rtpCases.push([Number(m), k]);
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
  // Coverage guard: N cases is derived (all mineCounts at k=1 + the production settings), never a
  // canned constant — a step that scored 0 cases must not pass vacuously.
  const expectedCases = MINE_COUNTS.length + Object.values(PROD_DEPTHS).reduce((a, ks) => a + ks.length, 0);
  const coverageOk = rtpCases.length === expectedCases;

  // FULL-GRID reference sweep: evaluate the closed-form identity at ALL 300 legal (m,k) cells
  // (m=1..24, k=1..25−m), not only the 28 live-witnessed depths above. This asserts the
  // AUDITOR'S REFERENCE FORMULA is a clean (1−edge) at every reachable depth, so a corrupted
  // reference multiplier at a cell no captured bet ever won (e.g. a 70% cell) is caught here.
  // NOTE: this is a property of the reference formula, NOT evidence about the operator — 260 of the
  // 300 cells have no production round (the 40 played cells are data-witnessed, Steps 8 and 22).
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

  // SETTLEMENT-FLOOR RTP DEFICIT (G-PRODUCING). The identity above is exact; the amounts LIQD writes
  // are floored, so the return they carry is at most (1 − edge), strictly below wherever a positive
  // fraction is discarded. Two amounts, two rules, both computed in BigInt over all 300 cells:
  //   (a) the RECORDED fiat amount, floor2(stake × mult), at the capture's stake — DERIVED from the
  //       bets, cross-checked against the header (G-BIND: a doctored header must not move the figure);
  //   (b) the wallet field in the reply, floor8(walletStake × floor8(mult)) — LIQD's measured rule
  //       (Step 22) — at the smallest betAmountWallet the raw capture recorded.
  //   deficit(m,k) = P(win) × (discarded fraction of one grid unit) / (stake in grid units)
  const betStakes = [...new Set(bets.map(b => Number(b.betAmount)))]
    .filter(a => Number.isFinite(a) && a > 0).sort((a, z) => a - z);
  const headerStakes = Object.values((ctx.meta?.phases ?? {}) as Record<string, { amount?: number }>)
    .flatMap(p => [Number(p?.amount), ...(Array.isArray((p as { amounts?: number[] })?.amounts) ? (p as { amounts: number[] }).amounts.map(Number) : [])]).filter(a => Number.isFinite(a) && a > 0);
  const headerMinStake = headerStakes.length > 0 ? Math.min(...headerStakes) : 0;
  const minStake = betStakes.length > 0 ? betStakes[0] : 0;
  // The header is a CLAIM about the capture; the bets are the capture. They must agree.
  const stakeSourcesAgree = minStake > 0 && Math.abs(headerMinStake - minStake) < 1e-12;
  const worstDeficit = (stakeUnits: bigint, scale: bigint, floorMultFirst: boolean) => {
    let worst = 0, at = '';
    if (stakeUnits <= 0n) return { worst, at };
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        let num = EDGE_NUM, den = EDGE_DEN;
        for (let i = 0; i < k; i++) { num *= BigInt(GRID - i); den *= BigInt(GRID - m - i); }
        if (floorMultFirst) { num = (100_000_000n * num) / den; den = 100_000_000n; }
        const exactUnits = stakeUnits * num;
        const flooredUnits = exactUnits / den;
        // Deficit measured against the EXACT multiplier, whatever the rule floors first.
        let xn = EDGE_NUM, xd = EDGE_DEN;
        for (let i = 0; i < k; i++) { xn *= BigInt(GRID - i); xd *= BigInt(GRID - m - i); }
        const lostUnits = Number(stakeUnits * xn - flooredUnits * xd) / Number(xd);
        const d = winProbability(m, k) * lostUnits / Number(stakeUnits);
        if (Number.isFinite(d) && d > worst) { worst = d; at = `m=${m},k=${k}`; }
      }
    }
    void scale;
    return { worst, at };
  };
  const fiat = worstDeficit(BigInt(Math.round(minStake * 100)), FIAT_SCALE, false);
  const floorDeficit = fiat.worst, floorWorst = fiat.at;
  let walletMinUnits: bigint | null = null;
  for (const { rec } of ctx.prodCapture.bets) {
    const u = decimalUnits(rec?.placeRaw?.betAmountWallet, 8);
    if (u !== null && u > 0n && (walletMinUnits === null || u < walletMinUnits)) walletMinUnits = u;
  }
  const wallet = walletMinUnits !== null ? worstDeficit(walletMinUnits, 100_000_000n, true) : { worst: NaN, at: '' };
  // (c) the booked cent floor at the smallest stake LIQD SERVES (minBet in every settings record,
  // src/pins.ts PROD_GAME_SETTINGS, bound to the raw captures by Step 22) — arithmetic, not played.
  // And the full-clear arithmetic for DL-7: 5,148,297× (12 mines, 13 tiles) at that stake against
  // each served round payout limit (maxExposure, in the booking fiat of the capture that served it).
  const fiatOfCapture = new Map(PROD_CAPTURES.map(c => [c.capture, c.fiat]));
  const servedMinBets = new Set<number>();
  const servedLimits = new Map<string, { fiat: string; maxExposure: number }>();
  for (const g of PROD_GAME_SETTINGS) {
    try {
      const o = JSON.parse(g.value) as { minBet?: unknown; maxExposure?: unknown };
      servedMinBets.add(Number(o.minBet));
      const f = fiatOfCapture.get(g.capture) ?? '?';
      servedLimits.set(`${f} ${Number(o.maxExposure)}`, { fiat: f, maxExposure: Number(o.maxExposure) });
    } catch { servedMinBets.add(NaN); }
  }
  const minBetServed = servedMinBets.size === 1 && Number.isFinite([...servedMinBets][0]) && [...servedMinBets][0] > 0 ? [...servedMinBets][0] : null;
  const minBetFloor = minBetServed !== null ? worstDeficit(BigInt(Math.round(minBetServed * 100)), FIAT_SCALE, false) : { worst: NaN, at: '' };
  const c2 = (c: bigint) => `${(c / 100n).toLocaleString('en-US')}.${String(c % 100n).padStart(2, '0')}`;
  const FULL_M = 12, FULL_K = GRID - FULL_M;
  const fullClearLine = minBetServed === null ? 'the served minBet could not be read' : [...servedLimits.values()]
    .sort((a, z) => a.fiat.localeCompare(z.fiat) || a.maxExposure - z.maxExposure).map(r => {
      const stakeC = BigInt(Math.round(minBetServed * 100)), capC = BigInt(Math.round(r.maxExposure * 100));
      const at = (k: number) => minesMultiplierRational(FULL_M, k);
      const full = at(FULL_K);
      if (!full || !Number.isFinite(r.maxExposure)) return `${r.fiat}: not computable`;
      const fullCents = (stakeC * full.num) / full.den;
      const minStakeAbove = (capC * full.den) / full.num + 1n;   // smallest stake in cents whose full clear exceeds the limit
      if (stakeC * full.num <= capC * full.den) {
        return `${r.fiat} limit ${r.maxExposure.toLocaleString('en-US')}: a full clear at the ${minBetServed.toFixed(2)} minimum books ${c2(fullCents)} ${r.fiat}, within it; from a stake of ${c2(minStakeAbove)} ${r.fiat} a full clear exceeds it`;
      }
      let k = FULL_K;
      while (k > 1) { const mk = at(k); if (mk && stakeC * mk.num <= capC * mk.den) break; k--; }
      const mk = at(k)!;
      return `${r.fiat} limit ${r.maxExposure.toLocaleString('en-US')}: a full clear at the ${minBetServed.toFixed(2)} minimum would book ${c2(fullCents)} ${r.fiat}, above it; by LIQD's statement of 15 October 2026 a ${FULL_M}-mine round at that stake ends at ${k} tiles, ${(Number(mk.num) / Number(mk.den)).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}× (booked ${c2((stakeC * mk.num) / mk.den)} ${r.fiat})`;
    }).join('; ') + ' (arithmetic on the served settings; payout-limit enforcement was not observed)';
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
  const stakeSourceFault = !stakeSourcesAgree || walletMinUnits === null || !Number.isFinite(wallet.worst);
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
  //     and multiplier caps stay in scope. LIQD stated, the same day, that Mines has had no multiplier cap
  //     since the end of August 2026 (the 10,000× setting removed from the configuration), and that
  //     what remains is a per-round payout limit: the round ends and pays the full multiplier for
  //     the tiles already revealed. So there is no multiplier cap to score on the production build
  //     (its 3,886 settings records carry no maxOdds — src/pins.ts PROD_GAME_SETTINGS, bound to the
  //     raw captures by Step 22), and the round payout limit (maxExposure, exposureSource "game") is a
  //     payout cap, excluded. The figures below are still COMPUTED and printed as disclosure — the
  //     production settings and the largest displayed multiplier — and none of them moves the status.
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
  const settingsValues = new Map<string, number>();
  let settingsRecords = 0, settingsWithMaxOdds = 0;
  for (const b of bets) {
    const raw = (b as unknown as { currentGameSettings?: unknown }).currentGameSettings;
    if (raw != null) {
      settingsRecords++;
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      settingsValues.set(text, (settingsValues.get(text) ?? 0) + 1);
      try { if ((JSON.parse(text) as { maxOdds?: unknown }).maxOdds !== undefined) settingsWithMaxOdds++; } catch { settingsWithMaxOdds++; }
    }
    if (b.result !== 'won') continue;
    const served = Number(b.multiplier);
    for (const q of [served]) {
      quotedChecked++;
      if (!Number.isFinite(q) || q > MAX_ODDS_DECLARED) quotedAboveCap++;
      else if (q > maxQuoted) maxQuoted = q;
    }
  }
  // The production settings declaration (src/pins.ts PROD_GAME_SETTINGS, bound to the raw capture by
  // Step 22) and the dataset's own copies of those records must agree — printed, not scored here.
  const declaredRecords = PROD_GAME_SETTINGS.reduce((a, g) => a + g.records, 0);
  const declaredByValue = new Map<string, number>();
  for (const g of PROD_GAME_SETTINGS) declaredByValue.set(g.value, (declaredByValue.get(g.value) ?? 0) + g.records);
  const declAgree = settingsRecords === declaredRecords && settingsValues.size === declaredByValue.size
    && [...declaredByValue].every(([v, n]) => settingsValues.get(v) === n);
  const limitsOf = (v: string) => { try { const o = JSON.parse(v) as { maxBet?: unknown; maxExposure?: unknown }; return `maxBet ${o.maxBet} / maxExposure ${o.maxExposure}`; } catch { return 'unparseable'; } };
  let refAboveCap = 0;
  for (const m of MINE_COUNTS) for (let k = 1; k <= GRID - m; k++) if (minesMultiplierExact(m, k) > MAX_ODDS_DECLARED) refAboveCap++;
  const quotedOk = quotedAboveCap === 0 && quotedChecked > 0;
  const monoDetail = ` Monotonicity (FLAG policy, scored): the exact multiplier is strictly increasing in depth and in mine count over ${monoPairs}/${EXPECTED_MONO_PAIRS} adjacent legal cell pairs (exact rational comparison) — ${monoViolations} violations${firstMonoViolation ? ` (first: ${firstMonoViolation})` : ''}. `
    + `Caps (MINES-14 cap half, MANIFEST DL-7) — DISCLOSED, NOT SCORED since 2026-10-15: payout caps are excluded from the audit and multiplier caps stay in scope (profile owner, 2026-10-15); LIQD states that Mines has had no multiplier cap since the end of August 2026 (the 10,000× setting removed from the configuration) and that a per-round payout limit ends the round and pays the full multiplier for the tiles already revealed (operator statement, 2026-10-15, quoted in MANIFEST DL-7). `
    + `Production build: ${settingsRecords} of the ${bets.length} settling replies carry currentGameSettings (every loss and the ${PROD_AUTO_FINISH_ROUNDS.length} wins LIQD settled by itself; a cash-out reply carries none), ${settingsValues.size} distinct value(s), ${settingsWithMaxOdds} with a maxOdds key — no multiplier cap, as stated; `
    + `the values ${declAgree ? 'equal' : 'DO NOT equal'} the declaration src/pins.ts PROD_GAME_SETTINGS (${PROD_GAME_SETTINGS.map(g => `capture ${g.capture}: ${g.records} × ${limitsOf(g.value)}`).join('; ')}; the limits are stated in the fiat the round was booked in, CAD in capture 1 and USD in captures 2 and 3, with maxExposureUsdc 50000 in all), which Step 22 binds to the raw captures; `
    + `maxExposure is the round payout limit LIQD describes, excluded (payout-limit enforcement is not tested; no captured round reached it). `
    + `Largest multiplier displayed on a production win: ${maxQuoted}× (${quotedChecked - quotedAboveCap}/${quotedChecked} wins carry a finite displayed multiplier${quotedOk ? '' : ' — NOT all'}); `
    + `the reference formula exceeds 10,000× at ${refAboveCap} of the 300 legal cells, none played; the live page read 2026-10-01 quotes 5,148,297× (evidence/rtp-page-labels-2026-10-01.json): the top multiplier on the formula (m=12, k=13), payable only within the round payout limit — ${fullClearLine}.`;

  // ── Step 10, RTP claim — RULING 1 (decided 11 November 2026; MANIFEST "Rulings") ─────────
  // The held claim is RTP_CLAIM (flat 99%), scored by the RTP-CLAIM gate in tests/verify.ts; the wallet
  // field meets it. The page's rounding sentence is a DISCREPANCY recorded as published on 1 Oct 2026:
  // run through the same rule as a range claim, and set against the edge the 2-decimal multiplier would
  // give if it were paid, cut (what production displays) or rounded (what the sentence says). Printed,
  // not scored.
  let rulingOne = '';
  try {
    const alt = computeRtpClaim(RTP_CLAIM_PAGE_RANGE);
    const rc = alt.rangeChecks.map(c => `${c.id === 'published-min-vs-true-min' ? 'published min' : 'published max'} ${c.publishedPct}% vs true ${c.truePct}% (${c.gapPp} pp, ${c.outcome})`).join('; ');
    let cutMin = Infinity, cutMax = -Infinity, rndMin = Infinity, rndMax = -Infinity;
    for (const m of MINE_COUNTS) for (let k = 1; k <= GRID - m; k++) {
      const r = minesMultiplierRational(m, k);
      if (!r) continue;
      const p = winProbability(m, k);
      const eCut = 1 - p * Number((100n * r.num) / r.den) / 100;
      const eRnd = 1 - p * Number((200n * r.num + r.den) / (2n * r.den)) / 100;
      cutMin = Math.min(cutMin, eCut); cutMax = Math.max(cutMax, eCut); rndMin = Math.min(rndMin, eRnd); rndMax = Math.max(rndMax, eRnd);
    }
    const pc = (v: number) => `${(v * 100).toFixed(2)}%`;
    rulingOne = ` RTP claim — RULING 1 (decided): LIQD is held to the page's flat ${RTP_CLAIM.kind === 'flat' ? `${(Number(RTP_CLAIM.rtp) * 100).toFixed(2)}%` : RTP_CLAIM.kind} ("99% RTP at every setting"; scored by the RTP-CLAIM gate printed after the steps), which the wallet field meets (99.0000% to four decimals, (b) above). `
      + `DISCREPANCY, as published on 1 Oct 2026: the same page states "Multipliers are rounded to two decimals rather than cut, so the realised edge moves a little with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%." (RTP ${(Number((RTP_CLAIM_PAGE_RANGE as { min: string }).min) * 100).toFixed(2)}%–${(Number((RTP_CLAIM_PAGE_RANGE as { max: string }).max) * 100).toFixed(2)}%). On production the displayed multiplier is cut, not rounded (Step 7), and the range matches neither rule: over the 300 cells, paying the 2-decimal multiplier cut would give an edge of ${pc(cutMin)}–${pc(cutMax)}, rounded ${pc(rndMin)}–${pc(rndMax)}. `
      + `Run through the same rule (${alt.rule} ${alt.ruleVersion.split(' ')[0]}, band ${alt.bandPp} pp) as a range claim the sentence would ${alt.outcome}: ${rc}. Printed as the discrepancy, not scored.`;
  } catch (e: any) {
    rulingOne = ` RTP claim — RULING 1: the page's range statement could not be evaluated (${e?.message ?? e}).`;
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
    `Closed-form identity theoreticalRTP(m,k) = winProbability(m,k) × minesMultiplierExact(m,k) (winProbability = pure C(25-m,k)/C(25,k) combinatorics), checked for m=1..24 at k=1 and the 20 multi-reveal settings (src/pins.ts PROD_DEPTHS) — ${rtpCases.length}/${expectedCases} cases: `
      + `RTP range ${(minRTP * 100).toFixed(4)}%–${(maxRTP * 100).toFixed(4)}%, mean ${(meanRTP * 100).toFixed(4)}% — ${rtpClause}`
      + `Full-grid reference sweep: all ${allCells}/${EXPECTED_ALL_CELLS} legal (m,k) cells (k=1..25−m) evaluate to 99.0000% within 1e-9 (${allCellsOff} off), range ${(allMin * 100).toFixed(4)}%–${(allMax * 100).toFixed(4)}% — this checks the reference formula at every reachable depth, NOT the operator (${PLAYED_CELLS.length}/300 cells were played on production, Steps 8 and 22; ${300 - PLAYED_CELLS.length} formula-only). `
      + `Settlement floor — the identity above is the THEORETICAL leg; the amounts LIQD writes are floored, so the return they carry is at most (1 − edge). `
      + `(a) the BOOKED fiat amount, floor2(stake × exact), at the smallest stake played (${minStake.toFixed(2)}, DERIVED from the ${betStakes.length} distinct betAmount value(s) in the pinned bets — ${betStakes.map(v => v.toFixed(2)).join(', ')} — not read from meta.phases; the header's own smallest amount is ${headerMinStake.toFixed(2)} and the two ${stakeSourcesAgree ? 'agree' : 'DISAGREE — hard fail: the dataset header describes stakes its bets do not contain'}): worst cell over all ${EXPECTED_ALL_CELLS} ${floorWorst || 'n/a'}, ${(floorDeficit * 100).toFixed(4)} pp of turnover → a booked return of ${((1 - HOUSE_EDGE - floorDeficit) * 100).toFixed(4)}% there — a property of a cent-floored figure at a 0.10 stake, not of the wallet field (Step 8 states the amounts dropped per capture); `
      + `(b) the ${PROD_WALLET_CURRENCY} wallet field in the reply, LIQD's measured rule floor8(walletStake × floor8(exact)) (Step 22), at the smallest betAmountWallet in the raw captures (${walletMinUnits === null ? 'NOT READ' : (Number(walletMinUnits) / 1e8).toFixed(8)} ${PROD_WALLET_CURRENCY}, a 0.10 CAD stake of capture 1): worst cell ${wallet.at || 'n/a'}, ${Number.isFinite(wallet.worst) ? wallet.worst.toExponential(3) : 'n/a'} of turnover → RTP on the wallet field ${Number.isFinite(wallet.worst) ? ((1 - HOUSE_EDGE - wallet.worst) * 100).toFixed(6) : 'n/a'}%, i.e. ${((1 - HOUSE_EDGE) * 100).toFixed(4)}% to four decimals; `
      + `(c) the BOOKED amount at the smallest stake LIQD serves (minBet ${minBetServed === null ? 'NOT READ' : minBetServed.toFixed(2)} in every settings record, src/pins.ts PROD_GAME_SETTINGS; not played): worst cell ${minBetFloor.at || 'n/a'}, ${(minBetFloor.worst * 100).toFixed(4)} pp of turnover → a booked return of ${((1 - HOUSE_EDGE - minBetFloor.worst) * 100).toFixed(4)}% there. `
      + `Which amount reaches the balance: the wallet field (b), measured on the balance check of 12 November 2026 (Step 23: 71 of 71 wins where the two differ, at (1, 2) on 0.10 and (3, 5) on 0.01, booked in USD); (a) and (c) are the returns of the booked figure, a display figure, not returns paid. `
      + `Edge-rational integrity: EDGE_NUM/EDGE_DEN = ${Number(EDGE_NUM)}/${Number(EDGE_DEN)} ${edgeRationalOk ? 'exactly represents' : 'DOES NOT represent'} (1 − HOUSE_EDGE) = ${1 - HOUSE_EDGE} — the BigInt factor the floor8 wallet field identity in Step 8 divides by. A factor that only approximates the audited edge makes that identity measure a different edge, silently. `
      + `Reference-formula integrity: ${allCellsNonFinite + caseNonFinite} cells returned a non-finite value${firstNonFinite ? ` (first: ${firstNonFinite})` : ''} — a NaN/Infinity here is NOT an "off 99%" deviation (which FLAGs); it means the auditor's own reference is corrupt and every comparison built on it is vacuous, so it hard-FAILS. `
      + `This is the uncapped reference calculation; Step 8 checks the booked winningAmount and Step 22 the wallet field in the reply at the ${PLAYED_CELLS.length} played cells. The displayed multiplier field is floored — cosmetic (Step 7).`
      + monoDetail
      + rulingOne
      + ` FLAG REASONS: ${s10Fail ? 'n/a (hard fail)' : (flagReasons.join(', ') || 'none')}.`,
  );

  return [s7, s8, s9, s10];
}
