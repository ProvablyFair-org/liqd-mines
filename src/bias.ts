/**
 * The audit's draw-bias bound for LIQD Mines (MINES-08, scored in Step 5).
 *
 * OUR audit helper, not part of the RNG: moved here from src/rng.ts on 20 Oct 2026 when src/rng.ts
 * was replaced by the module rebuilt from docs/ALGORITHM.md. It reads the rebuilt module's own
 * `maxFairFor`, so the bound describes the window the draw (`generateProvablyFairNumber`) applies,
 * and nothing here re-implements the draw.
 */
import { maxFairFor } from './rng';

/**
 * The exact per-value bias of one draw over `range`, conditional on acceptance, computed from
 * `maxFairFor` in integer arithmetic: the accepted chunks are 0 … maxFair−1, each residue r gets
 * floor(maxFair/range) or that plus one of them, and the bias is the largest
 * |count(r)/maxFair − 1/range|. Zero exactly when maxFair is a whole multiple of `range`.
 * Returned as a Number for printing; `exact` says whether it is exactly zero.
 *
 * Note what the 2⁻³² bound alone would NOT catch: a plain `chunk % range` with no rejection at
 * all is biased by (range − 2³² mod range)/(range·2³²) or less — below 2⁻³² for every range
 * 1…25. The declared design here is REJECTION sampling, and for that design the bias must be
 * exactly zero; Step 5 gates on `exact`, and prints the magnitude beside it.
 */
export function drawBias(range: number): { maxFair: number; rejectProbability: number; bias: number; exact: boolean } {
  const TWO32 = 0x1_0000_0000;
  const maxFair = maxFairFor(range);
  const mf = BigInt(maxFair), r = BigInt(range);
  const q = mf / r, rem = mf % r;
  // count(residue) ∈ {q, q+1}; deviation of each from maxFair/range, scaled by range·maxFair.
  const lo = q * r - mf, hi = (q + 1n) * r - mf;          // (count·range − maxFair)
  const worst = rem === 0n ? 0n : (hi > -lo ? hi : -lo);
  return {
    maxFair,
    rejectProbability: (TWO32 - maxFair) / TWO32,
    bias: Number(worst) / (range * maxFair),
    exact: rem === 0n && maxFair > 0 && maxFair <= TWO32,
  };
}
