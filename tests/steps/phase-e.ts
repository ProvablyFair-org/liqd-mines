/**
 * Step 15: Multi-Reveal Verification (mines-specific).
 *
 * There is no separate multi-reveal phase on production: phase A (5,000 rounds, capture 1) and phase
 * D (500 rounds, capture 2) are multi-reveal on EVERY round — place-bet, then open-tile once per
 * planned tile, then cash-out — at the 20 settings of src/pins.ts PROD_DEPTHS (depths 2 to 15). The
 * step scores those 5,500 rounds; the single-reveal rounds (phase A+ and phase C, one tile) are
 * counted beside them and held to the same layout and multiplier checks. For each round:
 *   - its (mineCount, planned depth) must be a setting of its phase in the plan (SETTINGS_PLAN),
 *   - its mine layout recomputes via revealMines and matches mineTiles (draw order),
 *   - a WIN opened exactly its planned depth and its displayed multiplier equals
 *     minesMultiplier(m, openTiles.length) at 1e-9;
 *   - a LOSS opened no more than its planned depth.
 * The outcome split per setting is emitted so the report's narrative has a producing artifact.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { revealMines, sameMines } from '../../src/rng';
import { minesMultiplier } from '../../src/config';
import { EXPECTED_BETS, PROD_DEPTHS, SETTINGS_PLAN, EXPECTED_PHASE_ID_BETS } from '../../src/pins';

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap } = ctx;

  if (bets.length === 0) {
    return [step(15, 'Multi-Reveal Verification', 'FAIL', 'No multi-reveal rounds found in the dataset')];
  }

  // The 20 multi-reveal cells; a round is multi-reveal when its planned depth is above one tile.
  const plan = new Set(Object.entries(PROD_DEPTHS).flatMap(([m, ks]) => ks.map(k => `${m}:${k}`)));
  const MULTI_PHASES = ['A', 'D'];
  const expectedMulti = MULTI_PHASES.reduce((a, p) => a + EXPECTED_PHASE_ID_BETS[p], 0);
  let multi = 0, single = 0, multiReveals = 0;
  const failures: string[] = [];
  let layoutChecked = 0, layoutFails = 0, offPlan = 0, depthFails = 0, multiPhaseFails = 0;
  let multChecked = 0, multFails = 0, nonFiniteRef = 0;
  const winDepths = new Set<number>();
  const split = new Map<string, { n: number; won: number; lostAtLast: number; lostEarlier: number }>();

  for (const b of bets) {
    const cell = `${b.mineCount}:${b.reveals}`;
    if (!SETTINGS_PLAN.has(`${b.phaseId}|${cell}`)) { offPlan++; if (failures.length < 5) failures.push(`bet ${b.id}: setting (${b.mineCount}, ${b.reveals}) is not in the plan of phase ${b.phaseId}`); }
    const isMulti = b.reveals > 1;
    if (isMulti) { multi++; multiReveals += b.openTiles.length; } else single++;
    // A multi-reveal round must sit in a multi-reveal phase at one of the 20 cells, and vice versa.
    if (isMulti !== MULTI_PHASES.includes(b.phaseId) || (isMulti && !plan.has(cell))) { multiPhaseFails++; if (failures.length < 5) failures.push(`bet ${b.id}: planned depth ${b.reveals} in phase ${b.phaseId}`); }
    const sp = split.get(cell) ?? { n: 0, won: 0, lostAtLast: 0, lostEarlier: 0 };
    if (isMulti) sp.n++;

    const ss = seedMap.get(b.hashedServerSeed);
    if (ss) {
      layoutChecked++;
      if (!sameMines(revealMines(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles)) {
        layoutFails++;
        if (failures.length < 5) failures.push(`bet ${b.id}: mineTiles recompute mismatch`);
      }
    }

    if (b.result === 'won') {
      if (isMulti) sp.won++;
      winDepths.add(b.openTiles.length);
      if (b.openTiles.length !== b.reveals) { depthFails++; if (failures.length < 5) failures.push(`bet ${b.id}: won after ${b.openTiles.length} tiles, planned ${b.reveals}`); }
      const expected = minesMultiplier(b.mineCount, b.openTiles.length);
      multChecked++;
      // NON-FINITE REFERENCE GUARD: a non-finite value out of the auditor's OWN reference would score
      // every win as a match (`Math.abs(NaN − x) > 1e-9` is FALSE). Counted separately and hard-failed.
      if (!Number.isFinite(expected)) {
        nonFiniteRef++;
        if (failures.length < 5) failures.push(`bet ${b.id}: minesMultiplier(${b.mineCount},${b.openTiles.length}) returned ${expected} — reference formula corrupt`);
      } else if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(expected - b.multiplier) > 1e-9) {
        multFails++;
        if (failures.length < 5) failures.push(`bet ${b.id}: multiplier ${b.multiplier} != minesMultiplier(${b.mineCount},${b.openTiles.length})=${expected}`);
      }
    } else {
      if (b.openTiles.length > b.reveals || b.openTiles.length < 1) { depthFails++; if (failures.length < 5) failures.push(`bet ${b.id}: lost after ${b.openTiles.length} tiles, planned ${b.reveals}`); }
      if (isMulti) { if (b.openTiles.length === b.reveals) sp.lostAtLast++; else sp.lostEarlier++; }
    }
    if (isMulti) split.set(cell, sp);
  }

  // Coverage guard: every round's layout must recompute, against the pinned population; the multi-reveal
  // rounds must be exactly phases A and D, at all 20 cells.
  const coverageOk = layoutChecked === bets.length && bets.length === EXPECTED_BETS && split.size === plan.size
    && multi === expectedMulti && multi + single === EXPECTED_BETS;
  const pass = failures.length === 0 && layoutFails === 0 && multFails === 0 && depthFails === 0
    && offPlan === 0 && multiPhaseFails === 0 && nonFiniteRef === 0 && coverageOk;
  const depths = [...winDepths].sort((a, b) => a - b).join(',');
  const won = [...split.values()].reduce((a, x) => a + x.won, 0);
  const lostAtLast = [...split.values()].reduce((a, x) => a + x.lostAtLast, 0);
  const lostEarlier = [...split.values()].reduce((a, x) => a + x.lostEarlier, 0);
  const perCell = [...split].sort(([a], [z]) => {
    const [am, ak] = a.split(':').map(Number), [zm, zk] = z.split(':').map(Number);
    return am - zm || ak - zk;
  }).map(([c, x]) => `(${c.replace(':', ', ')}) ${x.won}/${x.n}`).join(', ');
  const s15 = step(15, 'Multi-Reveal Verification (phases A and D, every round)',
    pass ? 'PASS' : 'FAIL',
    pass
      ? `${multi}/${expectedMulti} multi-reveal rounds — every round of phase A (${EXPECTED_PHASE_ID_BETS.A}) and phase D (${EXPECTED_PHASE_ID_BETS.D}); production has no separate multi-reveal phase — at the ${plan.size} settings of the plan (${split.size}/${plan.size} present, ${offPlan} rounds off plan), ${multiReveals} tiles opened in them; the other ${single} rounds (phase A+ and phase C) open one tile and are held to the same checks; `
        + `${layoutChecked}/${bets.length} mine layouts recomputed; `
        + `${multChecked}/${multChecked} winning multipliers == minesMultiplier(m, openTiles.length) at 1e-9, every win opened exactly its planned depth (win depths ${depths}; ${nonFiniteRef} non-finite reference values — a NaN in the auditor's own formula hard-fails rather than scoring as agreement); `
        + `multi-reveal outcome split: ${won} cashed out at the planned depth, ${lostAtLast} hit a mine on the last planned reveal, ${lostEarlier} busted earlier; wins per setting (phases A and D together, 275 rounds each) ${perCell}`
      : `${failures.length || (coverageOk ? 0 : 1)} issue(s): ${(coverageOk ? failures.slice(0, 3) : [...failures.slice(0, 2), `coverage: ${layoutChecked}/${bets.length} layouts recomputed, ${split.size}/${plan.size} settings present, ${multi}/${expectedMulti} multi-reveal rounds`]).join('; ')}`,
  );

  return [s15];
}
