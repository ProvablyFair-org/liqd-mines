/**
 * Steps 16–17: Simulation Results (reads outputs/simulation-results.json)
 *
 * Pass 1 tests the RNG as it is actually drawn (constrained multinomial):
 *   - First-draw uniformity (df=24, proper single-outcome multinomial) — scored
 *   - Pairwise co-occurrence joint test (m≥2) — scored: each of the 300 tile pairs is a
 *     Binomial(N,q) count, standardized z=(O−Nq)/√(Nq(1−q)); statistic = max|z| with a
 *     Bonferroni correction across pairs (z²~χ²(1) asymptotically — normal approximation to
 *     a discrete binomial count; Nq ≥ 3,333 here, so the error is far below the threshold)
 *   - Serial tests of FIRST-DRAWN TILE VALUES (lag-1 + runs) — scored. NOT whole-layout serial
 *     coverage: dependence confined to tiles the first draw never touches is invisible to it (L8).
 * Pass 2: cherry-pick test on the first-draw statistic over the 0..49 early window
 *   with a parametric-bootstrap null (analytic chi² invalid at n=50).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  WHY THIS FILE IS AS LONG AS IT IS — G-BIND (audit-framework/code-patterns.md)
 * ══════════════════════════════════════════════════════════════════════════════════════
 * These two steps are the only ones in the suite that score a PIPELINE ARTIFACT rather than
 * the captured dataset. The dataset is SHA-256-pinned; simulation-results.json cannot be,
 * because `npm test` regenerates it every run. That makes it the one input an attacker (or
 * an honest mistake) can shape freely, and an external review in September 2026 demonstrated
 * exactly that: five separate hand-built artifacts — 138 empty `{}` seed rows; 138 copies of
 * one unflagged epoch row; `configs: 1` with a single real-shaped row; 24 copies of the m=1
 * row; every `simRTP` and `theoreticalRTP` set to 0.5 — each scored **Full Pass**. Every one
 * of them was internally consistent. None of them corresponded to a run that happened.
 *
 * "Recompute the predicate from the detail rows instead of the summary scalars" (G-SIMDERIVE)
 * does not fix that, because it says nothing about where the ROWS came from. So both steps
 * now assert, in this order:
 *
 *   0. KEY-PATH INVENTORY. Every leaf key path in the artifact is classified below into
 *      ATTESTED / BOUND / BOUNDED / UNATTESTED. A path in none of them FAILS the step —
 *      including a field a forger adds and a field a future simulate.ts starts emitting.
 *      This is the only guard here that fails closed on a forgery nobody has thought of yet.
 *   1. CARDINALITY AGAINST A CONSTANT. 24 configs comes from MINE_COUNTS.length in
 *      src/config.ts and 138 seeds from ctx.seeds — never from `artifact.configs` or
 *      `artifact.seeds_tested`, which the forger controls. A threshold computed from an
 *      artifact-supplied sample size is forger-controlled: lower n and the band widens until
 *      the forgery fits, which is why roundsPerConfig carries a hard floor before it is used.
 *   2. IDENTITY AGAINST THE ANCHOR. A COUNT IS NOT AN IDENTITY. Pass-1 rows must carry each
 *      mineCount 1..24 exactly once (the anchor for a fresh-seed pass is the exported
 *      constant, never "N/A"); Pass-2 rows' hashedServerSeed set must equal the revealed set
 *      in ctx.seeds, with epoch and mineCount matching those seed records.
 *   3. RECOMPUTE, DON'T BOUNDS-CHECK. Every Pass-2 chi² statistic is re-derived here from the
 *      dataset's own revealed serverSeeds (firstMineTile, ~1.9 s) and compared. Pass-1 rows
 *      are bound to their seeds by re-drawing the first convergence checkpoint. What genuinely
 *      cannot be recomputed inside a verify run is listed in BOUNDED/UNATTESTED and said out
 *      loud in the step detail — a statistic that is only ever bounds-checked can be forged to
 *      the centre of its band, and pretending otherwise is how "every simRTP = 0.5" passed.
 *   4. STORED BOOLEANS FROM RECOMPUTED INPUTS. cherryPickFlag is re-derived from the
 *      RECOMPUTED latePValue (not the stored one) and the stored flag must equal it.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { inverseCriticalZ, chiSquaredTest, chiSquaredPValue, normalTwoSidedP } from '../../src/stats';
import { combination, GRID, MINE_COUNTS, HOUSE_EDGE, theoreticalRTP, minesMultiplierExact, pairCoOccurProb } from '../../src/config';
import { revealMines, firstMineTile, deriveSeedHex, isMasterSeed, SEED_DERIVATION_VERSION } from '../../src/rng';
import { earlyBootstrapPDigest, LEGACY_EARLY_BOOTSTRAP_P_DIGEST, LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT } from '../../src/pins';
import { falseAlarmAccounting, ENFORCED_ROUNDS_PER_CONFIG } from '../../src/false-alarm';

/**
 * Exact upper-tail binomial survival P(X ≥ k) for Binom(n, p) — recomputed HERE from the
 * flag count so Step 17 never trusts the artifact's own `cherryPickSurvivalP` scalar.
 * Mirrors src/simulate.ts binomSurvival: 1 − Σ_{i<k} C(n,i) p^i (1−p)^(n−i).
 */
function binomialSurvival(k: number, n: number, p: number): number {
  let cum = 0;
  for (let i = 0; i < k; i++) cum += combination(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  return 1 - cum;
}

/**
 * Every leaf key path of outputs/simulation-results.json, classified. Array elements collapse
 * to `[]` (so `results[].simRTP` covers all 24 rows). The step FAILS if the artifact carries a
 * path outside the union of these four sets, or if an ATTESTED/BOUND path is missing.
 *
 *  ATTESTED  — recomputed here from src/config.ts, ctx.seeds or the pinned dataset, and
 *              compared. A forged value fails.
 *  BOUND     — asserted `===` a constant exported by src/config.ts.
 *  BOUNDED   — not recomputable inside a verify run; checked against a threshold DERIVED from
 *              α and code constants (never from the artifact). Honest limit: a value forged to
 *              the centre of its band passes. Printed in the step detail and reproduced in
 *              reproducibility.md.
 *  UNATTESTED— provenance/prose/timing. NEVER scored on, by anything.
 */
const KP_ATTESTED = [
  'houseEdge',
  'pass1_fresh_seeds.configs',
  'pass1_fresh_seeds.roundsPerConfig',
  'pass1_fresh_seeds.totalRounds',
  'pass1_fresh_seeds.bonferroniAlpha',
  'pass1_fresh_seeds.bonferroniZCritical',
  'pass1_fresh_seeds.firstDrawChi2FailsAtAlpha01',
  'pass1_fresh_seeds.firstDrawChi2FailsBonferroni',
  'pass1_fresh_seeds.jointConfigsTested',
  'pass1_fresh_seeds.jointFailsAtAlpha01',
  'pass1_fresh_seeds.jointFailsBonferroni',
  'pass1_fresh_seeds.jointMaxAbsZAcrossConfigs',
  'pass1_fresh_seeds.layoutSerialFailsUncorrected',
  'pass1_fresh_seeds.layoutSerialFailsBonferroni',
  'pass1_fresh_seeds.meanSimulatedRTP',
  'pass1_fresh_seeds.meanTheoreticalRTP',
  'pass1_fresh_seeds.results[].mineCount',
  'pass1_fresh_seeds.results[].serverSeed',
  'pass1_fresh_seeds.results[].clientSeed',
  'pass1_fresh_seeds.results[].theoreticalRTP',
  'pass1_fresh_seeds.results[].convergence[].n',
  'pass1_fresh_seeds.results[].convergence[].wins',
  'pass2_casino_seeds.noncesPerSeed',
  'pass2_casino_seeds.earlyWindow[]',
  'pass2_casino_seeds.lateWindow[]',
  'pass2_casino_seeds.bootstrapMineCounts[]',
  'pass2_casino_seeds.seeds_tested',
  'pass2_casino_seeds.cherryPickFlags',
  'pass2_casino_seeds.expectedFlagsByChance',
  'pass2_casino_seeds.cherryPickSurvivalP',
  'pass2_casino_seeds.results[].epoch',
  'pass2_casino_seeds.results[].hashedServerSeed',
  'pass2_casino_seeds.results[].mineCount',
  'pass2_casino_seeds.results[].earlyChi2',
  'pass2_casino_seeds.results[].lateChi2',
  'pass2_casino_seeds.results[].latePValue',
  'pass2_casino_seeds.results[].cherryPickFlag',
];
const KP_BOUND = [
  'pass1_fresh_seeds.results[].firstDrawDf',
  'pass1_fresh_seeds.results[].jointPairs',
];
const KP_BOUNDED = [
  'pass1_fresh_seeds.results[].firstDrawChi2',
  'pass1_fresh_seeds.results[].firstDrawPValue',
  'pass1_fresh_seeds.results[].jointMaxAbsZ',
  'pass1_fresh_seeds.results[].jointPValue',
  'pass1_fresh_seeds.results[].layoutR1',
  'pass1_fresh_seeds.results[].layoutR1Z',
  'pass1_fresh_seeds.results[].layoutRunsZ',
  'pass1_fresh_seeds.results[].layoutRunsPValue',
  'pass1_fresh_seeds.results[].simRTP',
  'pass2_casino_seeds.bootstrapReps',
  'pass2_casino_seeds.results[].earlyBootstrapP',
];
/**
 * Replay metadata is required together and validated by Step 17. Each bootstrap p-value
 * is rebuilt from these inputs. Pass 1 replays from the seed pairs recorded in its rows.
 * Metadata-free compatibility is limited to the fixed regression fixture in src/pins.ts.
 */
const KP_OPTIONAL_ATTESTED = [
  'masterSeed',
  'seedDerivation',
  'pass2_casino_seeds.bootstrapSeedDerivation',
];
const KP_UNATTESTED = [
  'audit',
  'algorithm',
  'generatedAt',
  'pass1_fresh_seeds.description',
  'pass1_fresh_seeds.executionTimeMs',
  'pass1_fresh_seeds.results[].jointWorstPair',
  'pass2_casino_seeds.description',
  'pass2_casino_seeds.executionTimeMs',
];

/** Collapse an artifact to its set of leaf key paths, arrays collapsing to `[]`. */
function leafKeyPaths(node: unknown, prefix: string, out: Set<string>): void {
  if (Array.isArray(node)) {
    if (node.length === 0) out.add(`${prefix}[]`);
    for (const v of node) leafKeyPaths(v, `${prefix}[]`, out);
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      leafKeyPaths((node as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  out.add(prefix);
}

/**
 * QA-01 SUPPORT PREDICATE, exported so it can be unit-tested against real replayed numbers
 * (tests/mines/simulationSupportTests.ts) instead of only through a full verify run.
 *
 * Given one Pass-1 row and the run's roundsPerConfig, decides whether a statistic sitting exactly
 * at its null centre is OUTSIDE THE SUPPORT of the integer counts that generate it (a fault), or
 * CONTRADICTED by the row's own convergence counts (a fault), or a legitimate finite-sample
 * outcome (not a fault — `supportedExactMean`). See the long QA-01 block in `run()` for why the
 * previous blanket "exactly zero / exactly equal ⇒ fabricated" rule rejected valid evidence.
 *
 * Fails CLOSED on a malformed row only insofar as the caller's other guards do: a row with a
 * non-finite mineCount produces no support verdict here and is already rejected by `rows1Finite`.
 */
export function nullCentreSupport(
  r: any, roundsPerConfig: number,
): { faults: string[]; supportedExactMean: boolean } {
  const faults: string[] = [];
  let supportedExactMean = false;
  const attainable = (x: number) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;

  if (r?.simRTP === r?.theoreticalRTP && Number.isFinite(r?.mineCount) && Number.isFinite(r?.simRTP)) {
    // Exact equality holds iff the win count landed on N·p = roundsPerConfig·(25−m)/25.
    const w = (roundsPerConfig * (GRID - r.mineCount)) / GRID;
    const cp = (Array.isArray(r?.convergence) ? r.convergence : []).find((c: any) => c?.n === roundsPerConfig);
    if (!attainable(w)) {
      faults.push(`simRTP === theoreticalRTP but the win count it implies, N·p = ${w}, is not an integer — outside the support`);
    } else if (!cp || !Number.isFinite(cp.wins)) {
      faults.push(`simRTP === theoreticalRTP with no n=${roundsPerConfig} convergence checkpoint to corroborate the implied ${Math.round(w)} wins`);
    } else if (cp.wins !== Math.round(w)) {
      faults.push(`simRTP === theoreticalRTP claims exactly ${Math.round(w)} wins, but the row's own final checkpoint records ${cp.wins}`);
    } else {
      supportedExactMean = true;   // legitimate, corroborated — counted, never scored on
    }
  }

  if (r?.jointMaxAbsZ === 0 && Number.isFinite(r?.mineCount)) {
    // max|z| = 0 requires EVERY one of the 300 pair counts to equal N·q exactly.
    const nq = roundsPerConfig * pairCoOccurProb(r.mineCount);
    if (!attainable(nq)) {
      faults.push(`jointMaxAbsZ === 0 requires every one of the ${(GRID * (GRID - 1)) / 2} pair counts to equal N·q = ${nq.toFixed(4)}, which is not an integer — outside the support`);
    }
  }

  return { faults, supportedExactMean };
}

/** Minimum Pass-1 sample size the audit will score. A CODE constant — never the artifact's. */
const MIN_ROUNDS_PER_CONFIG = 1_000_000;
/** The convergence checkpoint re-drawn from each row's own seeds to bind row → RNG output. */
const BIND_CHECKPOINT_N = 1_000;
/** Cherry-pick criterion, verbatim from src/simulate.ts (kept here so the flag is DERIVED). */
const CHERRY_EARLY_ALPHA = 0.05;
const CHERRY_LATE_ALPHA = 0.05;
/** P(earlyBootstrapP < 0.05 AND lateP ≥ 0.05) under the fair null = 0.05 × 0.95. */
const CHERRY_FLAG_RATE = CHERRY_EARLY_ALPHA * (1 - CHERRY_LATE_ALPHA);

export function run(ctx: VerifyContext): StepResult[] {
  const { outputsDir } = ctx;
  const simPath = path.join(outputsDir, 'simulation-results.json');

  // A MISSING input artifact is an incomplete run, not a fairness failure. It FLAGs
  // (→ "Conditional Pass"), never silently passes and never hard-fails: reserving
  // "NOT PROVABLY FAIR" for actual fairness breaches (broken commitment, parity
  // failure) keeps the verdict meaningful. The delivered repo ships
  // outputs/simulation-results.json, so a fresh clone runs these steps for real.
  if (!fs.existsSync(simPath)) {
    const s16 = step(16, 'Simulation — Pass 1 (First-Draw · Joint · Serial, FWER)', 'FLAG',
      'simulation-results.json not found — supply the published artifact or run `npm run simulate` in a separate working copy to score this step');
    const s17 = step(17, 'Simulation — Pass 2 Cherry-Pick Test', 'FLAG',
      'simulation-results.json not found — supply the published artifact or run `npm run simulate` in a separate working copy to score this step');
    return [s16, s17];
  }

  // Record WHICH simulation artifact was scored. Compute the SHA-256 of the exact bytes read
  // and copy its generatedAt, and stash on ctx so verify.ts can write them under
  // artifactHashes.simulation. ACTUAL hash only — never pinned: `npm test` regenerates the
  // file fresh every run, so an expected-hash guard would break the pipeline by design. This
  // is exactly why Steps 16–17 must bind the artifact's CONTENT to the dataset instead.
  const simRaw = fs.readFileSync(simPath);
  const sim = JSON.parse(simRaw.toString('utf-8'));
  ctx.simArtifact = {
    file: 'outputs/simulation-results.json',
    sha256: crypto.createHash('sha256').update(simRaw).digest('hex'),
    generatedAt: typeof sim.generatedAt === 'string' ? sim.generatedAt : null,
  };

  // ── G-BIND item 0: KEY-PATH INVENTORY (applies to BOTH steps) ────────────────
  const declared = new Set<string>([...KP_ATTESTED, ...KP_BOUND, ...KP_BOUNDED, ...KP_OPTIONAL_ATTESTED, ...KP_UNATTESTED]);
  const present = new Set<string>();
  leafKeyPaths(sim, '', present);
  const unclassified = [...present].filter(p => !declared.has(p)).sort();
  // A missing ATTESTED/BOUND path is a truncated artifact — a forgery that simply deletes the
  // field a guard reads. UNATTESTED/BOUNDED paths may legitimately be absent (e.g. jointPairs
  // is null for m=1, and a null leaf still yields its path, so absence means the key is gone).
  const mustExist = [...KP_ATTESTED, ...KP_BOUND];
  const missingPaths = mustExist.filter(p => !present.has(p)).sort();
  const inventoryOk = unclassified.length === 0 && missingPaths.length === 0;
  const countPresent = (paths: string[]) => paths.filter(p => present.has(p)).length;
  const bootstrapPPath = 'pass2_casino_seeds.results[].earlyBootstrapP';
  const inventoryNote = inventoryOk
    ? `key-path inventory: ${present.size}/${present.size} leaf paths classified (${countPresent(KP_ATTESTED)} attested, ${countPresent(KP_BOUND)} bound, ${countPresent(KP_BOUNDED.filter(p => p !== bootstrapPPath))} bounded-only, ${Number(present.has(bootstrapPPath))} bootstrap-p-value path with validation reported in Step 17, ${countPresent(KP_OPTIONAL_ATTESTED)} replay-input paths, ${countPresent(KP_UNATTESTED)} unattested)`
    : `key-path inventory FAILED: ${unclassified.length} unclassified (${unclassified.slice(0, 4).join(', ')}), ${missingPaths.length} missing (${missingPaths.slice(0, 4).join(', ')})`;

  // ── Step 16: Pass 1 (fresh seeds, three scored tests, FWER) ──────────────────
  const pass1 = sim.pass1_fresh_seeds ?? {};
  const results1: any[] = Array.isArray(pass1.results) ? pass1.results : [];

  // G-BIND item 1 — the config count is MINE_COUNTS.length from src/config.ts. It is NOT read
  // from `pass1.configs`; `pass1.configs` is instead ASSERTED to equal it. (Reading it was how
  // `configs: 1` with a single row scored a Full Pass: one row, one config, "complete".)
  const CONFIGS = MINE_COUNTS.length;                       // 24, from src/config.ts
  const configsDeclaredOk = pass1.configs === CONFIGS;
  const bonAlpha = 0.01 / CONFIGS;
  const bonZCrit = inverseCriticalZ(bonAlpha);
  // The pairwise-joint statistic is corrected TWICE — once across the 300 tile pairs inside a
  // config (simulate.ts: p = min(1, 300·p_pair)), once across the 24 configs. Its critical |z| is
  // therefore inverseCriticalZ(α/24/300) ≈ 4.8, NOT the 3.53 across-config serial critical.
  // Reviewer B (QA 2026-09-09) flagged the step detail for printing a "largest |z|" beside a
  // Bonferroni threshold it appears to exceed; the two numbers belong to different families and
  // the detail now prints this one so a reader can see which comparison is the real one.
  const JOINT_PAIRS = (GRID * (GRID - 1)) / 2;
  const jointPairCritZ = inverseCriticalZ(bonAlpha / JOINT_PAIRS);
  const bonAlphaOk = Number.isFinite(pass1.bonferroniAlpha) && Math.abs(pass1.bonferroniAlpha - bonAlpha) < 1e-15;
  const bonZOk = Number.isFinite(pass1.bonferroniZCritical) && Math.abs(pass1.bonferroniZCritical - bonZCrit) < 1e-9;

  // G-BIND item 1 — the sample size carries a hard floor from a CODE constant BEFORE it is used
  // to size any tolerance. Without the floor a forger lowers roundsPerConfig and every
  // statistical band below widens until the forgery fits inside it.
  const roundsPerConfig = Number(pass1.roundsPerConfig);
  const roundsOk = Number.isFinite(roundsPerConfig) && roundsPerConfig >= MIN_ROUNDS_PER_CONFIG;
  // The false-alarm accounting the Step-16 detail publishes. ONE calculation, shared with
  // src/figures.ts → outputs/audit-figures.json → falseAlarmAccounting, so the report and its
  // executable source cannot disagree (round-5: they did — this string said "≤ 5%" over five
  // arms while figures.ts computed eight).
  const fa = falseAlarmAccounting(
    Number.isFinite(roundsPerConfig) && roundsPerConfig > 0 ? roundsPerConfig : ENFORCED_ROUNDS_PER_CONFIG);
  const totalRoundsOk = Number.isFinite(pass1.totalRounds) && pass1.totalRounds === CONFIGS * roundsPerConfig;
  const houseEdgeOk = Number.isFinite(sim.houseEdge) && Math.abs(sim.houseEdge - HOUSE_EDGE) < 1e-15;

  // G-BIND item 2 — IDENTITY, not count. For a fresh-seed pass the anchor is the exported
  // constant MINE_COUNTS: the rows must carry every mineCount 1..24 exactly once. Reading this
  // item as "N/A because Pass 1 has no source records" is precisely how 24 copies of the m=1
  // row passed a row-count check.
  const rowCountOk = results1.length === CONFIGS;
  const mineCounts1 = results1.map(r => r?.mineCount);
  const mineCountSetOk = rowCountOk
    && new Set(mineCounts1).size === CONFIGS
    && MINE_COUNTS.every(m => mineCounts1.includes(m));

  // Finite guards on EVERY field any predicate below reads (a NaN silently satisfies every
  // `>` and `<` comparison it appears in — G-NONVACUOUS (a)).
  const rows1Finite = results1.length > 0 && results1.every(r =>
    Number.isFinite(r?.firstDrawChi2) &&
    Number.isFinite(r?.firstDrawPValue) &&
    Number.isFinite(r?.layoutR1Z) &&
    Number.isFinite(r?.layoutRunsZ) &&
    Number.isFinite(r?.layoutRunsPValue) &&
    Number.isFinite(r?.simRTP) &&
    Number.isFinite(r?.theoreticalRTP) &&
    r?.firstDrawDf === GRID - 1 &&
    // m=1 has no tile PAIR to co-occur, so joint fields are legitimately null there and
    // MUST be finite everywhere else. `null` is the only permitted absence, and only at m=1.
    (r?.mineCount === 1
      ? (r?.jointPValue === null && r?.jointMaxAbsZ === null && r?.jointPairs === null)
      : (Number.isFinite(r?.jointPValue) && Number.isFinite(r?.jointMaxAbsZ)
         && r?.jointPairs === (GRID * (GRID - 1)) / 2)));

  // The per-config detail rows are the ground truth. RECOMPUTE every FWER fail count here from
  // results[] with the derived thresholds — never trust the reported summary scalars. This
  // hardens against a forged artifact that reports clean scalars while its detail rows carry
  // failing p-values, or that deletes its detail rows entirely (G-SIMDERIVE).
  const firstDrawBon = results1.filter(r => r.firstDrawPValue < bonAlpha).length;
  const firstDrawUnc = results1.filter(r => r.firstDrawPValue < 0.01).length;
  const jointRows = results1.filter(r => r.jointPValue !== null && r.jointPValue !== undefined);
  const jointConfigs = jointRows.length;
  const jointBon = jointRows.filter(r => (r.jointPValue as number) < bonAlpha).length;
  const jointUnc = jointRows.filter(r => (r.jointPValue as number) < 0.01).length;
  const serialBon = results1.filter(r => Math.abs(r.layoutR1Z) > bonZCrit || r.layoutRunsPValue < bonAlpha).length;
  const serialUnc = results1.filter(r => Math.abs(r.layoutR1Z) > 1.96 || r.layoutRunsPValue < 0.01).length;
  const jointMaxAbsZ = results1.reduce((mx, r) => Math.max(mx, r.jointMaxAbsZ ?? 0), 0);
  // Exactly one config (m=1) has no pair test; 23 must be tested. Derived from the constant,
  // and the artifact's own `jointConfigsTested` must agree with the recount.
  const jointConfigsOk = jointConfigs === CONFIGS - 1 && pass1.jointConfigsTested === jointConfigs;

  // G-BIND item 3 — theoreticalRTP is RECOMPUTED from src/config.ts, never compared to itself.
  // (Setting every simRTP AND every theoreticalRTP to 0.5 passed the old |sim − theo| < 0.03
  // band, because that band compared two artifact-supplied fields to each other.)
  let theoDev = 0, theoBad = 0;
  for (const r of results1) {
    if (!Number.isFinite(r?.theoreticalRTP) || !Number.isFinite(r?.mineCount)) { theoBad++; continue; }
    const dev = Math.abs(r.theoreticalRTP - theoreticalRTP(r.mineCount, 1));
    if (!(dev < 1e-12)) theoBad++;
    if (dev > theoDev) theoDev = dev;
  }
  const theoOk = theoBad === 0 && results1.length === CONFIGS;

  // G-BIND item 3 — simRTP against a per-config STATISTICAL band, not a flat ±0.03 slack.
  // The k=1 strategy wins iff tile 1 is safe: p = (25−m)/25, payout = minesMultiplierExact(m,1).
  // simRTP is then p̂ · mult, so SE_m = mult · √(p(1−p)/N). The gate is 5·SE_m around the
  // theoretical (1 − edge). At m=24 the old flat 0.03 was ~6× wider than 5·SE and at m=1 it was
  // ~30× wider; both thresholds come from code constants and the floored N, never the artifact.
  let worstZ = 0, worstZm = 0, bandFails = 0;
  for (const r of results1) {
    if (!Number.isFinite(r?.simRTP) || !Number.isFinite(r?.mineCount)) { bandFails++; continue; }
    const m = r.mineCount;
    const p = (GRID - m) / GRID;
    const mult = minesMultiplierExact(m, 1);
    if (!Number.isFinite(mult) || !(p > 0 && p < 1)) { bandFails++; continue; }
    const se = mult * Math.sqrt((p * (1 - p)) / roundsPerConfig);
    const z = Math.abs(r.simRTP - theoreticalRTP(m, 1)) / se;
    if (!Number.isFinite(z) || z > 5) bandFails++;
    if (Number.isFinite(z) && z > worstZ) { worstZ = z; worstZm = m; }
  }
  const bandOk = bandFails === 0;

  // ══════════════════════════════════════════════════════════════════════════════════════
  //  H-C — EVERY STATISTIC IS RECONCILED WITH ITS OWN p-VALUE
  // ══════════════════════════════════════════════════════════════════════════════════════
  // A row carries a statistic AND a p-value as two independent numbers, and nothing checked that
  // they described the same event. Measured 2026-09-09: set `results[0].firstDrawChi2 = 500` and
  // leave `firstDrawPValue = 0.7787` → `[PASS] Step 16`, 21/21 Full Pass. A χ² of 500 on 24 df has
  // p ≈ 1e-89. The p-value is what every FWER count above is computed from, so a forger only ever
  // needed to write a plausible p and could put anything at all in the statistic beside it.
  //
  // All four identities below are exact closed forms of what src/simulate.ts computed, and they
  // reproduce the committed artifact to 0.000e+0 — not "within tolerance", bit-identical:
  //
  //   firstDrawPValue   === chiSquaredPValue(firstDrawChi2, firstDrawDf)
  //   jointPValue       === min(1, jointPairs · chiSquaredPValue(jointMaxAbsZ², 1))   [Bonferroni
  //                        over the 300 pairs WITHIN the config, clamped — simulate.ts's own form]
  //   layoutRunsPValue  === normalTwoSidedP(layoutRunsZ)
  //   layoutR1Z         === layoutR1 · √roundsPerConfig
  //
  // Gate 1e-12 on the p-values (they are O(1) quantities whose recomputation is deterministic);
  // 1e-9 relative on layoutR1Z. These are the FIRST checks in this file that make the 1e6-round
  // statistics attested rather than merely bounded — the LIMIT clause in the step detail is
  // narrowed accordingly.
  const PV_TOL = 1e-12;
  let pvMismatches = 0, firstPvFault = '';
  for (const r of results1) {
    if (!Number.isFinite(r?.firstDrawChi2) || !Number.isFinite(r?.firstDrawPValue)) { pvMismatches++; continue; }
    const fdP = chiSquaredPValue(r.firstDrawChi2, r.firstDrawDf);
    if (!(Math.abs(fdP - r.firstDrawPValue) < PV_TOL)) {
      pvMismatches++;
      if (!firstPvFault) firstPvFault = `m=${r.mineCount}: firstDrawChi2 ${r.firstDrawChi2} on df ${r.firstDrawDf} gives p=${fdP.toExponential(4)}, row stores ${r.firstDrawPValue}`;
    }
    if (r.jointMaxAbsZ !== null && r.jointMaxAbsZ !== undefined) {
      const jP = Math.min(1, r.jointPairs * chiSquaredPValue(r.jointMaxAbsZ * r.jointMaxAbsZ, 1));
      if (!(Math.abs(jP - r.jointPValue) < PV_TOL)) {
        pvMismatches++;
        if (!firstPvFault) firstPvFault = `m=${r.mineCount}: jointMaxAbsZ ${r.jointMaxAbsZ} over ${r.jointPairs} pairs gives p=${jP.toExponential(4)}, row stores ${r.jointPValue}`;
      }
    }
    const runsP = normalTwoSidedP(r.layoutRunsZ);
    if (!(Math.abs(runsP - r.layoutRunsPValue) < PV_TOL)) {
      pvMismatches++;
      if (!firstPvFault) firstPvFault = `m=${r.mineCount}: layoutRunsZ ${r.layoutRunsZ} gives p=${runsP.toExponential(4)}, row stores ${r.layoutRunsPValue}`;
    }
    const r1z = r.layoutR1 * Math.sqrt(roundsPerConfig);
    if (!(Math.abs(r1z - r.layoutR1Z) <= 1e-9 * Math.max(1, Math.abs(r1z)))) {
      pvMismatches++;
      if (!firstPvFault) firstPvFault = `m=${r.mineCount}: layoutR1 ${r.layoutR1} × √${roundsPerConfig} = ${r1z}, row stores layoutR1Z ${r.layoutR1Z}`;
    }
  }
  const pvOk = pvMismatches === 0 && results1.length === CONFIGS;

  // ══════════════════════════════════════════════════════════════════════════════════════
  //  H-D — simRTP IS RECOMPUTED FROM THE ROW'S OWN ATTESTED CONVERGENCE SERIES
  // ══════════════════════════════════════════════════════════════════════════════════════
  // src/simulate.ts computes simRTP = (wins/N) × mult₁ where mult₁ = theoreticalRTP(m,1)/((25−m)/25),
  // and the LAST convergence checkpoint is (n = N, wins). Both operands are already attested here
  // — `convergence[].wins` is bound to the seeds at n=1,000 and constrained monotone/bounded/5·SE
  // beyond it, and mult₁ comes from src/config.ts — so this identity is FREE and exact. It
  // reproduces the committed artifact to 0.000e+0.
  //
  // It matters because a 5·SE band accepts anything near the centre. The fabricated Pass 1 that
  // scored a Full Pass on 2026-09-09 set every simRTP EQUAL to its theoreticalRTP; that is inside
  // every band by construction, and only a cross-check against a different attested quantity can
  // see it.
  let rtpDeriveBad = 0, firstRtpFault = '', maxRtpDev = 0;
  for (const r of results1) {
    const cp = (Array.isArray(r?.convergence) ? r.convergence : []).find((c: any) => c?.n === roundsPerConfig);
    if (!cp || !Number.isFinite(cp.wins) || !Number.isFinite(r?.simRTP)) {
      rtpDeriveBad++;
      if (!firstRtpFault) firstRtpFault = `m=${r?.mineCount}: no n=${roundsPerConfig} convergence checkpoint to derive simRTP from`;
      continue;
    }
    const mult1 = theoreticalRTP(r.mineCount, 1) / ((GRID - r.mineCount) / GRID);
    const derived = (cp.wins / roundsPerConfig) * mult1;
    const dev = Math.abs(derived - r.simRTP);
    if (dev > maxRtpDev) maxRtpDev = dev;
    if (!(dev < 1e-12)) {
      rtpDeriveBad++;
      if (!firstRtpFault) firstRtpFault = `m=${r.mineCount}: ${cp.wins}/${roundsPerConfig} wins × ${mult1} = ${derived}, row stores simRTP ${r.simRTP}`;
    }
  }
  const rtpDeriveOk = rtpDeriveBad === 0 && results1.length === CONFIGS;

  // ══════════════════════════════════════════════════════════════════════════════════════
  //  H-D — PLAUSIBILITY FLOOR. PERFECTION IS EVIDENCE OF FABRICATION, NOT OF FAIRNESS.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Every threshold above is one-sided: it asks whether a statistic is too EXTREME. A forger's
  // problem is the opposite one, and the natural forgery is a value at the dead centre of the
  // null. Measured 2026-09-09: simRTP = theoreticalRTP, firstDrawChi2 = 24, firstDrawPValue = 0.5,
  // layoutR1/R1Z/RunsZ = 0, jointMaxAbsZ = 0, jointPValue = 1, scalars recomputed → Full Pass.
  //
  // Two arms, both of which the genuine artifact passes with room (checked: the smallest observed
  // |layoutR1Z| is 0.026, the largest firstDrawPValue 0.9957, and no row's win count equals its
  // fair expectation exactly):
  //
  //  (a) LOWER TAIL. A χ² far BELOW its degrees of freedom is as improbable as one far above.
  //      Screened at the same Bonferroni α/24 as the upper tail, so the test is symmetric and the
  //      genuine 0.9957 (m=9) is comfortably inside; the uncorrected count is reported for
  //      context, not scored. jointPValue is deliberately EXCLUDED — simulate.ts clamps it with
  //      `Math.min(1, 300·p)`, so 13 of 23 genuine rows sit at exactly 1.0 and a lower-tail test
  //      on it would fire on honest data. Saying that out loud is the point: an unstated exclusion
  //      is how a check becomes decoration.
  //
  //  (b) SUPPORT — NOT SUSPICION. See the QA-01 block immediately below.
  const lowerBon = results1.filter(r => Number.isFinite(r?.firstDrawPValue) && r.firstDrawPValue > 1 - bonAlpha).length;
  const lowerUnc = results1.filter(r => Number.isFinite(r?.firstDrawPValue) && r.firstDrawPValue > 0.99).length;
  const runsLowerBon = results1.filter(r => Number.isFinite(r?.layoutRunsPValue) && r.layoutRunsPValue > 1 - bonAlpha).length;

  // ══════════════════════════════════════════════════════════════════════════════════════
  //  QA-01 (2026-09-10) — THE VERIFIER MUST NOT REJECT VALID EVIDENCE
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Until 2026-09-10 this arm was a BLANKET rejection: any row with layoutR1, layoutR1Z,
  // layoutRunsZ or jointMaxAbsZ exactly 0, or with `simRTP === theoreticalRTP`, was counted as
  // fabricated on the reasoning that such a value is "outside the support of a 1e6-round draw".
  //
  // For the equality arm that reasoning is simply WRONG, and the reviewer supplied the
  // counterexample. `simRTP === theoreticalRTP` holds exactly when the win count lands on
  //     N·p = roundsPerConfig · (25 − m)/25 = 40,000 · (25 − m)   at N = 1,000,000,
  // which is an INTEGER for every mineCount — the single most likely value of the binomial, not
  // an impossible one. Replayed here (server f4661fd0…, client e944296a…, nonces 0..999999,
  // m=1): 960,000 wins out of 1,000,000 against an expectation of exactly 960,000, simRTP 0.99,
  // theoreticalRTP 0.99, deviation exactly 0. A genuine, seed-reproducible million-round
  // experiment was being labelled fabrication for the sole reason that it agreed with theory.
  // Measured before the fix: `[FAIL] Step 16`, VERDICT NOT PROVABLY FAIR, on that one fault.
  //
  // The fix is NOT to stop rejecting fabricated evidence. It is to make the arm test what it
  // always claimed to test — SUPPORT — and to let inconsistency, not agreement, be the fault:
  //
  //   1. `simRTP === theoreticalRTP` is UNSUPPORTED only when N·p is not an integer (it always
  //      is here, so this branch is latent — kept because roundsPerConfig is configurable and a
  //      grid size is a constant, not a law). When N·p IS an integer the equality is legitimate,
  //      AND the row must then actually carry that win count: a forger who writes the equality
  //      without moving the count fails HERE, on the evidence, with the counts named. That is
  //      the "reclassify to fail for inconsistency with the regenerated draws" the ticket asks
  //      for, and it is the same fact H-D's simRTP↔convergence identity establishes — stated
  //      twice on purpose, because this is the arm whose message a reader will read.
  //   2. `jointMaxAbsZ === 0` requires ALL 300 pair counts to equal N·q exactly. That is
  //      unsupported when N·q is not an integer — true at 8 of the 23 pair-tested configs here
  //      (m = 2, 5, 8, 11, 14, 17, 20, 23; e.g. N·q = 3,333.33… at m=2) and attainable at the
  //      other 15. The screen therefore fires on the eight and stays silent on the fifteen.
  //   3. `layoutR1`, `layoutR1Z` and `layoutRunsZ` exactly 0 are ATTAINABLE and the arm is GONE.
  //      r₁ is a ratio of sums of products of integer tile values and its numerator can be
  //      exactly zero; the runs z is zero whenever the observed run count equals 2n₁n₂/n + 1,
  //      and the artifact does not record n₁, so there is no integrality test to apply. Calling
  //      an attainable value impossible is the same defect as (1), one statistic over.
  //      What replaces them is coverage that does not depend on a value being improbable:
  //      layoutR1Z is reconciled against layoutR1·√N and layoutRunsPValue against the normal
  //      tail of layoutRunsZ (H-C, above), and the deep statistics are replayable end-to-end by
  //      `npm run deep-replay` (QA-04).
  //
  // Net effect on the forged-evidence battery, measured rather than assumed: A23 (the fabricated
  // Pass 1 forged to the centre of every band) is still REJECTED — it fails p-value
  // reconciliation, because χ²=24 on 24 df has p≈0.4616 and the forgery writes 0.5 — and A25/A26
  // below are new negative controls for precisely this arm.
  let degenerate = 0, firstDegenerate = '';
  let supportedEqualities = 0;
  for (const r of results1) {
    const { faults, supportedExactMean } = nullCentreSupport(r, roundsPerConfig);
    if (supportedExactMean) supportedEqualities++;
    if (faults.length > 0) {
      degenerate++;
      if (!firstDegenerate) firstDegenerate = `m=${r?.mineCount}: ${faults.join('; ')}`;
    }
  }
  const plausibilityOk = lowerBon === 0 && runsLowerBon === 0 && degenerate === 0;

  // Summary scalars recomputed from the rows (never read).
  const meanSim = results1.reduce((s, r) => s + (r?.simRTP ?? NaN), 0) / (results1.length || 1);
  const meanTheo = results1.reduce((s, r) => s + (r?.theoreticalRTP ?? NaN), 0) / (results1.length || 1);
  const meansOk = Number.isFinite(pass1.meanSimulatedRTP) && Number.isFinite(pass1.meanTheoreticalRTP)
    && Math.abs(pass1.meanSimulatedRTP - meanSim) < 1e-12
    && Math.abs(pass1.meanTheoreticalRTP - meanTheo) < 1e-12;

  // G-BIND item 3 — bind each ROW to actual RNG output. Every Pass-1 row names the fresh
  // serverSeed/clientSeed it was drawn with, so the first convergence checkpoint is
  // reproducible: re-draw BIND_CHECKPOINT_N rounds with revealMines and count the k=1 wins
  // (tile 1 not a mine). A fabricated row cannot survive this without someone actually running
  // the RNG — which is the whole point. The deeper checkpoints (5e3..1e6) are not re-drawn
  // inside a verify run (~40 s each at 1e6); they are constrained to be monotone in n, bounded
  // by n, and within 5·SE of the fair win rate.
  const convSamplesSeen = new Set<number>();
  let convBad = 0, convChecked = 0, convFirstBad = '';
  for (const r of results1) {
    const conv: any[] = Array.isArray(r?.convergence) ? r.convergence : [];
    if (conv.length === 0) { convBad++; if (!convFirstBad) convFirstBad = `m=${r?.mineCount}: no convergence checkpoints`; continue; }
    const m = r?.mineCount;
    const p = (GRID - m) / GRID;
    let prevN = 0, prevWins = 0;
    for (const c of conv) {
      if (!Number.isFinite(c?.n) || !Number.isFinite(c?.wins)) { convBad++; break; }
      convSamplesSeen.add(c.n);
      if (c.n <= prevN || c.wins < prevWins || c.wins > c.n) { convBad++; if (!convFirstBad) convFirstBad = `m=${m}: checkpoint (${c.n},${c.wins}) not monotone/bounded`; break; }
      const seHat = Math.sqrt((p * (1 - p)) / c.n);
      if (Math.abs(c.wins / c.n - p) > 5 * seHat) { convBad++; if (!convFirstBad) convFirstBad = `m=${m}: win rate at n=${c.n} is ${(c.wins / c.n).toFixed(5)}, >5·SE from ${p}`; break; }
      prevN = c.n; prevWins = c.wins;
    }
    // The re-drawn bind.
    const cp = conv.find((c: any) => c?.n === BIND_CHECKPOINT_N);
    if (!cp || typeof r?.serverSeed !== 'string' || typeof r?.clientSeed !== 'string'
        || !/^[0-9a-f]{32}$/.test(r.serverSeed) || !/^[0-9a-f]{32}$/.test(r.clientSeed)) {
      convBad++;
      if (!convFirstBad) convFirstBad = `m=${m}: no n=${BIND_CHECKPOINT_N} checkpoint or malformed seeds to re-draw it from`;
      continue;
    }
    let wins = 0;
    for (let n = 0; n < BIND_CHECKPOINT_N; n++) {
      const mines = revealMines(r.serverSeed, r.clientSeed, n, m);
      if (!mines.includes(1)) wins++;
    }
    convChecked++;
    if (wins !== cp.wins) {
      convBad++;
      if (!convFirstBad) convFirstBad = `m=${m}: re-drawn n=${BIND_CHECKPOINT_N} wins ${wins} != stored ${cp.wins} (row not produced by these seeds)`;
    }
  }
  // The checkpoint grid itself is derived, not read: simulate.ts samples the fixed ladder
  // filtered to n ≤ roundsPerConfig, so at the enforced floor all seven points must be present.
  const EXPECTED_CONV_N = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000].filter(n => n <= roundsPerConfig);
  const convGridOk = EXPECTED_CONV_N.every(n => convSamplesSeen.has(n)) && convSamplesSeen.size === EXPECTED_CONV_N.length;
  const convOk = convBad === 0 && convChecked === CONFIGS && convGridOk;

  const pass1HasData = inventoryOk && configsDeclaredOk && bonAlphaOk && bonZOk && houseEdgeOk
    && roundsOk && totalRoundsOk
    && rowCountOk && mineCountSetOk && rows1Finite
    && pvOk && rtpDeriveOk && plausibilityOk
    && theoOk && bandOk && meansOk && convOk && jointConfigsOk
    && pass1.firstDrawChi2FailsBonferroni === firstDrawBon
    && pass1.firstDrawChi2FailsAtAlpha01 === firstDrawUnc
    && (pass1.jointFailsBonferroni ?? pass1.jointChi2FailsBonferroni) === jointBon
    && pass1.jointFailsAtAlpha01 === jointUnc
    && pass1.layoutSerialFailsBonferroni === serialBon
    && pass1.layoutSerialFailsUncorrected === serialUnc
    && Math.abs((pass1.jointMaxAbsZAcrossConfigs ?? NaN) - jointMaxAbsZ) < 1e-12;
  const pass1Ok = pass1HasData && firstDrawBon === 0 && jointBon === 0 && serialBon === 0;

  // Why each arm failed, when one does — a bare FAIL with a clean-looking detail line is how a
  // forged artifact reads as a pipeline hiccup.
  const s16Faults: string[] = [];
  if (!inventoryOk) s16Faults.push(inventoryNote);
  if (!configsDeclaredOk) s16Faults.push(`declared configs ${pass1.configs} != MINE_COUNTS.length ${CONFIGS}`);
  if (!roundsOk) s16Faults.push(`roundsPerConfig ${pass1.roundsPerConfig} below the ${MIN_ROUNDS_PER_CONFIG.toLocaleString()} floor`);
  if (!totalRoundsOk) s16Faults.push(`totalRounds ${pass1.totalRounds} != ${CONFIGS} × ${roundsPerConfig}`);
  if (!houseEdgeOk) s16Faults.push(`artifact houseEdge ${sim.houseEdge} != src/config.ts HOUSE_EDGE ${HOUSE_EDGE}`);
  if (!bonAlphaOk || !bonZOk) s16Faults.push('reported Bonferroni threshold(s) disagree with the derived α/24');
  if (!rowCountOk) s16Faults.push(`${results1.length} detail rows, expected ${CONFIGS}`);
  else if (!mineCountSetOk) s16Faults.push('detail rows are not one per mineCount 1..24 (duplicate or missing config)');
  if (!rows1Finite) s16Faults.push('non-finite / wrong-shaped statistic in at least one row');
  if (!theoOk) s16Faults.push(`${theoBad} rows whose theoreticalRTP != theoreticalRTP(m,1) recomputed from src/config.ts (max dev ${theoDev.toExponential(2)})`);
  if (!bandOk) s16Faults.push(`${bandFails} rows outside the per-config 5·SE band around ${(theoreticalRTP(1, 1) * 100).toFixed(4)}%`);
  if (!meansOk) s16Faults.push('mean RTP scalars disagree with the mean of the detail rows');
  if (!convOk) s16Faults.push(`convergence bind: ${convBad} bad, ${convChecked}/${CONFIGS} re-drawn${convFirstBad ? ` (${convFirstBad})` : ''}${convGridOk ? '' : '; checkpoint grid does not match the derived ladder'}`);
  if (!jointConfigsOk) s16Faults.push(`jointConfigsTested ${pass1.jointConfigsTested} vs ${jointConfigs} rows with a pair test (expected ${CONFIGS - 1})`);
  if (!pvOk) s16Faults.push(`${pvMismatches} statistic/p-value pairs that do not reconcile — a stored p that does not follow from the statistic beside it${firstPvFault ? ` (${firstPvFault})` : ''}`);
  if (!rtpDeriveOk) s16Faults.push(`${rtpDeriveBad} rows whose simRTP does not equal (final convergence wins / N) × mult₁${firstRtpFault ? ` (${firstRtpFault})` : ''}`);
  if (lowerBon > 0) s16Faults.push(`${lowerBon}/${CONFIGS} first-draw p-values in the LOWER tail at Bonferroni (p > 1 − α/${CONFIGS}) — a χ² that far below its df is as improbable as one far above it`);
  if (runsLowerBon > 0) s16Faults.push(`${runsLowerBon}/${CONFIGS} runs p-values in the LOWER tail at Bonferroni`);
  if (degenerate > 0) s16Faults.push(`${degenerate}/${CONFIGS} rows carry a null-centre value that is either outside the support of the integer counts that produce it, or contradicted by the row's own convergence counts${firstDegenerate ? ` (${firstDegenerate})` : ''}`);

  const s16 = step(16, 'Simulation — Pass 1 (First-Draw · Joint · Serial, FWER)',
    pass1Ok ? 'PASS' : 'FAIL',
    `${CONFIGS} configurations × ${roundsPerConfig.toLocaleString()} rounds = ${(pass1.totalRounds ?? 0).toLocaleString()} rounds. `
      + `Approximate statistical thresholds use Bonferroni α/${CONFIGS}=${bonAlpha.toExponential(3)}. `
      + `First-drawn tile uniformity: ${firstDrawUnc}/${CONFIGS} unadjusted rejections, ${firstDrawBon}/${CONFIGS} adjusted. `
      + `Pairwise co-occurrence: ${jointUnc}/${jointConfigs} unadjusted rejections, ${jointBon}/${jointConfigs} adjusted; `
      + `max|z|=${jointMaxAbsZ.toFixed(2)}, per-pair critical=${jointPairCritZ.toFixed(2)} after adjustment across pairs and configurations. `
      + `First-drawn-tile serial checks: ${serialUnc}/${CONFIGS} unadjusted rejections, ${serialBon}/${CONFIGS} adjusted; lag-one |z| critical=${bonZCrit.toFixed(2)}. `
      + `Mean simulated RTP ${(meanSim * 100).toFixed(4)}%; reference ${(meanTheo * 100).toFixed(4)}%. `
      + `Artifact checks: ${inventoryNote}; ${pvMismatches} statistic/p-value mismatches; ${rtpDeriveBad} RTP/convergence mismatches; `
      + `${lowerBon} first-draw and ${runsLowerBon} runs lower-tail rejections; ${degenerate} unsupported or contradictory rows; ${supportedEqualities} supported exact-mean rows. `
      + `Convergence: ${convChecked}/${CONFIGS} initial ${BIND_CHECKPOINT_N.toLocaleString()}-round checkpoints recomputed, ${convBad} faults; `
      + `RTP deviation up to ${worstZ.toFixed(2)} modeled SE at m=${worstZm}. `
      + `FALSE-ALARM ACCOUNTING: ${fa.arms.length} scored rejection arms have total NOMINAL level ${fa.totalNominalPercent.toFixed(4)}%; this is NOT an upper bound or a calibrated combined rate. `
      + `At n=${fa.notAnUpperBound.checkpointN}, m=${fa.notAnUpperBound.worstConfig.mineCount}, the 5-SE screen rejects wins ≤ ${fa.notAnUpperBound.worstConfig.rejectAtOrBelow} or ≥ ${fa.notAnUpperBound.worstConfig.rejectAtOrAbove}; `
      + `its exact binomial rejection probability is ${fa.notAnUpperBound.worstConfig.exactRejectionProbability.toExponential(12)}, compared with nominal ${fa.notAnUpperBound.worstConfig.nominalRejectionProbability.toExponential(12)}. `
      + `The Bernstein union upper bound ${fa.validBounds.arm8UnionUpperBound.toExponential(4)} covers the convergence-screen family only. See outputs/audit-figures.json → falseAlarmAccounting for the individual arms. `
      + `Default verification recomputes the initial checkpoints and checks deeper summaries for consistency. Full Pass-1 statistics require npm run deep-replay, using the retained row seeds. `
      + `A self-consistent deep-summary forgery can pass ordinary verification; this coverage boundary is exercised by declared survivor S01. Serial statistics concern first-drawn tiles, not every form of layout dependence.`
      + (s16Faults.length > 0 ? ` FAULTS: ${s16Faults.join('; ')}` : ''),
  );

  // ── Step 17: Pass 2 (casino seeds, cherry-pick, 0..49 bootstrap null) ─────────
  const pass2 = sim.pass2_casino_seeds ?? {};
  const results2: any[] = Array.isArray(pass2.results) ? pass2.results : [];

  // G-BIND items 1+2 — the population is ctx.seeds, not `pass2.seeds_tested`. The row set must
  // BE the revealed casino seeds: same hashes, no duplicates, epoch and mineCount matching the
  // seed record and the dataset's own bets. A count is not an identity — 138 copies of one row
  // and 138 empty `{}` rows both satisfied "138 rows".
  const revealedSeeds = ctx.seeds.filter(s => s.serverSeed);
  const revealedSeedCount = revealedSeeds.length;
  const seedByHash = new Map(revealedSeeds.map(s => [s.hashedServerSeed, s]));
  // mineCount per epoch, derived from the pinned dataset exactly as simulate.ts derives it:
  // the first bet recorded against that hashedServerSeed.
  const mineCountByHash = new Map<string, number>();
  for (const b of ctx.bets) if (!mineCountByHash.has(b.hashedServerSeed)) mineCountByHash.set(b.hashedServerSeed, b.mineCount);

  const rowHashes = results2.map(r => r?.hashedServerSeed);
  const rowHashSet = new Set(rowHashes);
  const seedSetOk = results2.length === revealedSeedCount
    && rowHashSet.size === revealedSeedCount
    && [...seedByHash.keys()].every(h => rowHashSet.has(h));

  const noncesPerSeed = Number(pass2.noncesPerSeed);
  const early: any[] = Array.isArray(pass2.earlyWindow) ? pass2.earlyWindow : [];
  const late: any[] = Array.isArray(pass2.lateWindow) ? pass2.lateWindow : [];
  const earlyOk = early.length === 2 && early[0] === 0 && Number.isFinite(early[1]) && early[1] > 0;
  const earlyN = earlyOk ? early[1] + 1 : 0;
  const windowsOk = earlyOk && Number.isFinite(noncesPerSeed) && noncesPerSeed > earlyN
    && late.length === 2 && late[0] === earlyN && late[1] === noncesPerSeed - 1;
  const lateN = windowsOk ? noncesPerSeed - earlyN : 0;
  const reps = Number(pass2.bootstrapReps);
  const repsOk = Number.isFinite(reps) && reps >= 1_000;

  // Every row's numeric statistic that any predicate reads must be finite BEFORE it is used
  // (138 empty `{}` rows produced 0 flags and survival 1 under the old count-only guard).
  const rows2Finite = results2.length > 0 && results2.every(r =>
    Number.isFinite(r?.epoch) && typeof r?.hashedServerSeed === 'string'
    && Number.isFinite(r?.mineCount)
    && Number.isFinite(r?.earlyChi2) && Number.isFinite(r?.earlyBootstrapP)
    && Number.isFinite(r?.lateChi2) && Number.isFinite(r?.latePValue)
    && typeof r?.cherryPickFlag === 'boolean');

  // G-BIND item 3 — RE-DERIVE the chi² statistics from the dataset's own revealed serverSeeds.
  // The first drawn tile is one HMAC (src/rng.ts firstMineTile === revealMines(...)[0]), so all
  // 138 seeds × 10,000 nonces recompute in ~1.9 s. This is what makes the rows evidence rather
  // than assertions: a fabricated row is now wrong about a number this file computes itself.
  // earlyBootstrapP is the ONE numeric that cannot be re-derived (its null is 10,000 fresh
  // random replicates); it is structurally constrained below and disclosed as such.
  let recomputeOk = windowsOk && rows2Finite && seedSetOk;
  let statMismatches = 0, epochMismatches = 0, mcMismatches = 0, flagMismatches = 0;
  let firstStatFault = '';
  let derivedFlags = 0;
  let bootPQuantBad = 0, bootPRangeBad = 0;
  if (recomputeOk) {
    for (const r of results2) {
      const seed = seedByHash.get(r.hashedServerSeed);
      if (!seed) { statMismatches++; continue; }
      if (r.epoch !== seed.epoch) epochMismatches++;
      const dsMineCount = mineCountByHash.get(r.hashedServerSeed);
      if (dsMineCount === undefined || r.mineCount !== dsMineCount) mcMismatches++;

      const ef = new Array(GRID).fill(0);
      const lf = new Array(GRID).fill(0);
      for (let n = 0; n < noncesPerSeed; n++) {
        const t = firstMineTile(seed.serverSeed as string, seed.clientSeed, n);
        if (n < earlyN) ef[t - 1]++; else lf[t - 1]++;
      }
      const ec = chiSquaredTest([...ef], new Array(GRID).fill(earlyN / GRID));
      const lr = chiSquaredTest([...lf], new Array(GRID).fill(lateN / GRID));
      if (!(Math.abs(ec.chi2 - r.earlyChi2) < 1e-9)
          || !(Math.abs(lr.chi2 - r.lateChi2) < 1e-9)
          || !(Math.abs(lr.pValue - r.latePValue) < 1e-12)) {
        statMismatches++;
        if (!firstStatFault) firstStatFault = `epoch ${r.epoch}: stored (earlyChi2 ${r.earlyChi2}, lateChi2 ${r.lateChi2}, lateP ${r.latePValue}) vs re-derived (${ec.chi2}, ${lr.chi2}, ${lr.pValue})`;
      }

      // earlyBootstrapP structural constraints: an empirical upper-tail p with add-one
      // smoothing is exactly (ge+1)/(reps+1) for integer ge ∈ [0, reps] — so it is quantized
      // and can never be 0. Not an attestation of its VALUE; it rules out a hand-typed p.
      const kUnits = r.earlyBootstrapP * (reps + 1);
      if (Math.abs(kUnits - Math.round(kUnits)) > 1e-6) bootPQuantBad++;
      if (!(r.earlyBootstrapP >= 1 / (reps + 1) - 1e-12 && r.earlyBootstrapP <= 1 + 1e-12)) bootPRangeBad++;

      // G-BIND item 4 — the flag is DERIVED from the RE-DERIVED latePValue (never the stored
      // one) and the stored boolean must equal it. Under the old guard, 138 rows carrying
      // earlyBootstrapP=1e-10, latePValue=0.5 and cherryPickFlag=false scored a Full Pass even
      // though the stated criterion makes every one of them a flag.
      const derived = r.earlyBootstrapP < CHERRY_EARLY_ALPHA && lr.pValue >= CHERRY_LATE_ALPHA;
      if (derived) derivedFlags++;
      if (derived !== r.cherryPickFlag) flagMismatches++;
    }
    recomputeOk = statMismatches === 0 && epochMismatches === 0 && mcMismatches === 0
      && flagMismatches === 0 && bootPQuantBad === 0 && bootPRangeBad === 0;
  }

  // Rebuild every bootstrap null from the recorded seed and version. The first-tile fast
  // path equals revealMines(...)[0]; its full-shuffle parity is covered by the unit suite.
  // Any supplied replay metadata must be complete and valid. Absent metadata is supported
  // only for the fixed compatibility fixture; it cannot bypass verification for other data.
  const bootMaster = (sim as any).masterSeed;
  const bootVersionTop = (sim as any).seedDerivation;
  const bootVersionPass2 = pass2.bootstrapSeedDerivation;
  const bootVersion = bootVersionTop ?? bootVersionPass2;
  const replayPathsPresent = ([
    ['masterSeed', bootMaster],
    ['seedDerivation', bootVersionTop],
    ['pass2_casino_seeds.bootstrapSeedDerivation', bootVersionPass2],
  ] as [string, unknown][]).filter(([, v]) => v !== undefined);
  const claimsReplay = replayPathsPresent.length > 0;

  const replayMetaFaults: string[] = [];
  if (claimsReplay) {
    if (replayPathsPresent.length !== KP_OPTIONAL_ATTESTED.length) {
      const missing = KP_OPTIONAL_ATTESTED.filter(p => !replayPathsPresent.some(([n]) => n === p));
      replayMetaFaults.push(`replay metadata INCOMPLETE — the artifact carries ${replayPathsPresent.map(([n]) => n).join(', ')} but not ${missing.join(', ')}; all ${KP_OPTIONAL_ATTESTED.length} are required together or the artifact must carry none of them`);
    }
    if (!isMasterSeed(bootMaster)) {
      replayMetaFaults.push(`masterSeed ${JSON.stringify(bootMaster)} is not a usable master seed (32–128 lowercase hex characters, even length) — the bootstrap null cannot be rebuilt from it, so the run is UNVERIFIABLE, not exempt`);
    }
    for (const [name, v] of [['seedDerivation', bootVersionTop], ['pass2_casino_seeds.bootstrapSeedDerivation', bootVersionPass2]] as [string, unknown][]) {
      if (v !== undefined && v !== SEED_DERIVATION_VERSION) {
        replayMetaFaults.push(`${name} ${JSON.stringify(v)} is not the derivation this build implements (${SEED_DERIVATION_VERSION}) — this build cannot rebuild that artifact's null and must not score it as if no null were needed`);
      }
    }
  }
  const replayMetaOk = replayMetaFaults.length === 0;

  const bootReplayAvailable = claimsReplay && replayMetaOk
    && repsOk && rows2Finite && earlyOk;
  let bootReplayed = 0, bootPMismatches = 0, firstBootFault = '';
  if (bootReplayAvailable) {
    // One sorted null per mineCount, rebuilt exactly as src/simulate.ts builds it.
    const nulls = new Map<number, Float64Array>();
    for (const mc of new Set<number>(results2.map(r => r.mineCount))) {
      const stats = new Float64Array(reps);
      for (let rep = 0; rep < reps; rep++) {
        const bs = deriveSeedHex(bootMaster, `pass2-bootstrap-server:m=${mc}`, rep);
        const bc = deriveSeedHex(bootMaster, `pass2-bootstrap-client:m=${mc}`, rep);
        const freq = new Array(GRID).fill(0);
        for (let n = 0; n < earlyN; n++) freq[firstMineTile(bs, bc, n) - 1]++;
        stats[rep] = chiSquaredTest([...freq], new Array(GRID).fill(earlyN / GRID)).chi2;
      }
      stats.sort();
      nulls.set(mc, stats);
    }
    // Same empirical upper-tail p with add-one smoothing src/simulate.ts uses.
    const bootP = (sorted: Float64Array, stat: number): number => {
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < stat) lo = mid + 1; else hi = mid; }
      return (sorted.length - lo + 1) / (sorted.length + 1);
    };
    for (const r of results2) {
      const sorted = nulls.get(r.mineCount);
      if (!sorted) { bootPMismatches++; continue; }
      const p = bootP(sorted, r.earlyChi2);
      bootReplayed++;
      if (Math.abs(p - r.earlyBootstrapP) > 1e-12) {
        bootPMismatches++;
        if (!firstBootFault) firstBootFault = `epoch ${r.epoch}: stored earlyBootstrapP ${r.earlyBootstrapP}, replayed ${p}`;
      }
    }
  }
  // The legacy exception (QA-05b): claimed nothing, AND is the one artifact src/pins.ts names.
  const legacyDigest = earlyBootstrapPDigest(results2);
  const legacyPinOk = legacyDigest === LEGACY_EARLY_BOOTSTRAP_P_DIGEST;
  const legacyExceptionOk = !claimsReplay && legacyPinOk;

  // FAILS CLOSED. There is no longer any state in which `earlyBootstrapP` goes unchallenged:
  // either the replay ran and matched, or this is the pinned legacy artifact, or Step 17 fails.
  const bootReplayOk = claimsReplay
    ? (replayMetaOk && bootReplayAvailable && bootPMismatches === 0 && bootReplayed === results2.length)
    : legacyExceptionOk;

  // Within a mineCount every row's earlyBootstrapP came from the SAME sorted bootstrap null, so
  // p must be non-increasing in earlyChi2 there — exactly, with no tolerance. Cheap, and it
  // rejects an artifact whose p-values were written independently of its chi² statistics.
  let monoViolations = 0;
  if (rows2Finite) {
    const byM = new Map<number, any[]>();
    for (const r of results2) {
      const arr = byM.get(r.mineCount) ?? [];
      arr.push(r);
      byM.set(r.mineCount, arr);
    }
    for (const [, rows] of byM) {
      const sorted = [...rows].sort((a, b) => a.earlyChi2 - b.earlyChi2);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].earlyBootstrapP > sorted[i - 1].earlyBootstrapP + 1e-12) monoViolations++;
      }
    }
  }

  // bootstrapMineCounts must be the sorted distinct mineCounts of the revealed epochs — derived
  // from the pinned dataset, not read.
  const expectedBootMC = [...new Set(revealedSeeds.map(s => mineCountByHash.get(s.hashedServerSeed)))]
    .filter(v => v !== undefined).sort((a, b) => (a as number) - (b as number));
  const bootMC: any[] = Array.isArray(pass2.bootstrapMineCounts) ? pass2.bootstrapMineCounts : [];
  const bootMCOk = bootMC.length === expectedBootMC.length
    && expectedBootMC.every((m, i) => bootMC[i] === m);

  // Scalars recomputed, never read (G-SIMDERIVE) — now from DERIVED flags, not stored ones.
  const survival = binomialSurvival(derivedFlags, revealedSeedCount, CHERRY_FLAG_RATE);
  const expectedByChance = revealedSeedCount * CHERRY_FLAG_RATE;
  const scalarsOk = pass2.seeds_tested === revealedSeedCount
    && pass2.cherryPickFlags === derivedFlags
    && Number.isFinite(pass2.expectedFlagsByChance) && Math.abs(pass2.expectedFlagsByChance - expectedByChance) < 1e-9
    && Number.isFinite(pass2.cherryPickSurvivalP) && Math.abs(pass2.cherryPickSurvivalP - survival) < 1e-9;

  const pass2HasData = inventoryOk && seedSetOk && rows2Finite && windowsOk && repsOk
    && recomputeOk && monoViolations === 0 && bootMCOk && scalarsOk && bootReplayOk
    && revealedSeedCount === ctx.seeds.length      // 100% of seeds rotated in a delivered dataset
    && Number.isFinite(survival);
  const pass2Ok = pass2HasData && survival >= 0.01;

  const s17Faults: string[] = [];
  if (!inventoryOk) s17Faults.push(inventoryNote);
  if (!seedSetOk) s17Faults.push(`row seed set is not the ${revealedSeedCount} revealed dataset seeds (${results2.length} rows, ${rowHashSet.size} distinct hashes)`);
  if (!rows2Finite) s17Faults.push('non-finite / wrong-typed field in at least one seed row');
  if (replayMetaFaults.length > 0) s17Faults.push(`QA-05 replay metadata rejected — ${replayMetaFaults.join('; ')}`);
  if (!bootReplayOk && replayMetaFaults.length === 0) {
    if (claimsReplay) {
      s17Faults.push(bootReplayAvailable
        ? `deterministic bootstrap replay: ${bootPMismatches} of ${results2.length} rows whose earlyBootstrapP does not re-derive from the recorded masterSeed${firstBootFault ? ` (${firstBootFault})` : ''}`
        : `the artifact records valid QA-05 replay metadata but the replay could not be run against it (bootstrapReps / row finiteness / early-window declaration above), so earlyBootstrapP is unattested`);
    } else {
      s17Faults.push(`the artifact records NO QA-05 replay metadata, so its earlyBootstrapP cannot be re-derived, and it is not the one artifact the legacy exception covers: earlyBootstrapP digest ${legacyDigest} != pinned ${LEGACY_EARLY_BOOTSTRAP_P_DIGEST} (src/pins.ts). Omitting masterSeed is not a way to have earlyBootstrapP taken on trust`);
    }
  }
  if (!windowsOk) s17Faults.push(`window declaration inconsistent: noncesPerSeed ${pass2.noncesPerSeed}, early ${JSON.stringify(pass2.earlyWindow)}, late ${JSON.stringify(pass2.lateWindow)}`);
  if (!repsOk) s17Faults.push(`bootstrapReps ${pass2.bootstrapReps} below the 1,000 floor`);
  if (statMismatches > 0) s17Faults.push(`${statMismatches} rows whose chi² statistics do not re-derive from the dataset's revealed serverSeed${firstStatFault ? ` (${firstStatFault})` : ''}`);
  if (epochMismatches > 0) s17Faults.push(`${epochMismatches} rows whose epoch does not match the seed record`);
  if (mcMismatches > 0) s17Faults.push(`${mcMismatches} rows whose mineCount does not match the epoch's bets in the dataset`);
  if (flagMismatches > 0) s17Faults.push(`${flagMismatches} rows whose stored cherryPickFlag != the flag derived from earlyBootstrapP<0.05 AND re-derived latePValue>=0.05`);
  if (bootPQuantBad > 0) s17Faults.push(`${bootPQuantBad} earlyBootstrapP values not of the form k/(reps+1)`);
  if (bootPRangeBad > 0) s17Faults.push(`${bootPRangeBad} earlyBootstrapP values outside [1/(reps+1), 1]`);
  if (monoViolations > 0) s17Faults.push(`${monoViolations} within-mineCount monotonicity violations (larger earlyChi2 with a larger bootstrap p)`);
  if (!bootMCOk) s17Faults.push('bootstrapMineCounts is not the sorted distinct mineCount set of the revealed epochs');
  if (!scalarsOk) s17Faults.push('summary scalars (seeds_tested / cherryPickFlags / expectedFlagsByChance / cherryPickSurvivalP) disagree with the recomputation');
  if (pass2HasData && survival < 0.01) s17Faults.push(`cherry-pick survival P=${survival.toExponential(3)} < 0.01`);

  const s17 = step(17, 'Simulation — Pass 2 Cherry-Pick Test',
    pass2Ok ? 'PASS' : 'FAIL',
    `${revealedSeedCount} revealed dataset seeds × ${(noncesPerSeed || 0).toLocaleString()} nonces; early window ${early[0] ?? '?'}..${early[1] ?? '?'}. `
      + `Recalculated early/late statistics and late p-values: ${statMismatches} mismatching rows; epoch and mine-count mismatches: ${epochMismatches}, ${mcMismatches}. `
      + `Flags derived from earlyBootstrapP < ${CHERRY_EARLY_ALPHA} and latePValue >= ${CHERRY_LATE_ALPHA}: ${derivedFlags}; `
      + `nominal expectation ${expectedByChance.toFixed(3)}, binomial survival ${survival.toFixed(8)}; ${flagMismatches} stored-flag mismatches. `
      + (bootReplayAvailable
          ? `Bootstrap replay: ${(reps || 0).toLocaleString()} replicates per mine count rebuilt from the recorded master seed under '${bootVersion}'; ${bootReplayed}/${results2.length} p-values checked, ${bootPMismatches} mismatches. `
          : claimsReplay
            ? `Bootstrap replay did not run because the supplied replay metadata or statistical inputs are invalid; the faults below identify the rejected fields. `
            : legacyExceptionOk
              ? `Compatibility-fixture mode: early bootstrap values match the fixed reference digest ${LEGACY_EARLY_BOOTSTRAP_P_DIGEST}. This fixture lacks generating inputs, so its p-values are pinned rather than replayed. Range, lattice, ordering and downstream arithmetic are checked (${monoViolations} ordering violations). `
              : `Bootstrap replay unavailable: replay metadata is absent and the values do not match the supported compatibility fixture. `)
      + `Unsupported, partial or malformed replay metadata fails verification. This first-draw diagnostic does not prove unbiased seed selection. `
      + `Mitigation against selecting a server seed for a known client input requires a binding server commitment before learning an unpredictable client seed, with both inputs bound to the round. Player control alone does not establish those conditions.`
      + (s17Faults.length > 0 ? ` FAULTS: ${s17Faults.join('; ')}` : ''),
  );

  return [s16, s17];
}
