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

  // PREDICTABLE-SEED DISCLOSURE, ENUMERATED FROM THE DATA. The Phase D client seeds were built as
  // `pfaudit-<stamp>-<epoch>` — a fixed millisecond timestamp and the epoch counter — which does
  // not deny an operator foreknowledge of the client seed the way a CSPRNG seed does. Every epoch
  // whose client seed has that construction is listed here by number, with the stamp decoded, so
  // the exposure is a produced figure and not a sentence. It is carried as MANIFEST DL-13. It is
  // an auditor-side capture-hygiene limit, not an operator defect, and it does not change the
  // verdict: every one of those rounds still recomputes from the committed server seed.
  const PREDICTABLE = /^pfaudit-(\d{13})-(\d+)$/;
  const exposed = new Map<number, string>();
  for (const b of phaseD) {
    const mt = PREDICTABLE.exec(b.clientSeed);
    if (mt && Number(mt[2]) === b.epoch) exposed.set(b.epoch, mt[1]);
  }
  const exposedEpochs = [...exposed.keys()].sort((a, z) => a - z);
  const stamps = [...new Set(exposed.values())];
  const exposedBets = phaseD.filter(b => exposed.has(b.epoch)).length;
  const stampText = stamps.map(st => `${st} (${new Date(Number(st)).toISOString()})`).join(', ');
  const s14 = step(14, 'Phase D — Client Seed Variation',
    clientSeeds.size >= 2 && matched === tested && s14CoverageOk ? 'PASS' : 'FLAG',
    `${phaseD.length} bets, ${clientSeeds.size} distinct client seeds `
      + `(${pfauditSeeds.length} pfaudit-*); mine-layout recomputation: ${matched}/${tested} match (${tested}/${phaseD.length} recomputed). `
      + `Predictable-seed disclosure (MANIFEST DL-13): ${exposedEpochs.length} epoch(s) use the timestamp construction pfaudit-<stamp>-<epoch> — epochs ${exposedEpochs.join(', ') || 'none'}, ${exposedBets} bets, stamp ${stampText || 'n/a'} — `
      + `so for those epochs the client seed does not deny foreknowledge; their rounds rest on the recomputation above and on Steps 16–17, not on the client-seed mitigation.`,
  );
  return [s14];
}
