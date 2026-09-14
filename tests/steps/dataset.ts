/**
 * Steps 11–12: Dataset Integrity — and, since 2026-09-09, THE POPULATION GUARD.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  G-BIND / H-G — what these two steps are actually for
 * ══════════════════════════════════════════════════════════════════════════════════════
 * The SHA-256 pin proves the dataset has not changed since we pinned it. It says nothing about
 * whether the file is the capture. Shrink the bets, drop the matching seed rows, edit the header
 * counts to agree, re-pin, and every internal-consistency check in this suite is satisfied by a
 * smaller audit than the one the report describes.
 *
 * Both Stage 8 reviewers did that on 2026-09-09. On mines, dropping ONE trailing epoch (50 bets +
 * its seed) returned "PROVABLY FAIR — Conditional Pass, exit 0" — a DOWNGRADE, not a rejection,
 * and the framework's gate-population battery scored the rejection as INCIDENTAL because the only
 * thing that noticed was a derived simulation artifact still describing the old population.
 * Regenerate that artifact — one command — and the shrink walks straight through.
 *
 * The cause was that every count here was self-referential: `expected` was a literal phase table
 * that happened to match, the epoch check compared against `seeds.length`, and Step 7/8's coverage
 * guard used `seeds.length × 50`. All three operands came out of the file being scored.
 *
 * The population now comes from src/pins.ts — EXPECTED_BETS / EXPECTED_SEEDS /
 * EXPECTED_EPOCH_SIZE / EXPECTED_PHASE_BETS — and a mismatch is a HARD FAIL, not a FLAG. A
 * withheld population is not a disclosable irregularity; it is a different audit.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_BETS, EXPECTED_SEEDS, EXPECTED_EPOCH_SIZE, EXPECTED_PHASE_BETS } from '../../src/pins';

const PHASES = ['A', 'B', 'C', 'D', 'E'] as const;

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seeds } = ctx;

  // ── Step 11: Phase labels + total population ───────────────────────────────────
  const phases = new Set(bets.map(b => b.phase));
  const counts: Record<string, number> = {};
  for (const b of bets) counts[b.phase] = (counts[b.phase] ?? 0) + 1;
  const hasAll = PHASES.every(p => phases.has(p));
  const countsOk = PHASES.every(p => counts[p] === EXPECTED_PHASE_BETS[p]);
  // The phase plan must SUM to the pinned population — otherwise the two constants could drift
  // apart and a shrink could satisfy whichever one a given step happened to read.
  const planSum = PHASES.reduce((a, p) => a + EXPECTED_PHASE_BETS[p], 0);
  const planSelfConsistent = planSum === EXPECTED_BETS;
  // POPULATION GUARD: the delivered dataset must carry exactly EXPECTED_BETS bets. Compared
  // against src/pins.ts, never against the dataset's own meta.plannedTotal or Σ(phase counts).
  const totalOk = bets.length === EXPECTED_BETS;
  const summary = PHASES.map(p => `${p}=${counts[p] ?? 0}`).join(' ');
  const s11Faults: string[] = [];
  if (!hasAll) s11Faults.push(`missing phase label(s): ${PHASES.filter(p => !phases.has(p)).join(', ')}`);
  if (!countsOk) s11Faults.push(`phase count(s) off plan: ${PHASES.filter(p => counts[p] !== EXPECTED_PHASE_BETS[p]).map(p => `${p}=${counts[p] ?? 0}≠${EXPECTED_PHASE_BETS[p]}`).join(', ')}`);
  if (!totalOk) s11Faults.push(`POPULATION: ${bets.length} bets loaded, ${EXPECTED_BETS} pinned in src/pins.ts EXPECTED_BETS — the audited population is not the file's to declare`);
  if (!planSelfConsistent) s11Faults.push(`pin table inconsistent: Σ EXPECTED_PHASE_BETS = ${planSum} != EXPECTED_BETS ${EXPECTED_BETS}`);
  const s11 = step(11, 'Phase Labels',
    hasAll && countsOk && totalOk && planSelfConsistent ? 'PASS' : 'FAIL',
    `Phases present: ${[...phases].sort().join(', ')} (${summary}); plan A=${EXPECTED_PHASE_BETS.A} B=${EXPECTED_PHASE_BETS.B} C=${EXPECTED_PHASE_BETS.C} D=${EXPECTED_PHASE_BETS.D} E=${EXPECTED_PHASE_BETS.E} (src/pins.ts EXPECTED_PHASE_BETS, Σ=${planSum}); `
      + `total ${bets.length}/${EXPECTED_BETS} bets and ${seeds.length}/${EXPECTED_SEEDS} seed records, both against CODE constants in src/pins.ts — not against meta.plannedTotal or any other field of the dataset being scored. `
      + `The published population and phase plan are fixed in source independently of the dataset header.`
      + (s11Faults.length ? `. FAULTS: ${s11Faults.join('; ')}` : ''),
  );

  // ── Step 12: Epoch size + seed population ─────────────────────────────────────
  const epochSizes = new Map<number, number>();
  for (const b of bets) epochSizes.set(b.epoch, (epochSizes.get(b.epoch) ?? 0) + 1);
  const sizes = [...epochSizes.values()];
  const minSize = sizes.length ? Math.min(...sizes) : 0;
  const maxSize = sizes.length ? Math.max(...sizes) : 0;
  const seedCountOk = seeds.length === EXPECTED_SEEDS;
  const epochCountOk = epochSizes.size === EXPECTED_SEEDS;
  const sizeOk = sizes.length > 0 && minSize === EXPECTED_EPOCH_SIZE && maxSize === EXPECTED_EPOCH_SIZE;
  // The three pinned constants must be mutually consistent — seeds × epoch size == bets.
  const arithmeticOk = EXPECTED_SEEDS * EXPECTED_EPOCH_SIZE === EXPECTED_BETS;
  const s12Faults: string[] = [];
  if (!seedCountOk) s12Faults.push(`POPULATION: ${seeds.length} seed records, ${EXPECTED_SEEDS} pinned`);
  if (!epochCountOk) s12Faults.push(`POPULATION: ${epochSizes.size} distinct epochs in the bets, ${EXPECTED_SEEDS} pinned`);
  if (!sizeOk) s12Faults.push(`epoch size min=${minSize} max=${maxSize}, ${EXPECTED_EPOCH_SIZE} pinned`);
  if (!arithmeticOk) s12Faults.push(`pin arithmetic: ${EXPECTED_SEEDS} × ${EXPECTED_EPOCH_SIZE} != ${EXPECTED_BETS}`);
  const s12 = step(12, 'Epoch Size',
    seedCountOk && epochCountOk && sizeOk && arithmeticOk ? 'PASS' : 'FAIL',
    `${epochSizes.size}/${EXPECTED_SEEDS} epochs and ${seeds.length}/${EXPECTED_SEEDS} seed records (src/pins.ts EXPECTED_SEEDS); `
      + `min=${minSize}, max=${maxSize} bets per epoch against EXPECTED_EPOCH_SIZE ${EXPECTED_EPOCH_SIZE}; `
      + `${EXPECTED_SEEDS} × ${EXPECTED_EPOCH_SIZE} = ${EXPECTED_SEEDS * EXPECTED_EPOCH_SIZE} must equal EXPECTED_BETS ${EXPECTED_BETS}. `
      + `The source constants fix the expected seed and bet population.`
      + (s12Faults.length ? `. FAULTS: ${s12Faults.join('; ')}` : ''),
  );

  return [s11, s12];
}
