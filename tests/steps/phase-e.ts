/**
 * Step 15: Phase E — Multi-Reveal Verification (mines-specific).
 *
 * Phase E is 400 bets at mineCount 3, reveals 5 — the sequential multi-reveal mode.
 * For each bet:
 *   - assert mineCount === 3 and reveals === 5,
 *   - recompute the mine layout via revealMines and match mineTiles,
 *   - for WINS, verify minesMultiplier(3, openTiles.length) == multiplier, where
 *     openTiles.length is the number of safe tiles opened before cash-out. Every
 *     Phase E win cashes out at k=5 (all 216 wins); losses bust at depths 1–5 with
 *     no payout. Captured winning-payout coverage for m=3 is therefore k ∈ {1, 5}
 *     (k=1 from Phases A/C); k=2–4 are covered analytically (Step 10), not live.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { revealMines, sameMines } from '../../src/rng';
import { minesMultiplier } from '../../src/config';

export function run(ctx: VerifyContext): StepResult[] {
  const { phaseE, seedMap } = ctx;

  if (phaseE.length === 0) {
    return [step(15, 'Phase E — Multi-Reveal Verification', 'FAIL',
      'No Phase E (multi-reveal) bets found in dataset')];
  }

  const failures: string[] = [];
  let layoutChecked = 0, layoutFails = 0;
  let multChecked = 0, multFails = 0, nonFiniteRef = 0;
  const revealDepths = new Set<number>();

  for (const b of phaseE) {
    if (b.mineCount !== 3) failures.push(`bet ${b.id}: mineCount ${b.mineCount} (expected 3)`);
    if (b.reveals !== 5) failures.push(`bet ${b.id}: reveals ${b.reveals} (expected 5)`);

    const ss = seedMap.get(b.hashedServerSeed);
    if (ss) {
      const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
      layoutChecked++;
      if (!sameMines(mines, b.mineTiles)) {
        layoutFails++;
        if (failures.length < 5) failures.push(`bet ${b.id}: mineTiles recompute mismatch`);
      }
    }

    if (b.result === 'won') {
      revealDepths.add(b.openTiles.length);
      const expected = minesMultiplier(b.mineCount, b.openTiles.length);
      multChecked++;
      // P0-3 (same class as Step 10's full-grid sweep): `Math.abs(NaN − x) > 1e-9` is FALSE, so
      // a non-finite value out of the auditor's OWN reference formula would score every Phase-E
      // win as a match. Counted separately and hard-failed — a corrupt reference is not an
      // operator mismatch.
      if (!Number.isFinite(expected)) {
        nonFiniteRef++;
        if (failures.length < 5) failures.push(`bet ${b.id}: minesMultiplier(${b.mineCount},${b.openTiles.length}) returned ${expected} — reference formula corrupt`);
      } else if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(expected - b.multiplier) > 1e-9) {
        multFails++;
        if (failures.length < 5) {
          failures.push(`bet ${b.id}: multiplier ${b.multiplier} != minesMultiplier(3,${b.openTiles.length})=${expected}`);
        }
      }
    }
  }

  // Coverage guard: every Phase-E bet's layout must recompute (layoutChecked === phaseE.length).
  // Without this the step passes vacuously when all server seeds are unrevealed (layoutChecked=0,
  // layoutFails=0), while the multiplier arm still runs on intact data.
  const s15CoverageOk = layoutChecked === phaseE.length;
  const pass = failures.length === 0 && layoutFails === 0 && multFails === 0
    && nonFiniteRef === 0 && s15CoverageOk;
  const depths = [...revealDepths].sort((a, b) => a - b).join(',');
  // Outcome split (emitted so the report's Phase-E narrative has a producing artifact):
  // wins cash out; losses either survived to the 5th reveal and hit a mine there
  // (openTiles.length === 5) or busted at an earlier depth.
  const won = phaseE.filter(b => b.result === 'won').length;
  const lostAtFifth = phaseE.filter(b => b.result !== 'won' && b.openTiles.length === 5).length;
  const lostEarlier = phaseE.filter(b => b.result !== 'won' && b.openTiles.length < 5).length;
  const s15 = step(15, 'Phase E — Multi-Reveal Verification',
    pass ? 'PASS' : 'FAIL',
    pass
      ? `${phaseE.length} multi-reveal bets: all mineCount 3 / reveals 5; ${layoutChecked}/${phaseE.length} mine layouts recomputed; `
        + `${multChecked}/${multChecked} winning multipliers == minesMultiplier(3, openTiles.length) at 1e-9 (reveal depths tested: ${depths}; ${nonFiniteRef} non-finite reference values — a NaN in the auditor's own formula hard-fails rather than scoring as agreement); `
        + `outcome split: ${won} cashed out at depth 5, ${lostAtFifth} hit a mine on the 5th reveal (${won + lostAtFifth} opened all five), ${lostEarlier} busted at depths 1–4`
      : `${failures.length || (s15CoverageOk ? 0 : 1)} issue(s): ${(s15CoverageOk ? failures.slice(0, 3) : [...failures.slice(0, 2), `coverage: ${layoutChecked}/${phaseE.length} layouts recomputed`]).join('; ')}`,
  );

  return [s15];
}
