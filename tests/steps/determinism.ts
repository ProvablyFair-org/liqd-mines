/**
 * Steps 5–6: RNG Determinism (mine-layout recomputation)
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_BETS } from '../../src/pins';
import { revealMines, sameMines } from '../../src/rng';

const WRONG_CLIENT = 'wrong-client-seed-test';

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap } = ctx;

  // ── Step 5: Mine-layout recomputation (all 6,900 bets) ────────────────────────
  let mismatches = 0, skipped = 0;
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) { skipped++; continue; }
    const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
    if (!sameMines(mines, b.mineTiles)) mismatches++;
  }
  // Coverage guard: a delivered dataset reveals 100% of seeds, so every bet must recompute.
  // skipped > 0 (e.g. all server seeds nulled) is incomplete coverage → FAIL, never a pass
  // on `mismatches === 0` alone.
  // G-BIND (H-G class sweep, 2026-09-09): "6,900/6,900 recomputed" is the single most-quoted
  // figure in this report, and `bets.length` on both sides of it made it true of whatever the file
  // contained. The denominator is now EXPECTED_BETS from src/pins.ts.
  const s5PopulationOk = bets.length === EXPECTED_BETS;
  const s5 = step(5, 'Mine-Layout Recomputation',
    mismatches === 0 && skipped === 0 && s5PopulationOk ? 'PASS' : 'FAIL',
    `${bets.length - skipped}/${EXPECTED_BETS} bets recomputed against the pinned population (src/pins.ts EXPECTED_BETS, a code constant — not bets.length, which would make this figure true of any capture); revealMines(serverSeed, clientSeed, nonce, mineCount) == mineTiles (draw order); ${mismatches} mismatches; ${skipped} skipped (unrevealed seeds)`
      + (s5PopulationOk ? '' : `; POPULATION FAIL: ${bets.length} bets loaded, ${EXPECTED_BETS} pinned`),
  );

  // ── Step 6: Client seed influence (whole-dataset controls) ────────────────────
  // Recompute EVERY bet's layout under (a) an empty client seed and (b) a fixed wrong
  // client seed, and count how many still reproduce the captured mineTiles. A correct-
  // but-different seed should almost never coincide; the few that do are rare chance
  // collisions, dominated by mineCount 1 (a single mine tile in 25). Both counts are
  // emitted so verification-results.json is the producing artifact for these figures.
  let tested = 0, emptyReproduce = 0, wrongReproduce = 0, emptyMineCount1 = 0;
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    tested++;
    if (sameMines(revealMines(ss, '', b.nonce, b.mineCount), b.mineTiles)) {
      emptyReproduce++;
      if (b.mineCount === 1) emptyMineCount1++;
    }
    if (sameMines(revealMines(ss, WRONG_CLIENT, b.nonce, b.mineCount), b.mineTiles)) wrongReproduce++;
  }
  const changed = tested - wrongReproduce;
  const pct = (n: number) => tested === 0 ? '0.00' : ((n / tested) * 100).toFixed(2);
  // Coverage guard: every bet must have been controlled (tested === bets.length). A run with
  // 0 tested bets must FAIL, not pass the old `tested === 0 || …` short-circuit.
  const s6 = step(6, 'Client Seed Influence',
    tested === bets.length && bets.length === EXPECTED_BETS && changed / tested >= 0.95 ? 'PASS' : 'FAIL',
    `whole-dataset controls over ${tested}/${EXPECTED_BETS} bets (denominator pinned in src/pins.ts): empty clientSeed reproduces ${emptyReproduce}/${tested} `
      + `(${pct(emptyReproduce)}%, ${emptyMineCount1} at mineCount 1 — single-tile chance collisions); `
      + `wrong clientSeed ('${WRONG_CLIENT}') reproduces ${wrongReproduce}/${tested} (${pct(wrongReproduce)}%); `
      + `${changed}/${tested} bets change under a wrong seed`,
  );

  return [s5, s6];
}
