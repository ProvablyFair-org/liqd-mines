/**
 * Steps 11–12: Dataset Integrity — and THE POPULATION GUARD.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  G-BIND — what these two steps are actually for
 * ══════════════════════════════════════════════════════════════════════════════════════
 * The SHA-256 pin proves the dataset has not changed since we pinned it. It says nothing about
 * whether the file is the capture. Shrink the bets, drop the matching seed rows, edit the header
 * counts to agree, re-pin, and every internal-consistency check in this suite is satisfied by a
 * smaller audit than the one the report describes.
 *
 * The population therefore comes from src/pins.ts — EXPECTED_BETS / EXPECTED_SEEDS / EPOCH_PLAN /
 * EXPECTED_PHASE_BETS / EXPECTED_PHASE_ID_BETS — and a mismatch is a HARD FAIL, not a FLAG. A
 * withheld population is not a disclosable irregularity; it is a different audit.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_BETS, EXPECTED_SEEDS, EXPECTED_PHASE_BETS, EXPECTED_PHASE_ID_BETS, EPOCH_PLAN, EPOCH_SIZES, PROD_CAPTURES } from '../../src/pins';

// The phase labels are the keys of the pinned plan. A row carrying any other label is off plan and
// FAILs, exactly as a missing or miscounted phase does.
const PHASES = Object.keys(EXPECTED_PHASE_BETS).sort();
const PHASE_IDS = Object.keys(EXPECTED_PHASE_ID_BETS).sort();

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seeds } = ctx;

  // ── Step 11: Phase labels + total population ───────────────────────────────────
  const phases = new Set(bets.map(b => b.phase));
  const counts: Record<string, number> = {};
  const idCounts: Record<string, number> = {};
  let rowTagFaults = 0, firstTagFault = '';
  for (const b of bets) {
    counts[b.phase] = (counts[b.phase] ?? 0) + 1;
    idCounts[b.phaseId] = (idCounts[b.phaseId] ?? 0) + 1;
    // Every row's phase, phase id, capture and capture-epoch are the PLAN's for its epoch.
    const pl = EPOCH_PLAN[b.epoch];
    if (!pl || pl.phase !== b.phase || pl.phaseId !== b.phaseId || pl.capture !== b.capture || pl.captureEpoch !== b.captureEpoch) {
      rowTagFaults++;
      if (!firstTagFault) firstTagFault = `bet ${b.id}: epoch ${b.epoch} tagged ${b.phase}/${b.phaseId}/capture ${b.capture}/${b.captureEpoch}, plan ${pl ? `${pl.phase}/${pl.phaseId}/capture ${pl.capture}/${pl.captureEpoch}` : 'has no such epoch'}`;
    }
  }
  const hasAll = PHASES.every(p => phases.has(p));
  const extraLabels = [...phases].filter(p => !PHASES.includes(p));
  const countsOk = PHASES.every(p => counts[p] === EXPECTED_PHASE_BETS[p]);
  const idsOk = PHASE_IDS.every(p => idCounts[p] === EXPECTED_PHASE_ID_BETS[p]) && Object.keys(idCounts).every(p => PHASE_IDS.includes(p));
  // The phase plan must SUM to the pinned population — otherwise the constants could drift
  // apart and a shrink could satisfy whichever one a given step happened to read.
  const planSum = PHASES.reduce((a, p) => a + EXPECTED_PHASE_BETS[p], 0);
  const idSum = PHASE_IDS.reduce((a, p) => a + EXPECTED_PHASE_ID_BETS[p], 0);
  const epochSum = EPOCH_PLAN.reduce((a, e) => a + e.size, 0);
  const planSelfConsistent = planSum === EXPECTED_BETS && idSum === EXPECTED_BETS && epochSum === EXPECTED_BETS
    && PHASE_IDS.every(p => EPOCH_PLAN.filter(e => e.phaseId === p).reduce((a, e) => a + e.size, 0) === EXPECTED_PHASE_ID_BETS[p]);
  // POPULATION GUARD: the delivered dataset must carry exactly EXPECTED_BETS bets. Compared
  // against src/pins.ts, never against the dataset's own meta.plannedTotal or Σ(phase counts).
  const totalOk = bets.length === EXPECTED_BETS;
  const summary = PHASES.map(p => `${p}=${counts[p] ?? 0}`).join(' ');
  const idSummary = PHASE_IDS.map(p => `${p}=${idCounts[p] ?? 0}`).join(' ');
  const s11Faults: string[] = [];
  if (!hasAll) s11Faults.push(`missing phase label(s): ${PHASES.filter(p => !phases.has(p)).join(', ')}`);
  if (extraLabels.length) s11Faults.push(`phase label(s) outside the plan: ${extraLabels.join(', ')}`);
  if (!countsOk) s11Faults.push(`phase count(s) off plan: ${PHASES.filter(p => counts[p] !== EXPECTED_PHASE_BETS[p]).map(p => `${p}=${counts[p] ?? 0}≠${EXPECTED_PHASE_BETS[p]}`).join(', ')}`);
  if (!idsOk) s11Faults.push(`phase id count(s) off plan: ${idSummary}`);
  if (rowTagFaults) s11Faults.push(`${rowTagFaults} row(s) whose phase / capture tags are not the plan's for their epoch (first: ${firstTagFault})`);
  if (!totalOk) s11Faults.push(`POPULATION: ${bets.length} bets loaded, ${EXPECTED_BETS} pinned in src/pins.ts EXPECTED_BETS — the audited population is not the file's to declare`);
  if (!planSelfConsistent) s11Faults.push(`pin table inconsistent: Σ EXPECTED_PHASE_BETS = ${planSum}, Σ EXPECTED_PHASE_ID_BETS = ${idSum}, Σ EPOCH_PLAN sizes = ${epochSum}, EXPECTED_BETS ${EXPECTED_BETS}`);
  const s11 = step(11, 'Phase Labels',
    hasAll && extraLabels.length === 0 && countsOk && idsOk && rowTagFaults === 0 && totalOk && planSelfConsistent ? 'PASS' : 'FAIL',
    `Phases present: ${[...phases].sort().join(', ')} (${summary}); plan ${PHASES.map(p => `${p}=${EXPECTED_PHASE_BETS[p]}`).join(' ')} (src/pins.ts EXPECTED_PHASE_BETS, Σ=${planSum}); `
      + `by phase id (A+ is the phase A top-up): ${idSummary}; plan ${PHASE_IDS.map(p => `${p}=${EXPECTED_PHASE_ID_BETS[p]}`).join(' ')} (EXPECTED_PHASE_ID_BETS, Σ=${idSum}); `
      + `${bets.length - rowTagFaults}/${EXPECTED_BETS} rows carry the phase, phase id, capture and capture-epoch the plan gives their epoch (EPOCH_PLAN); `
      + `there is no separate multi-reveal phase: phase A is multi-reveal on every round and phase D replays its settings (Step 15); `
      + `total ${bets.length}/${EXPECTED_BETS} bets and ${seeds.length}/${EXPECTED_SEEDS} seed records, both against CODE constants in src/pins.ts — not against meta.plannedTotal or any other field of the dataset being scored. `
      + `The published population and phase plan are fixed in source independently of the dataset header.`
      + (s11Faults.length ? `. FAULTS: ${s11Faults.join('; ')}` : ''),
  );

  // ── Step 12: Epoch size + seed population ─────────────────────────────────────
  const epochSizes = new Map<number, number>();
  for (const b of bets) epochSizes.set(b.epoch, (epochSizes.get(b.epoch) ?? 0) + 1);
  const seedCountOk = seeds.length === EXPECTED_SEEDS;
  const epochCountOk = epochSizes.size === EXPECTED_SEEDS;
  // Every epoch of the PLAN must hold exactly its planned number of bets, and no bet may sit in an
  // epoch the plan does not have.
  const wrongSize = EPOCH_PLAN.filter(e => epochSizes.get(e.epoch) !== e.size);
  const offPlanEpochs = [...epochSizes.keys()].filter(e => !EPOCH_PLAN[e]);
  const sizeOk = wrongSize.length === 0 && offPlanEpochs.length === 0;
  // Seed records: one per planned epoch, each carrying the plan's phase tags.
  const seedTagFaults = seeds.filter(sd => { const pl = EPOCH_PLAN[sd.epoch]; return !pl || pl.phase !== sd.phase || pl.phaseId !== sd.phaseId || pl.capture !== sd.capture || pl.captureEpoch !== sd.captureEpoch; }).length;
  const seedEpochsOk = new Set(seeds.map(sd => sd.epoch)).size === seeds.length && seedTagFaults === 0;
  // The pinned constants must be mutually consistent — Σ epoch sizes == bets, epochs == seeds, and
  // each capture's rounds == Σ of its epochs' sizes.
  const captureSumsOk = PROD_CAPTURES.every(c => EPOCH_PLAN.filter(e => e.capture === c.capture).reduce((a, e) => a + e.size, 0) === c.rounds);
  const arithmeticOk = EPOCH_PLAN.length === EXPECTED_SEEDS && EPOCH_PLAN.reduce((a, e) => a + e.size, 0) === EXPECTED_BETS && captureSumsOk;
  const perCapture = PROD_CAPTURES.map(c => {
    const eps = EPOCH_PLAN.filter(e => e.capture === c.capture);
    const got = eps.reduce((a, e) => a + (epochSizes.get(e.epoch) ?? 0), 0);
    return `capture ${c.capture}: ${eps.length} epochs, ${got}/${c.rounds} rounds`;
  }).join('; ');
  const s12Faults: string[] = [];
  if (!seedCountOk) s12Faults.push(`POPULATION: ${seeds.length} seed records, ${EXPECTED_SEEDS} pinned`);
  if (!epochCountOk) s12Faults.push(`POPULATION: ${epochSizes.size} distinct epochs in the bets, ${EXPECTED_SEEDS} pinned`);
  if (!sizeOk) s12Faults.push(`epoch size off plan: ${wrongSize.slice(0, 4).map(e => `epoch ${e.epoch} has ${epochSizes.get(e.epoch) ?? 0}, planned ${e.size}`).join('; ')}${offPlanEpochs.length ? `; epochs outside the plan: ${offPlanEpochs.slice(0, 4).join(', ')}` : ''}`);
  if (!seedEpochsOk) s12Faults.push(`seed records: ${seedTagFaults} whose tags are not the plan's, ${seeds.length - new Set(seeds.map(sd => sd.epoch)).size} duplicate epoch numbers`);
  if (!arithmeticOk) s12Faults.push(`pin arithmetic: EPOCH_PLAN has ${EPOCH_PLAN.length} epochs summing to ${EPOCH_PLAN.reduce((a, e) => a + e.size, 0)}; EXPECTED_SEEDS ${EXPECTED_SEEDS}, EXPECTED_BETS ${EXPECTED_BETS}; capture sums ${captureSumsOk ? 'ok' : 'DIFFER'}`);
  const s12 = step(12, 'Epoch Size',
    seedCountOk && epochCountOk && sizeOk && seedEpochsOk && arithmeticOk ? 'PASS' : 'FAIL',
    `${epochSizes.size}/${EXPECTED_SEEDS} epochs and ${seeds.length}/${EXPECTED_SEEDS} seed records (src/pins.ts EXPECTED_SEEDS); `
      + `${EPOCH_PLAN.length - wrongSize.length}/${EPOCH_PLAN.length} epochs hold exactly their planned number of bets (src/pins.ts EPOCH_PLAN: sizes ${EPOCH_SIZES.join(', ')}; ${perCapture}); ${offPlanEpochs.length} epochs outside the plan; `
      + `Σ planned epoch sizes = ${EPOCH_PLAN.reduce((a, e) => a + e.size, 0)} must equal EXPECTED_BETS ${EXPECTED_BETS}. `
      + `The source constants fix the expected seed and bet population.`
      + (s12Faults.length ? `. FAULTS: ${s12Faults.join('; ')}` : ''),
  );

  return [s11, s12];
}
