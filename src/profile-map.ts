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
 * A check no step and no package artifact claims is reported `missing`. None is, since
 * 2026-09-24: MINES-24 (player-verifier parity), recorded as a gap until then, is now carried by
 * Step 5's parity arm over the vendored ProvablyFair.org site verifier.
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

/** Scored step number → the profile checks it implements. Every step 1..22 has an entry. */
export const STEP_CLAIMS: Record<number, StepClaims> = {
  1: {
    claims: [{
      id: 'MINES-01', coverage: 'full',
      note: 'commitHash(serverSeed) == hashedServerSeed for every revealed seed, PAIRED PER ENTRY '
        + '(a loop over seed records, not a set-membership test), under the one declared encoding '
        + 'SHA-256(utf8(serverSeed hex STRING)) — src/rng.ts commitHash. The denominator is '
        + 'EXPECTED_SEEDS in src/pins.ts, a code constant, and is ALSO required to equal '
        + 'seeds.length, so a capture shipping fewer seed records FAILs rather than reporting its '
        + 'own count back to itself; `checked === seeds.length` makes 0 reveals a FAIL instead of a '
        + 'vacuous pass on `fails === 0`. The competing encoding is rejected rather than merely '
        + 'unused: tests/mutations.json M10 rewrites commitHash to hash the DECODED 16 bytes and '
        + 'this step is the one that must FAIL',
    }],
  },
  2: {
    claims: [{
      id: 'MINES-02', coverage: 'full',
      note: 'all 137 rotations recomputed from the RAW fields — seeds[i].nextHashedServerSeed must '
        + 'equal seeds[i+1].hashedServerSeed after sorting by epoch — and never from the capture\'s '
        + 'own chainLinkOk / commitVerified booleans, which no predicate here reads. The '
        + 'pre-capture anchor the profile requires is asserted in both halves and its ABSENCE is a '
        + 'FAIL: meta.preCapture.revealedServerSeed must hash to meta.preCapture.hashedServerSeed, '
        + 'and meta.preCapture.nextHashedServerSeed must equal epoch 0\'s hashedServerSeed, so the '
        + 'chain is anchored before the first captured epoch. Since 2026-10-02 (external QA, A10) the '
        + 'step also asserts the RECORDED ORDER on the capture\'s own clock: each epoch\'s commitment '
        + '(the pre-capture record for epoch 0, the previous seed record\'s next-hash after that) was '
        + 'recorded before the epoch\'s first bet (138/138), each seed record before its epoch\'s first '
        + 'bet (138/138), and each rotation after the retiring epoch\'s last bet (137/137) — the order '
        + 'the capture recorded, not an operator-side event order; forgery D24 moves one record and '
        + 'FAILs the step. Mutation M56 (the chain walked in reverse epoch order) FAILs it',
    }],
  },
  3: {
    claims: [{
      id: 'MINES-03', coverage: 'full',
      note: 'the server-seed-hash half: bets are grouped BY EPOCH (betsByEpoch keyed on b.epoch) '
        + 'and each group\'s hashedServerSeed set must have size 1 — grouping by hash, which would '
        + 'be tautological, is not what this does. The number of epoch groups is bound to '
        + 'EXPECTED_SEEDS in src/pins.ts as well as to seeds.length. That field is written onto each '
        + 'bet row by the capture script — LIQD\'s bet responses carry no hash — so since 2026-10-02 '
        + '(external QA, A9) the step also reads the one seed reference LIQD serves on every settle, '
        + 'serverSeedId: one value within each epoch and 138 distinct values across the 138 epochs, '
        + 'otherwise HARD FAIL (forgery D25 swaps one and FAILs the step). The same-client-seed half '
        + 'of the check is Step 4',
    }],
  },
  4: {
    claims: [
      {
        id: 'MINES-03', coverage: 'full',
        note: 'the client-seed half: per epoch exactly one client seed (Set size 1, otherwise HARD '
          + 'FAIL) — tests/steps/commitment.ts. The server-seed-hash half is Step 3',
      },
      {
        id: 'MINES-04', coverage: 'full',
        note: 'the window is DECLARED: every epoch\'s nonces must be exactly NONCE_BASE … '
          + 'NONCE_BASE+EXPECTED_EPOCH_SIZE−1 (src/pins.ts, 0 … 49) — a code constant, not the '
          + 'minimum observed and not the seed record\'s nonceStart, which is now checked AGAINST '
          + 'the declaration (a record/declaration disagreement hard-fails). No repeat '
          + '(Set(nonces).size === bets), no reorder (the capture sequence must be strictly '
          + 'increasing within an epoch), no nonce outside the window. Gaps are counted against '
          + 'EXPECTED_CAPTURE_RETRY_GAPS (declared 0): an undeclared gap — the operator-side case — '
          + 'hard-fails, and a gap count equal to a non-zero declaration is a capture-origin FLAG '
          + '(`origin: capture`, verdict-neutral; tests/verify.ts separates capture-origin from '
          + 'operator-origin flags). Measured: 138/138 epochs '
          + 'exactly 0 … 49, 0 gaps. Mutations M34 (NONCE_BASE 0→1) and M35 (declared gaps 0→1) '
          + 'FAIL the step; forgeries D13 and D15 (window and record shifted together) FAIL it; D21 '
          + '(a declared gap) shows the [FLAG:capture] branch. Limit, printed by the step: the '
          + 'window is what the capture requested, not an operator-side counter (MANIFEST DL-9)',
      },
    ],
  },
  5: {
    claims: [
      {
        id: 'MINES-07', coverage: 'full',
        note: 'revealMines(serverSeed, clientSeed, nonce, mineCount) is recomputed for EVERY bet in '
          + 'the population — wins and losses alike, no filter — and compared with mineTiles by '
          + 'sameMines, which is ORDER-SENSITIVE (element by element, same length), so the comparison is '
          + 'the DRAW-ORDER list the operator serves rather than a sorted set; there is no tolerance. '
          + 'A skipped round is a failure, not a smaller sample: `skipped === 0` is part of the pass '
          + 'condition, and the denominator is EXPECTED_BETS from src/pins.ts rather than '
          + 'bets.length, so "6,900/6,900" cannot be true of whatever the file happens to contain',
      },
      {
        id: 'MINES-08', coverage: 'full',
        note: 'the draw-bias bound is stated IN THE STEP DETAIL as a computed quantity: maxFair for '
          + 'each of the 25 ranges the shuffle uses (read from src/rng.ts maxFairFor, the one '
          + 'ceiling the draw itself reads), the exact per-value bias conditional on acceptance '
          + '(integer arithmetic, src/bias.ts drawBias on src/rng.ts maxFairFor), the worst per-draw rejection probability '
          + '(4.889e-9 at range 25) and the rejection census over the population (0 of 172,500 '
          + 'draws, 2.024e-4 expected). The declared design is rejection sampling, so the gate is '
          + 'EXACT ZERO bias at every range (a fortiori ≤ 2^-32) — deliberately stricter than the '
          + 'bound, because a plain chunk % range with no rejection is biased by less than 2^-32 '
          + 'at every range 1..25 and would pass the bound alone. The branch the capture never '
          + 'takes is exercised on a vector inside the step (nonce 760455 / cursor 12 / range 13 '
          + 'must draw 6; deletion draws 1). Mutation M12 (maxFair = 2^32), a declared survivor '
          + 'until 2026-09-23, now FAILs this step. Scope, printed by the step: this bounds the '
          + 'AUDITOR\'S draw; the operator\'s branch stays ASSUMED (MANIFEST DL-3)',
      },
      {
        id: 'MINES-24', coverage: 'full',
        note: 'the player-verifier parity arm. The Mines verifier a player uses on the ProvablyFair.org '
          + 'site — VerifyBets games/mines/derive.js and the one library file it imports, '
          + 'lib/hmac-sha256.js — is vendored byte-for-byte in verifier-parity/ and both files\' '
          + 'SHA-256 digests are recorded in src/pins.ts SITE_VERIFIER_PINS (derive.js fa4dbd19…, '
          + 'hmac-sha256.js 2095571f…). The step hashes the vendored copies against the pins, loads '
          + 'them with only the ES-module keywords removed (src/site-verifier.ts; any other import or '
          + 'export form is a load FAIL), runs deriveMines on all 6,900 captured rounds and requires '
          + 'the draw-order minePositions to EQUAL src/rng.ts revealMines — the computeLayout every '
          + 'other layout step uses — with the denominator pinned to EXPECTED_BETS. Measured '
          + '2026-09-24: 6,900/6,900 equal (and 6,900/6,900 equal to the served mineTiles); '
          + 'displayCents equal at 300/300 legal cells (printed, not scored). Mutation M44 edits one '
          + 'byte of the vendored derive.js logic and this step FAILs on the hash; a re-pinned copy of '
          + 'the same edit FAILs on layout parity (probe 2026-09-24). '
          + 'scripts/check-site-verifier.mjs compares a site checkout with the same pins (exit 1 on '
          + 'mismatch). What this parity is: hash-pinned behavioural equality on every captured '
          + 'round, not a derive.js generated from src/rng.ts. Where the two differ, on inputs no captured '
          + 'round reaches: all eight chunks of a digest rejected (the site redraws at cursor + 1,000,000; '
          + 'src/rng.ts, rebuilt from docs/ALGORITHM.md, which leaves it unspecified (O1), throws), and '
          + 'non-hex server seeds (the site keys the HMAC with their UTF-8 bytes; src/rng.ts throws). The '
          + 'operator\'s own verify endpoint is a different thing and remains unprobed',
      },
    ],
  },
  6: {
    claims: [{
      id: 'MINES-06', coverage: 'full',
      note: 'the whole-dataset control half, over every bet (6,900/6,900, denominator pinned): each '
        + 'layout is recomputed under an EMPTY client seed and under a fixed WRONG client seed, and '
        + 'the survivors are gated at the rate the MODEL predicts — E + 5σ of chance collisions '
        + 'with E = Σ 1/P(25,m) for the draw-order comparison (9.269, gate 24.197; measured 9 wrong '
        + '/ 7 empty) and E = Σ 1/C(25,m) for the set comparison (59.610, gate 97.458; measured 47 '
        + '/ 48), over the tested bets\' own mine counts — replacing the arbitrary ≥ 95% gate, which '
        + 'passed a first-mine-only comparator at 286 survivors, 6,614/6,900 = 95.86% changed (probe, 2026-09-23). 0% change '
        + 'fails by construction (M17). The A–C generator is disclosed '
        + '(capture/capture-mines.reference.mjs, `audit${randomBytes(6)…}`, Node\'s CSPRNG) and BOUND '
        + 'to the data: all 128 non-Phase-D epoch client seeds must match /^audit[0-9a-f]{12}$/ and '
        + 'be distinct, or the step fails. The Phase D half — every player-set seed recomputes and '
        + 'the predictable seeds are enumerated by epoch — is Step 14 (MANIFEST DL-13)',
    }],
  },
  7: {
    claims: [
      {
        id: 'MINES-11', coverage: 'full',
        note: 'the loss half of the payout check, at exact zero with no epsilon: every losing round '
          + 'must carry multiplier 0-or-absent AND winningAmount exactly 0 ((b.multiplier ?? 0) !== '
          + '0 || Number(b.winningAmount) !== 0 counts a violation), over a coverage total bound to '
          + 'EXPECTED_BETS. The winning-credit half is Step 8',
      },
      {
        id: 'MINES-13', coverage: 'full',
        note: 'the display-rounding arm the profile allows for ("or on the declared display '
          + 'rounding with the exact value credited"): for EVERY winning bet at its opened depth, '
          + 'the operator\'s served `multiplier` field must equal floor2(minesMultiplierExact(m, '
          + 'openTiles.length)) at 1e-9 (tests/steps/payouts.ts:62-66), the wins where the display '
          + 'sits below the exact reference are counted and emitted, and a non-finite reference '
          + 'hard-fails rather than scoring as agreement. The exact credited value is Step 8; the '
          + '300-cell closed form is Step 10; the independent anchor is Step 13; the depth-5 arm '
          + 'is Step 15. No operator-supplied odds field enters the derivation: '
          + 'minesMultiplierExact takes (m, k) only',
      },
    ],
  },
  8: {
    claims: [
      {
        id: 'MINES-11', coverage: 'full',
        note: 'the winning-credit half, on the settlement value domain rather than at a float '
          + 'epsilon: winningAmount in 1e-8 units must EQUAL floor8(stake x multExact) computed as '
          + 'a BigInt rational with ZERO tolerance (floor8CreditUnits, retention factor '
          + 'EDGE_NUM/EDGE_DEN derived from HOUSE_EDGE and not a re-typed 99n/100n), which is what '
          + 'rejects the uniform +/-1e-8 shift a +/-2e-8 residual band cannot see (forgery D02). An '
          + 'ON-GRID test runs BEFORE any rounding, so a credit carrying a ninth decimal is '
          + 'rejected on its own terms. Money is summed only after it is proven finite, and a '
          + 'non-finite stake or credit hard-fails rather than poisoning the turnover the report '
          + 'quotes. Losses-credit-exactly-zero is Step 7 and is re-asserted here. A win credited one '
        + '1e-8 unit below floor8(stake x exact) hard-fails THIS step (forgery D26) — 0 such wins on '
        + 'this dataset (3,104/3,104 exact) — and, since 2026-10-03, fails Step 22 on the scored '
        + '2026-10-03 supplement too, whose declared gap is 0: one severity for one shortfall in '
        + 'every scored dataset. OPEN RULING 2 (profile owner: FAIL or FLAG?) now bears only on how '
        + 'the dated 2026-09-26 history is classed (50 short credits, held at a Step 22 FLAG from '
        + '2026-10-01 to 2026-10-03), not on any status',
      },
      {
        id: 'MINES-10', coverage: 'full',
        note: 'the win ⇔ no-mine half, as it bears on payment: a "won" round that opened any mine '
          + 'tile and a "lost" round that opened none are both labelViolations and hard-fail, and '
          + 'the credit is computed from openTiles.length — the tiles ACTUALLY opened — never from '
          + '`reveals`. The recomputed-layout form of the check, the bust-on-the-last-tile clause '
          + 'and the opened-count-equals-recorded-depth clause are Step 20',
      },
    ],
  },
  9: {
    claims: [
      {
        id: 'MINES-15', coverage: 'full',
        note: 'the Phase A half, asserted against the plan in code: all 24 mineCounts at exactly 200 '
          + 'rounds each, against MINE_COUNTS.length x PHASE_A_PER_MC, and the Phase-A total must '
          + 'equal that product, so a phase short of the plan FLAGs rather than passing on "no '
          + 'missing mineCount" — 4,800 rounds, above the 50-per-config floor. The multi-reveal '
          + 'half ("several depths and mine counts") is Step 22 on the v3 supplement (5 mine counts '
          + 'x 4 depths x 50, asserted against SUPPLEMENT_DEPTHS in src/pins.ts); the first-pick '
          + 'span is Step 21; the all-cells reference artifact is Step 19',
      },
      {
        id: 'MINES-22', coverage: 'full',
        note: 'both fits, computed in the step from the captured rows against pure combinatorics: '
          + '(a) the first-drawn mine position (mineTiles[0]) over all 6,900 layouts against the '
          + 'uniform 25-tile lattice — chi² 15.978 on 24 df, p = 0.8889; (b) the win count in each '
          + 'of the 25 (mineCount, planned reveals) groups against the binomial at '
          + 'winProbability(m,k) — Σz² 13.424 on 25 df, p = 0.9709, largest |z| 1.883. '
          + 'Informational (policy INFORMATIONAL, 2026-09-29): a p-value below the pre-registered '
          + 'LIVE_FIT_ALPHA = 1e-3 is reported as INFO — never counted, never a FLAG or a FAIL (mutation '
          + 'M36 raises the level to 0.95: the step reports INFO and the verdict stays Full Pass)',
      },
    ],
  },
  10: {
    claims: [
      {
        id: 'MINES-13', coverage: 'full',
        note: 'the closed form at EVERY legal cell: the full-grid sweep evaluates all 300 legal '
          + '(m,k) cells (m=1..24, k=1..25-m; the count is asserted === 300) and requires '
          + 'theoreticalRTP(m,k) = winProbability(m,k) x minesMultiplierExact(m,k) to equal '
          + 'PUBLISHED_RTP within 1e-9, which is algebraically the profile\'s claim that '
          + 'mult(m,k) = C(25,k)/C(25-m,k) x (1-edge). The two factors are INDEPENDENTLY WRITTEN in '
          + 'src/config.ts — winProbability as the binomial ratio via combination(), '
          + 'minesMultiplierExact as the product (1-edge) x prod (25-i)/(25-m-i) — and Step 13 '
          + 'anchors the probability factor against a product form and an integer subset tally, so '
          + 'this is not the module agreeing with itself. PUBLISHED_RTP = 0.99 is deliberately a '
          + 'LITERAL and not 1 - HOUSE_EDGE, which would make the comparison vacuous. A corrupted '
          + 'cell is caught: M05 sets minesMultiplierExact(4,2) to 1 and this step FLAGs; M04 sets '
          + 'it to NaN and it FAILs',
      },
      {
        id: 'MINES-18', coverage: 'full',
        note: 'the identity half of anti-circularity — P(survive to k) x multiplier(m,k) == '
          + '(1-edge) at all 300 legal cells with no operator data anywhere in the computation. '
          + 'Non-finite is separated from off-target as its own fault class, because '
          + 'Math.abs(NaN - 0.99) > 1e-9 is FALSE and an unguarded sweep would print "300/300 '
          + 'clean": a cell at 70% FLAGs, a cell that is not a number hard-FAILS. The counting '
          + 'anchor and negative control are Step 13',
      },
      {
        id: 'MINES-19', coverage: 'full',
        note: 'the effective edge is DERIVED per cell — all 300 legal (m,k) cells evaluated as '
          + 'winProbability x minesMultiplierExact against the published 99.0000% claim, the '
          + 'off-target count asserted at 0 (FLAG otherwise) with the observed min/max range '
          + 'printed as the magnitude — and the settlement-floor arm re-enumerates the same 300 '
          + 'cells in BigInt at the capture\'s smallest stake, DERIVED from the distinct betAmount '
          + 'values in the pinned bets and cross-checked against meta.phases (a disagreement is a '
          + 'hard fail, mutation M24), naming its worst cell. No operator edge field is read: the '
          + 'edge factor is EDGE_NUM = round((1-HOUSE_EDGE)*1e8) and this step hard-fails on '
          + 'edgeRationalIsExact() (mutation M26) and on a non-finite reference cell (the '
          + 'reference-formula guard, mutation M04); M27 (EDGE_NUM rebuilt at 1e2 scale, the same '
          + 'rational at a 1% edge) is a declared survivor (tests/survivors.json, DL-11). Both arms '
          + 'can fail (M05 reports GRID-OFF, M04/M26 FAIL). Scope, stated in the step itself: this is a property of '
          + 'the auditor\'s reference formula plus the settlement floor; only 25 of the 300 cells '
          + 'are operator-witnessed (Step 8), the other 275 are formula-only (limitation DL-4). '
          + 'OPEN RULING 1 (profile owner: which statement on LIQD\'s page LIQD is held to): the '
          + 'enforced RTP-CLAIM gate holds the page\'s flat 99% and passes 300/300; the same page\'s '
          + 'edge range 0.64%-1.44% (RTP 98.56%-99.36%), run through the same rule by this step, would '
          + 'FAIL "no range wider than reality" (published min -0.44 pp, published max +0.36 pp, band '
          + '0.10 pp) — printed, not scored',
      },
      {
        id: 'MINES-14', coverage: 'full',
        note: 'FLAG POLICY ON THE MONOTONICITY HALF; THE CAP HALF IS DISCLOSED, NOT SCORED, SINCE 2026-10-15. '
          + '(a) the exact multiplier is STRICTLY increasing in '
          + 'depth k for every m and in mine count m for every k, over all 552 adjacent legal cell '
          + 'pairs, compared as exact rationals (BigInt cross-multiplication) — 0 violations; '
          + 'mutation M37 flattens the ladder at an unreached cell (m=20, k=5) and the step reports '
          + 'NON-MONOTONE. (b) the cap half: the profile owner ruled on 2026-10-15 that payout caps are '
          + 'excluded from the audit and multiplier caps stay in scope, and LIQD stated the same day that '
          + 'Mines has had no multiplier cap since the end of August 2026 (the 10,000x setting removed from '
          + 'the configuration) and that a per-round payout limit ends the round and pays the full '
          + 'multiplier for the tiles already revealed. The scored 2026-10-03 build\'s 607 settings '
          + 'records carry no maxOdds (src/pins.ts SUPPLEMENT_GAME_SETTINGS, bound by Step 22), which '
          + 'agrees with that statement; maxExposure 50000 (exposureSource "global") is the round payout '
          + 'limit, excluded and not tested. Printed as history, not scored: the audited July build\'s '
          + '3,844 records carry maxOdds 10000 (MAX_ODDS_DECLARED, src/config.ts) and all 6,208 quoted '
          + 'multipliers lie within it (largest 24.75x); the reference formula exceeds it at 44 of 300 '
          + 'cells, none reached by a captured bet. From 2026-10-02 to 2026-10-15 the step FLAGged on the '
          + 'scored build\'s missing maxOdds; mutation M58 re-scores that figure and the step FLAGs again '
          + '(SUPPLEMENT-SETTINGS-NO-DECLARED-CAP), and M38 lowers the July declaration to 20x and the step '
          + 'stays PASS. Open ruling 3 (reading R2) is closed by the 2026-10-15 ruling',
      },
    ],
  },
  11: {
    claims: [{
      id: 'MINES-05', coverage: 'full',
      note: 'the population and phase-plan half of G-BIND: bets.length === EXPECTED_BETS and every '
        + 'per-phase count === EXPECTED_PHASE_BETS[p], both from src/pins.ts — code constants, '
        + 'never meta.plannedTotal or the sum of the phase counts in the file being scored — and '
        + 'the pin table\'s OWN arithmetic is asserted (sum EXPECTED_PHASE_BETS === EXPECTED_BETS). '
        + 'A mismatch is a HARD FAIL. Mutation M22 re-derives EXPECTED_BETS from the dataset and '
        + 'this step is the one that must FAIL. The seed/epoch-size half is Step 12; this package '
        + 'has one dataset file, so there is no secondary file to pin',
    }],
  },
  12: {
    claims: [{
      id: 'MINES-05', coverage: 'full',
      note: 'the seed, epoch and epoch-size half: seeds.length === EXPECTED_SEEDS, the number of '
        + 'distinct epochs in the bets === EXPECTED_SEEDS, min and max bets per epoch both === '
        + 'EXPECTED_EPOCH_SIZE, and the three pins asserted mutually consistent (EXPECTED_SEEDS x '
        + 'EXPECTED_EPOCH_SIZE === EXPECTED_BETS). Mutation M23 moves EXPECTED_EPOCH_SIZE off 50 '
        + 'and this step must FAIL. The dataset SHA-256 pin is enforced before any parse by '
        + 'src/loader.ts and re-asserted as a scored step in Step 19',
    }],
  },
  13: {
    claims: [
      {
        id: 'MINES-18', coverage: 'full',
        note: 'the anti-circular derivation, the COUNTING ANCHOR and the negative control: '
          + 'winProbability is shown to be pure combinatorics with no call into the multiplier '
          + 'module and no operator data — (1) at k=1 the outcome space sums to exactly 1 for '
          + 'every m; (2) the binomial form C(25-m,k)/C(25,k) equals the product form '
          + 'prod (25-m-i)/(25-i), recomputed locally, over every reachable (m,k); (3) every '
          + 'k-subset of the 25 tiles is ENUMERATED by a depth-first walk and the tallies compared '
          + 'with INTEGER equality to C(25,k) and C(25-m,k). Mutation M00 shifts winProbability to '
          + 'C(26-m,k) and this step must FAIL — the corrupted-model control the profile asks for. '
          + 'The enumeration is exhaustive at k <= 5 (the deepest depth the capture reaches); leg '
          + '(2) covers all 300 cells and the p x mult identity at all 300 cells is Step 10',
      },
      {
        id: 'MINES-13', coverage: 'full',
        note: 'the independent-oracle half of the formula check: the multiplier equality Step 10 '
          + 'asserts is only as good as the probability factor in it, and this step anchors that '
          + 'factor outside the audited closed form — against a locally recomputed product form at '
          + 'every reachable cell and against an integer subset tally. A compensating pair of '
          + 'corruptions (a wrong winProbability matched by a wrong multiplier) is caught here '
          + 'rather than cancelling inside Step 10\'s identity',
      },
    ],
  },
  14: {
    claims: [{
      id: 'MINES-06', coverage: 'full',
      note: 'the Phase D half: all 500 Phase-D rounds recompute their mine layout under the client '
        + 'seeds ACTUALLY used (10 distinct pfaudit- seeds), with a coverage guard (tested === '
        + 'phaseD.length) so a run that recomputed nothing cannot pass on 0 === 0, and at least 2 '
        + 'distinct client seeds required (the profile floor). The predictable construction is '
        + 'disclosed WITH THE EXPOSED EPOCHS ENUMERATED by the step from the data: every Phase-D '
        + 'client seed of the form pfaudit-<13-digit stamp>-<its own epoch> is listed — epochs '
        + '120–129, 500 bets, one stamp 1785428583504 decoded to 2026-07-30T16:23:03.504Z — and '
        + 'carried as MANIFEST DL-13. Mutation M39 drops the client seed from the HMAC message and '
        + 'this step FLAGs. The whole-dataset controls and the A–C generator binding are Step 6',
    }],
  },
  15: {
    claims: [
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'the multi-reveal layout and cash-out arm: all 400 Phase-E rounds are asserted to be '
          + 'the declared shape (mineCount 3, reveals 5), every layout recomputes with a coverage '
          + 'guard (layoutChecked === phaseE.length), and each WIN\'s served multiplier is checked '
          + 'at minesMultiplier(3, openTiles.length) — the depth actually opened, not the planned '
          + '`reveals` — with a non-finite reference hard-failing. The outcome split is produced '
          + 'rather than asserted in prose (216 cashed out at depth 5, those that hit a mine on the '
          + 'fifth reveal, those that busted at depths 1-4). WHAT IS MISSING, package-wide: no '
          + 'per-step multiplier is recorded (gameModel.multiReveal.perStepMultipliersRecorded is '
          + 'false) — and the v3 supplement shows why: LIQD does not serve one on the wire (Step 22: '
          + '0 of 3,314 open-tile responses carry a multiplier on the scored 2026-10-03 capture, 0 of '
          + '3,418 on the 2026-09-26 one), so no intermediate rung can be '
          + 'checked against the formula at its depth and the rung check is limited to the '
          + 'cash-out, which the profile\'s declarationTruth says makes the check partial. Reveal '
          + 'ORDER independence at the cash-out rung and the cash-out rung at 20 (mineCount, depth) '
          + 'cells are Step 22; the mine-set invariance and per-reveal status arm is Step 20; the '
          + 'position arm is Step 21',
      },
      {
        id: 'MINES-13', coverage: 'full',
        note: 'the depth arm: every Phase-E win\'s served multiplier equals the closed form at the '
          + 'depth actually opened (minesMultiplier(3, openTiles.length), display rounding), with '
          + 'the reveal depths reached emitted; a non-finite reference is a hard fail',
      },
    ],
  },
  16: {
    claims: [{
      id: 'MINES-20', coverage: 'full',
      note: 'the committed experiment is REPLAYED, not trusted: all 24 x 1,000,000 Pass-1 rounds are '
        + 'regenerated inside every verify run from the seed pair each row records (src/replay.ts, '
        + 'the expressions src/simulate.ts uses; parallel worker processes of the verifier, '
        + 'src/replay-pool.ts — the zero-install bundle re-runs itself as the worker), and every row '
        + 'field is compared: the census (all seven convergence counts, df, pair count, worst pair) '
        + 'exactly, and every derived statistic — first-draw chi2 and p (first-draw uniformity, the '
        + 'profile\'s "first-draw + pairwise co-occurrence" form), joint max|z| and p, lag-1 r and z, '
        + 'runs z and p, theoretical and simulated RTP — within the reproduction tolerance (1e-14 + '
        + '1e-12·max, src/diff.ts). Every FWER count and verdict arm is computed from the REPLAYED '
        + 'statistics and the stored scalars must equal them. The replay\'s prefix shuffle is '
        + 'checked against the adapter\'s full revealMines on the first 1,000 rounds of every job. '
        + 'Coverage is bound to the plan: 24 rows, one per mineCount 1..24 (MINE_COUNTS), and '
        + 'roundsPerConfig must EQUAL ENFORCED_ROUNDS_PER_CONFIG (1,000,000) or nothing is replayed '
        + 'and the step fails. The artifact is pinned with no run metadata (Step 19, MINES-27). '
        + 'Measured 2026-09-24: 24/24 rows, 0 census mismatches, 0 derived statistics beyond '
        + 'tolerance, 0 non-zero differences (bit-identical), 162,000 prefix self-check rounds, 0 '
        + 'disagreements. FAIL probed: forgery A31 (the former declared survivor S01, a fully '
        + 'self-consistent deep Pass 1, re-pinned), A32 (one n=50,000 convergence count moved by one '
        + 'win, re-pinned) and mutation M47 (replay engine one nonce off)',
    }],
  },
  17: {
    claims: [{
      id: 'MINES-21', coverage: 'full',
      note: 'the SERVED-CONFIG statistic is computed in verify: for each of the 138 revealed epochs, '
        + 'the 50 configurations it actually served — mine count and the tiles the capture requested, '
        + 'in nonce order, taken from the pinned dataset (never from the artifact) — are replayed '
        + 'over the epoch\'s revealed seed for 10,000 nonces (nonce n plays config n mod 50). The '
        + 'early window is the captured nonce range 0–49, and its replayed outcomes must EQUAL the '
        + '6,900 recorded outcomes; nonces 50–9,999 give 199 later windows of the same sequence. '
        + 'Statistic: the window RETURN against the exact per-config mean P(survive k)·mult(m,k) and '
        + 'variance P·mult² − μ². Null: a bootstrap over the seed\'s own 199 later windows, '
        + 'p = (1 + #later ≤ early)/200. Rule (the SERVED_* constants in tests/steps/simulation.ts, '
        + 'written 2026-09-24 before the statistic was first computed): flag at p ≤ 0.01, family gate = binomial upper tail '
        + 'at 0.001 (6 of 138), pooled z < −3.090 fails. It was written after this capture\'s seeds '
        + 'were revealed. Power printed: 8.6% at a 5% '
        + 'early-window return shortfall, 64.1% at 10%, 100.0% at 20%. Measured: 0/138 flagged, pooled '
        + 'early-window z = 0.723 (the pooled return and its exact expectation are in the step detail). The tiles a losing round did not reach '
        + 'are rebuilt from the capture\'s consecutive-tile rule (capture/capture-mines.reference.mjs '
        + 'playRound), which all 6,900 recorded opened sequences satisfy; a round that does not '
        + 'satisfy it fails the binding. The first-draw test (bootstrap null replayed from the '
        + 'recorded master seed, 138/138) is kept and re-derived. FAIL probed: forgery A36 (a Phase-E '
        + 'win\'s opened tiles reversed, re-pinned), mutations M45 (replay plays a tile off the plan) '
        + 'and M46 (the pooled-z gate branch)',
    }],
  },
  18: {
    claims: [{
      id: 'MINES-12', coverage: 'full',
      note: 'all 200 Phase-C hands at $10.00 (100x the Phase-A stake, mineCount 3 — the low mine '
        + 'count the profile asks for, 176 wins exercising the payout path) recompute their layout '
        + 'in draw order against the same wager-free reference the $0.10 hands are scored by, with '
        + 'a coverage guard (chk === phaseC.length and chk > 0) and the distinct stakes present '
        + 'emitted. The HMAC message is `${clientSeed}:${nonce}:${cursor}` and revealMines takes '
        + 'no stake parameter, so no amount term can enter the derivation. The elevated-stake '
        + 'PAYOUT path is settled by the same exact floor8 identity over these same rows in Step 8. '
        + 'The step states its own limit: sample layout parity at two recorded stakes, not '
        + 'paired-stake causality',
    }],
  },
  19: {
    claims: [
      {
        id: 'MINES-26', coverage: 'full',
        note: 'the dataset pin has ONE definition — EXPECTED_DATASET_HASH in src/pins.ts — imported '
          + 'by the producer (src/simulate.ts, src/write-figures.ts) and the verifier '
          + '(tests/verify.ts) alike; src/loader.ts hashes the raw bytes and exits(1) BEFORE '
          + 'JSON.parse, so enforcement precedes any parse and any step; and the pin is '
          + 're-asserted here as a scored step. This package has exactly one dataset file and no '
          + 'config file (the payout is a formula), so there is no secondary file to pin. The '
          + 'immutable legacy simulation fixture is pinned too (LEGACY_BOOTSTRAP_ARTIFACT_SHA256, '
          + 'tests/mines/qaRegressionTests.ts QA-05b)',
      },
      {
        id: 'MINES-27', coverage: 'full',
        note: 'every artifact the report quotes from outputs/ is pinned by SHA-256 in src/pins.ts '
          + 'ARTIFACT_PINS and re-hashed here, ABSENT is a FAIL: simulation-results.json, '
          + 'simulation-provenance.json, bootstrap-nulls.float64le, rtp-convergence.html, '
          + 'deep-replay-report.json, bootstrap-replay-report.json, audit-figures.json and '
          + 'verification-results.json (8/8); each must be un-ignored BY NAME in .gitignore (M48); no '
          + 'pinned JSON artifact may carry a run-metadata key (src/domains.ts RUN_METADATA_KEY; '
          + 'forgery A33 puts generatedAt back, re-pinned, and is rejected); every numeric leaf of every '
          + 'pinned JSON artifact must have a DECLARED value domain with bounds from code and lie in it '
          + '(src/domains.ts; A34, an impossible value re-pinned, is rejected by the domain alone); the '
          + 'pin arm itself is A35 (one byte, not re-pinned). Run metadata was REMOVED, not excluded, '
          + 'on 2026-09-24, each file through its own generator\'s serialiser with every other leaf '
          + 'proven identical: simulation-results.json lost generatedAt and two executionTimeMs '
          + '(1,884 → 1,881 leaves, 0 changed) and a SIM_REPLAY=1 regeneration by src/simulate.ts '
          + 'reproduces it (see MANIFEST "Artifacts of record"); provenance, deep-replay, bootstrap-replay '
          + 'and figure artifacts likewise. The producers write to outputs/run/ by default (simulate, '
          + 'figures, bootstrap-replay; deep-replay only to --out), verify writes only outputs/run/ '
          + 'plus a field-level diff.json against the committed copies at the reproduction tolerance, '
          + 'and PF_EMIT=1 is the one deliberate in-place path, re-pinned in the same diff. Named '
          + 'exception: tests/fixtures/legacy-simulation-results.json keeps its 2026-08-05 generatedAt '
          + '— it is the byte-for-byte copy of a superseded artifact kept as a regression fixture, '
          + 'its bytes (timestamp included) are its asserted identity (LEGACY_BOOTSTRAP_ARTIFACT_SHA256, '
          + 'QA-05b), and no reported figure is read from it',
      },
      {
        id: 'MINES-15', coverage: 'full',
        note: 'the committed-artifact half: outputs/audit-figures.json carries `referenceGrid`, a '
          + 'row per legal (m,k) cell for all 300 cells, and this step BINDS it by field-for-field '
          + 're-derivation, so the all-cells reference is a produced artifact and not prose. The '
          + 'artifact does not mark which cells live play reached; that is not in the profile\'s '
          + 'asserts, and the live-witnessed cash-out cells are now emitted by a step — the '
          + 'audited dataset\'s 25 in Step 10\'s detail and MANIFEST DL-4, the scored supplement\'s 20 in '
          + 'Step 22\'s detail. The Phase A half is Step 9; the multi-reveal half is Step 22; the '
          + 'first-pick span is Step 21',
      },
    ],
  },
  20: {
    claims: [
      {
        id: 'MINES-10', coverage: 'full',
        note: 'every clause, over the whole population and from the RECOMPUTED layout — the mine '
          + 'set is revealMines(serverSeed, clientSeed, nonce, m), never the served mineTiles and '
          + 'never the result label: a WIN opens no mine AND its opened count equals the recorded '
          + 'depth (`reveals`); a LOSS busts on EXACTLY the last opened tile with no earlier mine '
          + 'and opens between 1 and `reveals` tiles; every opened tile is a legal index 1..25, '
          + 'none repeated, and the served mine list is mineCount distinct legal indices (the '
          + 'profile\'s rules.boardStructure note). Coverage: wins + losses === EXPECTED_BETS, both '
          + 'present, 0 rounds unrecomputable, 0 labels other than won/lost. Measured 3,104 wins / '
          + '3,796 losses, 0 violations of any clause. Forgery D23 truncates a Phase-E win to 4 '
          + 'tiles with its multiplier and credit rewritten for depth 4 — every payout step prices '
          + 'it at the opened depth and passes; this step FAILs it. D22 ([t,t,t,t,t]) and mutation '
          + 'M42 (recomputed set shifted) FAIL it. The label ⇔ mine half as it bears on payment is '
          + 'also carried by Step 8',
      },
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'the per-reveal status and mine-set invariance arm: every opened tile\'s mine/safe '
          + 'status is checked against the seed-derived layout for all 6,900 rounds (not only '
          + 'Phase E), which is what binds the reveal sequence to the committed layout. `partial` '
          + 'for the package-wide reason in Step 15: no per-step multiplier is served on the wire '
          + '(Step 22), so no intermediate rung is checked. Reveal ORDER independence at the '
          + 'cash-out rung is Step 22',
      },
    ],
  },
  21: {
    claims: [
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'the reveal-POSITION arm: all 400 Phase-E layouts still recompute regardless of which '
          + 'positions were opened (chk === phaseE.length, 0 mismatches) and the rounds span more '
          + 'than one distinct opened-tile set (measured 107) with ALL 25 board positions as a '
          + 'first pick (asserted since 2026-09-23; measured 25/25). The step says out loud that it '
          + 'is a layout-parity check over a swept window, not a statistical independence test. '
          + 'Reveal ORDER independence is Step 22 on the v3 supplement (CSPRNG reveal orders '
          + 'journalled before each bet). WHAT IS MISSING package-wide: no intermediate rungs, '
          + 'because LIQD serves no per-step multiplier (Step 22: 0 of 3,314 reveals on 2026-10-03, 0 of '
          + '3,418 on 2026-09-26) — a '
          + 'property of the operator\'s API, not closable by another capture',
      },
      {
        id: 'MINES-15', coverage: 'full',
        note: 'the first-pick span half: ALL 25 positions asserted as a first pick (firsts.size === '
          + 'GRID, tests/steps/standardization.ts; raised from >= 20 on 2026-09-23), measured 25/25, '
          + 'and mutation M43 (shuffle swap removed) makes the step FLAG. The Phase A half is Step '
          + '9; the several-depths-and-mine-counts half is Step 22',
      },
    ],
  },
  22: {
    claims: [
      {
        id: 'MINES-15', coverage: 'full',
        note: 'the multi-reveal half, on the scored v3 supplement captured 2026-10-03 '
          + '(data/liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.json, SHA-256 pinned with its '
          + 'journal in src/pins.ts): exactly 50 rounds at each of the 20 planned (mineCount, depth) '
          + 'configurations — mine counts 1, 3, 5, 8, 12 x 4 depths each, asserted against '
          + 'SUPPLEMENT_DEPTHS in code, none off plan — and at least SUPPLEMENT_MIN_CASHOUT_RUNGS (20) '
          + 'cash-out cells witnessed (measured 20; the fewest wins, 2, at (12, 5)); first picks span '
          + '25/25. The Phase A half is Step 9. The same step binds the supplement build\'s operator '
          + 'settings (arm j, since 2026-10-02): all 607 settle-response settings records equal '
          + 'SUPPLEMENT_GAME_SETTINGS in src/pins.ts (mutation M57 edits the declaration and FAILs the '
          + 'step); they carry no maxOdds, which Step 10 discloses (MINES-14 cap half, not scored since 2026-10-15). The 2026-09-26 '
          + 'capture of the same plan (19 cells witnessed; (12, 5) 0 wins in 50) is dated history, arm '
          + '(k), pinned and not scored',
      },
      {
        id: 'MINES-17', coverage: 'partial',
        note: 'the cash-out rung, the order arm and the per-reveal arm on the 1,000 interactive '
          + 'rounds captured 2026-10-03: every layout recomputes (1,000/1,000), every served mine/safe '
          + 'status equals the recomputed layout (3,314/3,314 reveals), the reveal order is the CSPRNG '
          + 'order journalled before the bet (1,000/1,000), and at each of the 20 witnessed '
          + '(mineCount, depth) cells the served multiplier and credit are one value across every '
          + 'reveal order (20/20). Every win is scored against the ONE rule the audited dataset is '
          + 'held to (credit floor8(stake x exact), display floor2(exact)): 393/393 credits and 393/393 '
          + 'displays equal it, 0 above, 0 below — the declared gap is 0, so a short credit FAILs the '
          + 'step, the severity MINES-11 (HARD_FAIL, an exact comparison under a declared settlement '
          + 'rule) gives it and the one Step 8 gives it on the audited dataset (forgery D26). DATED '
          + 'HISTORY, arm (k), pinned and re-derived, not scored: on the 2026-09-26 capture of the same '
          + 'plan 50 of 404 wins were credited one 1e-8 unit below the rule ((1,10) x29, (1,15) x21; '
          + '$0.0000005 in total; DL-14) and 29 displayed one cent below it, all at (1,10) (DL-15); the '
          + 'step was a FLAG on them from 2026-10-01 to 2026-10-03, pending OPEN RULING 2 (is a win '
          + 'credited 1e-8 below floor8(stake x exact) a FAIL or a FLAG?), which now bears only on how '
          + 'that history is classed; LIQD confirmed a floating-point issue on 2026-09-30 and stated a '
          + 'fix for its next release. No rule fitted to the operator\'s output is gated. WHAT IS '
          + 'MISSING: the per-step rung — LIQD serves no multiplier on an open-tile response (0 of '
          + '3,314 reveals, asserted equal to the declared SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS = '
          + '0; 0 of 3,418 on 2026-09-26), so no intermediate rung can be checked and the profile\'s '
          + 'declarationTruth makes the check partial',
      },
    ],
  },
};

/**
 * Checks this casino's design makes inapplicable. The reason is the declaration: a check that
 * simply never appears is a gap, and one that says why it cannot apply is an answer. Only ONE check
 * earns this here. A check the evidence says applies is never declared n/a to make a gap
 * disappear: MINES-24 was carried as a gap in PACKAGE_CHECKS until Step 5 implemented it.
 */
export const NOT_APPLICABLE: Array<{ id: string; reason: string }> = [
  {
    id: 'MINES-16',
    reason: 'applies={path: money.balanceField, notNull: true} is false — this capture has no '
      + 'balance field to reconcile against. Measured over data/mines-master-6900bets.json: no key '
      + 'matching /balance|wallet/i exists on any of the 6,900 bet records or any of the 138 seed '
      + 'records, and this operator\'s settle response carries none, so there is no consecutive-bet '
      + 'wallet delta and no magnitude to state — the quantity was never recorded. This is the '
      + 'package\'s own declared limitation DL-5 (MANIFEST.md), carried as risk R-CREDIT in '
      + 'MANIFEST.md#operator-trust and E14 in MANIFEST.md#evidence, with remedy A4 (a follow-up capture '
      + 'recording delta-balance == winningAmount - betAmount per round). What IS verified is the '
      + 'settle-response field: on the audited dataset 3,104/3,104 wins credit the exact floor8 '
      + 'amount and 3,796/3,796 losses credit exactly 0 (Step 8) — which the profile explicitly '
      + 'does not count as a balance ledger. Neither v3 supplement capture carries a balance field '
      + 'either (no key matching /balance|wallet/i in data/liqd-mines-capture-v3-2026-10-03T11-58-'
      + '54-479Z.json or data/liqd-mines-capture-v3-2026-09-26T16-46-41-121Z.json)',
  },
];

/**
 * Checks a package artifact answers rather than a scored step. `none` means the check is not
 * answered at all — recorded so the gap is machine-readable instead of merely absent.
 */
export const PACKAGE_CHECKS: Array<{ id: string; artifact: string; coverage: Coverage | 'none'; note: string }> = [
  {
    id: 'MINES-09',
    artifact: 'docs/ALGORITHM.md + src/rng.ts (provenance header) + tests/mines/rngSpecTests.ts + tests/mines/rngTests.ts (+ tests/mines/qaRegressionTests.ts QA-12) — 49 bundled unit specs',
    coverage: 'partial',
    note: 'REWRITTEN 2026-10-20. src/rng.ts is rebuilt from a written specification, '
      + 'docs/ALGORITHM.md (framework games/liqd-mines/ALGORITHM.md), by an implementer who never opened '
      + 'LIQD\'s code; LIQD\'s code is run as a second check, not used as the source. Until then src/rng.ts '
      + 'was the auditor\'s reconstruction from LIQD\'s client bundle, checked against the byte-level RNG '
      + 'specification LIQD supplied privately and cited generically; that module and its citation are '
      + 'gone. The profile\'s "the adapter cites the operator source line it ports" is superseded for '
      + 'this package by the 20 Oct 2026 rule that RNG code is rebuilt from a written spec: nothing is '
      + 'ported, so no operator line is cited; docs/ALGORITHM.md §4 names the source of every step '
      + '(LIQD\'s public pages, the standard construction, or the 8,900 live rounds). What IS here: '
      + 'tests/mines/rngSpecTests.ts runs the spec\'s own vectors and properties against src/rng.ts '
      + '(98/98); the unit specs reproduce CAPTURED bets from their revealed seeds (bet '
      + 'GbqOuPvhQekqcARNtHZ3_ → [6,20,7]; bet j2ICJ7NM_TrD_UMtv6Av0 → the full 24-tile draw order; '
      + 'commitHash(8b2f…) → 5d6c4f10…); and, as the second check, the OPERATOR\'S OWN validation '
      + 'vectors from LIQD\'s private specification (nonce 7 cursor 0 range 25 → 2; nonce 7 cursor 3 '
      + 'range 52 → 49; Mines nonce 7 mineCount 3 → [3,17,16]). Mutation M16 corrupts a fixture '
      + 'nibble and mocha fails. PARTIAL because LIQD\'s code itself is not in this package (its '
      + 'specification is private and not quoted), so the second check here is its three vectors, not an '
      + 'execution of its code on every round; and the operator\'s live verify endpoint is still not probed',
  },
  {
    id: 'MINES-23', artifact: 'MANIFEST.md#verification-results', coverage: 'full',
    note: 'the standardized matrix with framework IDs S5-1 … S5-8, the same eight categories and '
      + 'order the LIQD Dice package uses — seed substitution, client-seed manipulation, '
      + 'stake-conditional outcome, server-seed cherry-picking, seed-rotation race (TOCTOU), '
      + 'multiplier tampering, nonce manipulation, modulo bias — each row carrying one of Pass / '
      + 'Flag / Hard Fail / Not tested — disclosed and a citation to the scored step or capture '
      + 'evidence that decides it. S5-5 is "Not tested — disclosed": the capture drove the atomic '
      + 'auto-bet endpoint one round at a time, so no concurrent rotate/round interleaving was '
      + 'exercised (risk R-RACE in MANIFEST.md#operator-trust, recommendation A5)',
  },
  {
    id: 'MINES-25',
    artifact: 'MANIFEST.md#verify-a-bet (steps, script and worked verification examples)',
    coverage: 'full',
    note: 'MANIFEST.md "Verify a bet" carries the player path, in the profile\'s '
      + 'order and in the dataset\'s field names: (1) where the seed is revealed — the Seeds panel '
      + 'shows the Active Server Seed (Hashed) commitment and the next pair before play (E12, E13), '
      + 'and rotating the pair reveals the retiring serverSeed, shown under My Bets in the round\'s '
      + 'Provably Fair section (E21); the player is told to copy the Active Server Seed (Hashed) '
      + 'before rotating, because that round view lists only Client Seed, Server Seed, Nonce and '
      + 'Mines (E21); (2) which fields to take — clientSeed, serverSeed, nonce, mineCount from that '
      + 'section, hashedServerSeed from the Seeds panel before rotating, openTiles and mineTiles '
      + 'from the player\'s own board; (3) the commitment encoding — SHA-256 of the '
      + 'serverSeed hex STRING as UTF-8, not of its decoded bytes; (4) the shuffle — HMAC-SHA256 '
      + 'keyed by the hex-decoded serverSeed over `clientSeed:nonce:cursor`, 4-byte big-endian '
      + 'chunks, rejection at maxFair, sequential Fisher-Yates; (5) the tile numbering — 1-based, '
      + '1..25, mines in draw order, numbered across rows from the top-left square (tile t at row '
      + 'ceil(t/5), column ((t-1) mod 5)+1), settled by E22, the finished board of the E21 round, '
      + 'whose revealed seed computes mines [12, 1, 25] and whose board shows them at row 1 column '
      + '1, row 3 column 2 and row 5 column 5 (docs/ALGORITHM.md O5, closed 2026-10-21; until then '
      + 'this check was claimed full while the numbering was open, external QA 2026-10-21). A copy-paste Node script (node:crypto only) performs steps '
      + '3-5 and was run against bet GbqOuPvhQekqcARNtHZ3_ (commitment ok, mines [6, 20, 7] = the '
      + 'recorded mineTiles). The worked verification examples in the same '
      + 'section carry bets through literally',
  },
  {
    id: 'MINES-28',
    artifact: 'scripts/check-standalone.mjs + scripts/standalone-runtime.cjs + src/pins.ts (AUDIT_ID, EXPECTED_UNIT_TESTS) + standalone-manifest.json + verify.js / test.js + package.json (engines 22.x) + .nvmrc + src/diff.ts -> outputs/run/diff.json',
    coverage: 'full',
    note: 'zero-install verification on a fresh clone: `npm test` is scripts/run-stages.mjs running four '
      + 'dependency-free stages — check-standalone.mjs, node test.js, node verify.js and '
      + 'release-manifest.mjs --check — every one of them whatever the verdict (until 2026-10-02 an && '
      + 'chain stopped at the verifier\'s exit 2 and never reached the release check); it exits with the '
      + 'verifier\'s verdict code when the other three pass and 1 when one does not; the runtime is pinned (engines 22.x plus '
      + '.nvmrc); verify writes only outputs/run/ and a field-level diff.json at the profile\'s '
      + 'reproduction tolerance, exiting 1 beyond it; the bundle inventory is hash-checked. The '
      + 'PASSING unit-spec count is enforced: the zero-install runner counts every spec that ran '
      + 'to completion and exits 1 unless it equals EXPECTED_UNIT_TESTS (49) in src/pins.ts. The '
      + 'audit ID is a constant (AUDIT_ID = PF-2026-LQ02 in src/pins.ts), emitted into '
      + 'outputs/verification-results.json, and check-standalone.mjs fails unless MANIFEST.md '
      + 'carries the same ID, the unit-spec count quoted in MANIFEST.md/README.md equals '
      + 'EXPECTED_UNIT_TESTS, and the scored-step count quoted there equals the steps in the '
      + 'committed scored record (22); since 2026-10-02 it also scans every shipped chapter for the '
      + 'current-count phrasings of the unit specs, scored steps, declared mutations, forgeries and '
      + 'declared limitations and fails on any that disagrees with the registry it counts',
  },
  {
    id: 'MINES-29',
    artifact: 'tests/mutations.json (48) + tests/survivors.json (11, each tied to a DL row) + tests/forgeries.ts (63 must-fail, 0 declared survivors), run by tests/mutations.ts and tests/forgeries.ts',
    coverage: 'full',
    note: 'the registry is step-named and runs in a disposable copy (node_modules symlinked, the '
      + 'working tree never touched), and every entry NAMES the step that must fire, with the '
      + 'runner asserting both the VERDICT and that step\'s status (and, where the named step already '
      + 'carries that status on the unmutated tree, a FLAG REASONS code the unmutated run does not '
      + 'print — Step 10 since 2026-10-02). EVERY scored step 1–22 has '
      + 'at least one mutation that kills it: M56 (Step 2, added 2026-10-02 — until then no entry named '
      + 'Step 2), M33 (Step 3), M34/M35 (4), M12 (5), M36 (9), '
      + 'M37/M38 (10, FLAG), M39 (14), M40 (15), M41 (18), M42 (20), M43 (21) were added '
      + '2026-09-23, M44 (5, the vendored site verifier) and M45–M48 (17 served-config binding and '
      + 'gate, 16 replay engine, 19 .gitignore) on 2026-09-24, M49–M52 (22: display rule, supplement '
      + 'plan, per-step declaration, DL-14 count) on 2026-09-26, M53–M55 (22: a credit above the '
      + 'rule, the fitted binary64 model re-adopted as the rule, the credit-gap flag switch) on '
      + '2026-09-29, M57 (22: the supplement settings declaration) and M58 (10: the supplement '
      + 'settings arm) on 2026-10-02 — beside the existing entries for steps '
      + '1, 5, 6, 7, 8, 10, 11, 12, 13, 16, 17, 19. On 2026-10-03, when Step 22 moved to the '
      + '2026-10-03 capture, four Step 22/10 entries were re-targeted to it rather than left asserting '
      + 'the 2026-09-26 data: M52 now edits the dated-history count (SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW), '
      + 'M55 — whose switch was removed with the FLAG it held — now declares a non-zero gap on the '
      + 'zero-gap capture, M57 edits the 2026-10-03 settings value, and M58 now expects Full Pass. On '
      + '2026-10-20, when src/rng.ts was replaced by the module rebuilt from docs/ALGORITHM.md, the nine '
      + 'entries that edit it (M09, M10, M11, M12, M17, M39, M41, M42, M43) were re-targeted to the same '
      + 'faults in the rebuilt code (M13\'s line is unchanged). A run '
      + 'that hits the per-run time limit '
      + '(PF_MUTATION_TIMEOUT_S, default 1200 s) is reported TIMED OUT, not MISS, and fails the gate '
      + 'as inconclusive. '
      + 'The survivor staleness alarm is REACHABLE: a declared survivor is "now caught" when the '
      + 'verdict is no longer the clean one or its named step fires, and that fails the gate '
      + '(registry out of date). Every survivor carries a `limitation` field naming its MANIFEST '
      + 'row (DL-11, and DL-2 for the bootstrap-arm entries). Forged-evidence batteries are '
      + 'included (dataset, simulation-artifact and figure-artifact forgeries; dataset forgeries '
      + 're-pin the dataset and, since 2026-09-24, artifact forgeries re-pin every artifact of record '
      + 'so that only the step re-deriving the content can reject them — A35 is the one that does not, '
      + 'to test the pin). The one evidence survivor, S01, became must-fail A31 on 2026-09-24',
  },
  {
    id: 'MINES-30', artifact: 'MANIFEST.md (Declared Limitations DL-1…DL-16, Load-Bearing Premises, Model Anchors) + MANIFEST.md#evidence E01-E20',
    coverage: 'full',
    note: 'the register is present and measured: DL-1…DL-16 each carry a MEASURED MAGNITUDE and the '
      + 'registry entry or evidence that closes it (DL-1, the deep Pass-1 statistics, is CLOSED since '
      + '2026-09-24 by the in-verify replay of Step 16 and says so); DL-13 is the predictable Phase D '
      + 'seeds with the exposed epochs 120–129 enumerated; the load-bearing-premises table marks the '
      + 'unwitnessed premises ASSUMED; MANIFEST Evidence numbers E01-E20 with an evidential role each. No '
      + 'internal QA material ships, by the profile\'s own measure (param '
      + 'package.internalFoldersPresent; conformance C-09 scans file paths for review-rounds/, '
      + 'qa|review|notes|scratch|internal/, .env, credential files and .pf-*): the two framework '
      + 'files that shipped at the package root, .pf-assumptions and .pf-declared-constants, were '
      + 'moved on 2026-09-24 out of the package into the ProvablyFair.org audit framework\'s package '
      + 'notes (the framework\'s prose checker still looks for them in the package and must be '
      + 'repointed — a framework change). QA-nn / FIX-nn identifiers remain in shipped prose and test '
      + 'names as cross-references to the review items that produced a guard; the profile\'s rule '
      + 'measures shipped files and folders, not identifiers inside them, so they are not counted here',
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
