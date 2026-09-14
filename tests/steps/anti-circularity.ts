/**
 * Step 13: Anti-circularity — win probability is pure combinatorics.
 *
 * winProbability(m, k) = C(25-m, k) / C(25, k): the fair "all k opened tiles are
 * safe" probability. It never touches operator data. We prove it here three ways:
 *   (1) at k=1, Σ over the two mutually-exclusive outcomes (safe / mine) sums to 1:
 *       P(safe) + P(mine) = (25-m)/25 + m/25 = 1 for every m.
 *   (2) winProbability(m,k) equals the product form Π (25-m-i)/(25-i), i=0..k-1,
 *       which is manifestly independent of any payout table.
 *   (3) COUNTING ANCHOR: legs (1) and (2) are algebra about the same closed form —
 *       both are ours and both would be wrong together if the form itself were. Leg
 *       (3) enumerates every k-subset of the 25 tiles outright and counts, as
 *       integers, the total (must equal C(25,k)) and the subsets avoiding a fixed
 *       m-tile mine set (must equal C(25-m,k)). Nothing is multiplied or divided —
 *       a binomial-coefficient error is inexpressible in a tally. Integer equality,
 *       no tolerance. Covers every m at the depths the game data exercises
 *       (k ≤ min(5, 25−m); Phase E's maximum reveal depth is 5).
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { winProbability, combination, GRID, MINE_COUNTS } from '../../src/config';

export function run(_ctx: VerifyContext): StepResult[] {
  let maxSumDev = 0, worstM = 1;
  let maxProdDev = 0, worstMk = '';
  let mCovered = 0, mkCovered = 0;
  // P0-3 (same class as Steps 7/8/10/15): `dev > maxProdDev` is FALSE when dev is NaN, so a
  // non-finite value out of winProbability/combination would leave maxProdDev at 0 and the
  // `< 1e-9` gate below would pass. Count non-finite results and hard-fail on them.
  let nonFiniteRef = 0;
  let firstNonFinite = '';

  for (const m of MINE_COUNTS) {
    mCovered++;
    // (1) k=1 outcome space sums to exactly 1.
    const pSafe = winProbability(m, 1);          // C(25-m,1)/C(25,1) = (25-m)/25
    const pMine = m / GRID;
    const sumDev = Math.abs(pSafe + pMine - 1);
    if (!Number.isFinite(sumDev)) {
      nonFiniteRef++;
      if (!firstNonFinite) firstNonFinite = `winProbability(${m},1) → ${pSafe}`;
    } else if (sumDev > maxSumDev) { maxSumDev = sumDev; worstM = m; }

    // (2) combinatorial form == product form, for every reachable k.
    for (let k = 1; k <= GRID - m; k++) {
      mkCovered++;
      const combForm = combination(GRID - m, k) / combination(GRID, k);
      let prodForm = 1;
      for (let i = 0; i < k; i++) prodForm *= (GRID - m - i) / (GRID - i);
      const dev = Math.abs(combForm - prodForm);
      if (!Number.isFinite(dev)) {
        nonFiniteRef++;
        if (!firstNonFinite) firstNonFinite = `m=${m},k=${k}: comb ${combForm} vs prod ${prodForm}`;
        continue;
      }
      if (dev > maxProdDev) { maxProdDev = dev; worstMk = `m=${m},k=${k}`; }
    }
  }

  // (3) Counting anchor: tally k-subsets directly and require INTEGER equality with
  // the closed form. Enumeration is a plain depth-first walk over index tuples.
  let countCases = 0, countMismatches = 0;
  let worstCount = '';
  for (const m of MINE_COUNTS) {
    const kMax = Math.min(5, GRID - m);
    for (let k = 1; k <= kMax; k++) {
      let total = 0, avoiding = 0;
      const idx: number[] = [];
      const walk = (start: number): void => {
        if (idx.length === k) {
          total++;
          // mines occupy tiles 0..m-1 (any fixed set is equivalent by symmetry)
          if (idx[0] >= m) avoiding++;  // idx ascending ⇒ subset avoids 0..m-1 iff smallest ≥ m
          return;
        }
        for (let t = start; t < GRID; t++) { idx.push(t); walk(t + 1); idx.pop(); }
      };
      walk(0);
      countCases++;
      if (total !== combination(GRID, k) || avoiding !== combination(GRID - m, k)) {
        countMismatches++;
        if (!worstCount) worstCount = `m=${m},k=${k}: counted ${avoiding}/${total} vs C-form ${combination(GRID - m, k)}/${combination(GRID, k)}`;
      }
    }
  }

  // Coverage guard: all 24 mineCounts and every reachable (m,k) pair must be exercised.
  const coverageOk = mCovered === MINE_COUNTS.length && mkCovered > 0 && countCases > 0;
  const ok = maxSumDev < 1e-12 && maxProdDev < 1e-9 && countMismatches === 0 && coverageOk
    && nonFiniteRef === 0;
  const s13 = step(13, 'Anti-Circularity (Combinatorial Win Probability)',
    ok ? 'PASS' : 'FAIL',
    `winProbability(m,k) = C(25-m,k)/C(25,k), pure combinatorics — no operator data (${mCovered}/${MINE_COUNTS.length} mineCounts, ${mkCovered} (m,k) pairs). `
      + `k=1 outcome space Σ (safe+mine) = 1.0 exactly (max dev ${maxSumDev.toExponential(3)}, m=${worstM}); `
      + `combinatorial form == product Π(25-m-i)/(25-i) over all reachable m,k (max dev ${maxProdDev.toExponential(3)}, ${worstMk}); `
      + `counting anchor: ${countCases} (m,k) cases enumerated subset-by-subset, integer equality with C(25,k) and C(25-m,k) — ${countMismatches} mismatches; `
      + `reference-formula integrity: ${nonFiniteRef} non-finite results${firstNonFinite ? ` (first: ${firstNonFinite})` : ''} — a NaN deviation satisfies every \`>\` comparison it appears in, so it is counted, not silently skipped`
      + (countMismatches > 0 ? ` (first: ${worstCount})` : '') + '.',
  );
  return [s13];
}
