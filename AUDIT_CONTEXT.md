# LIQD Mines Technical Audit Report

## Result and certification scope

The published QA dataset passes all **21 scored verification checks**, with **zero flags and zero hard failures**. Independent recomputation matches all **6,900 recorded mine layouts**, all **138 revealed seed commitments**, and every recorded winning and losing settlement amount.

This report presents the findings for the pre-release QA capture. Certification remains **provisional pending anonymous production verification**. The production stage will evaluate ordinary public play and the additional checks in [Anonymous production verification](#anonymous-production-verification). Extending certification requires those production findings to be supported by the new evidence. The published result covers the checks described here, including their stated replay coverage.

The audit combines three forms of evidence:

1. Recorded QA responses, checked against independently calculated outcomes and payouts.
2. Mathematical analysis of the reconstructed, uncapped game formula.
3. Statistical tests of the auditor's implementation and disclosed analysis of the captured server seeds.

The reconstruction is in `src/rng.ts` and `src/config.ts`. It reproduces the captured responses. The auditor attributes its derivation to the operator's client bundle; the complete original bundle and derivation record are not retained in this package. Operator backend source is not included. Observational findings apply to the captured population; analytical findings apply to the stated reference model.

## Captured population

The dataset records game `fast-games-13` on `qa.liqd.com`, with USDC stakes, from **2026-07-30 16:23:03.508 UTC** to **18:05:38.881 UTC**. It contains **6,900 bets**, organized into **138 seed epochs of 50 bets**. The auditor identifies the account scope as one account. All epoch server seeds are revealed in the dataset.

| Phase | Bets | Stake | Recorded coverage |
|---|---:|---:|---|
| A | 4,800 | $0.10 | 200 bets at each mine count from 1 through 24; one planned reveal |
| B | 1,000 | $0.10 | Mine count 24; one planned reveal |
| C | 200 | $10.00 | Mine count 3; one planned reveal |
| D | 500 | $0.10 | Ten player-supplied client seeds; mine counts 1 through 24; one planned reveal |
| E | 400 | $0.10 | Mine count 3; five planned reveals, stopping on a mine |

The auditor's capture method uses the atomic auto-bet path, which places, reveals, and settles in one request. The sanitized capture reference describes that path. Phase E supplies multi-reveal response records; there is no captured interactive cash-out sequence or pause between individual reveal requests.

Population and phase assertions are defined in `src/pins.ts` and checked by `tests/steps/dataset.ts`. The phase counts, settings, and recorded times are available in the dataset itself.

## Dataset and evidence provenance

### Identity and integrity

The master dataset is `data/mines-master-6900bets.json`. Its SHA-256 is:

```text
c7c2e8a930549e11e3e564a962aea0ca2875b6eb94bc1f4347cc703bc410b222
```

`src/pins.ts` defines the expected digest, and `src/loader.ts` checks it before the verifier scores the dataset. A matching digest establishes equality to these published bytes.

The audit is attributed to ProvablyFair.org. Authorship, capture origin, the one-account scope, and the historical capture method are auditor-attested. The bet rows contain no account identity field, and the package does not include authenticated raw request/response transcripts or an independently authenticated capture-time receipt. The records support internal recomputation and integrity checks; those checks do not independently authenticate their real-world origin.

`capture/capture-mines.reference.mjs` documents the capture flow, seed lifecycle, response shape, and phase design. It is a sanitized reference with authentication and transport removed, and throws if executed. The captured responses can be rechecked offline; reproducing the network capture requires a separate authenticated capture implementation.

### Recorded and calculated fields

| Field group | Source and use |
|---|---|
| `mineTiles`, `openTiles`, `winningAmount`, `multiplier`, `result`, `betAmount` | Recorded response fields; primary inputs to outcome and settlement verification |
| `clientSeed`, `nonce`, `hashedServerSeed`, `serverSeedId` | Recorded bet inputs and seed references |
| Seed-row `serverSeed`, `hashedServerSeed`, `nextHashedServerSeed` | Recorded seed reveals and commitments |
| `currentGameSettings` | Recorded settings serialized as a JSON string; these describe settings, not observed enforcement of every limit |
| `localMines`, `verified`, `commitVerified`, `chainLinkOk` | Capture-side calculations; the verifier performs its own checks |
| `epoch`, `phase`, `at`, `nonceStart`, `nonceEnd`, `meta` bookkeeping | Capture-side organization and chronology |

A bet joins to its revealed server seed through `hashedServerSeed` in `seeds[]`. `mineTiles` preserves draw order. `openTiles` preserves the actual reveal order; its length is the completed reveal depth. The `reveals` field is the requested depth and can be larger when a round hits a mine early.

`betAmount` appears as a JSON number on wins and a decimal string on losses. Verification normalizes both representations. Settlement checks use exact rational arithmetic and the recorded eight-decimal settlement precision.

### Nonce coverage

The nonce checks establish uniqueness and completeness within each recorded epoch window, nonces 0 through 49. The bounds come from the capture's seed records. They establish internal completeness against those records, without establishing the existence or absence of activity outside the recorded windows.

## Outcome algorithm

The board has 25 tiles numbered 1 through 25. A legal mine count `m` is an integer from 1 through 24.

### Commitment

The commitment is:

```text
SHA256(UTF8(serverSeedHexString))
```

The hash input is the text representation of the hexadecimal seed. By contrast, the HMAC key used for mine placement is the hex-decoded seed bytes. This distinction is implemented by `commitHash` and `generateProvablyFairNumber` in `src/rng.ts`.

The dataset verifies **138 of 138** revealed-seed commitments and **137 of 137** next-seed links. The recorded pre-capture state provides the link into the first captured epoch. These checks establish consistency of the recorded commitments, reveals, and chain.

### Random integers and shuffle

For a given server seed, client seed, nonce, cursor, and range:

1. Decode the server seed's hex string into the HMAC key bytes.
2. Form the UTF-8 message `clientSeed:nonce:cursor`, with nonce and cursor written as decimal integers.
3. Compute HMAC-SHA256 and read successive four-byte chunks as unsigned big-endian integers.
4. Set `maxFair = floor(2^32 / range) × range`. Accept the first chunk below `maxFair` and return `chunk % range`.
5. If all eight chunks are rejected, repeat with `cursor + 1,000,000`.

Initialize the ordered tile list `[1, 2, ..., 25]`. For cursor `i` from 0 through 24, draw an integer in `[0, 25-i)`, add `i`, and swap that position with position `i`. The first `m` tiles in the resulting list are the mines, in draw order.

This is the implemented sequential Fisher–Yates construction. With independent uniform accepted draws, it gives the uniform layout model used in the probability calculation. All 6,900 captured layouts match this implementation. The capture contains **zero modulo-rejection events in 172,500 draws**; it therefore does not independently witness the operator's rare rejection or retry branches. The reconstruction's rejection behavior is covered by a dedicated unit-test vector.

### Outcomes and client seeds

For fixed seed inputs, nonce, and mine count, the reconstructed layout is fixed. Player-selected reveal positions are not inputs to `revealMines`. The verifier checks the recorded opened tiles against the recomputed layout, including that a losing round stops on its final opened mine.

The custom-seed phase records **500 bets using ten distinct player-supplied seeds**, all of which recompute. A whole-dataset control using `wrong-client-seed-test` reproduces only **9 of 6,900** layouts: **6,891 change, or 99.87%**. An empty client seed reproduces **7 of 6,900** layouts. These are measured controls for this dataset, not universal probabilities for arbitrary seed replacements.

The capture reference specifies random client seeds for 128 epochs and timestamp-derived custom seeds for the ten Phase-D epochs. The latter demonstrate input participation and are consistent with the auditor's account of player control, but do not establish unpredictability. A player-selected seed can still be predictable. Mitigation against selecting a server seed for a known client input requires the operator to commit before learning an unpredictable client seed, together with the commitment and input remaining bound to the round. Client-seed participation alone does not establish that sequence.

The production plan records the applicable server commitment before generating a fresh cryptographically random client seed in every phase, then retains the seed acknowledgement, bet inputs, and eventual server-seed reveal. This supplies stronger evidence for the sequence in the sampled sessions.

### Stake and reveal coverage

All **200 Phase-C bets at $10**, at mine count 3, reproduce through the same wager-free function as the $0.10 sample. Step 18 tests this layout parity. It does not compare an identical server-seed, client-seed, nonce, and mine-count tuple under different stakes. The supported finding is agreement with the wager-free reference at both sampled stakes, without a causal conclusion about all backend stake behavior.

Step 21 checks layout parity in the **400 Phase-E bets**, covering **107 distinct opened-tile sets** and all **25 first-pick positions**. Reveal positions are absent from the reference function's inputs. These observations establish agreement across the recorded reveal choices; they are not a statistical proof of every form of reveal-position independence in the backend.

## Payouts and analytical RTP

### Reference formula

Let `m` be the mine count and `k` the number of safe tiles revealed before settlement. Legal winning configurations satisfy `1 ≤ m ≤ 24` and `1 ≤ k ≤ 25-m`, giving **300 configurations**.

For uniform mine placement:

```text
P(win at depth k) = C(25-m, k) / C(25, k)
                 = product over i=0..k-1 of (25-m-i)/(25-i)

exactMultiplier  = (99/100) × product over i=0..k-1 of (25-i)/(25-m-i)

theoreticalRTP   = P(win) × exactMultiplier
                 = 99/100
```

Each factor cancels, establishing **99.0000% theoretical RTP** and a **1.00% theoretical house edge** across the entire legal grid. This identity concerns the uncapped reference formula before settlement rounding. It does not establish cap enforcement or operator-side settlement at configurations absent from the capture.

`src/config.ts` provides the probability, multiplier, and exact-rational helpers. `tests/steps/anti-circularity.ts` checks independent probability formulations and integer enumeration controls. The unit tests sweep all 300 display-multiplier configurations in exact arithmetic. `outputs/audit-figures.json` contains the derived reference grid.

### Settlement and display

The captured winning settlements follow:

```text
winningAmount = floor(stake × exactMultiplier × 10^8) / 10^8
displayMultiplier = floor(exactMultiplier × 100) / 100
```

All **3,104 wins** match the eight-decimal settlement identity; all **3,796 losses** report zero payout. Winning settlements cover **25 configurations**: `(m,1)` for all 24 mine counts and `(3,5)`. These checks concern the response's `winningAmount`; wallet movements were not recorded.

The displayed multiplier is separate from the settlement calculation. For example, at `m=3, k=1`, the exact multiplier is `9/8 = 1.125`, the displayed multiplier is `1.12`, and a $0.10 winning stake reports `0.11250000`.

The eight-decimal floor can reduce expected return slightly below the 99% theoretical identity. At each captured stake, 149 of the 300 formula configurations discard no fraction, and 151 do. Under the uncapped model, the lowest settled RTP across the grid is **98.9999934% at $0.10**, and **98.999999928% at $10.00**. These figures are derived in `outputs/audit-figures.json → settlementFloor`.

### Payout limits

Recorded settings include `maxOdds = 10000`. The reference grid contains 44 configurations whose uncapped multiplier exceeds 10,000×. No captured winning round approaches that boundary: the largest winning multiplier is 24.75×.

Whether the setting caps payment, restricts placement or reveals, or serves another purpose is outside the observed settlement evidence. Payout-limit enforcement remains excluded. The production audit will investigate behavior exposed through the player-facing interface and will retain the exclusion for any boundary it cannot observe.

## Statistical analysis

### Pass 1 independent implementation

`outputs/simulation-results.json → pass1_fresh_seeds` records **24 configurations × 1,000,000 rounds = 24,000,000 rounds**. Every row stores its server and client seeds. The simulation evaluates the auditor's implementation; its connection to the captured game is established by the separate outcome-recomputation checks.

| Scored statistical check | Coverage | Published result at the declared threshold |
|---|---|---|
| First-drawn tile uniformity | 24 mine counts | 0 rejections |
| Pairwise mine co-occurrence | 23 applicable mine counts; 300 tile pairs per configuration | 0 rejections |
| First-drawn tile serial checks | 24 mine counts; lag-one correlation and runs | 0 rejections |

The declared per-configuration Bonferroni level is `0.01/24`, approximately `0.000416667`. Pairwise testing also adjusts across the 300 pairs within a configuration. First-draw and runs diagnostics include the stated lower-tail support screens. The published artifact contains one unadjusted serial flag and none at the scored adjusted threshold.

For a tile pair, the uniform independent-round model gives `X ~ Binomial(N,q)`, where `q = m(m-1)/(25×24)`. The standardized count is `Z = (X-Nq)/sqrt(Nq(1-q))`. The test uses a normal approximation, equivalently a chi-square approximation for `Z²`; this is not an exact finite-sample distribution. A finite binomial count has discrete support, whereas a chi-square variable is continuous. The reported passing result is relative to the implemented approximate thresholds.

Mean simulated RTP is **98.94271044%**, approximately **1.66 modeled standard errors below 99.0000%**, consistent with the stated sampling-variance model. It is the unweighted mean of the 24 per-configuration RTP estimates, each based on one million rounds.

These results establish that the specified finite tests passed. The serial tests consume the first drawn tile, not the entire layout across time. They do not establish the absence of every form of dependence or bias. The production analysis plan adds prespecified tile-occupancy indicators to broaden serial coverage.

The recorded sample's observed RTP is **99.5361%** across the 6,900 bets. It is reported as descriptive sample information, not as an independent proof of the theoretical RTP.

The unconditional lag-one correlation of the captured win/loss sequence is **0.35481357**. The capture groups bets by configuration, whose win probabilities differ, so this statistic mixes configuration effects with any within-configuration dependence. The current calculation does not separate those effects or establish their relative contributions. Pass 1 tests the reference generator; it does not establish the cause of the captured win/loss correlation.

### Pass 2 captured server seeds

Pass 2 evaluates each of the **138 revealed server seeds** over **10,000 nonces**: an early window of 0–49 and a late window of 50–9,999. Nonces beyond the captured window are locally generated extensions, not additional observed bets.

The statistic uses the first-drawn tile histogram. `chiSquaredTest` in `src/stats.ts` pools low-expected-count cells inward from the two ends. At 50 draws, the resulting expected vector is `[6, 2×19, 6]`, giving a 21-cell statistic with 20 degrees of freedom. Interior cells are not pooled. The same statistic is applied to the bootstrap replicates. The late window retains all 25 cells, with expected count 398 per cell.

The published analysis uses **10,000 bootstrap replicates for each of 24 mine counts**: **240,000 statistics**, generated from **12,000,000 first draws**. A seed is flagged when its early bootstrap p-value is below 0.05 and its late-window p-value is at least 0.05. Recalculation gives **4 flagged seeds**, against **6.555** under the stated nominal flag model; the binomial survival probability is **0.89757317**. **Step 17 passes.** The four seed flags feed that aggregate diagnostic and are not four failed audit steps.

**Complete bootstrap replay:** Step 17 derives every bootstrap server/client seed pair from the published master seed and reconstructs the null and all **138 early p-values**. The independent Python replay also reproduces every retained bootstrap statistic exactly. Both implementations give zero early-p-value mismatches. Partial, malformed, unsupported, or removed replay metadata fails verification for this published analysis.

The deterministic derivation in `src/rng.ts` is:

```text
version = mines-seed-derivation-v1
masterSeed = 7461a9c2b511fac35b9b73eef4deb2ea7fca228ed231fb721f6da4e065d68b63
seed(domain, replicate) = first 16 bytes of
  HMAC-SHA256(hexDecode(masterSeed), UTF8(version + ':' + domain + ':' + replicate))
server domain = pass2-bootstrap-server:m=<mineCount>
client domain = pass2-bootstrap-client:m=<mineCount>
replicate = 0..9999
```

Each derived client seed is used as its lowercase hexadecimal text. Each replicate generates first-drawn tiles for nonces 0–49. Its statistic uses the same pooling and arithmetic order as the observed statistic. For the sorted null, `earlyBootstrapP = (count(nullStatistic >= observedStatistic) + 1) / 10001`. The add-one rule includes equal statistics in the upper tail.

`outputs/simulation-provenance.json` identifies the inputs, parameters, hashes, and replay commands. `outputs/bootstrap-nulls.float64le` retains 10,000 sorted 64-bit floating-point statistics per mine count in little-endian order, with mine counts ordered 1–24. `outputs/bootstrap-replay-report.json` records the independent execution. The master seed is scoped to **Pass 2**; **Pass 1** replays from the seed pairs in its own rows. These are separate recorded analyses within the published audit.

The flagged epochs are **23, 71, 93, and 98**. Their early p-values are respectively **0.0068993101**, **0.0442955704**, **0.0367963204**, and **0.0014998500**. Epoch 28 is near the 0.05 threshold at **0.0500949905**. Finite bootstrap sampling can move a borderline case across a threshold in a different experiment; retaining the inputs makes the published result exactly reproducible. The flag-count model `Binomial(138, 0.05 × 0.95)` is nominal, not a calibrated proof of unbiased server-seed selection.

### Statistical interpretation

The implementation defines the test thresholds and multiple-test treatment. The approximately **6.968%** sum in `audit-figures.json → falseAlarmAccounting` is the sum of nominal levels across the enumerated screens. It is not a calibrated false-alarm rate or a guaranteed upper bound on the combined rate. `src/false-alarm.ts` provides the accounting and the exact or bounded comparisons available for individual screens.

A statistical threshold crossing and an evidence mismatch require different interpretation. Retain the inputs and results of new experiments, including flagged runs. Deterministic discrepancies in layouts, hashes, payouts, or replayed values require investigation; additional experiments do not erase them.

## Worked verification examples

The following six bets span a loss, ordinary wins, the 24-mine boundary, the $10 stake, a custom client seed, and a five-reveal win. Their layouts, commitments, outcomes, and settlement amounts reproduce from the listed inputs.

### Seed inputs

| Seed label | Revealed server seed | Client seed |
|---|---|---|
| A | `8b2fc7e909d2fff439692f648a9df0ba` | `audit59c2b0bf86aa` |
| B | `1973480c6bf1a4e3b62f7f8eb3f663d5` | `audite90633066c80` |
| C | `aa25dc6c599ec12f86008226ed60cb11` | `audit7a476e8c79bf` |
| D | `9663646e4e6bf958437a824814c13344` | `pfaudit-1785428583504-120` |
| E | `496d591eb92568a9503f57bc9014981f` | `auditd0b517fc7d4c` |

Hashing the UTF-8 server-seed strings gives the recorded commitments:

```text
A  5d6c4f105f182f9798063a4ca29d2c4ad2c575449bc5742a9680ec31bd9d79a0
B  11fd2784b14c9a55a020ef5c59327e032b216e8cdea4216b1759661e87d400dd
C  66c283a045f5fa95fe2f4a8102d8f59877c067aef045be210e9d59596b1bbd22
D  864adaa06aecc6da498831494b2d4627f998f673c71cfafce56fdec796d340e6
E  4a12622993f10a7c8f1747dbc01d358a965325698e14828aed0d9794f60d79a3
```

### Outcomes and settlements

| Bet ID | Seed | Nonce | Mines | Opened tiles | Result and reported payout |
|---|---|---:|---:|---|---|
| `ZQRg9gBkK1tWFve_aBoy3` | A | 0 | 3 | `[2]` | Loss; `0.00000000` on a $0.10 stake |
| `GbqOuPvhQekqcARNtHZ3_` | A | 25 | 3 | `[2]` | Win; `0.11250000` on a $0.10 stake |
| `TCa1TgVPdjTmWhlP1tPH0` | B | 10 | 24 | `[12]` | Win; `2.47500000` on a $0.10 stake |
| `zV2W_lviablGhLozxmRdo` | C | 0 | 3 | `[2]` | Win; `11.25000000` on a $10.00 stake |
| `iBuGmbTb6MMhfP3VN5cMm` | D | 0 | 1 | `[2]` | Win; `0.10312500` on a $0.10 stake |
| `BLw3EsK-uZ_X0x_xPEHKb` | E | 3 | 3 | `[5,6,7,8,9]` | Win; `0.19973684` on a $0.10 stake |

The corresponding recomputed mine lists, equal to the recorded lists in draw order, are:

```text
ZQRg9gBkK1tWFve_aBoy3   [16,10,2]
GbqOuPvhQekqcARNtHZ3_   [6,20,7]
TCa1TgVPdjTmWhlP1tPH0   [11,13,4,3,16,23,18,10,21,17,2,22,5,24,15,6,14,20,8,9,25,19,7,1]
zV2W_lviablGhLozxmRdo   [21,18,14]
iBuGmbTb6MMhfP3VN5cMm   [3]
BLw3EsK-uZ_X0x_xPEHKb   [3,15,22]
```

For bet `GbqOuPvhQekqcARNtHZ3_`, the first HMAC message is `audit59c2b0bf86aa:25:0`. With seed A decoded as hex bytes, the digest is:

```text
c9868d2c53d8031cc5718fa68613ac548d4c37fb5c296654abc9782f640be138
```

Its first four bytes are `3381038380`, below `maxFair = 4294967275` for range 25. The remainder is 5, so the first swap puts tile 6 in the first mine position. Continuing the shuffle yields `[6,20,7]` for the three mines. Opened tile 2 is safe. The probability is `22/25`, the exact multiplier is `(99/100) × (25/22) = 9/8`, and the payout is `floor8(0.10 × 9/8) = 0.11250000`.

For the five-reveal example, the exact multiplier is `759/380`; `floor8(0.10 × 759/380) = 0.19973684`. Each opened tile is outside `[3,15,22]`.

## Claim and evidence map

| Finding | Primary artifact or implementation | Verification route |
|---|---|---|
| Recorded game identifier, dates, phases, stakes, and population | Dataset `meta`, `bets[]`, `seeds[]`; `src/pins.ts` | Dataset inspection; Steps 9, 11–12; real-world origin remains auditor-attested |
| Dataset digest | Dataset bytes; `EXPECTED_DATASET_HASH`; `src/loader.ts` | SHA-256 before scoring |
| 138 commitments and 137 next-seed links | Dataset `seeds[]`; `commitHash` | Steps 1–3 |
| Recorded nonce uniqueness and complete epoch windows | Dataset nonces and recorded windows | Step 4 |
| 6,900 matching layouts and client-seed controls | Dataset inputs and `mineTiles`; `src/rng.ts` | Steps 5–6 |
| Display and settlement amounts | `multiplier`, `winningAmount`, `openTiles`; `src/config.ts` | Steps 7–8; exact settlement identity |
| Analytical 99% RTP and the 300-cell grid | `src/config.ts`; `referenceGrid`, `referenceGridSummary`, `settlementFloor` in `audit-figures.json` | Step 10, Step 13, unit rational sweeps, and direct combinatorial derivation |
| Custom seeds and multi-reveal outcomes | Dataset phases D and E | Steps 14–15 |
| Pass-1 counts, statistics, and mean RTP | `simulation-results.json → pass1_fresh_seeds` | Step 16 checks; full statistics through `deep-replay` |
| Retained Pass-1 replay report: 24 million rounds, zero differences | `outputs/deep-replay-report.json` | File inspection verifies what is recorded; `npm run deep-replay` independently recomputes the experiment |
| Pass-2 early/late statistics, all bootstrap p-values, and four flagged seeds | Dataset seeds, `simulation-results.json → pass2_casino_seeds`, recorded master seed and derivation | Step 17; independent `bootstrap-replay` |
| Independent bootstrap replay: 240,000 statistics and 138 p-values, zero mismatches | `outputs/bootstrap-replay-report.json`; `bootstrap-nulls.float64le`; `simulation-provenance.json` | `npm run bootstrap-replay` regenerates and compares all values |
| Layout parity at both captured stakes; wager-free reference function | RNG function signature and phase comparisons | Steps 5 and 18; no paired-stake causal test |
| Derived-figure consistency | `src/figures.ts`; `outputs/audit-figures.json` | Step 19 |
| Opened-tile outcome consistency | `openTiles`, `mineTiles`, result labels | Step 20 |
| Layout parity across the captured reveal positions | Phase-E `openTiles` and recomputed layouts | Step 21 |
| Capture-reference classification | `capture/capture-mines.reference.mjs` | Static inspection of the reference and its disabled transport |
| Published 21-check verdict | `outputs/verification-results.json → summary` | `npm test`, `node verify.js`, or `npm run verify` |
| Unit and adversarial coverage | `tests/mines/`, fixture files, mutation and forgery registries | Commands below |

Stored reports identify the published results. Running the relevant command supplies a new verification result for its stated coverage. Fields named `layoutR1` and `layoutRuns*` contain first-drawn-tile serial statistics. The Step-18 label “Bet-Size Invariance” and Step-21 label “Reveal-Position Independence” identify the sample-parity checks defined above.

## Reproduction and test coverage

### Default verification

From the repository root, with Node.js and npm installed:

```sh
npm test
```

`package.json` defines this as `node test.js && node verify.js`. The first command runs **45 bundled unit tests**; the second runs the **21 scored verification checks**. Both bundled files use Node's built-in modules and can run without installing project dependencies. `node verify.js` alone runs the scored checks.

Default verification writes `outputs/run/verification-results.json`, `outputs/run/audit-figures.json`, and `outputs/run/diff.json`. The comparison excludes generated timestamps and preserves committed evidence. A hard failure returns nonzero. A conditional result with flags returns zero, so the reported status and counts remain part of the result.

The passing published result is **21 PASS, 0 FLAG, 0 FAIL**. The unit suite reports **45 passed**; cancellations or skipped cases are not a substitute for that count.

The verifier's “Full Pass” status denotes those 21 checks under their implemented acceptance rules. Pass 2 fully reconstructs the bootstrap and verifies every early p-value. Full Pass-1 replay is a separate command. These checks support the published QA finding; extending certification to production requires the anonymous production capture.

### Source tools and full simulation replay

Install the versions recorded in `package-lock.json` with `npm ci`. The lockfile lists Mocha 11.7.6, ts-node 10.9.2, TypeScript 5.9.3, `@types/node` 22.20.1, and `@types/mocha` 10.0.10.

| Command | Work performed | Output behavior |
|---|---|---|
| `npm run build` | Compile and bundle the verifier and unit suite from source | Replaces `verify.js` and `test.js` |
| `npm run build:check` | Compile in memory and compare the bundles byte for byte | Read-only; exits nonzero if a bundle differs |
| `npm exec -- mocha` | All 45 source unit tests | Does not replace published artifacts |
| `npm run verify` | Source version of the scored verifier | Writes under `outputs/run/` by default |
| `npm run deep-replay` | All 24 × 1,000,000 published Pass-1 rounds, every retained deep statistic, and convergence counts | Read-only; optional report destination |
| `npm run bootstrap-replay` | Independent Python reconstruction of all 240,000 Pass-2 null statistics and all 138 seed rows | Preserves published evidence; writes `outputs/run/bootstrap-replay-report.json`; requires Python 3.9+ but no dependency installation |
| `npm run simulate` | A new Pass-1 and Pass-2 experiment, with recorded seed derivation | Replaces simulation results, provenance, bootstrap null, and the convergence chart |
| `npm run figures` | Regenerate derived figures | Replaces `audit-figures.json` |
| `npm run report` | Explicitly regenerate verification results and, if Step 19 passes, figures | Replaces the corresponding published reports |
| `npm run mutations` | Source mutation battery | Uses disposable copies |
| `npm run forgeries` | Dataset and artifact forgery battery | Uses disposable copies |
| `npm run test:toolchain` | Source unit tests, a new simulation, figures, verification, mutations, and forgeries | Replaces simulation and figure artifacts; verification writes to `outputs/run/` |

For a partial Pass-1 replay, use `npm run deep-replay -- --configs=1,7`. A partial replay covers only those configurations. `--out=<path>` records a replay report. The retained full replay report records **24 rows, 24,000,000 rounds, and zero differences**, with scope `full`; its SHA-256 is:

```text
ce0b055b28ddfc7424e93a943f5891f00e476eb02094bb50e77b939271ee8d9f
```

Normal verification redraws the first 1,000-round checkpoint per Pass-1 configuration and checks deeper summaries for consistency. Full deep replay recomputes those deeper summaries from each row's stored seeds. Neither `npm test` nor `test:toolchain` includes that full replay automatically.

Use `npm run bootstrap-replay` to independently repeat the published Pass-2 calculation without generating a new Pass 1. The replay implements the HMAC and histogram calculations in Python without importing the TypeScript source, compares every sorted null value, and checks all early p-values and seed statistics. It evaluates late p-values with the finite chi-square survival formula for 24 degrees of freedom; the recorded maximum numerical difference is below `1e-12`. The report identifies the exact dataset and simulation hashes it checked. `--out=<path>` selects a separate report destination; published inputs and reports are protected against overwrite.

Use a separate working copy for `npm run simulate`, which creates a new experiment for both passes. `SIM_MASTER_SEED` repeats that new experiment with the same parameters. It does not reconstruct the published Pass-1 seed selection from the published Pass-2 master seed. Retain all inputs, results, and the source version for each new experiment. The convergence chart requires access to its Chart.js CDN when rendered.

The standalone JavaScript files are compiled snapshots, not a second independent verifier. Source edits must be tested with the source commands; changing a TypeScript file does not change the bundled JavaScript automatically. Run `npm run build` after source changes, then `npm run build:check`, the source tests, and `npm test`. The build tooling is included under `scripts/` and uses the locked TypeScript compiler; generated bundles contain no build timestamp.

### Tests that reject incorrect evidence

The source suite contains seven tests in `rngTests.ts` and 38 in `qaRegressionTests.ts`. Coverage includes captured layout vectors, commitment hashing, exact and displayed multipliers, the first-draw fast path, integer-supported simulation outcomes, rational payout sweeps, seed derivation, bootstrap artifact validation, and statistical-accounting controls.

The fast-path comparison on vector A checks **200 `(nonce, mineCount)` pairs**: nonces 0–199 with `mineCount = (nonce % 24) + 1`. Each mine count receives eight or nine cases. The vector-B comparison checks another **200 nonces at mine count 24**. The vector-A loop is not a 200-by-24 sweep.

A direct falsifiability check is available in `tests/mines/rngTests.ts`: the expected exact multiplier at `(m=3,k=1)` is `1.125`. In a disposable copy, change that expected value to `1.126` and run `npm exec -- mocha`. The payout assertion fails. Applying the corresponding expectation change to the bundled test fixture makes `npm test` fail in its unit-test stage. This exercises a payout assertion independently of the dataset hash check.

For input integrity, changing a byte in the master dataset without updating the pin must stop verification. Semantic mutation and forgery tests operate in disposable copies and specify the individual check expected to reject the change.

| Adversarial registry | Declared cases | Interpretation |
|---|---:|---|
| `tests/mutations.json` | 21 | Required source-mutation detections |
| `tests/survivors.json` | 12 | Documented source mutations not required to fail on the published honest inputs |
| `tests/forgeries.ts`, `FORGERIES` | 50 | Required dataset or artifact rejections |
| `tests/forgeries.ts`, `SURVIVORS` | 1 | A self-consistent forged deep Pass-1 summary that ordinary verification accepts and full deep replay rejects |

These are registry counts. Run the corresponding batteries for their execution results. The declared survivors define test coverage; they are not additional passing probes. Weakening a guard can leave honest input passing, which is why source mutations are paired with forged-input cases. The source and fixture definitions remain available for independent inspection.

## Exclusions and evidence boundaries

Infrastructure and server security, custody, payment processing, account-system security, and promotional or loyalty programs are outside this audit. Payout checks cover the game-settlement response, not independent wallet reconciliation. Limit enforcement, interactive cash-out, and mid-round rotation are outside the captured paths.

The uniform-draw model supports the analytical RTP proof. Statistical tests and sample recomputation provide the stated checks of the reconstruction and observed responses; they do not establish every possible backend behavior. In particular, the rare RNG rejection branch was not witnessed in the captured responses, and serial tests do not cover all forms of whole-layout dependence.

The dataset's recorded windows support internal completeness checks. A player-side capture cannot establish that the operator never generated or suppressed activity invisible to that client, nor that every future account or deployment behaves identically. Capture provenance remains auditor-attested. These are boundaries of the evidence, not observed operator faults.

Both statistical passes retain their replay inputs. Bootstrap reproducibility is verified in this release and is not an outstanding production prerequisite.

## Anonymous production verification

### Purpose and access

The next audit stage will use anonymous ordinary-player access to the public production site and its player-facing APIs. No backend source, privileged ledger access, or controlled operator settlement environment is assumed.

The production stage will repeat outcome reconstruction, commitment checks, settlement arithmetic, and evidence-integrity checks against a new capture. It will also evaluate the following upgrades. The production report will identify each item as verified, partially covered, unavailable through player-facing access, or discrepant.

| Current boundary | Planned production work | Evidence required to close or narrow it |
|---|---|---|
| QA-only environment | Capture public production sessions, with environment, dates, settings, exposed build identifiers, and raw game responses | Matching outcomes, commitments, and settlement calculations for the production sample; the resulting scope identifies the observed sessions and settings |
| Settlement-response amounts without wallet reconciliation | Capture balances before stake debit and after completed settlement; obtain player-accessible transaction history where available | Bet-linked stake, payout, and refund entries with no unexplained balance differences; if precision or history is insufficient, retain the qualification |
| Atomic auto-bet coverage | Exercise supported interactive reveal and cash-out paths, reconnects, retries, and seed rotation during an active round | Recorded state transitions with consistent commitments, nonce use, outcomes, and settlement; no unexplained duplicate debit or credit |
| Limited winning-payout configurations | Extend the legal mine-count, reveal-depth, and stake matrix | A published matrix separating attempted configurations, winning settlements, and formula-only coverage; rare configurations remain unobserved until witnessed |
| Unobserved payout-limit enforcement | Record public settings and test accessible placement and reveal boundaries; examine relevant winning settlements if observed | An observed enforcement path supports a finding for that path; settings labels or accepted placement alone do not prove a capped winning payout |
| Client-seed unpredictability and chronology | Generate fresh cryptographically random client seeds in every phase after recording the applicable server commitment; retain acknowledgements and eventual reveals | Evidence of the commitment-before-client-seed sequence and consistent bet inputs throughout the sampled epochs |
| Capture provenance and unsuccessful attempts | Preserve raw request/response records securely, separate calculated fields, record errors and retries, retain capture-time hash records, and reconcile with player-visible history | An auditable record of the captured session, including unsuccessful attempts; independently witnessed origin and invisible server activity remain separate questions |
| Reproducible production analysis | Apply the same complete input-retention and replay procedures to the production dataset and simulations; retain all runs | Reconstruct the production bootstrap null and p-values and fully replay production Pass-1 statistics; retain the resulting reports |
| First-drawn-tile serial coverage and mixed-configuration correlation | Prespecify within-configuration or configuration-adjusted checks of captured rounds, plus tile-occupancy indicators and appropriate multiple-test treatment | Report the statistic, null model, sample size, thresholds, and sensitivity for each check; distinguish captured-round evidence from reference simulation |

### Production acceptance

The capture plan, evaluated configurations, and statistical thresholds will be specified before the main run. A pilot will confirm that the capture records the fields needed for outcome, payout, balance, and request-history reconciliation. Evidence is retained for unsuccessful requests and flagged analyses as well as successful rounds.

Certification can be extended to production only after the anonymous capture and its analysis support the production findings and material discrepancies have been resolved or reflected in the conclusion. The production report must publish the dataset identity, observed coverage, passing and non-passing results, and the remaining exclusions. Completing a capture does not by itself establish a passing result.

Player-facing access may leave cap settlement, rare internal RNG branches, and invisible server behavior unobserved. Those boundaries remain explicit where they cannot be closed. Infrastructure, custody, and broader platform security remain outside the Mines game-fairness certification.
