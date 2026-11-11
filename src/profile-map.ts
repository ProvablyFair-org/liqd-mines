/**
 * Which ProvablyFair.org Mines profile check each scored step implements.
 *
 * WHY THIS FILE EXISTS. The framework's Mines game profile (Framework 1.1, profile 1.0.2)
 * declares checks MINES-01 … MINES-30. This suite scores 22 steps under its own numbering, which
 * every chapter cites by number and which therefore cannot be renumbered to match. Without a
 * written mapping the only way to relate the two was to read all the steps by hand and type the
 * answer into the profile — where it went stale the moment a step changed, silently, because
 * nothing re-derived it. The mapping is declared here, emitted into
 * `outputs/verification-results.json` beside the step results, and read back by `pf-audit matrix`,
 * which prints the conformance matrix and exits 1 when a HARD_FAIL check has nothing implementing
 * it.
 *
 * THIS FILE LABELS; IT DOES NOT CHECK. Nothing here can make a step pass or fail. An id claimed for
 * a step the step does not implement is a false statement in a published artifact, so the rule is
 * the profile's own `asserts` text: claim the check only if the step's assertion actually decides it.
 *
 * COVERAGE DESCRIBES THE PACKAGE, NOT THE STEP.
 *   full    — nothing the profile's `asserts` requires is unimplemented; where a check is split
 *             across two or more steps every one of them says `full` and each note says which half
 *             it carries.
 *   partial — something the profile requires is implemented nowhere in this package, and the note
 *             says what. `partial` is a disclosure, never a softer word for `full`.
 * A check no step and no package artifact claims is reported `missing`. None is.
 *
 * EVERY NOTE BELOW WAS READ OUT OF THE CODE IT DESCRIBES, and the counts it quotes were produced by
 * a command against this repository — never from memory. Where a note says a thing is unasserted,
 * that was checked by reading the predicate, not inferred from the absence of a comment.
 */

export type Coverage = 'full' | 'partial';

export interface CheckClaim {
  id: string;
  coverage: Coverage;
  /** For `partial`: what the profile requires that this package does not do. */
  note?: string;
}

export interface StepClaims {
  claims: CheckClaim[];
  /** Required when `claims` is empty: why the step answers no profile check. */
  reason?: string;
}

export const PROFILE_GAME = 'mines';
export const PROFILE_VERSION = '1.0.2';

/** What MINES-17 asks for that LIQD's wire does not carry; repeated on every step that claims it. */
const NO_RUNG = 'PARTIAL: the profile asks for per-step multipliers on every intermediate rung. LIQD answers a safe '
  + 'open-tile with `{ mineTile: false }` and nothing else, so no intermediate rung exists to check: the only '
  + 'open-tile replies carrying a multiplier are the 3 rounds LIQD settled by itself on their last safe tile '
  + '(src/pins.ts PROD_DECLARED_PER_STEP_MULTIPLIERS, asserted against the data by Step 22). The cash-out rung is '
  + 'checked on every win';

/** Scored step number → the profile checks it implements. Every step 1..22 has an entry. */
export const STEP_CLAIMS: Record<number, StepClaims> = {
  1: {
    claims: [{
      id: 'MINES-01', coverage: 'full',
      note: 'commitHash(serverSeed) == hashedServerSeed for every revealed seed, paired per seed record, under the one '
        + 'declared encoding SHA-256(utf8(serverSeed hex string)) — src/rng.ts commitHash. The denominator is '
        + 'EXPECTED_SEEDS (36) in src/pins.ts and must also equal seeds.length; 0 reveals is a FAIL',
    }],
  },
  2: {
    claims: [{
      id: 'MINES-02', coverage: 'full',
      note: 'the dataset holds three captures, each its own run. Within a capture every rotation is recomputed from the '
        + 'raw fields (seeds[i].nextHashedServerSeed == seeds[i+1].hashedServerSeed): EXPECTED_CHAIN_LINKS = 33 '
        + 'transitions (24 + 9 + 0), never from the capture\'s own chainLinkOk / commitVerified booleans. Each capture '
        + 'has its own pre-capture anchor (meta.captures[].preCapture), asserted in both halves — its revealed seed '
        + 'hashes to its commitment and its next hash is the capture\'s first epoch — and an absent anchor FAILs. No '
        + 'link between captures is recorded or claimed: other games were played on the account between the runs. '
        + 'The recorded order (commitment before first bet, seed record before first bet, reveal after last bet) is '
        + 'asserted on the capture\'s own clock',
    }],
  },
  3: {
    claims: [{
      id: 'MINES-03', coverage: 'full',
      note: 'bets are grouped by EPOCH (not by hash) and every epoch must carry one hashedServerSeed; the count of epochs '
        + 'is EXPECTED_SEEDS. That field is written onto each row by the capture (LIQD\'s mines replies carry no hash — '
        + 'measured in this step over every place-bet, open-tile and cash-out reply of the raw captures), so the '
        + 'operator-served reference is asserted too: serverSeedId is one value within each epoch and distinct across '
        + 'the 36 epochs. The one-client-seed-per-epoch half is Step 4',
    }],
  },
  4: {
    claims: [
      { id: 'MINES-03', coverage: 'full', note: 'the client-seed half: every epoch carries exactly one client seed' },
      {
        id: 'MINES-04', coverage: 'full',
        note: 'per epoch the nonces are exactly NONCE_BASE … NONCE_BASE + size − 1 in capture order, with no gap, repeat '
          + 'or reorder, where size is the epoch\'s length in the plan (src/pins.ts EPOCH_PLAN: 200, 100, 190 or 124). '
          + 'The base is a declared constant, and each seed record\'s own nonceStart / nonceEnd are checked against the '
          + 'declaration. A gap is counted against EXPECTED_CAPTURE_RETRY_GAPS (0): an undeclared gap FAILs, a declared '
          + 'one would be a capture-origin FLAG',
      },
    ],
  },
  5: {
    claims: [
      {
        id: 'MINES-07', coverage: 'full',
        note: 'every one of the EXPECTED_BETS (6,574) rounds recomputes: revealMines(serverSeed, clientSeed, nonce, '
          + 'mineCount) equals the served mineTiles as an ORDERED list (draw order); a skipped round is a FAIL',
      },
      {
        id: 'MINES-08', coverage: 'full',
        note: 'the declared draw is rejection sampling: maxFair is printed per range and is a whole multiple of the range '
          + 'at all 25 ranges, so the per-value bias conditional on acceptance is exactly 0; the rejection census over '
          + 'the population is printed against its expectation, and because no captured round takes the branch it is '
          + 'exercised on a fixed vector inside the step. That the operator\'s server takes the same branch is ASSUMED '
          + '(MANIFEST DL-3)',
      },
      {
        id: 'MINES-24', coverage: 'full',
        note: 'the ProvablyFair.org site verifier (verifier-parity/, two files hash-pinned in src/pins.ts '
          + 'SITE_VERIFIER_PINS) is run on every round and must give the same draw-order layout as src/rng.ts; a hash '
          + 'or layout mismatch FAILs. scripts/check-site-verifier.mjs compares a live site checkout with the same pins',
      },
    ],
  },
  6: {
    claims: [{
      id: 'MINES-06', coverage: 'full',
      note: 'the influence half: a wrong client seed and an empty client seed are run over all 6,574 rounds and the '
        + 'surviving layouts are compared with the model-predicted chance collisions over those rounds\' own mine '
        + 'counts (E + 5σ, in draw order and as a set); 0 change FAILs. The generator of phases A, A+ and C is asserted '
        + 'from the data: every such epoch seed matches /^audit[0-9a-f]{12}$/ and all are distinct. The Phase D half '
        + 'is Step 14',
    }],
  },
  7: {
    claims: [
      { id: 'MINES-11', coverage: 'full', note: 'the loss half: every loss carries no multiplier and winningAmount 0. The booked win amount is Step 8, the wallet field Step 22' },
      {
        id: 'MINES-13', coverage: 'full',
        note: 'the served `multiplier` on every win equals floor2 of the exact closed form at the depth actually opened '
          + '(1e-9); it is a display value, below the exact multiplier wherever that is not a whole number of cents',
      },
    ],
  },
  8: {
    claims: [
      {
        id: 'MINES-11', coverage: 'full',
        note: 'the declared settlement rule for the amount LIQD BOOKS: winningAmount == floor2(betAmount × exact rational '
          + 'multiplier) in BigInt cents, 0 tolerance, in the fiat the round was staked in (CAD in capture 1, USD in '
          + 'captures 2 and 3; nothing converted) — 2,691 of 2,691 wins; every loss books 0. Per capture the booked '
          + 'totals and the wins booked below the unrounded amount must equal the declaration (src/pins.ts '
          + 'PROD_CAPTURES, BOOKED_BELOW_UNROUNDED). The wallet field of the reply follows a second rule, scored by '
          + 'Step 22',
      },
      { id: 'MINES-10', coverage: 'full', note: 'the label half: a round is `won` exactly when no opened tile is a mine of the served layout. The recomputed-layout half is Step 20' },
    ],
  },
  9: {
    claims: [
      {
        id: 'MINES-15', coverage: 'full',
        note: 'the plan is a code constant (src/pins.ts SETTINGS_PLAN, 60 phase settings) and every setting must hold '
          + 'exactly its planned rounds, with none off plan. Phase A covers every mine count 1…24 with at least 50 '
          + 'rounds: 5 mine counts × 1,000 in capture 1 and the other 19 × 50 in the phase A top-up of capture 2. The '
          + 'multi-reveal depths and first-pick span are Steps 15 and 21',
      },
      {
        id: 'MINES-22', coverage: 'full',
        note: 'the live-sample fit, informational: first-drawn mine position over all rounds against the uniform lattice '
          + '(chi-squared, 24 df) and win counts per (mine count, planned depth) group against the binomial; a p-value '
          + 'below the pre-registered level is reported as INFO and never counted',
      },
    ],
  },
  10: {
    claims: [
      { id: 'MINES-13', coverage: 'full', note: 'the closed form at every legal cell: all 300 (m,k) cells are evaluated and must equal the published RTP within 1e-9' },
      { id: 'MINES-18', coverage: 'full', note: 'the identity half of anti-circularity: P(survive k) × multiplier(m,k) == 1 − edge at all 300 cells with no operator data; a non-finite reference value FAILs as its own fault class' },
      {
        id: 'MINES-19', coverage: 'full',
        note: 'the effective edge is derived per cell over all 300 cells against the published claim, and the two '
          + 'settlement floors are quantified in BigInt: the booked cent floor at the smallest stake played and the '
          + 'wallet rule at the smallest wallet stake in the raw captures. The RTP-CLAIM gate holds the per-setting '
          + 'table to the claim shown to players. RULING 1 (11 November 2026): LIQD is held to the page\'s flat 99%, '
          + 'which the wallet field meets; the page\'s rounding sentence is recorded as a discrepancy, as published '
          + 'on 1 Oct 2026',
      },
      {
        id: 'MINES-14', coverage: 'full',
        note: 'monotonicity, scored: the exact multiplier is strictly increasing in depth and in mine count over all 552 '
          + 'adjacent legal cell pairs, compared as exact rationals. The cap half is disclosed and not scored: payout '
          + 'caps are excluded by the profile owner (2026-10-15) and the production settings records carry no maxOdds '
          + 'key (src/pins.ts PROD_GAME_SETTINGS, bound to the raw captures by Step 22)',
      },
    ],
  },
  11: {
    claims: [{
      id: 'MINES-05', coverage: 'full',
      note: 'bets per phase letter and per phase id equal EXPECTED_PHASE_BETS / EXPECTED_PHASE_ID_BETS, every row carries '
        + 'the phase, capture and capture-epoch the plan gives its epoch, and the total equals EXPECTED_BETS — code '
        + 'constants, never the dataset\'s own header',
    }],
  },
  12: {
    claims: [{
      id: 'MINES-05', coverage: 'full',
      note: 'every epoch of EPOCH_PLAN holds exactly its planned number of bets (200, 100, 190 or 124), there are '
        + 'EXPECTED_SEEDS epochs and seed records, and the pinned constants are mutually consistent (Σ epoch sizes == '
        + 'EXPECTED_BETS; each capture\'s rounds == Σ of its epochs)',
    }],
  },
  13: {
    claims: [
      { id: 'MINES-18', coverage: 'full', note: 'winProbability is pure combinatorics: the binomial form equals the product form at every reachable cell, and k-subsets are enumerated and counted with integer equality — every m at k ≤ 5 plus the played settings deeper than 5' },
      { id: 'MINES-13', coverage: 'full', note: 'the probability half of the multiplier ladder: the survival probability the closed form divides by is derived here without the multiplier module' },
    ],
  },
  14: {
    claims: [{
      id: 'MINES-06', coverage: 'full',
      note: 'the Phase D half: 500 rounds in 5 epochs under 5 distinct PLAYER-SET client seeds (floor 2), each of the '
        + 'declared form, named in the capture\'s meta before its anchor rotation, submitted in a rotation recorded as '
        + 'player-set, and returned by LIQD\'s reply as the active seed; every Phase D round recomputes under its seed. '
        + 'The predictable-seed census (a 13-digit timestamp in a client seed) is enumerated and is 0, so there is no '
        + 'exposed epoch to list. For all 36 epochs the client seed was submitted in the rotation whose reply made the '
        + 'epoch\'s commitment active, recorded before the epoch\'s first bet',
    }],
  },
  15: {
    claims: [
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'the multi-reveal rounds are every round of phases A and D (5,500; production has no separate multi-reveal '
          + 'phase): each is at a setting of the plan, its layout recomputes, a win opened exactly its planned depth '
          + 'and its cash-out multiplier equals the closed form at that depth. ' + NO_RUNG,
      },
      { id: 'MINES-13', coverage: 'full', note: 'the cash-out multiplier of every win equals minesMultiplier at the depth opened, at depths 1 to 15' },
    ],
  },
  16: {
    claims: [{
      id: 'MINES-20', coverage: 'full',
      note: '24 mine counts × 1,000,000 rounds; first-draw uniformity, pairwise co-occurrence and first-drawn-tile serial '
        + 'statistics with a Bonferroni family; every Pass-1 row is replayed in full from the seed pair it records and '
        + 'compared field by field; convergence within 5·SE',
    }],
  },
  17: {
    claims: [{
      id: 'MINES-21', coverage: 'full',
      note: 'every revealed seed (36). The profile\'s statistic is the served-configuration test: each epoch\'s captured '
        + 'configurations, in nonce order with each round\'s planned tiles from the raw captures, are replayed over '
        + 'the revealed seed for 200 of the epoch\'s own lengths (20,000 to 40,000 nonces, floor 10,000); the early '
        + 'window is exactly the epoch\'s captured nonce range and its replayed outcomes must equal the recorded ones; '
        + 'the window return is ranked against the seed\'s own later windows; the rule is pre-registered in code and '
        + 'the detection power is printed. The first-draw diagnostic beside it uses one early window for all seeds, '
        + 'the first PASS2_EARLY_WINDOW (100) nonces — the longest prefix every epoch played in full — over 10,000 '
        + 'nonces per seed, with a bootstrap null rebuilt from the recorded master seed',
    }],
  },
  18: {
    claims: [{
      id: 'MINES-12', coverage: 'full',
      note: 'Phase C: 124 rounds at 10.00, 100 times the stake of every other phase, at 3 mines and one tile (a low mine '
        + 'count). Every one recomputes from the wager-free engine, and its wins (at least PHASE_C_MIN_WINS = 100 '
        + 'required) are booked at floor2(stake × exact) and carry the wallet field floor8(betAmountWallet × floor8(exact)), the '
        + 'rules the 0.10 wins are held to. The 3-mine, one-tile cell was played only at the elevated stake (3 mines '
        + 'at 0.10 were played at depths 2, 4, 6 and 8), so "the same formula as its base-stake config" is the same '
        + 'closed form holding at both stakes, not the same cell at two stakes — stated in the step detail',
    }],
  },
  19: {
    claims: [
      { id: 'MINES-26', coverage: 'full', note: 'the live SHA-256 of the dataset equals the constant in src/pins.ts and the loader aborts on a mismatch before any step runs; the three raw captures are pinned the same way (src/pins.ts PROD_CAPTURES, src/prod-capture.ts)' },
      {
        id: 'MINES-27', coverage: 'full',
        note: 'every artifact of record is hash-pinned (ARTIFACT_PINS), un-ignored by name, free of run metadata, never '
          + 'rewritten by verify (which writes only outputs/run/), and every numeric leaf of every pinned JSON artifact '
          + 'has a declared value domain (src/domains.ts); the derived-figure artifact is re-derived and compared field '
          + 'by field at the reproduction tolerance',
      },
    ],
  },
  20: {
    claims: [
      { id: 'MINES-10', coverage: 'full', note: 'judged against the RECOMPUTED layout: a win opens no mine and exactly its recorded depth; a loss busts on exactly the last opened tile; opened tiles are legal and unrepeated' },
      { id: 'MINES-17', coverage: 'partial', note: 'the mine set of a round is the recomputed layout whatever was opened, on every multi-reveal round. ' + NO_RUNG },
    ],
  },
  21: {
    claims: [
      { id: 'MINES-17', coverage: 'partial', note: 'independence of reveal position: every opened sequence is a prefix of the round\'s planned order, drawn per round by the runner\'s CSPRNG and written into the capture before any bet, and the layout recomputes whatever was opened. ' + NO_RUNG },
      { id: 'MINES-15', coverage: 'full', note: 'the reveal positions span all 25 tiles as a first pick (required: 25 of 25)' },
    ],
  },
  22: {
    claims: [
      {
        id: 'MINES-11', coverage: 'full',
        note: 'the wallet leg: every win\'s winningAmountWallet equals LIQD\'s measured rule floor8(betAmountWallet × '
          + 'floor8(exact)) on the 1e-8 USDT grid — 2,691 of 2,691; a wallet field below or above the rule FAILs, a loss '
          + 'carries no wallet win. Against the exact product the wallet field is one 1e-8 unit lower on 62 wins of capture 1 and '
          + 'never higher. RULING 2 (11 November 2026, every LIQD game whose wallet rule rounds down to 8 decimals): '
          + 'a floor at 1e-8 produced by the declared rule is DISCLOSED, not a deviation, so it moves no status and '
          + 'the Full Pass stands (the dice package treats its floor8 payouts the same way); the disclosure is bound '
          + 'to the data (a moved count FAILs). Per capture the wallet totals '
          + 'equal the declaration, and on the captures booked in USD the wallet fields exceed the booked wins by '
          + 'exactly the amount the cent floor dropped',
      },
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'every open-tile reply\'s mine/safe flag equals the recomputed layout (19,498 reveals), every round opened '
          + 'its planned tiles in order, and per (cell, stake, fiat) there is one displayed multiplier and one booked '
          + 'amount across every reveal order that reached it. ' + NO_RUNG,
      },
      { id: 'MINES-15', coverage: 'full', note: 'every planned (phase, setting) pair is checked for a witnessing win and the ones without are enumerated in the detail; all pairs outside phase D (25 rounds per setting) must be witnessed' },
    ],
  },
};

/**
 * Checks this casino's design makes inapplicable. The reason is the declaration: a check that
 * simply never appears is a gap, and one that says why it cannot apply is an answer.
 */
export const NOT_APPLICABLE: Array<{ id: string; reason: string }> = [
  {
    id: 'MINES-16',
    reason: 'applies={path: money.balanceField, notNull: true} is false — no reply of the mines game carries a balance '
      + 'field to reconcile against (the raw captures\' only key matching /balance/i is the runner\'s own balanceGuard '
      + 'setting in its meta), so there is no consecutive-bet balance delta. This is the package\'s declared limitation '
      + 'DL-5 (MANIFEST.md). What IS verified per round is the operator\'s settle record in both currencies: the booked '
      + 'fiat amount (Step 8) and the USDT wallet debit and wallet field, betAmountWallet on every place-bet reply and '
      + 'winningAmountWallet on every win (Step 22) — which the profile does not count as a balance ledger',
  },
];

/**
 * Profile checks of kind `package-check`: decided by something in the package other than a scored
 * step. `artifact` says what; `none` would mean nothing in the package answers it.
 */
export const PACKAGE_CHECKS: Array<{ id: string; artifact: string; coverage: Coverage | 'none'; note: string }> = [
  {
    id: 'MINES-09',
    artifact: 'docs/ALGORITHM.md + src/rng.ts + tests/mines/rngSpecTests.ts + tests/mines/rngTests.ts + tests/mines/regressionTests.ts',
    coverage: 'partial',
    note: 'src/rng.ts is rebuilt from a written specification, docs/ALGORITHM.md, by an implementer who never opened '
      + 'LIQD\'s code; LIQD\'s code is run as a second check, not used as the source. tests/mines/rngSpecTests.ts runs '
      + 'the specification\'s vectors — five production rounds of this dataset — and properties against src/rng.ts; '
      + 'tests/mines/rngTests.ts reproduces two captured production rounds from their revealed seeds and, as the '
      + 'second check, the operator\'s own validation vectors from the specification LIQD supplied privately. PARTIAL '
      + 'because LIQD\'s code itself is not in this package (its specification is private and not quoted), so the '
      + 'second check is its three vectors, not an execution of its code on every round. LIQD\'s live verifier endpoint '
      + 'IS queried for every round (Step 22 arm j), which is the operator\'s tool agreeing, not its source',
  },
  {
    id: 'MINES-23', artifact: 'exploit-testing.md', coverage: 'full',
    note: 'the standardized matrix with framework IDs S5-1 … S5-8, each row carrying Pass / Flag / Hard Fail / Not tested '
      + '— disclosed and the scored step or capture evidence that decides it. S5-5 (seed-rotation race) is "Not tested '
      + '— disclosed": the captures played one round at a time and rotated only between epochs',
  },
  {
    id: 'MINES-25',
    artifact: 'README.md#verify-a-bet + MANIFEST.md#verify-a-bet',
    coverage: 'partial',
    note: 'the player path is stated in the profile\'s order and in the declaration\'s field names: where the seed is '
      + 'revealed (the rotation reply\'s revealedServerSeed), which fields to take (clientSeed, serverSeed, nonce, '
      + 'mineCount; the commitment hashedServerSeed read BEFORE rotating), the commitment encoding (SHA-256 of the '
      + 'serverSeed hex string as UTF-8), the shuffle, and the tile numbering (1-based, 1…25), with a script and worked '
      + 'production rounds. PARTIAL because the path is evidenced from the production API replies only: no screen of '
      + 'LIQD\'s provably-fair panel or of a finished board was captured on production, so the panel labels and the '
      + 'position on screen of each tile number are not evidenced in this package (MANIFEST DL-19)',
  },
  {
    id: 'MINES-28',
    artifact: 'scripts/run-stages.mjs + scripts/check-standalone.mjs + scripts/standalone-runtime.cjs + src/pins.ts (AUDIT_ID, EXPECTED_UNIT_TESTS) + standalone-manifest.json + verify.js / test.js + package.json (engines 22.x) + .nvmrc + scripts/release-manifest.mjs + .github/workflows/reproduce.yml',
    coverage: 'full',
    note: 'zero-install verification on a fresh clone: `npm test` runs four dependency-free stages — check-standalone.mjs, '
      + 'node test.js, node verify.js and release-manifest.mjs --check — every one of them whatever the verdict, and '
      + 'exits with the verifier\'s verdict code when the other three pass and 1 when one does not; the runtime is '
      + 'pinned (engines 22.x plus .nvmrc); verify writes only outputs/run/ and a field-level diff.json at the '
      + 'reproduction tolerance, exiting 1 beyond it; the bundle inventory is hash-checked; the passing unit-spec count '
      + 'must equal EXPECTED_UNIT_TESTS; the audit ID is a constant in src/pins.ts and the documents\' step, unit, '
      + 'mutation and forgery counts are compared with the suite by check-standalone.mjs. The second-machine job is '
      + 'defined in .github/workflows/reproduce.yml; its run is not part of the package',
  },
  {
    id: 'MINES-29',
    artifact: 'tests/mutations.json + tests/survivors.json + tests/forgeries.ts, run by tests/mutations.ts and tests/forgeries.ts',
    coverage: 'full',
    note: 'a step-named source-mutation registry run in a disposable copy (each entry names the step that must FAIL or '
      + 'FLAG), declared survivors each tied to a limitation row, and a forged-evidence battery over the dataset, the '
      + 'raw captures and the pinned artifacts. The batteries are run by `npm run test:toolchain`, not by `npm test`',
  },
  {
    id: 'MINES-30', artifact: 'MANIFEST.md (declared limitations register, load-bearing premises) + evidence.md (evidence register)',
    coverage: 'full',
    note: 'the register carries each declared limitation with its measured magnitude and what closes it; the '
      + 'load-bearing-premises table marks the unwitnessed premises ASSUMED; the evidence register numbers every '
      + 'exhibit with its evidential role. No internal review material ships in the package',
  },
];

/** The block emitted alongside the step results. */
export function profileCoverageBlock(): Record<string, unknown> {
  return {
    game: PROFILE_GAME,
    profileVersion: PROFILE_VERSION,
    notApplicable: NOT_APPLICABLE,
    packageChecks: PACKAGE_CHECKS,
  };
}

/** The label fields for one scored step, to be merged into its emitted record. */
export function labelFor(step: number): Record<string, unknown> {
  const entry = STEP_CLAIMS[step];
  if (!entry) return { profileIds: [], profileChecks: [], profileNote: 'no mapping declared for this step' };
  return entry.claims.length
    ? { profileIds: entry.claims.map(c => c.id), profileChecks: entry.claims }
    : { profileIds: [], profileChecks: [], profileNote: entry.reason ?? 'no reason given' };
}
