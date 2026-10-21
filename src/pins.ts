/**
 * Integrity pins — ONE definition, imported by every reader.
 *
 * The captured master dataset is the load-bearing artifact of this audit: every scored
 * step reads it, and the simulation's Pass 2 reads its revealed casino seeds. Its SHA-256
 * is pinned so that ANY edit — a flipped nibble in a serverSeed, a moved decimal in a
 * winningAmount, a deleted bet — aborts the run instead of being audited as if it were
 * the capture.
 *
 * Two copies of this constant — one in `src/simulate.ts`, one in `tests/verify.ts` — would
 * be two things to keep in sync, and a re-pin that updates one and not the other leaves a
 * producer and a verifier disagreeing about which bytes they audited. It is defined here
 * exactly once and imported by both.
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
 * describes. Two independent reviewers did exactly that: dropping a
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
 * The first nonce of every epoch — a DECLARED constant, not the minimum observed and not the
 * `nonceStart` a seed record carries. LIQD resets the nonce to 0 on every server-seed rotation,
 * and the capture rotates before each epoch, so every epoch's window is
 * NONCE_BASE … NONCE_BASE + EXPECTED_EPOCH_SIZE − 1 = 0 … 49. Step 4 asserts the bets against
 * THIS window and then separately asserts that each seed record's own `nonceStart`/`nonceEnd`
 * agree with it, so a dataset whose records and bets were shifted together (1 … 50) no longer
 * passes by agreeing with itself.
 */
export const NONCE_BASE = 0;

/**
 * Auditor-side capture-retry nonce gaps this capture is DECLARED to contain. A retry leaves one
 * nonce unrecorded inside an otherwise complete window; it is disclosed as a capture-origin FLAG
 * (verdict-neutral). This capture has none — a prior LIQD capture had one, this one was re-run
 * clean — so any gap at all is a different dataset from the one declared and hard-fails Step 4,
 * rather than being attributed to the capture on the strength of the remaining bets replaying.
 */
export const EXPECTED_CAPTURE_RETRY_GAPS = 0;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE MULTI-REVEAL SUPPLEMENT — capture v3. A SUPPLEMENT, NOT A REPLACEMENT.
 *  SCORED: the 2026-10-03 capture (today's build). DATED HISTORY: the 2026-09-26 capture.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * The audited dataset above stays the population every Step 1–21 scores. The supplement is 1,000
 * interactive rounds (place-bet → open-tile × depth → cash-out-bet) captured by
 * capture/capture-mines-v3.mjs to close what the audited dataset cannot: several mine counts ×
 * several depths (MINES-15) and multi-reveal parity with a RECORDED reveal order (MINES-17).
 * It is scored by Step 22 alone, with one exception: its operator-settings declaration
 * (SUPPLEMENT_GAME_SETTINGS below, bound to the data by Step 22) is also read by Step 10's MINES-14
 * cap half, disclosed and not scored since 2026-10-15. Both files are vendored byte-identical from capture/out/ and
 * pinned here; the journal is the capture's append-only record (every round's reveal order was
 * journalled as an `intent` BEFORE its place-bet), and Step 22 requires it to agree with the
 * dataset row for row.
 *
 * WHICH CAPTURE IS SCORED (2026-10-03). The same 20-configuration plan was captured twice on
 * qa.liqd.com: on 2026-09-26 and on 2026-10-03, after LIQD stated (2026-09-30) that a fix for the
 * 1e-8 short credit ships in its next release. The package scores TODAY's build — the 2026-10-03
 * capture, below — and keeps the 2026-09-26 capture pinned as a DATED HISTORY exhibit
 * (SUPPLEMENT_HISTORY_* further down), whose quoted figures Step 22 re-derives from the pinned
 * bytes in arm (k) without scoring them as today's behaviour.
 *
 * The population is bound in source, not read from the file's own `meta` (G-BIND): 20 epochs of
 * 50, the (mineCount → depths) plan below, 50 rounds per configuration.
 */
export const SUPPLEMENT_DATASET_RELATIVE_PATH = 'data/liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.json';
export const SUPPLEMENT_DATASET_HASH =
  'a7737572394215b0262eb467eec4fe5ff083e87c0d132746aa6e66c271277b45';
export const SUPPLEMENT_JOURNAL_RELATIVE_PATH = 'data/liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.journal.ndjson';
export const SUPPLEMENT_JOURNAL_HASH =
  'db16421c70d55331049ce186d03fa1c60367c84b208252f920e8e91f2074e9c9';
/** The scored supplement's capture date, quoted in the step details. */
export const SUPPLEMENT_CAPTURE_DATE = '2026-10-03';
export const SUPPLEMENT_EXPECTED_BETS = 1000;
export const SUPPLEMENT_EXPECTED_SEEDS = 20;
export const SUPPLEMENT_PER_CONFIG = 50;
/** mineCount → the depths played before cash-out (the v3 plan; 5 × 4 = 20 configurations). */
export const SUPPLEMENT_DEPTHS: Readonly<Record<number, readonly number[]>> =
  { 1: [2, 5, 10, 15], 3: [2, 4, 6, 8], 5: [2, 3, 5, 6], 8: [2, 3, 4, 5], 12: [2, 3, 4, 5] };
/**
 * Cash-out rungs (mineCount, depth) that must be witnessed by at least one win. A FLOOR, declared
 * from the measured capture: on 2026-10-03 all 20 planned configurations cashed out at least once
 * (fewest: (12, 5), 2 wins in 50). The 2026-09-26 capture reached 19; its (12, 5) had 0 wins in 50
 * (P(win) = C(13,5)/C(25,5) = 0.0242, expected 1.2).
 */
export const SUPPLEMENT_MIN_CASHOUT_RUNGS = 20;
/**
 * DECLARED, and asserted against the data by Step 22: the number of reveals whose open-tile
 * response carried a multiplier. LIQD's open-tile response on a safe tile is `{ mineTile: false }`
 * and nothing else; a mine reveal returns the settled record, which carries no multiplier field.
 * The per-step rung arm of MINES-17 is therefore NOT SERVED ON THE WIRE: 0 of 3,314 reveals on
 * 2026-10-03 (0 of 3,418 on 2026-09-26).
 */
export const SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS = 0;
/**
 * ONE SETTLEMENT RULE FOR EVERY WIN, EVERY DATASET (2026-09-29).
 *
 * Every win this package scores — the audited dataset's 3,104 (Steps 7–8) and the scored
 * supplement's 393 (Step 22) — is held to the SAME declared rule, and so is every figure the dated
 * history quotes (the 2026-09-26 capture's 404 wins, Step 22 arm k):
 *   credit  = floor8(stake × exact rational multiplier)     (Step 8's rule; 0 tolerance)
 *   display = floor2(exact rational multiplier)             (Step 7's rule)
 * No rule fitted to the operator's output is used to score anything. A win that misses the rule
 * is a GAP against it, reported with its count, cells and magnitude — the audit does not move the
 * rule to where the operator landed.
 *
 * THE SCORED SUPPLEMENT'S GAP AGAINST THE ONE RULE IS ZERO (2026-10-03, measured): 393/393 credits
 * equal floor8(stake × exact) and 393/393 displayed multipliers equal floor2(exact), none above,
 * none below — including (1,10) ×23 and (1,15) ×16, the two cells that missed the rule on
 * 2026-09-26. Declared here so the published "0" is bound to the data: Step 22 FAILs if any win is
 * below the rule (the count, the cells and the total all move off 0) or above it.
 * Cell keys are `${mineCount}:${depth}`.
 */
export const SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW = 0;
export const SUPPLEMENT_CREDIT_GAP_CELLS: Readonly<Record<string, number>> = {};
/** Total shortfall against the credit rule, in 1e-8 units. */
export const SUPPLEMENT_CREDIT_GAP_TOTAL_UNITS = 0;
export const SUPPLEMENT_DISCLOSED_DISPLAY_CENT_BELOW = 0;
export const SUPPLEMENT_DISPLAY_GAP_CELLS: Readonly<Record<string, number>> = {};
/**
 * THE SUPPLEMENT BUILD'S OPERATOR SETTINGS (QA 2026-10-02, A4) — declared from the data, asserted
 * by Step 22, read by Step 10.
 *
 * The audited dataset (30 July 2026) carries `currentGameSettings` on 3,844 settles, one value:
 * {"minOdds":1.01,"maxOdds":10000,"houseEdge":1,"minBet":0.1,"maxBet":5000} — the source of
 * MAX_ODDS_DECLARED (src/config.ts). The scored 2026-10-03 supplement carries it on every one of its
 * 607 mine-reveal settle responses (`settleRaw`, repeated in that round's last reveal `steps[].raw`),
 * one value: minBet 0.01, maxBet 10000, NO maxOdds key, and five keys the audited build's records
 * do not carry — maxExposure 50000, maxExposureUsdc 50000, maxBetUsdc "10000.00000000",
 * exposureSource "global", maxBetSource "game". Recorded as served. Settled 2026-10-15: LIQD states
 * there is no multiplier cap on Mines since the end of August 2026 and that maxExposure is a per-round
 * payout limit; payout caps are excluded from the audit (profile owner, 2026-10-15). The 2026-09-26 capture's 596 records carried {"minOdds":1.01,"houseEdge":1,"minBet":
 * 0.01,"maxBet":10000} (SUPPLEMENT_HISTORY_GAME_SETTINGS below, dated history).
 *
 * Step 22 FAILs unless every supplement settings record equals `value` and there are exactly
 * `records` of them (each also equal in its reveal copy) — a drift moves the declaration, in a diff.
 * Step 10 reads this declaration for its MINES-14 cap half. From 2026-10-02 to 2026-10-15 that half
 * required the declared cap on these records and FLAGged on its absence; since 2026-10-15 it is
 * disclosed and not scored (no multiplier cap on this build, per LIQD; payout limits excluded).
 */
export const SUPPLEMENT_GAME_SETTINGS: Readonly<{ records: number; value: string }> = {
  records: 607,
  value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":10000,"maxExposure":50000,"maxExposureUsdc":50000,"maxBetUsdc":"10000.00000000","exposureSource":"global","maxBetSource":"game"}',
};
/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  DATED HISTORY — the 2026-09-26 capture of the same plan. PINNED, RE-DERIVED, NOT SCORED.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Until 2026-10-03 this capture WAS the scored supplement (Step 22 FLAG, the DL-14 credit gap).
 * It stays in data/ byte-identical and pinned, as exhibits E17/E18. Step 22 arm (k) hashes both
 * files (mismatch or absence FAILs — an exhibit of record was altered) and re-derives from the
 * dataset every figure the dated history quotes, against the same rule functions arm (g) uses;
 * any figure that moves off its declaration below FAILs the step, because a published history line
 * would then no longer describe the pinned bytes. None of these figures enters today's status.
 *
 * Measured 2026-09-26 and re-derived on 2026-10-03: 404 wins; 354 credited exactly at
 * floor8(stake × exact), 50 one 1e-8 unit below it — (1,10) ×29, (1,15) ×21 — $0.0000005 in total,
 * none above (DL-14, history); 375 displayed floor2(exact), 29 one cent below it, all at (1,10)
 * (1.64 where 33/20 = 1.65; DL-15, history); 596 settings records, one value, no maxOdds.
 *
 * OPEN RULING 2 (profile owner) — is a win credited 1e-8 below floor8(stake × exact) a FAIL or a
 * FLAG? — now bears ONLY on how this history is described: from 2026-10-01 to 2026-10-03 the
 * package held these 50 wins at a Step 22 FLAG pending the ruling (profile MINES-11's policy is
 * HARD_FAIL; the same shortfall on the audited dataset hard-fails Step 8, forgery D26). It does not
 * move today's status: the scored supplement's declared gap is 0, so a short credit on it FAILs
 * Step 22 through the binding above, as one on the audited dataset FAILs Step 8. Nothing here
 * decides the ruling.
 */
export const SUPPLEMENT_HISTORY_CAPTURE_DATE = '2026-09-26';
export const SUPPLEMENT_HISTORY_DATASET_RELATIVE_PATH = 'data/liqd-mines-capture-v3-2026-09-26T16-46-41-121Z.json';
export const SUPPLEMENT_HISTORY_DATASET_HASH =
  '023c17920d103954ec3c27eab4be55bdeef027884c06d33bd5434139bb569309';
export const SUPPLEMENT_HISTORY_JOURNAL_RELATIVE_PATH = 'data/liqd-mines-capture-v3-2026-09-26T16-46-41-121Z.journal.ndjson';
export const SUPPLEMENT_HISTORY_JOURNAL_HASH =
  '4f464fba88a515692e3f8ddaad4f6466345a1cc8180a96910a96f7461ac25fdc';
/** Rounds and wins in the history capture. */
export const SUPPLEMENT_HISTORY_BETS = 1000;
export const SUPPLEMENT_HISTORY_WINS = 404;
/** DL-14 (history): wins credited below floor8(stake × exact), by cell, per-win size and total (1e-8 units). */
export const SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW = 50;
export const SUPPLEMENT_HISTORY_CREDIT_GAP_CELLS: Readonly<Record<string, number>> = { '1:10': 29, '1:15': 21 };
export const SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN = 1;
export const SUPPLEMENT_HISTORY_CREDIT_GAP_TOTAL_UNITS = 50;
/** DL-15 (history): wins whose served multiplier is one cent below floor2(exact), by cell. */
export const SUPPLEMENT_HISTORY_DISPLAY_CENT_BELOW = 29;
export const SUPPLEMENT_HISTORY_DISPLAY_GAP_CELLS: Readonly<Record<string, number>> = { '1:10': 29 };
/** The history capture's operator settings: 596 records, one value, no maxOdds key. */
export const SUPPLEMENT_HISTORY_GAME_SETTINGS: Readonly<{ records: number; value: string }> = {
  records: 596,
  value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":10000}',
};
/**
 * Step 22's on-grid test: a served value × 1e8 (credit) or × 100 (display multiplier) must sit within
 * this of an integer — far tighter than one grid unit, loose enough for the binary64 representation
 * of the decimal literal. Declared here rather than typed into the step (conformance C-03).
 */
export const SUPPLEMENT_ON_GRID_TOLERANCE = 1e-6;

/** The audit ID assigned to this package. Emitted into verification-results.json; MANIFEST.md must carry the same ID (checked by scripts/check-standalone.mjs). */
export const AUDIT_ID = 'PF-2026-LQ02';

/**
 * Unit specs `npm test` must report as PASSING. The zero-install runner (scripts/standalone-runtime.cjs)
 * counts the specs that actually ran to completion and exits 1 when the count differs, so a
 * silently skipped or cancelled describe block cannot leave `npm test` green. Changing the unit
 * suite means changing this number, in a diff.
 */
export const EXPECTED_UNIT_TESTS = 49;

/**
 * ARTIFACTS OF RECORD — every artifact the report quotes, SHA-256 pinned (MINES-27).
 *
 * Step 19 re-hashes each one; an edit or a deletion FAILS it. Each must also be un-ignored BY NAME
 * in .gitignore, carry no run metadata (src/domains.ts RUN_METADATA_KEY) and, when it is JSON, have a
 * declared value domain for every numeric leaf (src/domains.ts). The pin asserts the identity of the
 * committed evidence; reproduction across machines is compared field by field at the reproduction
 * tolerance (src/diff.ts), never by these bytes.
 *
 * NOTHING THE PACKAGE RUNS BY DEFAULT WRITES THESE FILES. `npm run verify` writes only outputs/run/;
 * `npm run simulate`, `npm run figures` and `npm run bootstrap-replay` write to outputs/run/ unless
 * a caller deliberately names outputs/ (OUT_DIR / --out), and `npm run deep-replay` writes only
 * where --out points. The one deliberate in-place path for the scored record is PF_EMIT=1, and every
 * such regeneration is re-pinned here in the same diff.
 *
 * 2026-09-24 — run metadata removed and every file pinned. Removed with each generator's own
 * serialiser, every other leaf proven identical before/after (=== on all leaves):
 *   simulation-results.json   generatedAt, pass1_fresh_seeds.executionTimeMs,
 *                             pass2_casino_seeds.executionTimeMs (1,884 → 1,881 leaves, 0 changed;
 *                             was 0a00e0ca…613642). A SIM_REPLAY=1 regeneration reproduces it.
 *   simulation-provenance.json pass1.analysisRecordedAt, pass2.inputsRecordedAt; simulation.sha256
 *                             updated to the stripped artifact (was b8e13394…0aa4)
 *   deep-replay-report.json   generatedAt, artifactGeneratedAt, elapsedMs, perRow[].elapsedMs
 *                             (was ce0b055b…8d9f)
 *   bootstrap-replay-report.json  re-run by scripts/replay-bootstrap.py on the stripped inputs; it
 *                             no longer emits generatedAt or seconds (was 467ade06…0851)
 *   audit-figures.json        generatedAt (was 244fc8a4…3642)
 *   verification-results.json generatedAt (re-emitted by PF_EMIT=1)
 *
 * 2026-09-26 — verification-results.json re-emitted by PF_EMIT=1 with Step 22 (the v3 multi-reveal
 *   supplement) and Steps 7/8 scoped to the audited dataset (was 981b6d46…e587). audit-figures.json
 *   re-emitted byte-identical (942ba10e…69ca unchanged). Two PF_EMIT passes: Step 19 counts the
 *   numeric leaves of the committed record itself (6,717 → 6,718 with the added step), so the first
 *   emission quoted the old count; the second is the fixed point pinned here.
 * rtp-convergence.html and bootstrap-nulls.float64le carried no run metadata and are unchanged.
 *
 * 2026-09-28 — rtp-convergence.html rebuilt by `OUT_DIR=outputs npm run chart` (src/write-chart.ts)
 *   from the committed simulation-results.json, with Chart.js 4.4.7 inlined in place of the jsDelivr
 *   <script src> (Framework 1.0 review, F16). Every other byte of the page is unchanged; the data
 *   points are the same rendering of the same committed rows (was 6a314581…4f06).
 *
 * 2026-09-29 — verification-results.json re-emitted by PF_EMIT=1: Step 22 (g) now scores every
 *   supplement win against the ONE declared rule (floor8 / floor2 of the exact value) and reports the
 *   DL-14 / DL-15 gap against it; the fitted binary64 model is emitted as an explanatory note only.
 *   Only Step 22's detail changed (was 8a965ba6…f275). A second PF_EMIT pass reproduced the same
 *   bytes. audit-figures.json unchanged (942ba10e…69ca).
 *
 * 2026-09-29 — verification-results.json re-emitted by PF_EMIT=1 after MINES-22 became policy
 *   INFORMATIONAL (2026-09-29): Step 9's live-sample-fit wording and the MINES-22 profile note
 *   changed; no status or count changed (was f6fb3959…8757). audit-figures.json unchanged.
 *
 * 2026-10-01 — verification-results.json re-emitted by PF_EMIT=1 after publication clean-up of the
 *   step notes and the Step 22 detail (names of other packages and of people removed); no status,
 *   count or figure changed (was fc4784bb…45f2). audit-figures.json unchanged (942ba10e…69ca). *
 * 2026-10-02 — verification-results.json re-emitted by PF_EMIT=1 after the external QA fix list of
 *   2026-10-02: Step 2 gained the recorded-order arm (A10), Step 3 the serverSeedId arm (A9), Step 22
 *   the operator-settings arm (j) and Step 10 reads the supplement build's settings (A4) — Step 10
 *   PASS → FLAG, summary 21/22 → 20/22 PASS, flags 1 → 2, verdict still Conditional Pass; Steps 8,
 *   10 and 22 state the three open rulings; the maxOdds info item names the settings change; the
 *   MINES-02/03/11/14/15/17/19/23/28/29/30 notes changed (was 4ca2e62c…2afd). audit-figures.json
 *   re-emitted byte-identical (942ba10e…69ca). rtp-claim-table.json rewritten by
 *   `npm run rtp-claim:write` (claim source text names ruling 1), re-pinned in src/rtp-settings.ts.
 * 2026-10-03 — verification-results.json re-emitted by PF_EMIT=1 after the MINES-19 note was
 *   corrected (QA 2026-10-03, PB-12): Step 10's edge-rational guard is failed by M26 and its
 *   reference-formula guard by M04; M27 is a declared survivor (tests/survivors.json, DL-11), and
 *   M01/M02/M14 are Step 8's. The MINES-19 note only; no status, count or figure changed (was
 *   eb435f40…959c). audit-figures.json re-emitted byte-identical (942ba10e…69ca).
 * 2026-10-03 — verification-results.json re-emitted by PF_EMIT=1 after Step 22 moved to the 2026-10-03
 *   supplement capture (today's build; the 2026-09-26 capture kept as pinned dated history, arm k) and
 *   Step 10 read that capture's settings: Step 22 FLAG → PASS, summary 20/22 → 21/22 PASS, flags 2 → 1,
 *   verdict still Conditional Pass (Step 10); the Step 3, 7, 8, 10 and 22 details, the MINES-11/14/15/
 *   16/17/29/30 notes and the maxOdds info item changed (was 908057ab…94b8). audit-figures.json
 *   re-emitted byte-identical (942ba10e…69ca).
 * 2026-10-15 — verification-results.json re-emitted by PF_EMIT=1 after the cap half of MINES-14 left
 *   scoring (payout caps excluded by the profile owner, 2026-10-15; LIQD states no multiplier cap since
 *   the end of August 2026): Step 10 FLAG → PASS, summary 21/22 → 22/22 PASS, flags 1 → 0, verdict
 *   Conditional Pass → Full Pass; the Step 10 and 22 details, the MINES-14 note and the maxOdds info
 *   item changed (was a467ebf7…f007). A second PF_EMIT pass reproduced the same bytes.
 * 2026-10-21 — verification-results.json re-emitted by PF_EMIT=1 after the external QA of that date
 *   on the player path (MINES-25): only the MINES-25 note changed (tile numbering across rows from
 *   the top-left, settled by evidence E22; copy the Active Server Seed (Hashed) before rotating);
 *   no step, figure, coverage value or verdict changed (was 7b70235e…08a7).
 */
export const ARTIFACT_PINS: ReadonlyArray<{ file: string; sha256: string }> = [
  { file: 'outputs/simulation-results.json', sha256: '8854fc57e7f22f1960b9c89f6c8e003a5e92e19d899a3ecf20e0c0170e44fc2c' },
  { file: 'outputs/simulation-provenance.json', sha256: '4eee6b2b2259244fd2402a825c829089e270d36e8700ef0b9e3f1f8b1660eaa6' },
  { file: 'outputs/bootstrap-nulls.float64le', sha256: '477c58267cf890751abadaf48a723b569207838be7838d7a20da9b2e2d09cf18' },
  { file: 'outputs/rtp-convergence.html', sha256: 'ad969c106e979f3f0eabcea69b5d2d881eb4a44be248e670a215e6a561989d2d' },
  { file: 'outputs/deep-replay-report.json', sha256: '6de3935092af3db155c9e608f7f5993b68b31ac25364ad24ac0c0ce021c8d6bc' },
  { file: 'outputs/bootstrap-replay-report.json', sha256: 'a0395e57d8ccda10a9950334211380a43a02f4f01ab923b1472347fd43148573' },
  { file: 'outputs/audit-figures.json', sha256: '942ba10e301d2c99a502cfbec4ad3441055f27df0d1ca907df2b8f95f8dc69ca' },
  { file: 'outputs/verification-results.json', sha256: '25db7665027a4c0df089d1b711fb15c68449214be153ee0cd468d93eaf1ba745' },
];

/**
 * PLAYER-VERIFIER PARITY (MINES-24). The Mines verifier a player uses on the ProvablyFair.org
 * site is the VerifyBets component: `games/mines/derive.js` plus the one library file it
 * imports, `lib/hmac-sha256.js` (both under src/components/VerifyBets/ in the site repository).
 * Those exact bytes are vendored in verifier-parity/ at the same relative paths, and these are
 * their SHA-256 digests. Step 5 hashes the vendored copies against these pins and then runs the
 * vendored derive.js on every captured round, requiring the same draw-order layout as
 * src/rng.ts revealMines; a hash mismatch or a layout mismatch FAILs it.
 * `scripts/check-site-verifier.mjs <path-to-site-derive.js>` compares a live site checkout
 * against the same pins (exit 1 on mismatch). A change to the site file is a re-pin here, in a
 * diff, together with a fresh vendored copy — never an edit to the vendored bytes.
 */
export const SITE_VERIFIER_PINS: ReadonlyArray<{ file: string; sitePath: string; sha256: string }> = [
  { file: 'games/mines/derive.js', sitePath: 'src/components/VerifyBets/games/mines/derive.js',
    sha256: 'fa4dbd19b80e7ce74fc63bd57630fb76e89ce6a5794d81aacf4a1f0ec38ffb82' },
  { file: 'lib/hmac-sha256.js', sitePath: 'src/components/VerifyBets/lib/hmac-sha256.js',
    sha256: '2095571fecd77f536bb3363c801cd70786856e687d108e0ff2102a4e2a18b847' },
];
export const SITE_VERIFIER_DIR = 'verifier-parity';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE LEGACY BOOTSTRAP EXCEPTION — ONE ARTIFACT, NAMED IN SOURCE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Step 17 replays the Pass-2 bootstrap null from the artifact's recorded `masterSeed`. The
 * 2026-08-05 artifact predates that machinery and records no master seed, so for IT the replay has
 * nothing to rebuild and `earlyBootstrapP` stays bounded-only — limitation DL-2. That artifact is no
 * longer the committed one: it is kept byte-for-byte as tests/fixtures/legacy-simulation-results.json
 * (below). The committed outputs/simulation-results.json records `masterSeed` 7461a9c2… and
 * `seedDerivation` mines-seed-derivation-v1, takes the replay path, and all 138 of its
 * `earlyBootstrapP` values regenerate (Step 17; outputs/bootstrap-replay-report.json, the
 * independent Python replay, records 138/138 p-values and 240,000 null statistics with 0 mismatches
 * against this file's SHA-256). Everything below about the legacy exception is about the fixture.
 *
 * Reaching that fallback by ABSENCE OF DATA — every artifact without usable replay metadata
 * taking the lenient path — is the wrong rule, and a reviewer executed the consequence: set
 * `seedDerivation` to an unknown string, or `masterSeed` to `not-hex`, and a run whose
 * p-values demonstrably did NOT replay went back to 21/21 Full Pass, exit 0. The check was
 * switched off by corrupting the thing it verifies.
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
 * **DL-2 stays open on the substance.** The pin closes the EDIT vector, not the origin question.
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
 *  THE PIN IS ABOUT A FIXED FILE, NOT ABOUT WHATEVER IS IN outputs/
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Asserting the three properties above — the digest, the absence of replay metadata, the
 * 2026-08-05 timestamp — against the MUTABLE artifact at `outputs/simulation-results.json`
 * would be the wrong place for them. The producer legitimately writes a master seed, a
 * derivation version, a fresh timestamp and newly drawn bootstrap values, so the moment
 * anyone re-ran the documented pipeline the unit suite would reject the package's own output.
 *
 * EXECUTED, at reduced counts (ROUNDS_PER_CONFIG=1000, PASS2_NONCES=1000,
 * BOOTSTRAP_REPS=1000): `npm run simulate` exits 0, and the unit suite then FAILS its
 * historical assertions, because the freshly drawn vector digests to something else.
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
