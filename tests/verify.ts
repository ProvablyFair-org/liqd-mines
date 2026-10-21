/**
 * LIQD Mines — Verification suite
 * Run: npm run verify
 *
 * Loads the captured master dataset (SHA-256 guarded), runs all scored steps, and writes THIS
 * RUN's results — pass or fail — under `outputs/run/`, leaving every committed artifact
 * byte-identical.
 *
 * ── VERIFICATION DOES NOT WRITE THE EVIDENCE IT SCORES ──────────────────────────────────────────
 * A tail that overwrote `outputs/verification-results.json` on EVERY run, including a failing one,
 * would destroy the finding it just made: that file IS the scored record, so a run disagreeing
 * with the committed evidence would replace the evidence of the disagreement, and the next run
 * would compare the repo against what the failing run had just written. That has been executed on
 * a sibling audit — FAIL on Node 24, then PASS on the re-run, with nothing left to show the first
 * result. Repeated testing must not be able to erase an original disagreement.
 *
 * The same shape applies to the OTHER artifact this file writes: `outputs/audit-figures.json` is
 * regenerated only when Step 19 passed, so the verifier cannot heal the very figure artifact it
 * just condemned. That guard is kept below and still applies on the emission path — it is
 * redundant on the verification path, because the verification path writes nothing into
 * `outputs/` at all.
 *
 * Two modes now, deliberately distinct:
 *   • `npm run verify`  — scores the committed artifacts, writes ONLY under `outputs/run/`
 *                         (this run's results and figures, plus a field-level diff against the
 *                         committed artifacts). Committed bytes are never touched. Run it twice on
 *                         unchanged input and you get the same outcome twice.
 *   • `PF_EMIT=1 …`     — the same run as an EXPLICIT, intentional regeneration of the committed
 *                         artifacts, to be reviewed as a diff before publishing. The figure
 *                         artifact still obeys the no-self-heal rule there: a run whose Step 19
 *                         did not pass leaves it untouched, and `npm run figures` is the
 *                         deliberate command that rebuilds it on its own.
 *
 * Note: Mines has NO multiplier config file — the payout is a closed-form formula
 * (minesMultiplier). There is therefore NO config artifact to pin; artifactHashes
 * contains ONLY the dataset.
 */

import * as fs from 'fs';
import * as path from 'path';

import { loadDataset } from '../src/loader';
import { revealMines, sameMines } from '../src/rng';
import { EXPECTED_DATASET_HASH, AUDIT_ID } from '../src/pins';
import { computeAuditFigures, AUDIT_FIGURES_FILE } from '../src/figures';
import { fieldDiff, beyondTolerance, maxima, DIFF_ATOL, DIFF_RTOL } from '../src/diff';
import { labelFor, profileCoverageBlock } from '../src/profile-map';
import { runRtpClaimGate, RTP_CLAIM_STEP } from '../src/rtp-settings';
import { rtpClaimVerdict, RTP_FIGURE_OVERSTATED } from '../src/rtp-claim';
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
import * as supplement  from './steps/supplement';
import { runWorkerIfRequested } from '../src/replay-pool';

// REPLAY WORKER BRANCH (src/replay-pool.ts). Steps 16–17 replay the simulation of record and the
// served configurations in parallel child processes of THIS script; a child exits here, before the
// dataset is read or anything is written, so a worker never scores a step.
runWorkerIfRequested();

const DATASET_PATH        = path.join(__dirname, '../data/mines-master-6900bets.json');
// The pin has ONE definition — src/pins.ts — imported by both the producer (src/simulate.ts)
// and this verifier, so a re-pin cannot update one and leave the other behind.
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
  ...supplement.run(ctx),     // Step  22 — the v3 multi-reveal SUPPLEMENT (its own pinned dataset)
];

// ── Profile labels ──────────────────────────────────────────────────────────────
// Each scored step says which ProvablyFair.org Mines profile check it implements, so the
// conformance matrix is DERIVED from the artifact rather than written by hand and left to go stale.
// The label is attached here, to the emitted record only: src/profile-map.ts cannot change what any
// step asserts, and a claim it makes that a step does not decide is a false statement in a
// published artifact, not a passing check.
const labelled = results.map(r => ({ ...r, ...labelFor(r.step) }));

// ── Informational items ───────────────────────────────────────────────────────

const infoItems: InfoItem[] = statistical.run(ctx);

// ── RTP-CLAIM rule (1.2.0, Methodology v1.1; agreed 2026-09-29, 1.2.0 2026-10-14) ──────────────
// The per-setting exact RTP table held to the published claim (src/rtp-settings.ts). While the
// package switch RTP_CLAIM_RULE_ENFORCED (src/rtp-claim-switch.ts) is false this is printed only and no step moves; when it
// is true a miss (gate status OVERSTATED) marks the step carrying MINES-19 OVERSTATED: not a draw FAIL, not counted in
// hardFail, verdict RTP FIGURE OVERSTATED, exit 5 (decision D3, 2026-10-14). A committed table that no longer equals this
// run (or its pin) is a reproduction failure either way (gate status FAIL → step FAIL, exit 1).
const rtpClaim = runRtpClaimGate();
console.log('');
for (const line of rtpClaim.lines) console.log(`  ${line}`);
if (rtpClaim.status === 'FAIL' || rtpClaim.status === 'OVERSTATED') {
  // `labelled` (the emitted record) was copied from `results` above: mark the step in both, or the
  // artifact would carry it as PASS under another verdict.
  const status = rtpClaim.status;
  for (const list of [results, labelled] as any[][]) {
    const s = list.find(r => r.step === RTP_CLAIM_STEP);
    if (s) {
      s.status = status;
      s.detail += status === 'FAIL' ? ' — RTP-CLAIM: the committed table does not match this run or its pin (reproduction failure)'
        : ` — ${RTP_FIGURE_OVERSTATED} (RTP-CLAIM 1.2.0, enforced): ${rtpClaim.result.minimalFix}`;
    }
  }
  console.log(`  [${status === 'FAIL' ? 'FAIL' : RTP_FIGURE_OVERSTATED}] Step ${RTP_CLAIM_STEP} — re-scored by the enforced RTP-CLAIM rule (outcome ${rtpClaim.result.outcome})`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const passed   = results.filter(r => r.status === 'PASS').length;
const flags    = results.filter(r => r.status === 'FLAG').length;
const hardFail = results.filter(r => r.status === 'FAIL').length;
const overstated = results.filter(r => r.status === 'OVERSTATED').length;
// INFO (profile policy INFORMATIONAL — the live-sample fit, 2026-09-29): reported, never counted
// as a flag, never enters the verdict or the exit code.
const informational = results.filter(r => r.status === 'INFO').length;
// A capture-origin FLAG (a DECLARED auditor-side capture-retry nonce gap, Step 4) is disclosed on
// every run but is verdict-neutral; only an operator-origin FLAG downgrades to Conditional Pass
// (policy decided 2026-09-17).
const captureFlags  = results.filter(r => r.status === 'FLAG' && r.origin === 'capture');
const operatorFlags = results.filter(r => r.status === 'FLAG' && r.origin !== 'capture');
// The rule's ranking (src/rtp-claim.ts rtpClaimVerdict): draw fail 1 > INCOMPLETE 3 > RTP FIGURE OVERSTATED 5 >
// Conditional Pass 2 > Full Pass 0. Every step has run by this line, so the run is complete.
const { verdict, exit: verdictExit } = rtpClaimVerdict({ fails: hardFail, complete: true, overstated: overstated > 0, opFlags: operatorFlags.length });

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
if (overstated) console.log(`  RTP figure overstated: Step ${RTP_CLAIM_STEP} (RTP-CLAIM 1.2.0, enforced; not a draw fail)`);
console.log(`  Flags:      ${flags} (${operatorFlags.length} verdict-affecting, ${captureFlags.length} capture-origin)`);
if (informational > 0) console.log(`  Informational deviations: ${informational} (reported, not counted, verdict unchanged)`);
if (captureFlags.length > 0) {
  console.log('\n  CAPTURE-ORIGIN LIMITATIONS (disclosed, verdict-neutral):');
  for (const r of captureFlags) console.log(`  ⚑ Step ${r.step}: ${r.name}`);
}
console.log(`\n  VERDICT: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');

// NO RUN METADATA in the scored record (MINES-27): no timestamp, no timing. The record is pinned
// (src/pins.ts ARTIFACT_PINS), and two runs on the same inputs produce the same bytes.
const verificationBody = {
  auditId: AUDIT_ID,
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
    // Records WHICH simulation artifact Steps 16–17 actually scored (actual sha256). The pin is
    // src/pins.ts ARTIFACT_PINS, asserted by Step 19; `npm run simulate` writes to outputs/run/
    // and no longer rewrites this file. Null if the sim artifact was absent.
    simulation: ctx.simArtifact,
  },
  steps: labelled,
  profileCoverage: profileCoverageBlock(),
  info: infoItems,
  summary: { passed, flags, operatorFlags: operatorFlags.length, captureFlags: captureFlags.length, hardFail, verdict },
};

// ══════════════════════════════════════════════════════════════════════════════════════
//  THE VERIFIER MUST NOT HEAL THE EVIDENCE IT JUST CONDEMNED
// ══════════════════════════════════════════════════════════════════════════════════════
// Rewriting the figure artifact unconditionally defeats Step 19, which re-derives
// outputs/audit-figures.json and hard-fails when the copy on disk disagrees with its own
// recomputation — because that write then overwrites the copy with the correct one, in the SAME
// run. Measured:
//
//   edit liveAggregate.liveRTPPercent → 99.0
//   run 1: [FAIL] Step 19, VERDICT: NOT PROVABLY FAIR
//   run 2: nothing else changed — [PASS] Step 19, VERDICT: PROVABLY FAIR — Full Pass,
//          and liveRTPPercent silently back at 99.53605892172152
//
// The enforcement is then real for exactly one run, after which the tampering is gone and the
// repo looks clean. It launders forged SIMULATION artifacts too, because the `simulation`
// section of the figures is derived from simulation-results.json: a fabricated Pass 1
// hard-fails Step 19 on run 1 and returns 21/21 Full Pass on run 2 with nothing else touched.
//
// The committed artifact is written ONLY on the emission path (PF_EMIT=1) and ONLY when Step 19
// PASSED. After a failure the file on disk is left exactly as found — it is the evidence — and
// regenerating it is a separate, deliberate command (`npm run figures`) that a person has to
// choose to run.
//
// The same rule extends to the SCORED RECORD beside it. The figures are still
// recomputed on every run, but on the verification path they go to `outputs/run/`, where they can
// be diffed against the committed copy without replacing it.
const step19 = results.find(r => r.step === 19);
const figuresBody = {
  ...computeAuditFigures({ bets, seeds, seedMap, phaseD: phaseDBets, outputsDir: OUTPUTS_DIR, datasetSha256: ds.sha256 }),
};

const VERIFICATION_FILE = 'verification-results.json';
const write = (dir: string, name: string, body: unknown) =>
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2));
const readJsonOrNull = (p: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/**
 * Fields on which this run disagrees with the committed artifacts BEYOND the reproduction
 * tolerance. Stays 0 on the emission path, which is regenerating those artifacts rather than
 * checking against them.
 */
let reproductionFailures = 0;

if (EMIT) {
  // ── EXPLICIT REPORT GENERATION (PF_EMIT=1) ──────────────────────────────────────────────────
  // The only path that rewrites a committed artifact. It is a separate mode precisely so that
  // replacing evidence is an act somebody chose, reviewed as a diff, rather than a side effect of
  // testing.
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

  // Nothing is excluded: no committed artifact carries run metadata (absent, not excluded).
  const committedVerification = readJsonOrNull(path.join(OUTPUTS_DIR, VERIFICATION_FILE));
  const committedFigures      = readJsonOrNull(path.join(OUTPUTS_DIR, AUDIT_FIGURES_FILE));
  const verificationDiff = fieldDiff(committedVerification, verificationBody, []);
  const figuresDiff      = fieldDiff(committedFigures, figuresBody, []);

  // THE GATE IS "BEYOND TOLERANCE", NOT "ANY FIELD". The last bits of a derived floating-point
  // statistic are a property of the machine, not of the result: regenerated on other hardware a
  // p-value moves by a unit in the last place. Scoring that as a disagreement trains a reader to
  // ignore the diff, which is the one outcome that makes it useless. The bound is declared in
  // src/diff.ts and sits far below the precision of any figure this audit publishes; outside it
  // is a DIFFERENT result, and the run exits 1.
  const realVerification = beyondTolerance(verificationDiff);
  const realFigures      = beyondTolerance(figuresDiff);
  const realTotal        = realVerification.length + realFigures.length;
  const allDiffs         = [...verificationDiff, ...figuresDiff];
  const gap              = maxima(allDiffs);

  write(RUN_DIR, 'diff.json', {
    generatedAt: new Date().toISOString(),
    runtime: process.versions.node,
    verdict,
    tolerance: { atol: DIFF_ATOL, rtol: DIFF_RTOL, rule: '|a-b| <= atol + rtol*max(|a|,|b|); two distinct integers never agree' },
    reproduced: realTotal === 0,
    beyondToleranceCount: realTotal,
    withinToleranceCount: allDiffs.length - realTotal,
    largestGap: gap,
    note: 'Field-level diff between the COMMITTED artifacts and THIS RUN. Nothing is excluded — '
      + 'no committed artifact carries run metadata. Entries marked `withinTolerance` are the '
      + 'same result computed on different hardware and are recorded, not scored. Any entry NOT '
      + 'so marked means this run disagrees with the committed evidence — investigate it; do not '
      + 're-run until it goes away, and do not regenerate the committed artifact to make it go away.',
    committedReadable: {
      [`outputs/${VERIFICATION_FILE}`]: committedVerification !== null,
      [`outputs/${AUDIT_FIGURES_FILE}`]: committedFigures !== null,
    },
    verificationResultsDiff: verificationDiff,
    auditFiguresDiff: figuresDiff,
  });

  console.log(`  Output (this run only): outputs/run/${VERIFICATION_FILE}, outputs/run/${AUDIT_FIGURES_FILE}, outputs/run/diff.json`);
  console.log('  Committed artifacts NOT modified. Use `PF_EMIT=1 npm run verify` to propose replacements.');
  console.log(`  Reproduction vs the committed artifacts on Node ${process.versions.node}: `
    + `${realTotal === 0 ? 'REPRODUCED' : `${realTotal} field(s) BEYOND TOLERANCE`}`
    + `${allDiffs.length - realTotal > 0 ? ` (${allDiffs.length - realTotal} within tolerance` + (gap ? `, largest ${gap.absDiff.toExponential(2)} at ${gap.path}` : '') + ')' : ''}`);
  if (realTotal > 0) {
    console.log(`  ⚠ THIS RUN DISAGREES WITH THE COMMITTED EVIDENCE — ${realVerification.length} field(s) in ${VERIFICATION_FILE}, ${realFigures.length} in ${AUDIT_FIGURES_FILE}. See outputs/run/diff.json.`);
    for (const d of [...realVerification, ...realFigures].slice(0, 6)) {
      console.log(`      ${d.path}: committed ${JSON.stringify(d.committed)} vs this run ${JSON.stringify(d.thisRun)}`);
    }
  }
  reproductionFailures = realTotal;
}

// Framework 1.1 exit contract: FAIL -> 1, RTP FIGURE OVERSTATED (enforced RTP-CLAIM 1.2.0 miss) -> 5,
// operator FLAG -> 2, otherwise 0. A FLAG that exits 0 is
// invisible to CI, so a Conditional Pass reads as a clean run to anything automated.
// Reproduction beyond tolerance is a FAIL, not a warning: a gate that only prints is not one.
if (hardFail > 0 || reproductionFailures > 0 || !rtpClaim.tableMatches) process.exit(1);
// 5 RTP FIGURE OVERSTATED, 2 Conditional Pass, 0 Full Pass — the code rtpClaimVerdict ranked above.
if (verdictExit !== 0) process.exit(verdictExit);
// A capture-origin FLAG is disclosed but verdict-neutral: exit 0.
export {};
