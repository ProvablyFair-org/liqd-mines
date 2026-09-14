/**
 * Integrity pins — ONE definition, imported by every reader.
 *
 * The captured master dataset is the load-bearing artifact of this audit: every scored
 * step reads it, and the simulation's Pass 2 reads its revealed casino seeds. Its SHA-256
 * is pinned so that ANY edit — a flipped nibble in a serverSeed, a moved decimal in a
 * winningAmount, a deleted bet — aborts the run instead of being audited as if it were
 * the capture.
 *
 * This constant lived in TWO files (`src/simulate.ts` and `tests/verify.ts`) until
 * 2026-09-09. Two pins are two things to keep in sync, and a re-pin that updates one and
 * not the other leaves a producer and a verifier disagreeing about which bytes they
 * audited. It is defined here exactly once and imported by both.
 */

import { createHash } from 'crypto';

/** SHA-256 of data/mines-master-6900bets.json, byte-for-byte as captured. */
export const EXPECTED_DATASET_HASH =
  'c7c2e8a930549e11e3e564a962aea0ca2875b6eb94bc1f4347cc703bc410b222';

/** Path fragment of the pinned dataset, relative to the repo root (for reporting). */
export const DATASET_RELATIVE_PATH = 'data/mines-master-6900bets.json';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE AUDITED POPULATION — G-BIND. A ROW COUNT IS NOT AN IDENTITY.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * The SHA-256 above proves the dataset has not changed since WE pinned it. It does NOT
 * prove the file is the capture: shrink the data, doctor the header to agree, re-pin, and
 * the repo is internally consistent again on a smaller population than the one this report
 * describes. Both Stage 8 reviewers did exactly that on 2026-09-09 — on mines, dropping a
 * trailing epoch (50 bets + its seed) produced "PROVABLY FAIR — Conditional Pass, exit 0",
 * because the only thing holding the audit at 6,900 bets was a phase table read from the
 * dataset's own `meta`, and every count the suite compared against came from inside the file
 * being scored.
 *
 * These three constants are the fix, and they are constants for a reason: they live in
 * source, are quoted in the report, and are asserted by Steps 11 and 12. Changing one is a
 * code change with a diff, not a header edit inside an evidence file.
 *
 * If a re-capture changes the plan, change these — and then every figure in the report that
 * quotes them has to change too, which is the intended cost.
 */

/** Bets in the delivered capture. Quoted throughout the report as "6,900 bets". */
export const EXPECTED_BETS = 6900;

/** Seed epochs in the delivered capture. Quoted throughout as "138 epochs / 138 seeds". */
export const EXPECTED_SEEDS = 138;

/** Bets per epoch — nonces 0..49 under one (serverSeed, clientSeed) pair. */
export const EXPECTED_EPOCH_SIZE = 50;

/** Planned bets per capture phase. `EXPECTED_BETS` must be their sum — asserted in Step 11. */
export const EXPECTED_PHASE_BETS: Record<'A' | 'B' | 'C' | 'D' | 'E', number> =
  { A: 4800, B: 1000, C: 200, D: 500, E: 400 };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE LEGACY BOOTSTRAP EXCEPTION — ONE ARTIFACT, NAMED IN SOURCE (QA-05b, 2026-09-11)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Step 17 replays the Pass-2 bootstrap null from the artifact's recorded `masterSeed`. The
 * committed 2026-08-05 artifact predates that machinery and records no master seed, so the
 * replay has nothing to rebuild and `earlyBootstrapP` stays bounded-only — limitation L2.
 *
 * Until 2026-09-11 that fallback was reached by ABSENCE OF DATA: any artifact that did not
 * carry usable replay metadata got the lenient path. A reviewer executed the consequence on
 * 2026-09-11 — set `seedDerivation` to an unknown string, or `masterSeed` to `not-hex`, and a
 * run whose p-values demonstrably did NOT replay went back to 21/21 Full Pass, exit 0. The
 * check was switched off by corrupting the thing it verifies.
 *
 * The fix has two halves. Invalid or partial replay metadata now FAILS Step 17 (see
 * `tests/steps/simulation.ts`). And the legacy path is no longer "no metadata" — it is THIS
 * artifact, identified by a digest over the exact quantity the exception excuses:
 *
 *     sha256( "<epoch>:<earlyBootstrapP>" for all rows, epoch-ascending, "\n"-joined )
 *
 * WHAT THIS PIN IS. A commitment, in source, with a diff, to the 138 numbers that were
 * reviewed. It makes the exception specific to one artifact instead of available to any file
 * that omits three fields, and it turns forgery A27 — one `earlyBootstrapP` nudged to a
 * neighbouring legal lattice point — from a declared survivor into a caught forgery.
 *
 * WHAT THIS PIN IS NOT. It is NOT evidence that these values came from a bootstrap. Nothing
 * in this repository can establish that for this artifact: the replicate inputs were
 * discarded in August 2026 and no master seed is invented for a run that did not record one.
 * **L2 stays open on the substance.** The pin closes the EDIT vector, not the origin question.
 *
 * A run produced by the current `src/simulate.ts` records its master seed, takes the replay
 * path, and never consults this pin.
 */
export const LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT = '2026-08-05T16:41:40.964Z';

/** Digest of the legacy artifact's `earlyBootstrapP` vector. See the block above. */
export const LEGACY_EARLY_BOOTSTRAP_P_DIGEST =
  '292d8d546f924cf4cc469bb01061e271c1892f4657f2f28754a2793dba08bc6d';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE PIN IS ABOUT A FIXED FILE, NOT ABOUT WHATEVER IS IN outputs/ (round-5, 2026-09-11)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * The QA-05b unit tests originally asserted the three properties above — the digest, the
 * absence of replay metadata, the 2026-08-05 timestamp — against the MUTABLE artifact at
 * `outputs/simulation-results.json`. That was the wrong place to put the assertion. The
 * producer legitimately writes a master seed, a derivation version, a fresh timestamp and
 * newly drawn bootstrap values, so the moment anyone re-ran the documented pipeline the unit
 * suite rejected the package's own output.
 *
 * EXECUTED by the reviewer on 2026-09-11 at reduced counts (ROUNDS_PER_CONFIG=1000,
 * PASS2_NONCES=1000, BOOTSTRAP_REPS=1000): `npm run simulate` exit 0, then `npm test` →
 * 32 passing, 3 failing, exit 3, the new vector digesting to
 * 4991688f6d269182da3a7b9318e955d450cc39c5ac3a3d5bf06ed35359f8ba8d.
 *
 * The pin does not get weaker — it gets a subject. The reviewed artifact is COPIED, byte for
 * byte, into `tests/fixtures/legacy-simulation-results.json`, which no pipeline step writes,
 * and the historical assertions are made against THAT. Its SHA-256 is pinned here so the
 * fixture cannot be quietly edited into agreement with the digest either.
 *
 * What remains asserted about the LIVE artifact is the rule Step 17 implements: it must be
 * one of the two supported shapes — schema-2 (all three replay fields present and usable) or
 * schema-1 (none of them, in which case it must BE this pinned legacy artifact). A schema-2
 * rebuild passes; a metadata-stripped forgery does not.
 */

/** SHA-256 of `tests/fixtures/legacy-simulation-results.json`, byte-for-byte as reviewed. */
export const LEGACY_BOOTSTRAP_ARTIFACT_SHA256 =
  'bf1838490a7e9c173a04c06c1255a59e2bf17e114cca02e9d9b491c72fea0461';

/** Path of the immutable legacy artifact copy, relative to the repo root. */
export const LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH =
  'tests/fixtures/legacy-simulation-results.json';

/**
 * Canonical digest of a Pass-2 row set's `earlyBootstrapP` vector. ONE definition, so the pin
 * above and the check that reads it can never drift apart. Order-insensitive by construction
 * (rows are sorted by epoch); a row missing either field digests as the literal `undefined`,
 * so a truncated or blanked row set can never collide with the pin.
 */
export function earlyBootstrapPDigest(rows: ReadonlyArray<any>): string {
  const canon = [...rows]
    .sort((a, b) => (a?.epoch ?? -1) - (b?.epoch ?? -1))
    .map(r => `${r?.epoch}:${r?.earlyBootstrapP}`)
    .join('\n');
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}
