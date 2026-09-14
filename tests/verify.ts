/**
 * LIQD Mines — Verification suite
 * Run: npm run verify
 *
 * Loads the captured master dataset (SHA-256 guarded), runs all scored steps, and writes THIS
 * RUN's results — pass or fail — under `outputs/run/`, leaving every committed artifact
 * byte-identical.
 *
 * ── VERIFICATION DOES NOT WRITE THE EVIDENCE IT SCORES (client QA 2026-09-10, D1) ───────────────
 * Swept to Mines on 2026-09-11 from the sibling Dice audit, where the client's reviewer found and
 * closed it. Phase 9 of the audit methodology requires a closed finding to be applied as a CLASS
 * across sibling games; this is that sweep, and the structure below is Dice's by intent.
 *
 * Until this revision the tail of this file overwrote `outputs/verification-results.json` on EVERY
 * run, including a failing one. That file IS the scored record, so a run that disagreed with the
 * committed evidence replaced the evidence of the disagreement and the next run compared the repo
 * against what the failing run had just written. A reviewer executed exactly that on Dice: FAIL on
 * Node 24, then PASS on the re-run, with nothing left to show the first result. Repeated testing
 * must not be able to erase an original disagreement.
 *
 * QA round 3 (2026-09-09, item H-B) had already closed the same shape on the OTHER artifact this
 * file writes: `outputs/audit-figures.json` is regenerated only when Step 19 passed, so the
 * verifier cannot heal the very figure artifact it just condemned. That guard is kept below and
 * still applies on the emission path — it is now redundant on the verification path, because the
 * verification path writes nothing into `outputs/` at all.
 *
 * Two modes now, deliberately distinct:
 *   • `npm run verify`  — scores the committed artifacts, writes ONLY under `outputs/run/`
 *                         (this run's results and figures, plus a field-level diff against the
 *                         committed artifacts). Committed bytes are never touched. Run it twice on
 *                         unchanged input and you get the same outcome twice.
 *   • `PF_EMIT=1 …`     — the same run as an EXPLICIT, intentional regeneration of the committed
 *                         artifacts, to be reviewed as a diff before publishing. The figure
 *                         artifact still obeys the H-B rule there: a run whose Step 19 did not
 *                         pass leaves it untouched, and `npm run figures` is the deliberate
 *                         command that rebuilds it on its own.
 *
 * Note: Mines has NO multiplier config file — the payout is a closed-form formula
 * (minesMultiplier). There is therefore NO config artifact to pin; artifactHashes
 * contains ONLY the dataset.
 */

import * as fs from 'fs';
import * as path from 'path';

import { loadDataset } from '../src/loader';
import { revealMines, sameMines } from '../src/rng';
import { EXPECTED_DATASET_HASH } from '../src/pins';
import { computeAuditFigures, AUDIT_FIGURES_FILE } from '../src/figures';
import { fieldDiff } from '../src/diff';
import {
  GRID, HOUSE_EDGE, MINE_COUNTS,
  winProbability, minesMultiplier, minesMultiplierExact, theoreticalRTP,
} from '../src/config';
import type { Bet, Seed } from '../src/types';
import type { VerifyContext, InfoItem } from './steps/context';

import * as commitment  from './steps/commitment';
import * as determinism from './steps/determinism';
import * as payouts     from './steps/payouts';
import * as dataset     from './steps/dataset';
import * as antiCirc    from './steps/anti-circularity';
import * as phaseD      from './steps/phase-d';
import * as phaseE      from './steps/phase-e';
import * as simulation  from './steps/simulation';
import * as statistical from './steps/statistical';
import * as standardization from './steps/standardization';

const DATASET_PATH        = path.join(__dirname, '../data/mines-master-6900bets.json');
// The pin has ONE definition — src/pins.ts — imported by both the producer (src/simulate.ts)
// and this verifier, so a re-pin cannot update one and leave the other behind (P1-9).
const OUTPUTS_DIR         = path.join(__dirname, '../outputs');
/** This run's results. Never a committed artifact; gitignored. */
const RUN_DIR             = path.join(OUTPUTS_DIR, 'run');
/** PF_EMIT=1 is the ONLY thing that rewrites a committed artifact. */
const EMIT                = process.env.PF_EMIT === '1';

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — VERIFICATION SUITE');
console.log('══════════════════════════════════════════════════════════');
console.log(EMIT
  ? '  MODE: REPORT GENERATION (PF_EMIT=1) — the committed artifacts WILL be rewritten'
  : '  MODE: verification — committed artifacts are read-only; results go to outputs/run/');

// ── Dataset presence guard (graceful) ─────────────────────────────────────────
if (!fs.existsSync(DATASET_PATH)) {
  console.log('\n  [ERROR] Dataset not found at data/mines-master-6900bets.json');
  console.log('  Cannot run verification without the captured master dataset.');
  console.log('\n══════════════════════════════════════════════════════════\n');
  process.exit(1);
}

// ── Load dataset (SHA-256 guard exits(1) on mismatch) ─────────────────────────
const ds = loadDataset(DATASET_PATH, EXPECTED_DATASET_HASH);
const bets: Bet[]  = ds.bets;
const seeds: Seed[] = ds.seeds;

// seedMap: hashedServerSeed → revealed serverSeed
const seedMap = new Map<string, string>();
for (const s of seeds) {
  if (s.serverSeed) seedMap.set(s.hashedServerSeed, s.serverSeed);
}

// byHash: hashedServerSeed → bets[]
const byHash = new Map<string, Bet[]>();
for (const b of bets) {
  const arr = byHash.get(b.hashedServerSeed) ?? [];
  arr.push(b);
  byHash.set(b.hashedServerSeed, arr);
}

const phaseABets = bets.filter(b => b.phase === 'A');
const phaseBBets = bets.filter(b => b.phase === 'B');
const phaseCBets = bets.filter(b => b.phase === 'C');
const phaseDBets = bets.filter(b => b.phase === 'D');
const phaseEBets = bets.filter(b => b.phase === 'E');

if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

console.log(`  Dataset: ${bets.length} bets | Seeds: ${seeds.length} | SHA-256 verified`);
console.log(`  Phase A:${phaseABets.length} B:${phaseBBets.length} C:${phaseCBets.length} D:${phaseDBets.length} E:${phaseEBets.length}\n`);

const ctx: VerifyContext = {
  bets, seeds, seedMap, byHash,
  phaseA: phaseABets, phaseB: phaseBBets, phaseC: phaseCBets, phaseD: phaseDBets, phaseE: phaseEBets,
  outputsDir: OUTPUTS_DIR,
  datasetSha256: ds.sha256,
  expectedDatasetHash: EXPECTED_DATASET_HASH,
  meta: ds.meta,
  simArtifact: null,   // populated by the simulation step (FIX-3)
};

// ── Run scored steps ──────────────────────────────────────────────────────────

const results = [
  ...commitment.run(ctx),     // Steps  1– 4
  ...determinism.run(ctx),    // Steps  5– 6
  ...payouts.run(ctx),        // Steps  7–10
  ...dataset.run(ctx),        // Steps 11–12
  ...antiCirc.run(ctx),       // Step  13
  ...phaseD.run(ctx),         // Step  14
  ...phaseE.run(ctx),         // Step  15
  ...simulation.run(ctx),     // Steps 16–17
  ...standardization.run(ctx),// Steps 18–21
];

// ── Informational items ───────────────────────────────────────────────────────

const infoItems: InfoItem[] = statistical.run(ctx);

// ── Summary ───────────────────────────────────────────────────────────────────

const passed   = results.filter(r => r.status === 'PASS').length;
const flags    = results.filter(r => r.status === 'FLAG').length;
const hardFail = results.filter(r => r.status === 'FAIL').length;
const verdict  = hardFail > 0
  ? 'NOT PROVABLY FAIR'
  : flags > 0
    ? 'PROVABLY FAIR — Conditional Pass'
    : 'PROVABLY FAIR — Full Pass';

if (infoItems.length > 0) {
  console.log('');
  console.log('  ┌── Informational Context (not scored) ──');
  for (const item of infoItems) console.log(`  │ ${item.label}: ${item.detail}`);
  console.log('  └──');
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  RESULTS SUMMARY');
console.log('══════════════════════════════════════════════════════════');
console.log(`  Passed:     ${passed}/${results.length}`);
console.log(`  Hard fails: ${hardFail}`);
console.log(`  Flags:      ${flags}`);
console.log(`\n  VERDICT: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');

const verificationBody = {
  generatedAt: new Date().toISOString(),
  totalBets: bets.length,
  totalSeeds: seeds.length,
  datasetSha256: ds.sha256,
  artifactHashes: {
    // Mines has NO multiplier config file — the payout is a formula (minesMultiplier).
    // There is no config artifact to pin, so the dataset is the only pinned artifact.
    // expected = the pin in this file; actual = the recomputed hash; match must be true
    // (loadDataset already exits(1) on mismatch, so a written file always has match: true).
    dataset: {
      file: 'data/mines-master-6900bets.json',
      expected: EXPECTED_DATASET_HASH,
      actual: ds.sha256,
      match: ds.sha256 === EXPECTED_DATASET_HASH,
      sha256: ds.sha256,
    },
    // FIX-3: records WHICH simulation artifact Steps 16–17 actually scored (actual sha256 +
    // its generatedAt). NO `expected` field: `npm test` regenerates the sim fresh each run,
    // so this is a traceability record, not a pinned guard. Null if the sim artifact was absent.
    simulation: ctx.simArtifact,
  },
  steps: results,
  info: infoItems,
  summary: { passed, flags, hardFail, verdict },
};

// ══════════════════════════════════════════════════════════════════════════════════════
//  H-B (QA 2026-09-09) — THE VERIFIER NO LONGER HEALS THE EVIDENCE IT JUST CONDEMNED
// ══════════════════════════════════════════════════════════════════════════════════════
// The figure artifact used to be rewritten unconditionally. Step 19 re-derives
// outputs/audit-figures.json and hard-fails when the copy on disk disagrees with its own
// recomputation — and then that write overwrote the copy with the correct one, in the SAME run.
// Measured:
//
//   edit liveAggregate.liveRTPPercent → 99.0
//   run 1: [FAIL] Step 19, VERDICT: NOT PROVABLY FAIR
//   run 2: nothing else changed — [PASS] Step 19, VERDICT: PROVABLY FAIR — Full Pass,
//          and liveRTPPercent silently back at 99.53605892172152
//
// So the enforcement was real for exactly one run, after which the tampering was gone and the
// repo looked clean. It laundered forged SIMULATION artifacts too, because the `simulation`
// section of the figures is derived from simulation-results.json: the fabricated Pass 1 (H-D)
// hard-failed Step 19 on run 1 and returned 21/21 Full Pass on run 2 with nothing else touched.
//
// The committed artifact is written ONLY on the emission path (PF_EMIT=1) and ONLY when Step 19
// PASSED. After a failure the file on disk is left exactly as found — it is the evidence — and
// regenerating it is a separate, deliberate command (`npm run figures`) that a person has to
// choose to run.
//
// D1 (2026-09-11) extends the same rule to the SCORED RECORD beside it. The figures are still
// recomputed on every run, but on the verification path they go to `outputs/run/`, where they can
// be diffed against the committed copy without replacing it.
const step19 = results.find(r => r.step === 19);
const figuresBody = {
  generatedAt: new Date().toISOString(),
  ...computeAuditFigures({ bets, seeds, seedMap, phaseD: phaseDBets, outputsDir: OUTPUTS_DIR, datasetSha256: ds.sha256 }),
};

const VERIFICATION_FILE = 'verification-results.json';
const write = (dir: string, name: string, body: unknown) =>
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2));
const readJsonOrNull = (p: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

if (EMIT) {
  // ── EXPLICIT REPORT GENERATION (PF_EMIT=1) ──────────────────────────────────────────────────
  // The only path that rewrites a committed artifact. It is a separate mode precisely so that
  // replacing evidence is an act somebody chose, reviewed as a diff, rather than a side effect of
  // testing (D1).
  write(OUTPUTS_DIR, VERIFICATION_FILE, verificationBody);
  console.log(`  REPORT GENERATION: rewrote outputs/${VERIFICATION_FILE}`);
  if (step19?.status === 'PASS') {
    write(OUTPUTS_DIR, AUDIT_FIGURES_FILE, figuresBody);
    console.log(`  REPORT GENERATION: rewrote outputs/${AUDIT_FIGURES_FILE}`);
  } else {
    console.log(`  NOT written: outputs/${AUDIT_FIGURES_FILE} — Step 19 returned ${step19?.status ?? '(absent)'} (H-B).`);
    console.log('  The copy on disk is left untouched so the discrepancy stays visible.');
    console.log('  Regenerate deliberately with `npm run figures`, then re-run `npm run verify`.');
  }
  console.log('  Review the diff before publishing — these are artifacts of record.');
} else {
  // ── VERIFICATION (`npm run verify`) ─────────────────────────────────────────────────────────
  // This run's results, pass or fail, plus a field-level diff against the committed artifacts. A
  // disagreement is RECORDED here; it is not resolved in favour of whichever run wrote last.
  fs.mkdirSync(RUN_DIR, { recursive: true });
  write(RUN_DIR, VERIFICATION_FILE, verificationBody);
  write(RUN_DIR, AUDIT_FIGURES_FILE, figuresBody);

  // `generatedAt` differs by construction on every run and is excluded so the diff shows
  // disagreements only.
  const committedVerification = readJsonOrNull(path.join(OUTPUTS_DIR, VERIFICATION_FILE));
  const committedFigures      = readJsonOrNull(path.join(OUTPUTS_DIR, AUDIT_FIGURES_FILE));
  const verificationDiff = fieldDiff(committedVerification, verificationBody, ['generatedAt']);
  const figuresDiff      = fieldDiff(committedFigures, figuresBody, ['generatedAt']);
  write(RUN_DIR, 'diff.json', {
    generatedAt: verificationBody.generatedAt,
    runtime: process.versions.node,
    verdict,
    note: 'Field-level diff between the COMMITTED artifacts and THIS RUN. `generatedAt` is '
      + 'excluded because it differs by construction. A non-empty diff means this run disagrees '
      + 'with the committed evidence — investigate it; do not re-run until it goes away, and do '
      + 'not regenerate the committed artifact to make it go away.',
    committedReadable: {
      [`outputs/${VERIFICATION_FILE}`]: committedVerification !== null,
      [`outputs/${AUDIT_FIGURES_FILE}`]: committedFigures !== null,
    },
    verificationResultsDiff: verificationDiff,
    auditFiguresDiff: figuresDiff,
  });

  console.log(`  Output (this run only): outputs/run/${VERIFICATION_FILE}, outputs/run/${AUDIT_FIGURES_FILE}, outputs/run/diff.json`);
  console.log('  Committed artifacts NOT modified. Use `PF_EMIT=1 npm run verify` to propose replacements.');
  if (verificationDiff.length || figuresDiff.length) {
    console.log(`  ⚠ THIS RUN DISAGREES WITH THE COMMITTED EVIDENCE — ${verificationDiff.length} field(s) in ${VERIFICATION_FILE}, ${figuresDiff.length} in ${AUDIT_FIGURES_FILE}. See outputs/run/diff.json.`);
  }
}

if (hardFail > 0) process.exit(1);
export {};
