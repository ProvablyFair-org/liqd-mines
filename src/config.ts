/**
 * liqd Mines game math. Unlike Plinko, mines has NO multiplier config file — the
 * payout is a closed-form function of (mineCount, tilesRevealed), computed server-side.
 * There is therefore no external table to pin; the multiplier is derived here and
 * cross-checked against every captured win.
 *
 * Grid = 25 tiles. mineCount m ∈ [1, 24]. House edge 1.00%.
 */
export const GRID = 25;
export const HOUSE_EDGE = 0.01;
export const MINE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24

/**
 * (1 − HOUSE_EDGE) as an EXACT rational, DERIVED from the one definition of the edge above.
 *
 * The exact-floor8 credit identity (tests/steps/payouts.ts) and the settlement-floor sweep
 * (there and in src/figures.ts) both need the retention factor in integer arithmetic. Until
 * 2026-09-09 all three sites spelled it `let num = 99n, den = 100n` — three BigInt literals
 * that happened to agree with HOUSE_EDGE and were not derived from it. Mutating HOUSE_EDGE
 * 0.01 → 0.02 therefore left the floor8 arm reporting **0 violations** while the arm beside it
 * counted 3,104 errors: the strictest test in the suite was silently measuring a constant the
 * audit no longer used. check-constants.sh cannot see it either — a `99n` literal has no
 * textual relationship to `0.01`.
 *
 * Scale 1e8 rather than 100 so an edge shift in the 5th decimal (mutation M02, 0.0100001)
 * moves the numerator instead of rounding back onto 99. The floored quotient is unchanged for
 * an edge of exactly 1%: floor(x·k / y·k) === floor(x / y), and 99000000/100000000 === 99/100.
 */
/**
 * The RTP this report PUBLISHES — 99.0000%. Deliberately a literal and deliberately NOT written
 * as `1 - HOUSE_EDGE`.
 *
 * `theoreticalRTP(m,k)` is identically `1 − HOUSE_EDGE` by construction, so a step that compares
 * it to `1 - HOUSE_EDGE` is comparing the repo to itself and would pass for ANY edge — the
 * "gate is consistency, not correctness" failure the framework calls out (G3.8 Model Anchor).
 * This constant is the EXTERNAL anchor: the operator's advertised 1.00% edge and the figure every
 * chapter quotes. Step 10 tests the reference formula against it, which is why mutating
 * HOUSE_EDGE to 0.02 must move the measured RTP away from this number and be seen.
 *
 * Single-sourced here only so the same anchor is not retyped as a bare `0.99` at six sites.
 * If the operator's published edge ever changes, this changes with the report — not with the code.
 */
export const PUBLISHED_RTP = 0.99;

export const EDGE_SCALE = 100_000_000n;                                   // 1e8
export const EDGE_NUM = BigInt(Math.round((1 - HOUSE_EDGE) * 1e8));       // 99_000_000n at 1%
export const EDGE_DEN = EDGE_SCALE;

/**
 * Does the rational above REPRESENT the edge, or merely approximate it? An edge with more than 8
 * decimal places would silently round into EDGE_NUM and the floor8 identity would go back to
 * measuring a constant nobody declared — the exact defect this replaced.
 *
 * Deliberately a FUNCTION and not a `throw` at import. A throw here would abort the process
 * before a single step was scored, and "the run died in module initialisation" is NOT a catch —
 * it is a run that never happened, which is precisely the failure mode the framework's forgery
 * batteries refuse to count. Step 10 calls this and hard-FAILS on it, so the fault appears as a
 * scored step with a verdict attached.
 */
export function edgeRationalIsExact(): boolean {
  return Math.abs(Number(EDGE_NUM) / Number(EDGE_DEN) - (1 - HOUSE_EDGE)) <= 1e-12;
}

/** n choose k. */
export function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

/**
 * Fair "all k opened tiles are safe" probability — ANTI-CIRCULAR: pure combinatorics,
 * never operator data.  P(win) = C(25-m, k) / C(25, k).
 */
export function winProbability(mineCount: number, tilesRevealed: number): number {
  return combination(GRID - mineCount, tilesRevealed) / combination(GRID, tilesRevealed);
}

/** n choose k in exact integer arithmetic — the BigInt twin of `combination`. */
export function combinationBig(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  k = Math.min(k, n - k);
  let num = 1n, den = 1n;
  for (let i = 0; i < k; i++) { num *= BigInt(n - i); den *= BigInt(i + 1); }
  return num / den;
}

/** P(win) as an EXACT rational — C(25−m, k) / C(25, k). */
export function winProbabilityRational(
  mineCount: number, tilesRevealed: number,
): { num: bigint; den: bigint } | null {
  const den = combinationBig(GRID, tilesRevealed);
  if (den === 0n) return null;
  return { num: combinationBig(GRID - mineCount, tilesRevealed), den };
}

/**
 * Fair probability that a SPECIFIC unordered tile pair {i,j} are BOTH mines when m
 * mines are placed uniformly at random on the 25-tile grid — ANTI-CIRCULAR pure
 * combinatorics (hypergeometric). Choose the remaining m−2 mines among the other 23
 * tiles: C(23, m−2) / C(25, m). Defined for m ≥ 2; returns 0 otherwise.
 */
export function pairCoOccurProb(mineCount: number): number {
  if (mineCount < 2) return 0;
  return combination(GRID - 2, mineCount - 2) / combination(GRID, mineCount);
}

/**
 * EXACT payout multiplier — the value liqd now CREDITS (full precision), validated
 * against every captured winningAmount to 2e-8:
 *   multExact = (1 - edge) · Π_{i=0}^{k-1} (25-i)/(25-m-i)
 * Since payout = fair · (1 - edge) with no truncation, the effective RTP is exactly
 * (1 - edge) = 99.00% for every config and reveal depth.
 */
export function minesMultiplierExact(mineCount: number, tilesRevealed: number): number {
  let p = 1;
  for (let i = 0; i < tilesRevealed; i++) p *= (GRID - i) / (GRID - mineCount - i);
  return p * (1 - HOUSE_EDGE);
}

/**
 * The EXACT multiplier as a RATIONAL — numerator and denominator in BigInt, with no
 * floating-point step anywhere:
 *
 *   mult = EDGE_NUM/EDGE_DEN · Π_{i=0}^{k-1} (25−i)/(25−m−i)
 *
 * The retention factor is the same EDGE_NUM/EDGE_DEN the floor8 settlement identity uses, so
 * this function is derived from HOUSE_EDGE rather than from a re-typed `99n/100n` (H-H).
 *
 * Returns `null` for a cell outside the legal grid (k > 25 − m), where the product would divide
 * by zero — the caller decides what a non-cell means rather than receiving a silent Infinity.
 */
export function minesMultiplierRational(
  mineCount: number, tilesRevealed: number,
): { num: bigint; den: bigint } | null {
  if (!Number.isInteger(mineCount) || !Number.isInteger(tilesRevealed)) return null;
  if (mineCount < 1 || mineCount > GRID - 1) return null;
  if (tilesRevealed < 0 || tilesRevealed > GRID - mineCount) return null;
  let num = EDGE_NUM, den = EDGE_DEN;
  for (let i = 0; i < tilesRevealed; i++) {
    num *= BigInt(GRID - i);
    den *= BigInt(GRID - mineCount - i);
  }
  return { num, den };
}

/**
 * DISPLAY multiplier in CENTS — `floor(100 · num / den)` in integer arithmetic.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  QA-03 (2026-09-10) — WHY THIS IS NOT `Math.floor(multExact * 100)`
 * ══════════════════════════════════════════════════════════════════════════════════════
 * It was, until 2026-09-10, and the float form UNDERSTATED **31 of the 300** reference cells by
 * exactly 0.01. `minesMultiplierExact(1, 10)` telescopes to the exact rational 99/100 · 25/15 =
 * 33/20 = 1.65, but evaluated as a chain of binary64 divisions it lands on 1.6499999999999997;
 * ×100 gives 164.99999999999997 and the floor is 164, so the grid published **1.64** for a cell
 * whose exact floor is **1.65**. The other 30 are listed in the erratum in AUDIT_CONTEXT.md §12.2.
 *
 * The reviewer's instruction was explicit and it is the right one: a function that CLAIMS a
 * mathematical floor must not be repaired with an epsilon, and must not silently become a round.
 * An epsilon patch (`Math.floor(x * 100 + 1e-9)`) would move the boundary by an amount nobody
 * can derive from the game's arithmetic, and would then be wrong in the other direction for any
 * cell whose exact value sits within that epsilon BELOW a cent boundary. Integer division has no
 * boundary to tune: `num` and `den` are exact, BigInt `/` truncates toward zero, and both are
 * positive here, so `(100n * num) / den` IS `floor(100 · mult)` by construction.
 *
 * This is COSMETIC in the money sense — the field understates the credited amount and is not
 * what liqd pays (see `minesMultiplierExact`, which settles) — but it is the reference grid the
 * report publishes and the input to the display-payout counterfactual, so a wrong value there is
 * a wrong published number regardless of who it favours.
 */
export function minesMultiplierDisplayCents(mineCount: number, tilesRevealed: number): bigint | null {
  const r = minesMultiplierRational(mineCount, tilesRevealed);
  if (r === null) return null;
  return (100n * r.num) / r.den;
}

/**
 * DISPLAY multiplier — the `multiplier` field liqd returns for the fairness panel is
 * still floored to 2 decimals. This is COSMETIC: it now understates the actual paid
 * amount (player-favourable), and is no longer the value used to compute the payout.
 *   multDisplay = floor( multExact · 100 ) / 100,  computed in exact integer arithmetic.
 *
 * Cents are ≤ 5.15e8 across the whole legal grid (the largest exact multiplier is m=12,k=13 at
 * ≈5.148e6), so `Number(cents)` is exact and the /100 is the only float operation left — one
 * correctly-rounded division of an exactly-representable integer, not a 25-term product.
 *
 * Returns NaN outside the legal grid, which is what the float form returned there too.
 */
export function minesMultiplier(mineCount: number, tilesRevealed: number): number {
  const cents = minesMultiplierDisplayCents(mineCount, tilesRevealed);
  return cents === null ? NaN : Number(cents) / 100;
}

/**
 * Theoretical RTP for a fixed strategy (open k tiles, cash out): win pays the EXACT
 * multiplier (the credited amount), bust pays 0.  RTP = P(win) · multExact = 1 - edge
 * = 99.00% exactly.  Uses anti-circular winProbability.
 */
export function theoreticalRTP(mineCount: number, tilesRevealed: number): number {
  return winProbability(mineCount, tilesRevealed) * minesMultiplierExact(mineCount, tilesRevealed);
}

/**
 * COUNTERFACTUAL RTP if the operator credited the FLOORED DISPLAY multiplier instead of the exact
 * one — the behaviour a prior capture found and this one did not. Computed as one exact rational,
 * `C(25−m,k) · cents / (C(25,k) · 100)`, then divided once.
 *
 * QA-03 again: evaluated as `winProbability(m,k) * minesMultiplier(m,k)` in binary64, the m=1,k=10
 * cell returns 0.9899999999999999 and the edge derived from it 1.0000000000000009e-2 — noise at
 * the 16th digit, immaterial to any published figure but exactly the kind of near-miss that costs
 * a reviewer an hour. There is no reason to leave it in a quantity that has a closed rational form.
 */
export function displayPayoutRTP(mineCount: number, tilesRevealed: number): number {
  const cents = minesMultiplierDisplayCents(mineCount, tilesRevealed);
  const p = winProbabilityRational(mineCount, tilesRevealed);
  if (cents === null || p === null || p.den === 0n) return NaN;
  const SCALE = 10n ** 18n;
  const num = p.num * cents * SCALE;
  const den = p.den * 100n;
  return Number(num / den) / 1e18;
}
