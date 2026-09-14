/**
 * Step 14: Phase D — client seed variation (standalone scored step).
 *
 * 500 bets with custom pfaudit- client seeds, cycled mineCounts, reveals=1.
 * Must have ≥2 distinct client seeds and every bet must recompute.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { revealMines, sameMines } from '../../src/rng';

export function run(ctx: VerifyContext): StepResult[] {
  const { phaseD, seedMap } = ctx;

  if (phaseD.length === 0) {
    return [step(14, 'Phase D — Client Seed Variation', 'FLAG',
      'No Phase D bets in dataset (PROVISIONAL)')];
  }

  const clientSeeds = new Set(phaseD.map(b => b.clientSeed));
  const pfauditSeeds = [...clientSeeds].filter(cs => cs.startsWith('pfaudit-'));
  let tested = 0, matched = 0;
  for (const b of phaseD) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    tested++;
    const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
    if (sameMines(mines, b.mineTiles)) matched++;
  }

  // Coverage guard: every Phase-D bet must recompute (tested === phaseD.length); a run that
  // recomputed 0 bets must not pass on `matched === tested` (0 === 0).
  const s14CoverageOk = tested === phaseD.length;
  const s14 = step(14, 'Phase D — Client Seed Variation',
    clientSeeds.size >= 2 && matched === tested && s14CoverageOk ? 'PASS' : 'FLAG',
    `${phaseD.length} bets, ${clientSeeds.size} distinct client seeds `
      + `(${pfauditSeeds.length} pfaudit-*); mine-layout recomputation: ${matched}/${tested} match (${tested}/${phaseD.length} recomputed)`,
  );
  return [s14];
}
