/**
 * Forged-evidence battery (falsifiability, part 2) — run: npm run forgeries
 *
 * `npm run mutations` breaks the AUDITOR'S CODE and checks the suite notices. This file breaks
 * the AUDITOR'S EVIDENCE — the captured dataset, the simulation artifact and the derived-figure
 * artifact — and checks the same thing. They are different failure classes and neither substitutes for the other: an
 * external review in September 2026 found seven separate hand-built simulation artifacts that
 * scored 21/21 "PROVABLY FAIR — Full Pass" against a verifier whose every source mutation was
 * caught. The code was fine. The evidence binding was not.
 *
 * Every entry below is a counterexample somebody actually executed against this repo — mostly
 * the two independent reviewers (Claude and ChatGPT) in the 2026-09-09 QA round, a few found
 * in-house — recorded here so that a closed class stays closed. That is the point of a
 * registry: not to prove the current build is sound, but to stop the NEXT build from
 * rediscovering a defect this one already paid for.
 *
 * MECHANICS. Each entry mutates a fresh throwaway copy of the repo (`src tests data outputs` +
 * config, `node_modules` symlinked). The working tree is never touched. Dataset mutations
 * additionally RE-PIN `src/pins.ts` to the mutated file's SHA-256, because otherwise every one
 * of them would abort in the loader and prove nothing about the steps below it — the loader
 * abort itself is entry D16, tested on its own terms. Each entry declares the verdict the
 * mutated run must print and the step that must change status; a run that flips the verdict
 * through some OTHER step is a MISS, because the guard that was supposed to fire did not.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const COPY = ['src', 'tests', 'data', 'outputs', 'tsconfig.json', 'package.json', '.mocharc.yml'];
const DATASET_REL = 'data/mines-master-6900bets.json';
const SIM_REL = 'outputs/simulation-results.json';
const FIG_REL = 'outputs/audit-figures.json';

type Target = 'dataset' | 'artifact' | 'figures' | 'none';
interface Forgery {
  id: string;
  name: string;
  origin: string;
  target: Target;
  /** Mutates the parsed JSON in place (or returns a replacement). `root` is the temp repo. */
  mutate: (doc: any, root: string) => any | void;
  /** Verdict line the mutated run must print. `null` = the run must abort with no verdict. */
  expect: string | null;
  /** The step that must change status (omitted when the run aborts before scoring). */
  step?: number;
  status?: 'FAIL' | 'FLAG';
  /**
   * How many consecutive `verify` runs to make; the LAST one is the one scored. Default 1.
   *
   * `runs: 2` exists for the self-heal class (A19). tests/verify.ts used to rewrite
   * outputs/audit-figures.json unconditionally at the end of the same run that hard-failed
   * Step 19, so a single-run battery would have called that forgery REJECTED while the tampering
   * silently disappeared and every run after the first read clean. Asserting on the SECOND run is
   * what makes the guard's persistence testable at all: the question is never "did it fail once",
   * it is "is the finding still there tomorrow".
   */
  runs?: number;
}

/** Deep clone helper for the duplicate-row forgeries. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const FORGERIES: Forgery[] = [
  // ── Dataset: money ──────────────────────────────────────────────────────────
  {
    id: 'D01', name: 'one win over-credited by +3e-8', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won'); b.winningAmount = Math.round((b.winningAmount + 3e-8) * 1e8) / 1e8; },
  },
  {
    id: 'D02', name: 'EVERY win under-credited by exactly 1e-8 (a uniform shift, invisible to a +-2e-8 band)', origin: 'reviewer battery §4 (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { for (const b of d.bets) if (b.result === 'won') b.winningAmount = Math.round((b.winningAmount - 1e-8) * 1e8) / 1e8; },
  },
  {
    id: 'D03', name: 'one win over-credited by +1e-8 (0.103125 -> 0.10312501)', origin: 'reviewer battery §4 (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.winningAmount === 0.103125); b.winningAmount = 0.10312501; },
  },
  {
    id: 'D04', name: 'one credit OFF the 1e-8 grid (0.103125 -> 0.103125001, a ninth decimal)', origin: 'QA P1-1 — the floor8 identity rounds it back ON to the grid before comparing',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.winningAmount === 0.103125); b.winningAmount = 0.103125001; },
  },
  {
    id: 'D05', name: 'legacy 2-decimal credit (0.103125 -> 0.103)', origin: 'reviewer battery §4; the July capture actually paid this',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.winningAmount === 0.103125); b.winningAmount = 0.103; },
  },
  {
    id: 'D06', name: 'a LOSS credited 0.00000001', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result !== 'won'); b.winningAmount = 0.00000001; },
  },
  {
    id: 'D07', name: 'a loss relabelled "won" (payout math left consistent with the label)', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result !== 'won'); b.result = 'won'; },
  },
  {
    id: 'D08', name: 'displayed multiplier +0.01', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 7, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won'); b.multiplier = Math.round((b.multiplier + 0.01) * 100) / 100; },
  },
  // ── Dataset: layout and commitment ──────────────────────────────────────────
  {
    id: 'D09', name: 'one mineTiles entry changed', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 5, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.mineTiles.length > 1); b.mineTiles[1] = b.mineTiles[1] === 25 ? 24 : b.mineTiles[1] + 1; },
  },
  {
    id: 'D10', name: 'one revealed serverSeed nibble changed', origin: 'reviewer battery §4',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 1, status: 'FAIL',
    mutate: d => { const s = d.seeds[0]; s.serverSeed = (s.serverSeed[0] === 'a' ? 'b' : 'a') + s.serverSeed.slice(1); },
  },
  {
    id: 'D11', name: 'meta.preCapture.nextHashedServerSeed zeroed (the pre-capture chain anchor)', origin: 'reviewer battery §4 (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 2, status: 'FAIL',
    mutate: d => { d.meta.preCapture.nextHashedServerSeed = '0'.repeat(64); },
  },
  // ── Dataset: the nonce window (QA P0-5) ─────────────────────────────────────
  {
    id: 'D12', name: 'duplicate nonce (epoch 0 nonce 49 replaced by a copy of nonce 0)', origin: 'reviewer battery §4 (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: d => {
      const b0 = d.bets.find((x: any) => x.epoch === 0 && x.nonce === 0);
      const i = d.bets.findIndex((x: any) => x.epoch === 0 && x.nonce === 49);
      d.bets[i] = clone(b0); d.bets[i].id = `${b0.id}_dup`;
    },
  },
  {
    id: 'D13', name: 'epoch 0 nonces shifted to 1..50 (internally contiguous, wrong window)', origin: 'reviewer battery §4 (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: (d, root) => {
      // Layouts are genuinely re-derived for the shifted nonces, so Step 5 stays clean and the
      // ONLY thing that can catch this is the window assertion in Step 4.
      const { revealMines } = require(path.join(root, 'src', 'rng'));
      const s0 = d.seeds.find((s: any) => s.epoch === 0);
      for (const b of d.bets.filter((x: any) => x.epoch === 0)) {
        b.nonce += 1;
        b.mineTiles = revealMines(s0.serverSeed, b.clientSeed, b.nonce, b.mineCount);
        b.localMines = b.mineTiles.slice();
      }
    },
  },
  {
    id: 'D14', name: 'epoch 0 truncated: the bet at nonce 49 deleted, declared window still 0..49', origin: 'in-house, QA P0-5 — nonceEnd was never checked at all',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: d => { d.bets = d.bets.filter((x: any) => !(x.epoch === 0 && x.nonce === 49)); },
  },
  {
    id: 'D15', name: 'INTERIOR nonce gap with the window moved to match (nonce 49 orphaned, 50 genuinely re-derived)', origin: 'reviewer mutation X',
    // A gap is a Conditional Pass, NOT a clean pass: replaying the bets that are present cannot
    // establish why one is absent. Before 2026-09-09 this printed "PROVABLY FAIR — Full Pass"
    // with a Step 4 detail that claimed "no interior gaps" and described the gap in one sentence.
    target: 'dataset', expect: 'PROVABLY FAIR — Conditional Pass', step: 4, status: 'FLAG',
    mutate: (d, root) => {
      const { revealMines } = require(path.join(root, 'src', 'rng'));
      const s0 = d.seeds.find((s: any) => s.epoch === 0);
      const b = d.bets.find((x: any) => x.epoch === 0 && x.nonce === 49);
      b.nonce = 50;
      b.mineTiles = revealMines(s0.serverSeed, b.clientSeed, 50, b.mineCount);
      b.localMines = b.mineTiles.slice();
      s0.nonceEnd = 50;
    },
  },
  // ── Simulation artifact: Pass 1 (QA P0-1) ───────────────────────────────────
  {
    id: 'A01', name: 'summary-only artifact — every detail row deleted from both passes', origin: 'reviewer battery §4',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results = []; s.pass2_casino_seeds.results = []; },
  },
  {
    id: 'A02', name: 'one Pass-1 row\'s firstDrawPValue set to 0 (summary scalars left clean)', origin: 'reviewer battery §4',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[3].firstDrawPValue = 0; },
  },
  {
    id: 'A03', name: 'configs: 1 with a single real-shaped row and a self-consistent header', origin: 'reviewer mutation N3 — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const p1 = s.pass1_fresh_seeds; const r = p1.results[0];
      p1.configs = 1; p1.totalRounds = p1.roundsPerConfig; p1.results = [r];
      p1.jointConfigsTested = 0; p1.jointFailsAtAlpha01 = 0; p1.jointFailsBonferroni = 0;
      p1.jointMaxAbsZAcrossConfigs = 0; p1.bonferroniAlpha = 0.01;
      p1.meanSimulatedRTP = r.simRTP; p1.meanTheoreticalRTP = r.theoreticalRTP;
    },
  },
  {
    id: 'A04', name: '24 copies of the m=1 row (row COUNT preserved, identity destroyed)', origin: 'reviewer mutation T — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const p1 = s.pass1_fresh_seeds; const r = p1.results[0];
      p1.results = Array.from({ length: 24 }, () => clone(r));
      p1.jointConfigsTested = 0; p1.jointFailsAtAlpha01 = 0; p1.jointFailsBonferroni = 0;
      p1.jointMaxAbsZAcrossConfigs = 0;
      p1.meanSimulatedRTP = r.simRTP; p1.meanTheoreticalRTP = r.theoreticalRTP;
    },
  },
  {
    id: 'A05', name: 'self-consistent nonsense — every simRTP AND theoreticalRTP set to 0.5', origin: 'reviewer mutation V — scored FULL PASS before 2026-09-09 (the old band compared two artifact fields to each other)',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      for (const r of s.pass1_fresh_seeds.results) { r.simRTP = 0.5; r.theoreticalRTP = 0.5; }
      s.pass1_fresh_seeds.meanSimulatedRTP = 0.5; s.pass1_fresh_seeds.meanTheoreticalRTP = 0.5;
    },
  },
  {
    id: 'A06', name: 'one Pass-1 row re-seeded (statistics kept, serverSeed/clientSeed replaced)', origin: 'in-house — attacks the convergence re-draw specifically',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[7].serverSeed = 'f'.repeat(32); },
  },
  {
    id: 'A07', name: 'roundsPerConfig lowered to 1,000 (every statistical band widens with it)', origin: 'G-BIND item 1 — a threshold sized by an artifact-supplied n is forger-controlled',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const p1 = s.pass1_fresh_seeds; p1.roundsPerConfig = 1000; p1.totalRounds = 24000; },
  },
  // ── Simulation artifact: Pass 2 (QA P0-2) ───────────────────────────────────
  {
    id: 'A08', name: '138 empty {} seed rows (0 flags, survival 1)', origin: 'reviewer mutation S — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.pass2_casino_seeds.results = Array.from({ length: 138 }, () => ({}));
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A09', name: '138 copies of one unflagged epoch row', origin: 'reviewer mutation U — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const r = s.pass2_casino_seeds.results.find((x: any) => !x.cherryPickFlag);
      s.pass2_casino_seeds.results = Array.from({ length: 138 }, () => clone(r));
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A10', name: 'every row earlyBootstrapP=1e-10, latePValue=0.5, cherryPickFlag=false (the stated criterion makes all 138 flags)', origin: 'reviewer mutation, ChatGPT — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      for (const r of s.pass2_casino_seeds.results) { r.earlyBootstrapP = 1e-10; r.latePValue = 0.5; r.cherryPickFlag = false; }
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A11', name: 'one flagged row\'s stored cherryPickFlag flipped to false (scalars adjusted to match)', origin: 'G-BIND item 4 — the stored boolean must equal the DERIVED one',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const p2 = s.pass2_casino_seeds;
      const r = p2.results.find((x: any) => x.cherryPickFlag);
      if (!r) throw new Error('no flagged row to unflag — this forgery no longer applies');
      r.cherryPickFlag = false; p2.cherryPickFlags -= 1;
    },
  },
  {
    id: 'A12', name: 'one Pass-2 row\'s epoch and hash swapped for another epoch\'s', origin: 'G-BIND item 2 — row identity against the dataset anchor',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => { s.pass2_casino_seeds.results[5].hashedServerSeed = s.pass2_casino_seeds.results[6].hashedServerSeed; },
  },
  // ── Simulation artifact: structure ──────────────────────────────────────────
  {
    id: 'A13', name: 'an undeclared field added to every Pass-1 row', origin: 'G-BIND item 0 — the key-path inventory is the only guard that fails closed on a forgery class nobody has thought of',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { for (const r of s.pass1_fresh_seeds.results) r.qualityScore = 1; },
  },
  {
    id: 'A14', name: 'artifact houseEdge set to 0.005 (half the audited edge)', origin: 'in-house — the artifact must agree with src/config.ts, not narrate its own constants',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.houseEdge = 0.005; },
  },
  {
    id: 'A15', name: 'simulation artifact absent entirely', origin: 'framework — a MISSING input is an incomplete run, not a fairness breach',
    // The one entry here whose correct answer is NOT a hard fail: a fresh clone that has not run
    // `npm run simulate` yet must FLAG (Conditional Pass), reserving "NOT PROVABLY FAIR" for
    // actual fairness breaches. It is in the battery so that this stays a deliberate choice.
    target: 'artifact', expect: 'PROVABLY FAIR — Conditional Pass', step: 16, status: 'FLAG',
    mutate: (_s, root) => { fs.rmSync(path.join(root, SIM_REL)); return null; },
  },
  // ── The derived-figure artifact (outputs/audit-figures.json) ────────────────
  // This file was introduced on 2026-09-09 to give the report's prose figures a producing step,
  // and within minutes the framework's own forged-artifact gate caught the obvious consequence:
  // it was WRITTEN by tests/verify.ts and read by nothing, so editing it left the suite printing
  // 21/21 Full Pass. Step 19 now re-derives it and compares. Both cases are kept here because a
  // write-only artifact that the report cites is a defect shape, not a one-off.
  {
    id: 'A16', name: 'a headline figure edited in audit-figures.json (live RTP moved to 99.0%)', origin: 'in-house 2026-09-09, via the framework gate-forgery battery',
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (j: any) => { j.liveAggregate.liveRTPPercent = 99.0; },
  },
  {
    id: 'A17', name: 'audit-figures.json reference grid emptied (300 cells -> 0)', origin: 'in-house 2026-09-09, via the framework gate-forgery battery (F1 empty population)',
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (j: any) => { j.referenceGrid = []; },
  },
  // ══════════════════════════════════════════════════════════════════════════
  //  QA ROUND 3 — 2026-09-09. Two independent reviewers rebuilt this audit from the published
  //  chapters and REFUTED NOTHING: every dataset number reproduced. Everything below lived in
  //  the HARNESS, and every one was EXECUTED against this repo before the fix.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'A18', name: 'H-A — outputs/audit-figures.json DELETED (the guard\'s own evidence removed)',
    origin: 'QA round 3, item H-A — measured `[PASS] Step 19`, 21/21 Full Pass',
    // Step 19 treated an absent figure artifact as "a fresh clone has not run verify yet" and
    // PASSED. Deleting a file is strictly easier than editing it, so the absent arm was a bypass
    // around the edited arm beside it. The delivered repo ships this artifact (.gitignore
    // un-ignores it by name); absent means removed.
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (_j: any, root: string) => { fs.rmSync(path.join(root, FIG_REL)); return null; },
  },
  {
    id: 'A19', name: 'H-B — a headline figure edited, then verify run TWICE (the self-heal)',
    origin: 'QA round 3, item H-B — run 1 FAIL, run 2 PASS with nothing else changed',
    // tests/verify.ts rewrote audit-figures.json unconditionally at the end of the same run that
    // hard-failed Step 19, so the enforcement lasted exactly one run and then erased the evidence.
    // This entry runs the verifier TWICE (see runForgery's `runs` handling) and asserts the SECOND
    // run still fails — the first run failing was never the problem.
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL', runs: 2,
    mutate: (j: any) => { j.liveAggregate.liveRTPPercent = 99.0; },
  },
  {
    id: 'A20', name: 'H-C — firstDrawChi2 set to 500 with its p-value left at 0.7787',
    origin: 'QA round 3, item H-C — measured `[PASS] Step 16`, 21/21 Full Pass',
    // A χ² of 500 on 24 df has p ≈ 1e-89. The statistic and the p-value were two independent
    // numbers and nothing checked they described the same event; every FWER count is computed
    // from the p, so the statistic beside it could say anything.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[0].firstDrawChi2 = 500; },
  },
  {
    id: 'A21', name: 'H-C(b) — jointPValue left clean while jointMaxAbsZ is moved to 9.99',
    origin: 'QA round 3, item H-C — the same class on the pairwise-joint leg',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const r = s.pass1_fresh_seeds.results.find((x: any) => x.jointMaxAbsZ !== null); r.jointMaxAbsZ = 9.99; },
  },
  {
    id: 'A22', name: 'H-C(c) — layoutRunsPValue left clean while layoutRunsZ is moved',
    origin: 'QA round 3, item H-C — the same class on the runs leg',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[2].layoutRunsZ = 4.5; },
  },
  {
    id: 'A23', name: 'H-D — a FABRICATED Pass 1 forged to the exact centre of every band',
    origin: 'QA round 3, item H-D — measured 21/21 PROVABLY FAIR — Full Pass',
    // simRTP = theoreticalRTP, firstDrawChi2 = 24, firstDrawPValue = 0.5, layoutR1/R1Z/RunsZ = 0,
    // jointMaxAbsZ = 0, jointPValue = 1, summary scalars recomputed. Every threshold in Step 16
    // was one-sided — "is this too extreme?" — so a value at the dead centre of the null passed
    // all of them. Perfection is evidence of fabrication, not of fairness. Four guards now fire:
    // p-value reconciliation, the simRTP↔convergence identity, the lower-tail screen, and the
    // exact-zero screen.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const P = s.pass1_fresh_seeds;
      for (const r of P.results) {
        r.simRTP = r.theoreticalRTP;
        r.firstDrawChi2 = 24; r.firstDrawPValue = 0.5;
        r.layoutR1 = 0; r.layoutR1Z = 0; r.layoutRunsZ = 0; r.layoutRunsPValue = 1;
        if (r.jointMaxAbsZ !== null) { r.jointMaxAbsZ = 0; r.jointPValue = 1; }
      }
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
      P.meanTheoreticalRTP = P.results.reduce((a: number, r: any) => a + r.theoreticalRTP, 0) / P.results.length;
      P.firstDrawChi2FailsBonferroni = 0; P.firstDrawChi2FailsAtAlpha01 = 0;
      P.jointFailsBonferroni = 0; P.jointFailsAtAlpha01 = 0;
      P.layoutSerialFailsBonferroni = 0; P.layoutSerialFailsUncorrected = 0;
      P.jointMaxAbsZAcrossConfigs = 0;
    },
  },
  {
    id: 'A24', name: 'H-D(b) — one simRTP moved off its own final convergence checkpoint (still inside 5·SE)',
    origin: 'QA round 3, item H-D — the free cross-check the band could never provide',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const r = s.pass1_fresh_seeds.results[11]; r.simRTP = r.theoreticalRTP + 1e-5; s.pass1_fresh_seeds.meanSimulatedRTP = s.pass1_fresh_seeds.results.reduce((a: number, x: any) => a + x.simRTP, 0) / s.pass1_fresh_seeds.results.length; },
  },
  {
    id: 'D17', name: 'H-E — one LOSS row\'s betAmount replaced with "not-a-number" (NaN turnover)',
    origin: 'QA round 3, item H-E — measured `$NaN wagered` printed, Conditional Pass 20/21, exit 0',
    // `totalStaked += Number(b.betAmount)` with no finiteness test. Every comparison a NaN reaches
    // is false, so an unguarded money accumulator does not merely print badly — it deletes the
    // arithmetic that was the check.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'lost'); b.betAmount = 'not-a-number'; },
  },
  {
    id: 'D18', name: 'H-F — meta.phases[*].amount set to 1000 (the settlement floor read from an unvalidated header)',
    origin: 'QA round 3, item H-F — measured Step 10 PASS printing "$1000.00, read from meta.phases"',
    // The settled-RTP deficit scales with 1/stake, and the sentence it produces is quoted in four
    // chapters. The stake now comes from the bets; the header is compared against them.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 10, status: 'FAIL',
    mutate: d => { for (const k of Object.keys(d.meta.phases)) if (d.meta.phases[k].amount !== undefined) d.meta.phases[k].amount = 1000; },
  },
  {
    id: 'D19', name: 'H-G — a whole trailing epoch dropped, header made consistent, seed row removed',
    origin: 'QA round 3, item H-G + framework gate-population D2 — measured Conditional Pass, exit 0',
    // The audited population was whatever the file said it was: every count came from inside the
    // file being scored. src/pins.ts now carries EXPECTED_BETS / EXPECTED_SEEDS /
    // EXPECTED_EPOCH_SIZE and Steps 11/12 assert against them. A row COUNT is not an identity.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 11, status: 'FAIL',
    mutate: d => {
      const last = Math.max(...d.bets.map((b: any) => b.epoch));
      d.bets = d.bets.filter((b: any) => b.epoch !== last);
      d.seeds = d.seeds.filter((s: any) => s.epoch !== last);
      const walk = (o: any) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (o[k] === 6900) o[k] = 6850; else if (o[k] === 138) o[k] = 137; else if (o[k] && typeof o[k] === 'object') walk(o[k]); } };
      walk(d.meta);
      if (d.meta?.phases?.E) d.meta.phases.E.bets = 350;
    },
  },
  {
    id: 'D20', name: 'H-G(b) — 20% of the bets dropped from the tail with every header count made to agree',
    origin: 'framework gate-population D1',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 11, status: 'FAIL',
    mutate: d => { d.bets = d.bets.slice(0, Math.floor(d.bets.length * 0.8)); },
  },
  // ══════════════════════════════════════════════════════════════════════════
  //  QA ROUND 4 — 2026-09-10. The exact-mean arm was rewritten (QA-01): it screened for values
  //  that AGREE with theory and so rejected a genuine, seed-reproducible million-round result.
  //  It now screens for values outside the SUPPORT of the counts that produce them, or
  //  contradicted by the row's own counts. These two entries are the negative controls for the
  //  rewritten arm — the fabricated cases must still be rejected, and for the right reason.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'A25', name: 'QA-01(a) — every simRTP forced to equal its theoreticalRTP, convergence counts left GENUINE',
    origin: 'QA round 4, item QA-01 — the negative control for the rewritten support screen',
    // The old blanket rule rejected this because the values were equal. The new rule rejects it
    // because the equality claims exactly N·p wins while each row's own final checkpoint records
    // something else — a mismatch with the regenerated draws, not a verdict on the value.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const P = s.pass1_fresh_seeds;
      for (const r of P.results) r.simRTP = r.theoreticalRTP;
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
    },
  },
  {
    id: 'A26', name: 'QA-01(b) — the n=1,000 convergence counts replaced by their fair expectations (fabricated counts)',
    origin: 'QA round 4, item QA-01 — "negative controls with fabricated counts must still fail"',
    // Straight count fabrication with no attempt at consistency: the n=1,000 checkpoint is the one
    // the verifier re-draws from the row's own seeds, so this fails at the intended evidence check
    // rather than on a plausibility heuristic.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const GRID_ = 25;
      for (const r of s.pass1_fresh_seeds.results) {
        const cp = r.convergence.find((c: any) => c.n === 1000);
        if (cp) cp.wins = Math.round((1000 * (GRID_ - r.mineCount)) / GRID_);
      }
    },
  },
  // ── The pin itself ──────────────────────────────────────────────────────────
  {
    id: 'D16', name: 'dataset edited and the pin NOT updated', origin: 'reviewer battery §4 — the load-bearing guard',
    // No re-pin (see runForgery): the loader must exit(1) before a single step is scored, so
    // there is no VERDICT line at all.
    target: 'dataset', expect: null,
    mutate: d => { d.bets[0].winningAmount = 999; },
  },
  {
    id: 'A27', name: 'QA-05 — one earlyBootstrapP moved to a NEIGHBOURING LEGAL lattice point',
    origin: 'QA round 4, item QA-05; promoted from declared survivor to must-fail by QA-05b on 2026-09-11',
    // A one-increment edit stays on the legal bootstrap lattice. Step 17 must detect it
    // by deterministic replay; range and ordering checks alone do not establish parity.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const p2 = s.pass2_casino_seeds;
      const r = p2.results[0];
      const k = Math.round(r.earlyBootstrapP * (p2.bootstrapReps + 1));
      r.earlyBootstrapP = (k + 1) / (p2.bootstrapReps + 1);
    },
  },
  // ── QA-05b: switching the bootstrap replay OFF by corrupting its own metadata ────────────
  // All three were EXECUTED by the round-5 reviewer (the first two) and in-house (the third) on
  // 2026-09-11 and all three scored 21/21 PROVABLY FAIR — Full Pass, exit 0, against the build
  // of 2026-09-10. The same artifact with VALID metadata printed [FAIL] Step 17, 20/21, exit 1:
  // the p-values do not replay, and the only thing standing between that fact and the verdict
  // was whether the metadata parsed. Invalid metadata now FAILS instead of disabling the check.
  {
    id: 'A28', name: 'QA-05b — seedDerivation set to an unknown version string',
    origin: 'round-5 reviewer, EXECUTED 2026-09-11 — restored 21/21 Full Pass on an artifact whose p-values do not replay',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
      s.seedDerivation = 'mines-seed-derivation-v99-unknown';
      s.pass2_casino_seeds.bootstrapSeedDerivation = 'mines-seed-derivation-v99-unknown';
    },
  },
  {
    id: 'A29', name: 'QA-05b — masterSeed set to `not-hex`',
    origin: 'round-5 reviewer, EXECUTED 2026-09-11 — restored 21/21 Full Pass on an artifact whose p-values do not replay',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = 'not-hex';
      s.seedDerivation = 'mines-seed-derivation-v1';
      s.pass2_casino_seeds.bootstrapSeedDerivation = 'mines-seed-derivation-v1';
    },
  },
  {
    id: 'A30', name: 'QA-05b — replay metadata claimed only PARTIALLY (masterSeed, no derivation version)',
    origin: 'in-house, EXECUTED 2026-09-11 — same class as A28/A29, found while closing them',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
      delete s.seedDerivation;
      delete s.pass2_casino_seeds.bootstrapSeedDerivation;
    },
  },
];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  DECLARED SURVIVORS — forgeries this suite does NOT catch, run and printed anyway.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * A registry that quietly drops what it cannot catch reports a coverage it does not have.
 * These are executed on every `npm run forgeries` and must still SURVIVE; if one starts being
 * caught, that is reported too, because the registry is then out of date and the honest thing
 * is to promote it into FORGERIES above.
 *
 * `tests/survivors.json` is the equivalent list for SOURCE mutations. These are evidence
 * forgeries, so they live here.
 */
const SURVIVORS: Forgery[] = [
  {
    id: 'S01', name: 'a FULLY self-consistent deep Pass 1 — the n=1,000 checkpoint left genuine, every deeper statistic rebuilt to agree with itself',
    origin: 'in-house 2026-09-09, probing the residual left by QA item H-D',
    // The honest limit of Step 16, measured rather than assumed. Everything the verifier can
    // recompute inside a run — the n=1,000 convergence bind, each p-value against its own
    // statistic, simRTP against the final checkpoint, monotonicity, the 5·SE bands, the
    // plausibility floor — is satisfied by construction here, because this forgery satisfies them
    // deliberately. What it moves is the ONE thing a verify run cannot re-derive without
    // replaying 24,000,000 rounds: the deep statistics and the final convergence checkpoint.
    //
    // Measured: 21/21 PROVABLY FAIR — Full Pass (after `npm run figures`, which a forger would
    // run to make the derived-figure artifact agree with the forged simulation).
    //
    // ── CORRECTED 2026-09-10 (QA-04) ────────────────────────────────────────────────────
    // This note used to say the fix was "src/simulate.ts recording a deterministic master seed
    // for Pass 1 so the whole run is replayable". That was wrong, and it was wrong in a way that
    // mattered: it described the package as MISSING an input it already had. Every Pass-1 row
    // records the serverSeed and clientSeed it was drawn with, and the nonce range is
    // 0 .. roundsPerConfig−1 by construction — those ARE the replay inputs. A master seed would
    // only regenerate the SELECTION of the 24 seed pairs.
    //
    // So the check exists now: `npm run deep-replay` (src/deep-replay.ts) re-runs all 24 ×
    // 1,000,000 rounds from each row's own stored seeds and compares every deep statistic and
    // every convergence count. This forgery moves the deep statistics and the FINAL convergence
    // checkpoint, so deep replay rejects it at a defined check while `npm run verify` — which
    // re-draws only the n=1,000 checkpoint — still does not.
    //
    // Measured 2026-09-10 against this exact construction, configs 1–3, in a throwaway copy:
    //   DIFFER m=1 (8), m=2 (10), m=3 (9) — 27 differences over 3,000,000 rounds, RESULT
    //   DEEP REPLAY FAIL, exit 1. Examples: m=1 convergence[n=1000000].wins stored 960001 vs
    //   replayed 959875; m=2 jointMaxAbsZ stored 0.5 vs replayed 3.654950370026635; m=3
    //   firstDrawChi2 stored 23.337 vs replayed 19.0474.
    // The same command against the COMMITTED artifact: 24 of 24 rows, 24,000,000 rounds, 895.5s,
    //   0 differences, SCOPE FULL, DEEP REPLAY PASS.
    // It therefore SURVIVES the verify runner (declared here) and does NOT survive deep replay.
    // The residual it names is a residual of `npm run verify`, not of the package.
    //
    // No `step` assertion: the declaration here is about the VERDICT the forgery still earns.
    target: 'artifact', expect: 'PROVABLY FAIR — Full Pass',
    mutate: (s, root) => {
      const { chiSquaredPValue, normalTwoSidedP } = require(path.join(root, 'src', 'stats'));
      const { GRID, theoreticalRTP } = require(path.join(root, 'src', 'config'));
      const P = s.pass1_fresh_seeds; const N = P.roundsPerConfig;
      for (const r of P.results) {
        const p = (GRID - r.mineCount) / GRID;
        const mult = theoreticalRTP(r.mineCount, 1) / p;
        const targetWins = Math.round(N * p) + 1;          // one win off fair — never exactly 0·SE
        r.convergence[r.convergence.length - 1].wins = targetWins;
        r.simRTP = (targetWins / N) * mult;
        r.firstDrawChi2 = 23.337; r.firstDrawPValue = chiSquaredPValue(23.337, r.firstDrawDf);
        if (r.jointMaxAbsZ !== null) { r.jointMaxAbsZ = 0.5; r.jointPValue = Math.min(1, r.jointPairs * chiSquaredPValue(0.25, 1)); }
        r.layoutR1 = 1e-7; r.layoutR1Z = 1e-7 * Math.sqrt(N);
        r.layoutRunsZ = 0.01; r.layoutRunsPValue = normalTwoSidedP(0.01);
      }
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
      P.meanTheoreticalRTP = P.results.reduce((a: number, r: any) => a + r.theoreticalRTP, 0) / P.results.length;
      P.firstDrawChi2FailsBonferroni = 0; P.firstDrawChi2FailsAtAlpha01 = 0;
      P.jointFailsBonferroni = 0; P.jointFailsAtAlpha01 = 0;
      P.layoutSerialFailsBonferroni = 0; P.layoutSerialFailsUncorrected = 0;
      P.jointMaxAbsZAcrossConfigs = Math.max(...P.results.map((r: any) => r.jointMaxAbsZ ?? 0));
      // Write the forged simulation artifact HERE (returning it would write it after this
      // function returns, and the regeneration below has to read the forged file, not the real
      // one). Then regenerate the derived-figure artifact exactly as a forger would: without that
      // step this entry would look "caught" by a pin that one command defeats, which is the
      // "rejected for the wrong reason" failure the framework's population gate exists to name.
      fs.writeFileSync(path.join(root, SIM_REL), JSON.stringify(s, null, 2));
      execFileSync('npm', ['run', 'figures'], { cwd: root, stdio: 'ignore' });
      return null;
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

function runForgery(f: Forgery): { ok: boolean; note: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mines-forge-'));
  try {
    for (const item of COPY) {
      const src = path.join(repoRoot, item);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, item), { recursive: true });
    }
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

    if (f.target !== 'none') {
      const rel = f.target === 'dataset' ? DATASET_REL : f.target === 'figures' ? FIG_REL : SIM_REL;
      const file = path.join(tmp, rel);
      const doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const out = f.mutate(doc, tmp);
      if (out !== null && fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(out === undefined ? doc : out, null, 2));
      }
      // Dataset edits re-pin, EXCEPT D16 whose whole point is that the pin is stale.
      if (f.target === 'dataset' && f.expect !== null) {
        const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const pins = path.join(tmp, 'src', 'pins.ts');
        fs.writeFileSync(pins, fs.readFileSync(pins, 'utf-8').replace(/'[0-9a-f]{64}'/, `'${sha}'`));
      }
    }

    let out = '';
    let rc = 0;
    // The LAST run is the one scored (see Forgery.runs). Everything earlier is there to let a
    // self-healing verifier do its healing, so the assertion lands on the state a second reader
    // would actually see.
    for (let attempt = 0; attempt < (f.runs ?? 1); attempt++) {
      rc = 0;
      try {
        out = execFileSync('node', ['-r', 'ts-node/register/transpile-only', 'tests/verify.ts'],
          { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e: any) {
        rc = e.status ?? 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
    }

    const line = out.split('\n').find(l => l.includes('VERDICT:')) ?? '';
    const verdict = line ? line.replace(/^.*VERDICT:\s*/, '').trim() : null;

    if (f.expect === null) {
      const aborted = verdict === null && rc !== 0 && /SHA-256 mismatch/.test(out);
      return {
        ok: aborted,
        note: aborted
          ? `loader aborted before any step was scored (exit ${rc}, SHA-256 mismatch)`
          : `expected a loader abort with no VERDICT; got exit ${rc}, verdict ${verdict ?? '(none)'}`,
      };
    }

    const verdictOk = verdict === f.expect;
    let stepOk = true;
    let seen = '(not declared)';
    if (f.step !== undefined) {
      seen = (new RegExp(`\\[(PASS|FLAG|FAIL)\\] Step ${f.step} `).exec(out) ?? [])[1] ?? '(step line absent)';
      stepOk = seen === f.status;
    }
    return {
      ok: verdictOk && stepOk,
      note: `VERDICT: ${verdict ?? '(none)'} (expected ${f.expect})`
        + ((f.runs ?? 1) > 1 ? ` [scored on verify run ${f.runs} of ${f.runs}]` : '')
        + (f.step !== undefined ? `; Step ${f.step}: ${seen} (expected ${f.status})` : '')
        + (verdictOk && !stepOk ? ' — the verdict flipped through some OTHER step; the named guard did not fire' : ''),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — FORGED-EVIDENCE BATTERY (dataset + artifact)');
console.log('══════════════════════════════════════════════════════════');

let rejected = 0;
let survived = 0;
for (const f of FORGERIES) {
  const { ok, note } = runForgery(f);
  if (ok) rejected++; else survived++;
  console.log(`  ${ok ? 'REJECTED' : 'SURVIVED'} ${f.id} ${f.name}`);
  console.log(`           → ${note}`);
  if (!ok) console.log(`           → origin: ${f.origin}`);
}

// Declared survivors: run for real, printed, and NOT counted as failures. A survivor that has
// started being caught is reported so the registry can be corrected — pretending a known
// survivor is killed is worse than the survivor.
let stale = 0;
if (SURVIVORS.length > 0) {
  console.log('\n  ── declared survivors (executed; expected to survive) ──');
  for (const f of SURVIVORS) {
    // `ok` means "the run matched the DECLARED expectation", and for a survivor the declared
    // expectation IS a clean pass. ok === true therefore means it still survives, as documented.
    const { ok, note } = runForgery(f);
    if (!ok) stale++;
    console.log(`  ${ok ? 'SURVIVED as declared' : 'NO LONGER SURVIVES (registry out of date)'} ${f.id} ${f.name}`);
    console.log(`           → ${note}`);
    console.log(`           → origin: ${f.origin}`);
  }
}

console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${rejected}/${FORGERIES.length} forged-evidence cases rejected · ${survived} SURVIVED`
  + (SURVIVORS.length > 0 ? ` · ${SURVIVORS.length} declared survivor(s) run and listed above` : ''));
if (stale > 0) console.log(`  ${stale} declared survivor(s) no longer produce the verdict they declare — promote them into FORGERIES.`);
console.log('══════════════════════════════════════════════════════════\n');

if (survived > 0) process.exit(1);
export {};
