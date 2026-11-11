# LIQD Mines — Consolidated Audit Overview

**Audit ID:** `PF-2026-LQ02` · **Auditor:** ProvablyFair.org · **Release:** `v1.1.0` · **Framework:** 1.1 · **Game:** Mines (`gameId` `fast-games-13`), LIQD.com · **Captured against:** `liqd.com` (production, logged-in browser session) · **Booked in:** CAD (8–9 November 2026) and USD (10 November 2026), the account's display currency on each day; wallet currency USDT · **Report:** `https://audit.provablyfair.org/casino/liqd/games/mines/overview`

**Scored steps:** 22 · **Unit tests:** **43 passing** (the zero-install runner fails unless exactly `EXPECTED_UNIT_TESTS` = 43 pass)

Scored on **three production captures**: 6,574 rounds played on `liqd.com` from one account between **2026-11-08 22:36:21 UTC** and **2026-11-10 10:24:11 UTC**, with LIQD's own verifier queried for every round. Every count, example and figure in this document comes from those captures. The machine-readable release identity is [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json).

## Conclusion and scope

**PROVABLY FAIR — Full Pass.** 22 scored steps: 22 PASS, 0 FLAGs, 0 hard fails. `npm test` exits 0.

On the 6,574 production rounds, recomputation with the audit's own module matches all **6,574 recorded mine layouts** in draw order, all **36 revealed seed commitments**, the **33 links** between successive commitments inside each capture plus each capture's link from the seed pair active before it, every one of the **19,498 reveal replies**, every **booked amount** and every **USDT wallet field** under LIQD's measured rule. What is verified about money is the amounts LIQD reported in its replies; no balance was read (DL-5).

**Return to player.** Exactly **99%** on the game's formula at every setting (all 300 legal (mine count, depth) cells; production played 40 of them, at all 24 mine counts), and **99.0000%** on the wallet field in the reply. The booked figure is cut to the cent, which costs up to **7 points** at a 0.10 stake (a booked return of 92.0000% at the worst setting, (1, 2)). No balance was read (DL-5). LIQD's own account bet history records the wallet field in the reply as the payout on 2,691 of 2,691 wins (1,979 on the CAD run, 712 on the USD runs, including 2.47500000 on each of the 3 rounds LIQD settled by itself, booked 2.47) and charges each bet as the USDT equivalent of its fiat stake (0.07084688–0.07096596 USDT for 0.10 CAD, never 0.1; 0.10000000 and 10.00000000 for the USD stakes), so the 99% on the wallet field is what LIQD's account ledger shows (E24, E25); the history is LIQD's ledger, not a balance read.

**What was played.**

| Capture | When (UTC) | Phase | Rounds | Stake, booked in | Epochs | What |
|---|---|---|---:|---|---|---|
| 1 | 8 Nov 22:36 – 9 Nov 03:20 | A | 5,000 | 0.10 CAD | 25 × 200 | 5 mine counts (1, 3, 5, 8, 12) × 4 depths × 250, several tiles opened on every round |
| 2 | 10 Nov 04:40 – 05:42 | D | 500 | 0.10 USD | 5 × 100 | the same 20 settings × 25, under 5 client seeds set by the player |
| 2 | (same run) | A (top-up, id `A+`) | 950 | 0.10 USD | 5 × 190 | the 19 mine counts capture 1 did not play × 50, one tile opened |
| 3 | 10 Nov 10:19 – 10:24 | C | 124 | 10.00 USD | 1 × 124 | 3 mines, one tile opened, at 100 times the stake |

There is no separate multi-reveal phase: phase A is multi-reveal on every round, phase D replays its settings, and the multi-reveal checks are scored on those 5,500 rounds (Step 15).

**Stakes and currency, as booked.** LIQD's place-bet takes the stake in the account's display fiat and books the round in it. Capture 1 was booked in CAD. The account's display fiat was changed to USD on 9 November 2026 and captures 2 and 3 were booked in USD. The wallet fields of each reply (`betAmountWallet`, `winningAmountWallet`) are in USDT throughout. Nothing is converted or relabelled: each amount is checked in the currency LIQD recorded it in, and totals are never summed across currencies.

**Three production behaviours, disclosed.** Each is measured, bound to the data by a scored step, and stated with what it means for the player's money.

1. **The booked win is cut to the cent; the wallet field in the reply keeps 8 decimals** (Steps 8 and 22, DL-17). A win is booked as `floor2(stake × exact multiplier)`, and the wallet field in the reply is `floor8(wallet stake × floor8(exact multiplier))`. Per capture:

   | Capture | Booked: staked → won (net) | Wallet fields (USDT): staked → won (net) | Wins booked below the unrounded amount | Dropped by the cent cut |
   |---|---|---|---:|---:|
   | 1 (CAD, 0.10) | 500.00 → 487.62 CAD (−12.38) | 354.52607511 → 353.95401893 (−0.57205618) | 1,979 of 1,979 | 11.56861635 CAD |
   | 2 (USD, 0.10) | 145.00 → 137.39 USD (−7.61) | 145.00000000 → 140.88221236 (−4.11778764) | 603 of 603 | 3.49221236 USD |
   | 3 (USD, 10.00) | 1,240.00 → 1,226.25 USD (−13.75) | 1,240.00000000 → 1,226.25000000 (−13.75000000) | 0 of 109 | 0 |

   On the USD captures the served rate is 1.00000000 and the wallet stake equals the booked stake, so the amount dropped is exactly the amount by which the wallet fields exceed the booked wins: 3.49221236 on capture 2, nothing on capture 3 (10.00 × 1.125 is a whole number of cents). On capture 1 the two totals are in different currencies and are shown side by side. **For the player: on a win at a 0.10 stake the booked fiat win is up to a cent below the wallet field in the reply. No balance was read; LIQD's account history records the wallet field as the payout on 2,691 of 2,691 wins (DL-5, E24, E25).**
2. **The wallet rule cuts the multiplier to 8 decimals before multiplying** (Step 22, DL-14). Against the exact product `floor8(wallet stake × exact multiplier)` the wallet field is the same on 2,629 of the 2,691 wins and **one 1e-8 USDT unit lower on 62**, all in capture 1, where the wallet stake is not a round number; 0.00000062 USDT in total; never higher. Every wallet field equals LIQD's own rule (2,691 of 2,691). Disclosed, not a deviation (ruling 2). **For the player: the wallet field of a win is at most 0.00000001 USDT below the exact product, never above.**
3. **A round that opens its last safe tile is settled by LIQD in the same reply** (Step 22, DL-18). On 3 rounds — the 3 wins of the 50 rounds at 24 mines, where one tile is safe — the reply to the open-tile request is the settled round (`autoFinish: true`, won at 24.75×) and no cash-out was sent. They are booked (2.47), with 2.47500000 in the wallet field, by the same rules. **For the player: on those rounds the reply settled the win without a cash-out step.** No other captured round reached its last safe tile.

**What the 22 steps are:** not 22 independent tests of what LIQD served. Steps 1, 2, 4, 5, 7, 8, 14, 15, 17, 18, 20, 21 and 22 test what LIQD served; Step 3 carries one arm that reads a served field (`serverSeedId`) and Step 10 one that reads the served settings. The other steps test the auditor's own mathematics and controls (6, 10's reference sweep, 13, 16), capture bookkeeping (9, 11, 12) or file integrity (19).

**What the audit excludes:** round payout-limit enforcement (`maxExposure`, labelled `game` in the operator's settings records). No captured round approached it (largest multiplier won 40.86×). The full exclusion list is in [Limitations and trust](#limitations-and-trust).

**Production scope.** One account on `liqd.com`, played by the auditor from a logged-in browser tab in three runs. Observational findings apply to the captured population; analytical findings apply to the stated reference model. The RNG module `src/rng.ts` was built from a written specification, [docs/ALGORITHM.md](docs/ALGORITHM.md), by an implementer who never opened LIQD's code; LIQD's code is run as a second check, not used as the source (its three private validation vectors, `tests/mines/rngTests.ts`). Operator backend source is not included.

### Rulings

Two rulings (11 November 2026). The full pass rests on both.

| # | Question | Ruling | Where |
|---|----------|--------|-------|
| 1 | **Which RTP statement is LIQD held to?** The Mines page, as published on 1 Oct 2026 (`evidence/rtp-page-labels-2026-10-01.json`), says *"99% RTP at every setting"* and shows RTP *"99% (99.03% after rounding)"*; the same page says *"Multipliers are rounded to two decimals rather than cut, so the realised edge moves a little with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%."* | **LIQD is held to the flat 99%**, which the wallet field meets (99.0000%, Step 10); RTP-CLAIM passes on 300/300 settings (`src/rtp-settings.ts` `RTP_CLAIM`). **The rounding sentence is recorded as a discrepancy, as published on 1 Oct 2026**: on production the displayed multiplier is cut, not rounded (Step 7), and the 0.64%–1.44% range matches neither rule (paying the 2-decimal multiplier would give an edge of 1.00%–1.72% cut, 0.56%–1.33% rounded, over the 300 cells; Step 10). | Step 10; `src/rtp-settings.ts`; [Published rounding statement](#payouts-and-rtp) |
| 2 | **Is a wallet field 0.00000001 below the exact product a FAIL or a FLAG?** (profile MINES-11's policy is HARD_FAIL with an exact comparison under a declared settlement rule) | **Neither: a floor at 1e-8 produced by the declared rule is disclosed, not a deviation**, so the Full Pass stands. This applies to every LIQD game whose rule rounds down to 8 decimals; the dice package treats its `floor8` payouts the same way. A wallet field below or above the DECLARED rule still FAILs (Step 22), and the 62 wallet fields one unit below the exact product are bound to the data: their count, cells and total must equal `src/pins.ts` `PROD_WALLET_BELOW_EXACT…` or Step 22 FAILs. | Steps 8 and 22; `src/pins.ts`; `src/profile-map.ts` (MINES-11); DL-14 |

## Contents

- [Dataset and capture](#dataset-and-capture)
- [Game and algorithm](#game-and-algorithm)
- [Payouts and RTP](#payouts-and-rtp)
- [Verification results](#verification-results)
- [Reproduce the audit](#reproduce-the-audit)
- [Verify a bet](#verify-a-bet)
- [Evidence](#evidence)
- [Limitations and trust](#limitations-and-trust)
- [Terms](#terms)
- [Release history](#release-history)

## Dataset and capture

The scored dataset records game `fast-games-13` on `liqd.com`. It contains **6,574 rounds** in **36 seed epochs**, all epoch server seeds revealed; **2,691 wins and 3,883 losses**; 5,500 multi-reveal rounds and 1,074 single-reveal rounds; 19,498 tiles opened.

| Plan (bound in `src/pins.ts`) | Value |
|---|---|
| Epochs | `PHASE_BLOCKS` / `EPOCH_PLAN`: capture 1, phase A, 25 epochs of 200 · capture 2, phase D, 5 of 100, then phase A top-up (`A+`), 5 of 190 · capture 3, phase C, 1 of 124. `EXPECTED_BETS` 6,574, `EXPECTED_SEEDS` 36, `EXPECTED_PHASE_BETS` { A: 5,950, C: 124, D: 500 }, `EXPECTED_PHASE_ID_BETS` { A: 5,000, A+: 950, C: 124, D: 500 } |
| Settings | `SETTINGS_PLAN`, 60 (phase, setting) pairs: phase A, **20 multi-reveal settings × 250** — mine count 1 at depths 2/5/10/15 · 3 at 2/4/6/8 · 5 at 2/3/5/6 · 8 at 2/3/4/5 · 12 at 2/3/4/5; phase D, the same 20 × 25; phase `A+`, mine counts 2, 4, 6, 7, 9, 10, 11 and 13–24 at one tile × 50; phase C, 3 mines at one tile × 124 |
| Order | Phases A and D: round *i* plays setting *i* mod 20. Phase `A+`: round *i* plays mine count *i* mod 19 |
| Tiles | Each round's opening order drawn by the runner with `crypto.getRandomValues` (Fisher–Yates over tiles 1–25) and written into the capture's plan before its first bet; the round opens the first `depth` of them and cashes out, or stops on a mine |
| Seeds | One pair per epoch. Phases A, `A+`, C: the client seed `"audit"` + 6 bytes of `crypto.getRandomValues` as hex. Phase D: five player-set seeds, `"pfaudit-prod-mines-d<k>-"` + 12 hex digits from the same generator (k = 1…5), written into the capture's meta before its anchor rotation. Every seed is submitted in the rotation that opens its epoch, after that epoch's commitment is active; every epoch is closed by a rotation that reveals its server seed |

Wins per multi-reveal setting, phases A and D together, each out of 275 (Step 15): (1,2) 248 · (1,5) 218 · (1,10) 170 · (1,15) 87 · (3,2) 217 · (3,4) 157 · (3,6) 119 · (3,8) 70 · (5,2) 173 · (5,3) 135 · (5,5) 90 · (5,6) 75 · (8,2) 117 · (8,3) 90 · (8,4) 54 · (8,5) 33 · (12,2) 62 · (12,3) 41 · (12,4) 15 · (12,5) 5. Phase `A+`: 406 wins of 950. Phase C: 109 wins of 124.

**Identity.** The scored dataset is [data/mines-prod-full-6574bets.json](data/mines-prod-full-6574bets.json), SHA-256 `4d684d5e035e0be384685a2b44b9f5ab13b3f638e58686310cd778945c31741b`. `src/pins.ts` defines the expected digest, and `loadDataset()` in `src/loader.ts` checks it at the top of `src/simulate.ts`, `src/write-figures.ts` and `tests/verify.ts`, before any work; a mismatch aborts. Each row carries its `phase`, `phaseId`, `capture`, `captureEpoch` and the `fiatCurrency` it was booked in; Step 11 checks those tags against the plan, Step 22 against the raw captures.

**The raw captures.** The dataset was converted in the private workshop from the three files the capture runner exported, which ship beside it byte-identical and pinned (`src/pins.ts` `PROD_CAPTURES`):

| Capture | File in `data/` | SHA-256 | Lines | Requests: place-bet / open-tile / cash-out |
|---|---|---|---:|---|
| 1 | `liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson` | `f4a35b0635fd8a196d31ebccd64fa3b617ab127716def789a0f1529b9ffe7d60` | 38,801 | 5,000 / 16,766 / 1,979 |
| 2 | `liqd-mines-prod-capture-2026-11-10T06-06-19-772Z.ndjson` | `3b8f81d5de58ccbf60fc809a53a34174d2c088aa78aba67ab1a0742a6d866141` | 9,038 | 1,450 / 2,608 / 600 |
| 3 | `liqd-mines-prod-capture-2026-11-10T10-27-49-259Z.ndjson` | `795825a548d786946d8ab0d9331dcd80d86a59b5b73dcea197707482bf177376` | 738 | 124 / 124 / 109 |

One JSON event per line: the runner's plan (`meta`, written before any bet), the pre-capture seed read (`pre`), the rotations, the epoch openings, one `intent` per round (its planned tiles, journalled before its first request), every request and reply (`step`), one settled-round record per round (`bet`), LIQD's verifier reply per round (`verify`) and end markers. Step 22 requires every scored row to equal its settling reply, field for field, and reads from the raw captures what the dataset has no field for: the USDT amounts, the planned tiles, every reveal reply, LIQD's ledger debits and LIQD's verifier replies. Cash-out requests: 2,688 = 2,691 wins less the 3 rounds LIQD settled by itself. The runner's IP address was replaced by `[ip redacted]` in each exported copy (one occurrence per file, in the `meta` line). In capture 3's `meta` line a person's name in a plan note was replaced by "the auditor"; every other line of the three files is as exported (E04).

**Capture 2 stopped once and was resumed.** Its 538th round (bet `Z6B5Y_EKOsIi9rFGBZ8XX`, 24 mines) was the first round LIQD settled by itself; the reply had a shape the runner build that started the run (`4dbf8ae8f846`) did not know, and the runner stopped. The run was resumed on build `bfa80f1fc59d`, which read the live seed state, found no round in progress, and rebuilt that round's record from its stored place-bet and open-tile replies. The file holds one `stop`, one `resume-check` and one `recovered` event and is the complete run: 1,450 rounds, 0 lost replies, 0 gaps. The round's `at` in the dataset is the time its record was rebuilt (05:11:40 UTC); its requests were answered at 05:08:59. Captures 1 and 3 ran without a stop.

**How the captures were run.** The runner is pasted into the DevTools console of the auditor's logged-in `https://liqd.com` Mines tab, refuses any other origin, sends its requests with the page's own session and never reads cookies, storage or tokens; every event is stored in the origin's IndexedDB before the next request. It reads the active seed pair, rotates once to reveal it (the pre-capture anchor), then plays epoch by epoch: rotate with the epoch's client seed, play the epoch's rounds (`place-bet`, `open-tile` per planned tile, `cash-out` at the planned depth), next rotation; after the last epoch it requests LIQD's verifier (`POST /api/v1/fast-games/provably-fair/verify/mine`) once per round with that round's revealed inputs. Three builds of the runner ran: `218861d920b8` (capture 1), `4dbf8ae8f846` (capture 2, start) and `bfa80f1fc59d` (capture 2 after the resume, capture 3). Each capture records its build in `meta.script` and its export note, and Step 22 requires them to be these (`src/pins.ts` `PROD_CAPTURES`). The runner itself is not part of this package.

| Field group | Source and use |
|---|---|
| `mineTiles`, `openTiles`, `winningAmount`, `multiplier`, `result`, `betAmount`, `fiatCurrency`, `nonce`, `clientSeed`, `serverSeedId`, `autoFinish`, `currentGameSettings` | The settling reply (the cash-out reply on a win, the mine reveal on a loss, the open-tile reply on a self-settled round), each equal to the raw record (Step 22 b) |
| `reveals` | The planned depth of the round |
| `phase`, `phaseId`, `capture`, `captureEpoch`, `epoch` | The runner's record of the round; `epoch` numbers the epochs 0–35 across the captures |
| `hashedServerSeed` | Written by the converter from the epoch the round belongs to: LIQD's mines replies carry no seed hash (0 of 28,760 replies carry a key naming one, Step 3) |
| Seed-row `serverSeed`, `hashedServerSeed`, `nextHashedServerSeed`, `clientSeed`, `nonceStart` | The rotation replies that opened and closed the epoch (Step 22 c) |
| `localMines`, `verified`, `commitVerified`, `chainLinkOk` | Converter-side calculations; the verifier performs its own checks and reads none of them |
| `betAmountWallet`, `winningAmountWallet`, `exchangeRate` | Raw captures only (`placeRaw`, `settleRaw`); Step 22 f |

**Three chains, not one.** Each capture is its own run with its own pre-capture anchor and its own commitment chain (24 + 9 + 0 links). Other games were played on the account between the runs, so no link between one capture's last epoch and the next capture's anchor is recorded or claimed (DL-21).

**Nonce coverage.** Every epoch's nonces are exactly 0 … size − 1, contiguous, against the window declared in code (`NONCE_BASE`, `EPOCH_PLAN`); each seed record's own `nonceStart`/`nonceEnd` is checked against it. This establishes completeness against the window the capture requested, not the absence of activity outside it (DL-9).

## Game and algorithm

The board is always **25 tiles**, numbered `1 … 25` in every record. Before the round the player selects `mineCount`, an integer in `[1, 24]`; that many tiles are mines and the rest are safe. Each revealed safe tile raises the multiplier, revealing a mine ends the round with payout 0, and the player may cash out after any number of safe reveals. There are no risk levels and no variants: `mineCount` alone determines the odds and the multiplier schedule, so there are 24 configurations and, with `1 ≤ k ≤ 25 − m` safe reveals, **300 legal (m, k) cells**.

```
commit    = SHA-256( UTF-8(serverSeed) )                     // over the 32 hex characters, not the 16 bytes
key       = hex_decode(serverSeed)                            // 16 bytes
digest(i) = HMAC-SHA256(key, UTF-8(clientSeed + ":" + nonce + ":" + i))   // one digest per draw, i = 0, 1, …

draw(i, r):                                                   // an offset in [0, r)
    LIMIT = floor(2^32 / r) * r
    for each 4-byte chunk of digest(i), big-endian, offsets 0, 4, …, 28:
        if chunk < LIMIT: return chunk mod r                  // the rejection test is ASSUMED of the operator, unexercised
    (all eight rejected: not specified, docs/ALGORITHM.md O1)

a = [1, 2, …, 25]
for i in 0 … mineCount−1:                                     // draws past mineCount cannot change a[0 … mineCount−1]
    j = i + draw(i, 25 − i)
    swap a[i], a[j]
mineTiles  = a[0 … mineCount−1]                               // draw order

mult       = (1 − houseEdge) · Π_{i=0}^{k−1} (25−i)/(25−mineCount−i)    // exact rational
booked     = win: floor2(betAmount × mult), in the booking fiat   loss: 0
wallet     = win: floor8(betAmountWallet × floor8(mult)), USDT    loss: none
dispMult   = floor2(mult)                                     // the `multiplier` field — display only
```

`houseEdge = 0.01` (the settings records carry `houseEdge: 1`, the percentage form). The commitment hashes the UTF-8 text of the 32-character hex seed; the HMAC key is the 16 hex-decoded bytes (`commitHash` and `generateProvablyFairNumber` in `src/rng.ts`). The message is `clientSeed`, `nonce` and the draw index joined by literal colons, no zero-padding, one fresh HMAC per swap. Because the first `mineCount` shuffled tiles are the mines, one shuffle serves every mine count under the same inputs, and the tiles the player opens are not inputs to `revealMines`. There is no external entropy (no drand, block hash or VRF). **All 6,574 production layouts match this implementation** in draw order, 0 mismatches, 0 skipped; **36 of 36** revealed seeds match their commitments; **33 of 33** next-seed links inside the captures hold, plus the 3 pre-capture links.

**The rejection branch is ASSUMED as operator behaviour (DL-3).** The per-draw rejection probability is `(2³² mod range)/2³²`, at most **4.889e-9** (range 25); across the dataset's **164,350 draws** (6,574 rounds × 25) the expected number of rejection events is **1.929e-4**. The census was executed: **0 observed** (`outputs/audit-figures.json` → `moduloBiasRejectionCensus`). A no-rejection implementation reproduces all 6,574 layouts identically (`scripts/spec-check.mjs`). Step 5 runs the branch on a fixed vector from the Pass-1 seed space (serverSeed `1f1da0da5907129a0043f5ac8a12b5ee`, clientSeed `097bf01483879668f626781b35b297c2`, nonce 760455, cursor 12, range 13: the first chunk is rejected and the draw is 6, where deleting the branch gives 1) and requires the auditor's draw to be exactly unbiased at every range. That settles the branch in the auditor's code only.

**Where the RNG code comes from.** `src/rng.ts` was written from the algorithm stated in [docs/ALGORITHM.md](docs/ALGORITHM.md) §1–§2 by an implementer who read only the specification and never opened LIQD's code or its client bundle; the specification gives the evidence for every step on the production captures (`node scripts/spec-check.mjs` re-runs it, with the nearest alternative constructions: an ASCII key reproduces 45 of 6,574 layouts in order, cursor `i+1` 35, a little-endian read 224). LIQD's code is a second check: its three validation vectors run as unit tests (`tests/mines/rngTests.ts`). The ProvablyFair.org site verifier (vendored in `verifier-parity/`, Step 5) gives the same layout on 6,574/6,574 rounds, and LIQD's own verifier endpoint, queried by the capture, returns the same mine set on 6,574/6,574 (Step 22 j). On inputs no captured round reaches the implementations differ: when all eight chunks of a digest are rejected (below 1e-66 per draw) the module throws where LIQD's specification redraws at `cursor + 1,000,000`.

**No published algorithm.** No LIQD page read states the algorithm. Its server-side verifier answers `POST /api/v1/fast-games/provably-fair/verify/mine` with `(serverSeed, clientSeed, nonce, mineCount)` → `{ mines, openTiles }`; an operator-run verifier cannot corroborate the operator's own outcomes, so Step 22 reports its agreement and `src/rng.ts` recomputes every layout offline. What its replies do show is provenance: each request carried only the revealed seeds, the nonce and the mine count, and each reply named the tiles the round opened (6,574 of 6,574), which those inputs do not determine, so LIQD can only know them from its stored round; and it answers without a login (one round read on 11 November 2026, E23) (DL-6).

**Client seeds.** The 31 epochs of phases A, `A+` and C use the runner's CSPRNG form, `audit` + 12 hex characters, all distinct (Step 6). The 5 epochs of phase D use five distinct player-set seeds; all 500 rounds played under them recompute, each seed is the one LIQD's rotation reply returned as active, and none is used outside phase D (Step 14). For 36 of 36 epochs the client seed was submitted in the rotation whose reply made that epoch's commitment active, recorded before the epoch's first bet. A whole-dataset control using `wrong-client-seed-test` reproduces **43 of 6,574** layouts in draw order (0.65%) and an empty client seed **43**, against **44.172** expected by chance (`Σ 1/P(25, m)`, gate 76.735). These are measured controls for this dataset, not universal probabilities. The phase D seeds were generated by the auditor's runner and submitted as a player's own seed; they show that the seed a player sets is the seed the round is drawn with.

**Stake and reveal coverage.** Two stakes: 0.10 on 6,450 rounds and 10.00 on the 124 rounds of phase C (Step 18): all 124 recompute from the wager-free engine, and their 109 wins are booked, and carry the wallet field, by the rules the 2,582 wins at 0.10 follow. The 3-mine, one-tile cell was played only at 10.00 (DL-20). Each round's opened positions are a prefix of its pre-registered random order (6,574/6,574), spanning **2,720 distinct opened-tile sets** and **all 25 first-pick positions**; first picks that hit a mine: 1,865 against 1,832.9 expected (z = 1.000, printed, not gated; Step 21).

## Payouts and RTP

Let `m` be the mine count and `k` the number of safe tiles revealed before settlement. For uniform mine placement:

```text
P(win at depth k) = C(25-m, k) / C(25, k)
exactMultiplier   = (99/100) × C(25, k) / C(25-m, k)
theoreticalRTP    = P(win) × exactMultiplier = 99/100

booked (fiat)     = floor(betAmount × exactMultiplier × 100) / 100
wallet (USDT)     = floor(betAmountWallet × floor(exactMultiplier × 10^8) / 10^8 × 10^8) / 10^8
displayMultiplier = floor(exactMultiplier × 100) / 100
```

Each factor cancels, establishing **99.0000% theoretical RTP** and a **1.00% theoretical house edge** across the entire legal grid. This identity concerns the reference formula before settlement rounding. Win probabilities come from independent combinatorics, never operator data (Step 13 adds an exhaustive integer tally at every mine count to depth 5 and at the played settings deeper than that). There is no multiplier table file: `src/config.ts` provides `minesMultiplierExact`, `minesMultiplierRational`, `minesMultiplier`, `winProbability` and `theoreticalRTP`.

**Booked amount (Step 8).** All **2,691 wins** book `winningAmount = floor2(stake × exact)` in the booking fiat (exact BigInt arithmetic in cents, 0 tolerance): 1,979 in CAD, 712 in USD. All **3,883 losses** book 0. The cent cut drops part of a cent on every win at a 0.10 stake (the table under [Conclusion and scope](#conclusion-and-scope)). Worked examples: bet `k09hZxP4ZhUYw3SuDhspz`, (1, 2), exact `0.99 × 300/276 = 1.0760869…`, displayed `1.07`, booked `0.10` CAD; bet `Z6B5Y_EKOsIi9rFGBZ8XX`, (24, 1), exact `24.75`, booked `2.47` USD, wallet field `2.47500000` USDT; bet `4QJN4i6P5Fxc_NB4gxkE4`, (3, 1) at 10.00, exact `1.125`, displayed `1.12`, booked `11.25` USD; bet `PQMz0IhGUim57nUHy0IwG`, (12, 5), exact `40.8692307…`, displayed `40.86`, booked `4.08` CAD, the largest multiplier won. The 10.00 stake separates the booked rule from a rule built on the displayed multiplier: `floor2(10.00 × 1.12)` would be 11.20, and all 109 phase C wins are booked 11.25 (`scripts/spec-check.mjs`: the display-based rule matches 2,582 of 2,691).

**Wallet field (Step 22).** All 2,691 wins carry `winningAmountWallet = floor8(betAmountWallet × floor8(exact))` in USDT, and no loss carries a wallet win. Against `floor8(betAmountWallet × exact)` 2,629 are equal and **62 are one 1e-8 unit lower**, never higher, all in capture 1: (1,2) ×3, (3,2) ×18, (5,2) ×2, (5,3) ×1, (5,5) ×10, (8,2) ×12, (8,4) ×5, (8,5) ×1, (12,2) ×5, (12,3) ×4, (12,4) ×1 — **0.00000062 USDT in total**. Example: bet `r80BHxgDMcDuXkFpe-h40`, (12, 2), wallet stake `0.07085468` USDT, exact multiplier `0.99 × 600/156 = 3.80769230769…`, cut to 8 decimals `3.80769230`, wallet field `0.26979281` where the exact product floors to `0.26979282`. On capture 1 the wallet stake of a 0.10 CAD round takes 58 distinct values between 0.07084688 and 0.07096596 USDT: the rate LIQD applies between the booking fiat and USDT is finer than the two-decimal `exchangeRate` it serves (1.41 on 3,548 rounds, 1.40 on 1,452) and is not checked (DL-5). On captures 2 and 3 the served rate is 1.00000000 and the wallet stake is 0.10000000 or 10.00000000.

**Displayed multiplier (Step 7).** `floor2(exact)` on 2,691 of 2,691 wins, absent on losses; on 2,429 wins it sits below the exact multiplier (the exact value is not a whole number of cents), never above.

**Return on each amount (Step 10).** On the game's formula the return is exactly 99% at every setting. Both amounts in the replies are floored, so the return they carry is at most that. The **wallet field** at the smallest wallet stake in the captures (0.07084688) loses at most **1.016e-7** of turnover (worst cell (1, 4)): **99.0000% to four decimals**. The **booked amount** is cut to the cent, which at a 0.10 stake costs up to **7.0000 points** at the worst cell, (1, 2), where every win is booked as 0.10 (a booked return of **92.0000%** there); at the 0.01 minimum stake LIQD serves (`minBet` in every settings record; not played) the same arithmetic gives **49.5652%** at the worst cell, (3, 5). No balance was read (DL-5); if the booked figure were what reaches the balance, those would be the returns at those stakes. LIQD's own account bet history records the wallet field in the reply as the payout on 2,691 of 2,691 wins (1,979 on the CAD run, 712 on the USD runs, including 2.47500000 on each of the 3 rounds LIQD settled by itself, booked 2.47) and charges each bet as the USDT equivalent of its fiat stake (0.07084688–0.07096596 USDT for 0.10 CAD, never 0.1; 0.10000000 and 10.00000000 for the USD stakes), so the 99% on the wallet field is what LIQD's account ledger shows (E24, E25); the history is LIQD's ledger, not a balance read. Emitted in `outputs/audit-figures.json` → `settlementFloor` and `walletLeg.settlementFloorAtMinStake`; the 0.01 figure is printed in Step 10.

**Live-witnessed cells (DL-4).** 40 of the 300 cells were played: the 20 multi-reveal settings, the 19 top-up cells (mine counts 2, 4, 6, 7, 9–11, 13–24 at one tile) and (3, 1). All 40 carry at least one win, every win at them booked, and in the wallet field, at the rules above (the fewest: 3 wins at (24, 1), 4 at (23, 1), 5 at (12, 5)). 260 cells are formula-only.

**Payout limits (DL-7).** The settling replies carry `currentGameSettings` on every loss and on the 3 self-settled wins (3,886 records; a cash-out reply carries none). The limits are stated in the booking fiat: `maxBet` 7,060 / `maxExposure` 70,600 (413 records) and 7,050 / 70,500 (2,608) in capture 1 (CAD); 5,000 / 50,000 in captures 2 and 3 (USD, 850 and 15 records); `maxExposureUsdc` 50,000 and `maxBetUsdc` "5000.00000000" in all; `minOdds` 1.01, `houseEdge` 1, `minBet` 0.01. **None carries a `maxOdds` key.** LIQD states (15 October 2026) that Mines has had no multiplier cap since the end of August 2026 and that `maxExposure` is a per-round payout limit; payout limits are excluded from the audit. No captured round approached it. LIQD's page, as published on 1 Oct 2026, quotes 5,148,297×: that is the **top multiplier on the formula** (12 mines, 13 tiles), **payable only within the round limit**. The arithmetic, from the served settings and LIQD's statement (DL-7): on the USD settings the round limit is 50,000 and at the 0.01 minimum a full clear would book 51,482.97, above it, so by LIQD's statement such a round ends at 12 tiles, at 396,022.85× (3,960.22 booked); on the CAD settings of capture 1 (limits 70,500 and 70,600) a full clear at 0.01 books 51,482.97 CAD, within the limit, and from a 0.02 stake it is above it. RTP stays at 99% if the limit works as LIQD describes (a round ended early is settled at a setting whose return is 99%), but no captured round reached the limit, so that is not observed.

**Published rounding statement: a discrepancy, as published on 1 Oct 2026** (ruling 1). The page `liqd.com/originals/mines`, as published on 1 Oct 2026 (`evidence/rtp-page-labels-2026-10-01.json`), says: *"Multipliers are rounded to two decimals rather than cut, so the realised edge moves a little with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%."* On production the displayed multiplier is cut, not rounded (`floor2`, Step 7: 2,691/2,691), and the range matches neither rule: if the 2-decimal multiplier were paid, the edge over the 300 cells would be 1.00%–1.72% cut and 0.56%–1.33% rounded (Step 10). The wallet field is computed at the 8-decimal multiplier and returns 99.0000% to four decimals at every cell. The booked amount is cut to the cent (Step 8), which at a 0.10 stake moves the booked return further than the page's range; that is a property of the stake, not of the multiplier. LIQD is held to the flat 99% (ruling 1); the sentence is recorded as it was published on that date, and this package does not say what the page says now.

**Display floor in exact arithmetic.** The auditor's reference display floor is computed in exact integer arithmetic (`floor(100 · num / den)` in BigInt): in binary64, `Math.floor(multExact × 100) / 100` understates 31 of the 300 cells by a cent (at `m=1, k=10`, `33/20 = 1.65` evaluated as `1.6499999999999997`). The unit spec *"exactly 31 of the 300 cells moved, and every one moved UP by one cent"* (`tests/mines/regressionTests.ts`) recomputes them. On production the (1, 10) wins display 1.65 (170 wins).

### Simulation

**Pass 1** (`outputs/simulation-results.json → pass1_fresh_seeds`) records **24 configurations × 1,000,000 rounds = 24,000,000 rounds** of the auditor's implementation; every row stores its server and client seeds. It does not read any capture. Mine placement is a constrained multinomial, so Pass 1 scores three properties at the Bonferroni threshold α/24 = 4.167e-4:

| Scored check | Coverage | Result |
|---|---|---|
| First-drawn tile uniformity (`df = 24`: one outcome per round) | 24 mine counts | 0/24 uncorrected, 0/24 Bonferroni |
| Pairwise mine co-occurrence vs `N × C(23, m−2)/C(25, m)`, max \|z\| over 300 binomial-standardized pairs | 23 mine counts (m ≥ 2) | 0/23 Bonferroni; largest \|z\| 3.72 |
| First-drawn-tile serial independence (lag-1 + runs on `revealMines(...)[0]`) | 24 mine counts | 1/24 uncorrected, 0/24 Bonferroni |

The pair test uses a normal approximation to a binomial count; the serial statistic consumes only the first drawn tile of each round (DL-8). Mean simulated RTP is **98.94271044%**, the unweighted mean of the 24 per-configuration estimates (pooled standard error 0.0346 pp; z = −1.655 against 99.0000%). The convergence chart plots the pooled single-tile RTP at seven cumulative sample sizes against 99.0000% with a ±2 × SE band, where SE = σ/√n is the standard error; the final interval [98.8736%, 99.0118%] contains the theoretical value. The 24M-round simulation confirms RTP at `k = 1` only; every verify run replays all 24,000,000 rounds from each row's seed pair (Step 16) and holds each configuration's convergence to 5 standard errors.

**Pass 2, first-draw diagnostic.** Each of the **36 revealed production server seeds** is evaluated over **10,000 nonces**: early window 0–99, late window 100–9,999. The early window is one constant for all seeds (`src/pins.ts` `PASS2_EARLY_WINDOW`), the first 100 nonces: the longest prefix every epoch played in full (epoch lengths 100, 124, 190 and 200); the later nonces of the longer epochs fall in the late window (DL-22). The statistic is the first-drawn tile histogram (25 cells). The early null is a parametric bootstrap of **10,000 replicates** per mine count that `src/simulate.ts` reads per epoch (the first round's: 1, 2 or 3; the first drawn tile does not depend on the mine count), rebuilt from the committed master seed `7461a9c2b511fac35b9b73eef4deb2ea7fca228ed231fb721f6da4e065d68b63` under `mines-seed-derivation-v1`. A seed is flagged when its early bootstrap p-value is below 0.05 and its late p-value is at least 0.05. Result: **4 flagged seeds** of 36 (epochs 2, 12, 15 and 28) against 1.710 expected by chance at the nominal 4.75% per seed (binomial survival P = 0.0899). Step 17 fails when that probability is below 0.01; 0.0899 is above it. The count is higher than its nominal expectation and is reported as measured. This diagnostic reads the first-drawn tile only; the served-configuration test below scores the rounds that were actually played.

```text
version = mines-seed-derivation-v1
seed(domain, replicate) = first 16 bytes of HMAC-SHA256(hexDecode(masterSeed), UTF8(version + ':' + domain + ':' + replicate))
server domain = pass2-bootstrap-server:m=<mineCount>; client domain = pass2-bootstrap-client:m=<mineCount>; replicate = 0..9999
earlyBootstrapP = (count(nullStatistic >= observedStatistic) + 1) / 10001
```

Step 17 reconstructs the null and all 36 early p-values in every verify run; `npm run bootstrap-replay` (Python 3.9+, no dependencies) reproduces every retained statistic (run 11 November 2026: 30,000 null statistics and 36/36 p-values reproduced, 0 mismatches; late p-values within 1e-12, largest difference 8.92e-13; `outputs/bootstrap-replay-report.json`).

**Pass 2, served-configuration test (Step 17, MINES-21).** For each of the 36 epochs the configurations it served (mine count and the tiles each round planned to open, from the dataset and the raw captures' plans) are replayed over the revealed seed for 200 of the epoch's own lengths (20,000 nonces for an epoch of 100, 24,800 for 124, 38,000 for 190, 40,000 for 200); the early window is exactly the epoch's captured nonce range and must reproduce the 6,574 recorded outcomes, and its return against the exact per-configuration mean and variance is ranked against the seed's own 199 later windows. The rule (flag at p ≤ 0.01, family gate 3 of 36 at the binomial tail 0.001, pooled z < −3.090 fails) is fixed in code. Result: **0 of 36 flagged**; pooled early-window return 6,523.3334 against 6,508.2600 expected, **z = 0.088**; detection power of the pooled test 11.5% at a 5% early-window return shortfall, 75.6% at 10%, 100.0% at 20%.

**Live-bet statistics (informational only; variance, not RTP evidence).** Booked return 97.5240% in CAD (500.00 staked, 487.62 booked as won) and 98.4578% in USD (1,385.00 staked, 1,363.64 booked as won); wallet return 98.9400% (1,739.52607511 USDT staked, 1,721.08623129 won, by the wallet fields of the replies); win rate 2,691/6,574 = 40.93%. The RTP evidence is the theoretical calculation (Steps 10 and 13) and the simulation (Step 16), not these figures. The unconditional lag-one correlation of the win/loss sequence is **0.1234**; the plan cycles through settings whose win probabilities differ, so this mixes configuration effects with any within-configuration dependence. Live-sample fit (Step 9, informational): first-drawn mine position over 6,574 layouts, χ² 26.418 on 24 df (p = 0.3323); win counts in 40 (mine count, depth) groups against the binomial, Σz² 41.266 on 40 df (p = 0.4151), largest |z| 2.831 at (1, 15): 87 wins of 275 against 110.0 expected.

## Verification results

The verifier scores **22 steps**: **22 PASS, 0 FLAGs, 0 hard fails** — PROVABLY FAIR — Full Pass. Source: `outputs/verification-results.json` (dataset SHA-256 `4d684d5e035e0be384685a2b44b9f5ab13b3f638e58686310cd778945c31741b`). Steps map one-to-one to criteria EC-1…EC-22 and findings F1–F22.

| Step | Finding | Check | Result |
|---:|---|---|---|
| 1 | F1 | Seed Hash Integrity | PASS: 36/36 revealed seeds, `SHA-256(utf8(serverSeed)) == hashedServerSeed`, 0 mismatches |
| 2 | F2 | Next-Seed Pre-Commitment Chain | PASS: 33/33 transitions inside the three captures and 3/3 pre-capture links; on the capture's clock 36/36 epochs' commitment recorded before their first bet, 36/36 seed records before their first bet, 33/33 rotations after the retiring epoch's last bet; on LIQD's clock (its replies' Date header) 36/36 commitments published in a reply dated no later than the rotation that sent the epoch's client seed, 35 strictly earlier, 1 in the same second |
| 3 | F3 | Hash Consistency Within Epoch | PASS: all bets in each of 36 epochs share `hashedServerSeed` (capture labelling: 0 of 28,760 replies carry a hash); LIQD's `serverSeedId` one value per epoch, 36 distinct |
| 4 | F4 | Nonce Audit | PASS: 36/36 epochs, one client seed each, nonces unique, in capture order, exactly 0 … size − 1 against the declared window (sizes 200, 100, 190, 124), 0 gaps |
| 5 | F5 | Mine-Layout Recomputation | PASS: 6,574/6,574 in draw order; `maxFair` printed for all 25 ranges, bias 0 in the auditor's draw (the operator's rejection branch is ASSUMED, DL-3); rejection census 0 of 164,350; the rejection vector runs; site-verifier parity 6,574/6,574 |
| 6 | F6 | Client Seed Influence | PASS: wrong seed 6,531/6,574 change, 43 coincide (44.172 expected, gate 76.735); empty seed 43 coincide; 31/31 seeds of phases A, A+ and C of the CSPRNG form, distinct |
| 7 | F7 | Displayed Multiplier Field (floored, cosmetic) | PASS: 2,691 wins display `floor2(exact)` at 1e-9; 3,883 losses `multiplier` absent and `winningAmount == 0` |
| 8 | F8 | Payout Math + Win-Condition | PASS: 2,691 wins book `winningAmount == floor2(stake × exact)` in their booking fiat, 0 tolerance; 3,883 losses 0; booked fiat per row as planned; per-capture booked totals and cent-cut disclosure as declared; every `won` round opened no mine and every `lost` round opened one |
| 9 | F9 | Config Completeness | PASS: 60/60 planned (phase, setting) pairs with exactly their rounds, 0 off plan; 24/24 mine counts with at least 50 phase A rounds; live fit (informational) first-draw χ² 26.418 on 24 df (p = 0.3323), wins Σz² 41.266 on 40 df (p = 0.4151) |
| 10 | F10 | House Edge / RTP Audit | PASS: identity 99.0000% at 300/300 cells and at the 44 cases (m = 1..24 at k = 1, and the 20 multi-reveal settings); 552/552 monotone pairs; settlement floor: booked 7.0000 pp worst at (1, 2) at 0.10 (49.4348 pp at (3, 5) at the 0.01 minimum served, not played), wallet field 1.016e-7 worst at (1, 4); ruling 1: flat 99% held, the page's rounding sentence a discrepancy as published on 1 Oct 2026; cap half disclosed, not scored: 3,886 settings records, no `maxOdds` |
| 11 | F11 | Phase Labels | PASS: A = 5,950 (of which A+ = 950), C = 124, D = 500; 6,574/6,574 rows carry the plan's phase and capture tags; 6,574 bets, 36 seed records, against code constants |
| 12 | F12 | Epoch Size | PASS: 36/36 epochs hold exactly their planned rounds (25 × 200, 5 × 100, 5 × 190, 1 × 124 = 6,574) |
| 13 | F13 | Anti-Circularity | PASS: `k=1` outcome space sums to 1.0; combinatorial form equals the product (max dev 2.220e-16); counting anchor 115 cases (every m at k ≤ 5 and the 5 played settings deeper than 5), integer equality, 0 mismatches |
| 14 | F14 | Client Seed Variation | PASS: phase D 500/500 rounds under 5 distinct player-set seeds (floor 2), 5/5 named in the capture's meta before its first rotation, 5/5 returned by LIQD as active, 0 used outside phase D; 36 distinct seeds, 6,574/6,574 rounds recompute; 0 predictable-construction epochs; 36/36 client seeds submitted in the rotation that made their epoch's commitment active, before its first bet |
| 15 | F15 | Multi-Reveal Verification | PASS: 5,500/5,500 multi-reveal rounds (phases A and D) at the 20 planned settings, 18,424 tiles opened; 6,574 layouts recompute; 2,691/2,691 winning displays `== minesMultiplier(m, openTiles.length)`, every win at its planned depth (depths 1, 2, 3, 4, 5, 6, 8, 10, 15); multi-reveal split 2,176 cashed out, 559 lost on the last planned reveal, 2,765 earlier |
| 16 | F16 | Simulation — Pass 1 | PASS: 0 Bonferroni failures in all three families; all 24 × 1,000,000 rounds replayed |
| 17 | F17 | Simulation — Pass 2 Cherry-Pick Test | PASS: 4 of 36 flags (survival P = 0.0899); null and 36 p-values rebuilt; served-config 0/36, z = 0.088 |
| 18 | F18 | Bet-Size Invariance (phase C) | PASS: 124/124 rounds at 10.00 recompute from the wager-free engine; 109 wins (floor 100), 109/109 booked and 109/109 wallet fields by the rules of the 0.10 wins; 6,574/6,574 rows and requests at their phase's stake and fiat |
| 19 | F19 | Artifact Integrity | PASS: dataset pin; every pinned `outputs/` artifact re-hashed, un-ignored by name, free of run metadata and inside its declared value domains; `audit-figures.json` re-derived field for field |
| 20 | F20 | Reveal-Sequence Consistency | PASS: 2,691 wins opened no mine, at their recorded depth; 3,883 losses bust on exactly the final opened tile |
| 21 | F21 | Reveal-Position Independence | PASS: 6,574/6,574 opened sequences a prefix of the pre-registered random order; 2,720 distinct opened-tile sets, 25/25 first-pick positions; layouts recompute |
| 22 | F22 | Production Raw-Capture Binding | PASS: 3 raw pins, lines, events and requests as declared, 3 runner builds; 6,574/6,574 rows equal their settling reply; 6,574/6,574 intents before their first request and equal to the pre-written plan; 36/36 seed records; 19,498/19,498 reveal replies; 3 self-settled rounds as declared, the only 3 open-tile replies carrying a multiplier; 2,691/2,691 USDT wallet fields at LIQD's rule, 62 one unit below the exact product (declared, bound); per-capture wallet totals and the booked-to-wallet difference as declared; 59/59 winning (cell, stake, fiat) groups order-invariant; 59/60 planned pairs witnessed by a win (none in phase D at (12, 5): 25 rounds, all lost); 3,886 settings records as declared; LIQD verifier 6,574/6,574, each request carrying only seeds, nonce and mine count and each reply naming the round's opened tiles (it also answers without a login, read 11 Nov on one round, E23); 3,886 ledger debits as declared |

**Hard-fail criteria.** Any step that returns FAIL hard-fails the verdict; the steps that can do so are **EC-1–EC-8, EC-10–EC-13, EC-15–EC-20 and EC-22**. Only **EC-9, EC-14 and EC-21** are FLAG-only. EC-8 hard-fails on a payout error, a label violation, an off-grid amount, a booking fiat other than the plan's, a booked total or cent-cut disclosure that differs from its declaration, or an amount that is not exactly `floor2(stake × multExact)`. EC-22 hard-fails on any wallet field below or above LIQD's rule, a disclosure count that differs from its declaration, a self-settled round the declaration does not name, a ledger debit that differs from its declaration, a verifier request carrying anything but the round's seeds, nonce and mine count, or a row that differs from its raw record. EC-2 hard-fails on a commitment published, on LIQD's Date header, after the rotation that sent its epoch's client seed.

**Step 19 — the verifier does not heal the evidence it condemned.** A missing `outputs/audit-figures.json` is a hard FAIL; the verifier writes that artifact only on the emission path and only when Step 19 passed; `npm run verify` writes nothing into `outputs/` and records each run under `outputs/run/` with a field-level `diff.json`. Step 19 has three outcomes for the figures: match → PASS; stale (derived from a different dataset) → FLAG; edited, unparseable or absent → hard FAIL.

**Baseline-deviation review.** The left column is the standard commit-reveal Mines baseline written independently of LIQD.

| Standard-Mines baseline | LIQD observed on production | Disposition |
|---|---|---|
| 5×5 grid, mineCount selectable 1–24 | 25 tiles; all 24 mine counts played [EC-9] | Conforms |
| Multiplier = fair reciprocal × (1 − edge), uncapped through every reachable depth | Displayed multipliers, booked amounts and wallet fields follow the formula at all 40 played cells; the settings carry no `maxOdds`; `maxExposure` is a round payout limit (DL-7) | Conforms where played; payout limit excluded, not tested |
| Win amount at the exact multiplier | USDT wallet field at `floor8(betAmountWallet × floor8(exact))`: 62 of 2,691 wins one 1e-8 unit below the exact product, 0.00000062 USDT in total, never above [EC-22] | **Disclosed, not a deviation (ruling 2)** — house-favourable in direction, immaterial in size (DL-14) |
| Booked amount equals the wallet field | The booked fiat win is cut to the cent while the USDT wallet field keeps 8 decimals: 2,582 of 2,691 wins booked below the unrounded amount (all 2,582 wins at 0.10; none of the 109 at 10.00) [EC-8, EC-22] | **Disclosed** — the wallet field in the reply is the larger figure (DL-5, DL-17) |
| Displayed multiplier equals the settled multiplier | Display floored to 2 decimals [EC-7] | Minor deviation in presentation; disclosed |
| A round ends on a mine or on the player's cash-out | 3 rounds on their last safe tile were settled by LIQD in the open-tile reply, with no cash-out [EC-22] | Disclosed; booked, and in the wallet field, by the same rules (DL-18) |
| Seeds: commit-reveal, client seed after commitment, nonce per bet | Confirmed [EC-1..EC-6, EC-14]: every client seed submitted after its epoch's commitment was active, on the capture's clock; a player-set seed is the seed used (500 rounds) | Conforms |
| Same outcomes and rules at any stake | 124 rounds at 100 times the base stake recompute and pay by the same rules [EC-18] | Conforms on the two stakes played |
| Public byte-level spec of the algorithm | None — live verifier only | Deviation, disclosed in Operator trust |

The fairness-integrity matrix (framework layer S5, rows S5-1 to S5-8) and the results of the adversarial batteries are in [exploit-testing.md](exploit-testing.md).

## Reproduce the audit

Runtime: **Node 22.23.1 or a later 22.x** (`package.json` `engines` `>=22.23.1 <23`, `.nvmrc` 22.23.1); the committed artifacts were produced on Node 22.23.1, and a derived statistic's last bits are runtime-dependent.

```sh
npm test
```

`npm test` is `node scripts/run-stages.mjs test --stages=check-standalone.mjs,test.js,verify.js,release-manifest.mjs`: four stages, each run whatever the previous ones returned (the `--stages` list is checked against the stages the script runs). `scripts/check-standalone.mjs` re-hashes every TypeScript source, the tsconfig, the lockfile and the build scripts against `standalone-manifest.json`, fails if the bundled `test.js` / `verify.js` and the sources disagree by a byte, and checks that the audit ID and the counts quoted in the Markdown at the package root equal the registries; `node test.js` runs the **43 bundled unit tests**; `node verify.js` runs the 22 scored steps on the committed artifacts; `node scripts/release-manifest.mjs --check` re-hashes every artifact of the release. It needs no installed dependency. The exit code is the verifier's verdict code when the other three stages pass, and 1 when one does not.

**The reproduction gate.** `npm run verify` compares what it computed against the committed artifacts field by field and writes `outputs/run/verification-results.json`, `outputs/run/audit-figures.json` and `outputs/run/diff.json`. Exact content must match byte for byte; a derived floating-point statistic may differ within **1e-14 absolute + 1e-12 relative**, recorded as `withinTolerance`. Exit codes: **0** Full Pass · **1** any FAIL, or a reproduction beyond tolerance · **2** an operator-origin FLAG · **5** RTP FIGURE OVERSTATED.

| Command | Work performed |
|---|---|
| `npm run build` / `npm run check:build` | Rebuild the bundles from source / compile in memory and compare byte for byte (read-only) |
| `npm run check:standalone` | The staleness gate `npm test` runs; needs no dependencies |
| `npm exec -- mocha` | The 43 source unit tests |
| `npm run verify` | Source verifier; writes only `outputs/run/` |
| `PF_EMIT=1 npm run verify` | The explicit regeneration of the committed artifacts; a run that did not pass Step 19 leaves `outputs/audit-figures.json` untouched. Re-pin in the same diff |
| `node scripts/spec-check.mjs` | The specification and its nearest alternatives on every production round, independent of `src/` (docs/ALGORITHM.md §7) |
| `npm run deep-replay` | The Step-16 replay stand-alone (all 24 × 1,000,000 rounds); read-only |
| `npm run bootstrap-replay` | Independent Python reconstruction of the Pass-2 null and the 36 seed rows; writes `outputs/run/bootstrap-replay-report.json` |
| `npm run simulate` | A new experiment into `outputs/run/` (`SIM_REPLAY=1` regenerates the committed one) |
| `npm run figures` | Regenerate derived figures into `outputs/run/` (deliberate; scores nothing) |
| `npm run chart` / `npm run chart:check` | Rebuild / confirm the self-contained convergence chart (Chart.js 4.4.7 inlined) |
| `npm run mutations` / `npm run forgeries` | Source-mutation and forged-evidence batteries in disposable copies |
| `npm run test:toolchain` | Build check, source tests, a new simulation, figures, verify, both batteries — every stage whatever the verdict |

**Adversarial registries.** The source-mutation registry, the declared survivors and the forged-evidence battery, with their counts and the results of their runs, are in [exploit-testing.md](exploit-testing.md).

**What Steps 16–17 bind.** Every leaf key path of `outputs/simulation-results.json` is classified and a path in no class fails (`tests/steps/simulation.ts`): Pass 1's counts, thresholds and every row statistic are recomputed by a full replay; Pass 2's windows, mine counts, summary scalars and every row's `epoch`, `hashedServerSeed`, `mineCount`, `earlyChi2`, `lateChi2`, `latePValue`, `cherryPickFlag` are recomputed from the dataset's revealed seeds; `earlyBootstrapP` is rebuilt from the recorded master seed; the two free-text `description` strings are read by no predicate (DL-12).

**Nominal false-alarm accounting.** The scored rejection arms that can trip by chance sum to a nominal **6.97%** (`outputs/audit-figures.json` → `falseAlarmAccounting`). It is a sum of nominal levels, not an upper bound on the probability of a false alarm: the unit spec *"the exact probability EXCEEDS the nominal"* (`tests/mines/regressionTests.ts`) shows the 5·SE convergence screen's exact binomial rejection probability above its normal-tail nominal at n = 1,000, m = 24.

**Artifacts of record (hash-pinned).**

| Artifact | SHA-256 | Guard |
|----------|---------|-------|
| `data/mines-prod-full-6574bets.json` | `4d684d5e035e0be384685a2b44b9f5ab13b3f638e58686310cd778945c31741b` | `loadDataset()` aborts on mismatch, from a single pin in `src/pins.ts` |
| `data/liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson` | `f4a35b0635fd8a196d31ebccd64fa3b617ab127716def789a0f1529b9ffe7d60` | `src/prod-capture.ts` (`PROD_CAPTURES`); a mismatch leaves the captures unloaded and Steps 3, 10, 14, 17, 18, 21 and 22 fail |
| `data/liqd-mines-prod-capture-2026-11-10T06-06-19-772Z.ndjson` | `3b8f81d5de58ccbf60fc809a53a34174d2c088aa78aba67ab1a0742a6d866141` | `src/prod-capture.ts` (`PROD_CAPTURES`); a mismatch leaves the captures unloaded and Steps 3, 10, 14, 17, 18, 21 and 22 fail |
| `data/liqd-mines-prod-capture-2026-11-10T10-27-49-259Z.ndjson` | `795825a548d786946d8ab0d9331dcd80d86a59b5b73dcea197707482bf177376` | `src/prod-capture.ts` (`PROD_CAPTURES`); a mismatch leaves the captures unloaded and Steps 3, 10, 14, 17, 18, 21 and 22 fail |
| `outputs/simulation-results.json` | `50bef42d729a973376dee69e274900a037d6baa1d4b17a600c144beb46b329e6` | Step 19 pin; Steps 16–17 replay its content |
| `outputs/simulation-provenance.json` | `036f4b3c0c4f9d241206bff2317a3d8632c3547844335653cdd89f9ed8532a86` | Step 19 pin |
| `outputs/bootstrap-nulls.float64le` | `c8a946c806faa4e8896d68a70f66c6f20fa282571cfc4e14ef29fd29dae160a0` | Step 19 pin |
| `outputs/rtp-convergence.html` | `ad969c106e979f3f0eabcea69b5d2d881eb4a44be248e670a215e6a561989d2d` | Step 19 pin; self-contained (Chart.js 4.4.7 inlined) |
| `outputs/deep-replay-report.json` | `6de3935092af3db155c9e608f7f5993b68b31ac25364ad24ac0c0ce021c8d6bc` | Step 19 pin |
| `outputs/bootstrap-replay-report.json` | `2064e369b17b74d7798dfa5440cbc8f4a71427cb49212fbd270e4aedb3c68d4e` | Step 19 pin |
| `outputs/audit-figures.json` | `5319211bcaf7011b2c88f8e264705ba583cfc2a7e8c68a634a436c187d3d6d9e` | Step 19 pin, and re-derived field for field |
| `outputs/verification-results.json` | `e1142b07f920b2702a46d9b5e240cdcfc829bc77d9946f879632deb240cbfb33` | Step 19 pin; each verify run diffs its own record against it |

`outputs/rtp-claim-table.json` is pinned in `src/rtp-settings.ts` and recorded in the release manifest. The site-verifier copies in `verifier-parity/` are pinned in `src/pins.ts` `SITE_VERIFIER_PINS`: `games/mines/derive.js` `0ee08caf082e0e1a88b6e1ff0123b6bdae06ff372303fdf4512161d2340d2d11`, `lib/hmac-sha256.js` `2095571fecd77f536bb3363c801cd70786856e687d108e0ff2102a4e2a18b847`. Nothing the package runs by default writes the pinned files.

**Model anchors.**

| Modelled figure | Anchor method | Tolerance | Enforcing test |
|---|---|---|---|
| Win probability C(25−m,k)/C(25,k) (basis of the 99.0000% RTP) | Exhaustive k-subset enumeration with **integer equality** to C(25,k) and C(25−m,k) | exact | Step 13 |
| Booked amount (cent floor) | `floor2(stake × exact)` in BigInt cents against every win | exact | Step 8 |
| Wallet field (LIQD's 8-decimal rule) | `floor8(betAmountWallet × floor8(exact))` in BigInt against every win; the difference from the exact product bound to its declaration | exact | Step 22 |
| Flat 99.0000% RTP identity | Closed-form `winProbability × minesMultiplierExact = 1 − edge`, anchored by the subset tally | 1e-9 | Step 10 + Step 13 |

**Residual (declared):** oracle and engine share the rules reading (25-tile grid, mineCount = risk control). No published third-party RTP exists for this operator; the anchor class is enumeration, not external reference. Falsifiability: [exploit-testing.md](exploit-testing.md).

## Verify a bet

**First way: the ProvablyFair.org verifier.** [provablyfair.org/verify-bets/liqd](https://provablyfair.org/verify-bets/liqd) recomputes a LIQD Mines round. Its Mines code is the file in `verifier-parity/`, and it gives the same layout as this package on 6,574 of 6,574 production rounds (Step 5).

**Second way: LIQD's own verifier, from a browser, no login.** LIQD's verifier answers a published round without a login (read 11 November 2026, exhibit E23, `evidence/liqd-verifier-no-login-2026-11-11.json`). It must be called from a browser on `liqd.com`: a plain `curl` gets Cloudflare's "Security Check" page. Open any `liqd.com` page, open the browser console, and send a round's `serverSeed`, `clientSeed`, `nonce` and `mineCount` from the dataset (`data/mines-prod-full-6574bets.json`: the seed row of the round's epoch and the round's own row). A call of this form, with the first production round:

```js
// paste into the browser console on a liqd.com page; no login needed
const r = await fetch('/api/v1/fast-games/provably-fair/verify/mine', {
  method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ serverSeed: 'c5777675456c54fb9096287dfb1cd804', clientSeed: 'audit5065faa79b0b', nonce: 0, mineCount: 1 }),
});
console.log(r.status, await r.text());
```

On 11 November 2026 the call for bet `k09hZxP4ZhUYw3SuDhspz` returned `{"mines":[24],"openTiles":[2,21]}` with the session's credentials and with credentials omitted (a control request to `/api/v1/user/get-user` with credentials omitted returned 401 `ACCESS_TOKEN_EXPIRED_OR_NOT_PASSED`, so no session was sent), the same reply the capture recorded on 9 November. E23 records the method, URL, body and credentials mode of the call, not its other headers. The reply names the tiles the round opened, which the four inputs do not determine: LIQD can only know them from its stored round.

**Third way: by hand.** The manual path follows.

The steps below use the field names of this audit's dataset (`data/mines-prod-full-6574bets.json`) and of LIQD's own replies as the raw captures record them. They need Node.js and nothing else. What is evidenced here is the API behind LIQD's provably-fair panel; the panel's own labels, and where each tile number sits on the board on screen, were not captured on production (DL-19).

1. **Where the seed is revealed.** LIQD's seed state carries the commitment of the active pair, `activeServerSeedHash` (`hashedServerSeed`), the hash of the next pair, `nextServerSeedHash`, the client seed and the nonce. Rotating the pair makes the next pair active and reveals the retiring server seed as `revealedServerSeed`: all 36 epoch seeds of this dataset, and the 3 pre-capture seeds, were revealed that way, recorded from the rotation reply. **Keep the commitment before you rotate.**
2. **Which fields to take.** `clientSeed`, `serverSeed` (once rotated), `nonce` (0 for the first round after a rotation, +1 per round) and `mineCount`; `hashedServerSeed` from before the rotation; from your own round, the tiles you opened, in order (`openTiles`), and where the mines were (`mineTiles`).
3. **Check the commitment.** `SHA-256` of the `serverSeed` hex **string** as UTF-8 text — not of the 16 bytes it decodes to — must equal `hashedServerSeed`.
4. **Recompute the shuffle** ([docs/ALGORITHM.md](docs/ALGORITHM.md) §2). The HMAC key is the hex-decoded `serverSeed`. For each draw `i` = 0 … `mineCount` − 1, with `r` = 25 − `i`: take `HMAC-SHA256(key, "clientSeed:nonce:i")`, read it as eight 4-byte big-endian integers, and use the first one below `LIMIT = floor(2^32 / r) × r` (this rejection step is ASSUMED of LIQD's server); the draw is that integer mod `r`. Swap position `i` with position `i + draw` in the list 1 … 25.
5. **Read the result.** Tiles are numbered **1 to 25**. The first `mineCount` tiles of the shuffled list are the mines, in draw order, and must equal `mineTiles`. A round is a win exactly when none of your `openTiles` is a mine. A win books `floor2(stake × exact multiplier)` in your display currency and carries `floor8(wallet stake × floor8(exact multiplier))` in the reply's wallet field; the displayed `multiplier` is the exact multiplier cut to two decimals.

The same calculation as a script, filled in with the first production round (bet `k09hZxP4ZhUYw3SuDhspz`, epoch 0, nonce 0, mine count 1, tiles 2 and 21 opened, recorded `mineTiles` `[24]`) — replace the five values with your own:

```js
// save as check-round.mjs and run: node check-round.mjs
import { createHash, createHmac } from 'node:crypto';
const serverSeed = 'c5777675456c54fb9096287dfb1cd804';   // revealed after rotation
const hashedServerSeed = '4378c7dcd852995859795f0bbc5a535c98bbb7fa2c97fc141aae5292811e4119';
const clientSeed = 'audit5065faa79b0b', nonce = 0, mineCount = 1;

// docs/ALGORITHM.md §1.2: SHA-256 over the seed's characters, not the bytes they encode
console.log('commitment ok:', createHash('sha256').update(serverSeed, 'utf8').digest('hex') === hashedServerSeed);
// §2 steps 1-2: one HMAC per draw i, first big-endian 4-byte chunk below LIMIT, mod r
function draw(i, r) {
  const d = createHmac('sha256', Buffer.from(serverSeed, 'hex')).update(`${clientSeed}:${nonce}:${i}`).digest();
  const LIMIT = Math.floor(2 ** 32 / r) * r;   // rejection: ASSUMED of LIQD's server, unexercised by the captures
  for (let o = 0; o < 32; o += 4) { const v = d.readUInt32BE(o); if (v < LIMIT) return v % r; }
  throw new Error('all 8 chunks rejected: not specified (docs/ALGORITHM.md O1)');
}
// §2 step 3: forward Fisher-Yates over tiles 1..25; the mines are the first mineCount, in draw order
const a = Array.from({ length: 25 }, (_, t) => t + 1);
for (let i = 0; i < mineCount; i++) { const j = i + draw(i, 25 - i); [a[i], a[j]] = [a[j], a[i]]; }
console.log('mines:', a.slice(0, mineCount));   // [ 24 ]
```

Run on 10 November 2026 as printed above, it prints `commitment ok: true` and `mines: [ 24 ]`, the recorded `mineTiles`. The first HMAC message is `audit5065faa79b0b:0:0`; tile 24 is in neither of the opened tiles 2 and 21, so the round is a win at (1, 2): probability `23/25 × 22/24`, exact multiplier `(99/100) × 300/276 = 1.0760869…`, booked `floor2(0.10 × 1.0760869…) = 0.10` CAD, wallet field `floor8(0.07085468 × 1.07608695) = 0.07624579` USDT.

**Worked verification examples.** Five production rounds, one from each phase and both currencies, spanning a loss, a self-settled win, the elevated stake and the largest multiplier won; their layouts, commitments, outcomes and amounts reproduce from the listed inputs (Steps 5, 8, 22; the same rounds are vectors V1–V5 of `docs/ALGORITHM.md` §5 and of `tests/mines/rngSpecTests.ts`).

| Seed label | Epoch | Revealed server seed | Client seed | Commitment `SHA-256(UTF8(seed))` |
|---|---:|---|---|---|
| A | 0 | `c5777675456c54fb9096287dfb1cd804` | `audit5065faa79b0b` | `4378c7dcd852995859795f0bbc5a535c98bbb7fa2c97fc141aae5292811e4119` |
| B | 3 | `c66188d98acb72928e588e353413e929` | `audit1f90826fce1e` | `8b6cf0887521631e00ce27b8290712427f7cf2cdc2bdf9094569b424e384e4b1` |
| C | 25 | `dd0386a9ff7f578ad9369df19b6136ab` | `pfaudit-prod-mines-d1-d55af3b7500b` | `61669ff57a1550fe13e1066da7d7a0b194f8418a0ad31e15cb0692f753be8e12` |
| D | 30 | `00e770d6e05988f3ad2541120747356d` | `audit85eaa242e54a` | `3d240b15cd531ef7e6b3d5b80382e6aaf3ed5fd6ab5b3c130a5ee114fb6992bd` |
| E | 35 | `3cf098f6c5ba08f60eb228995ec061e6` | `audit12902b0c80f4` | `0f2be4ce60e2cdf3309e0de3525a1a7a1a326f120568a6f756e0c0b07658778b` |

| Bet ID | Phase | Seed | Nonce | Mines | Opened tiles | Recomputed `mineTiles` | Result, booked, wallet field USDT (wallet stake) |
|---|---|---|---:|---:|---|---|---|
| `k09hZxP4ZhUYw3SuDhspz` | A | A | 0 | 1 | `[2,21]` | `[24]` | Win at (1, 2), displayed 1.07; `0.10` CAD; `0.07624579` (`0.07085468`) |
| `PQMz0IhGUim57nUHy0IwG` | A | B | 139 | 12 | `[18,9,22,24,21]` | `[1,7,13,6,8,17,12,3,16,15,19,4]` | Win at (12, 5), displayed 40.86, the largest multiplier won; `4.08` CAD; `2.89713435` (`0.07088791`) |
| `NkMq1Is_kkTu9ZYCiCXIV` | D | C | 38 | 12 | `[10,7,12]` | `[11,19,12,6,3,9,5,14,16,4,25,8]` | Loss on the third tile, under a player-set client seed; `0` USD; no wallet win (`0.10000000`) |
| `Z6B5Y_EKOsIi9rFGBZ8XX` | A+ | D | 37 | 24 | `[23]` | `[4,19,14,10,5,17,3,18,6,20,11,8,13,24,22,21,7,1,15,16,12,9,25,2]` | Win at (24, 1), 24.75, settled by LIQD in the open-tile reply; `2.47` USD; `2.47500000` (`0.10000000`) |
| `4QJN4i6P5Fxc_NB4gxkE4` | C | E | 123 | 3 | `[25]` | `[24,7,21]` | Win at (3, 1) at the 10.00 stake, displayed 1.12; `11.25` USD; `11.25000000` (`10.00000000`) |

## Evidence

The evidence register — every exhibit, what it is, where it came from and its SHA-256 — is [evidence.md](evidence.md). The evidence for this audit is the data and the code; no screen capture is part of it (DL-19).

## Limitations and trust

**Excluded:** infrastructure, server and platform security; wallet balance reconciliation, payment processing, custody and account systems beyond the recorded settlement replies; the exchange rate LIQD applies between the display currency and the wallet currency; enforcement of maximum-profit and other payout limits; game paths the captures did not play (260 of the 300 cells; a seed rotation with a round pending); the on-screen interface.

### Declared limitations register

The complete list of residuals and disclosed behaviours this audit knows about, each declared in code (a registry, a pin or a scored step's `detail`) and restated here. No row moves the verdict. Limits of the capture are the auditor's, not findings against LIQD. The ids are not consecutive: DL-1, DL-2, DL-10, DL-13 and DL-15 are not used.

| ID | What is NOT established, or what is disclosed | Why | Measured magnitude | Declared in |
|----|-------------------------|----------------------------------------------|--------------------|-------------|
| **DL-3** | That the operator's draw contains the `maxFair` modulo-bias rejection branch. It is **ASSUMED** — stated in LIQD's private specification, unexercised by the captures. | The branch is only reached when a 4-byte chunk lands in `[maxFair, 2³²)`. | **0 rejection events in 164,350 draws**, against **1.929e-4** expected; a no-rejection implementation reproduces all 6,574 layouts; residual bias either way ≤ 4.889e-9 per draw. | Step 5 `detail` |
| **DL-4** | That the 99.0000% identity holds at every legal cell **on the operator's side**. | A cell is only operator-witnessed when a captured bet won at it. | **40 of 300 cells** played and won, at all 24 mine counts; **260 formula-only**. | Step 10 `detail`; Steps 9, 15, 22 |
| **DL-5** | Which amount reaches the balance — the booked fiat amount or the wallet field in the reply — and the rate between the booking fiat and USDT. The audit verifies the amounts LIQD reported in its settle replies, not a balance movement and not the conversion. **LIQD's ledger debits, read in Step 22 (k):** the settling open-tile reply of every loss and of every self-settled round carries a `betTransaction` record, **3,886 records** (3,021 / 850 / 15 by capture); each `amount` equals the round's stake in the booking currency; its `currencyId` is the wallet's (`3`, the id every bet was placed under, USDT); on the CAD run (capture 1) that amount, 0.1, is not the round's USDT stake (about 0.0709), on 3,021 of 3,021; the audit does not use these records to infer the balance. **LIQD's account bet history for the CAD run** (read 11 November 2026 from the capture account, read only, E24): 5,000 Mines rows whose bet ids are exactly the capture 1 ids; every row charged in USDT between 0.07084688 and 0.07096596 (sum 354.52607511, equal to the capture's wallet stakes), placed as 0.10 CAD, 0 rows at 0.1 USDT, so the debit record's 0.1 is the CAD amount; payouts on 1,979 rows, each equal to the reply's `winningAmountWallet` (1,979 of 1,979; 353.95401893 USDT both sides). So for capture 1 the account ledger records the wallet field, not the cent-cut booked figure. **The same for the USD runs** (captures 2 and 3, E25): 1,574 rows whose bet ids are exactly those captures' ids, placed in USD at 0.10 (1,450) and 10.00 (124), charged 0.10000000 and 10.00000000 USDT; payouts on 712 rows, each equal to the reply's `winningAmountWallet` (712 of 712, including 2.47500000 on each of the 3 rounds LIQD settled by itself; 1,367.13221236 USDT). Over the three captures the account ledger records the wallet field, not the cent-cut booked figure, on 2,691 of 2,691 wins. This is LIQD's ledger, not a balance read. | No mines reply carries a balance; the served `exchangeRate` has two decimals while the wallet stake of a 0.10 CAD round takes 58 distinct values. | No magnitude for the balance: the quantity was never served. At a 0.10 stake the booked figure returns 92.0000% at the worst setting, and at the 0.01 minimum 49.5652%; the wallet field returns 99.0000% (Step 10). | Risk **R-CREDIT**; MINES-16 not applicable; docs/ALGORITHM.md §3.6; Step 22 (k), `PROD_LEDGER_DEBITS` |
| **DL-6** | That the dataset is what LIQD served. | Provenance is an assertion about an event outside the artifact. The raw captures record every reply with its HTTP status, date header and body SHA-256 as the runner saw it; those are recorded by the auditor's runner, not authenticated by LIQD. Two things in the captures answer "the auditor made up or edited the data" better than the auditor's word: **LIQD's verifier** was sent only the revealed seeds, the nonce and the mine count, yet returned each round's opened tiles, which those inputs do not determine (6,574 of 6,574, Step 22 j): it can only know them from its own stored round; and **LIQD's own clock**: on the Date header of LIQD's replies, the reply that published each commitment is dated no later than the rotation that sent its client seed, 36 of 36, 35 strictly earlier and one in the same second (Step 2). LIQD's verifier also answers without a login: on 11 November 2026 it returned the same mines and opened tiles for bet `k09hZxP4ZhUYw3SuDhspz` with credentials omitted, the session control returning 401 (E23); so any reader can query a published round from a browser on liqd.com ([Verify a bet](#verify-a-bet)). Only that one round was queried without a login. | No magnitude. Every computational result is reproducible from E01 and E02–E04, and E01 is bound to E02–E04 row by row (Step 22). | E01, E02–E04; Steps 2 and 22 (j) |
| **DL-7** *(a disclosure, not scored)* | That the round payout limit is enforced as LIQD describes. LIQD's statement of 15 October 2026: *"There's no multiplier cap on Mines any more. We removed the 10,000× cap at the end of August and took the setting out of the configuration completely. … we still have a limit on how much a single round can pay out. If the next tile would take a round past that limit, the game ends the round there and pays the full multiplier for the tiles already revealed."* The profile owner ruled the same day that payout caps are excluded from the audit. | No captured round approached the limit. | 3,886 settings records, none with `maxOdds`; largest multiplier won 40.86×. The page's 5,148,297× (12 mines, 13 tiles) is the top multiplier on the formula, payable only within the round limit: on the USD settings (limit 50,000, minimum stake 0.01) a full clear would book 51,482.97, above the limit, so by the statement above such a round ends at 12 tiles, 396,022.85× (3,960.22 booked); on the CAD settings of capture 1 (limits 70,500 / 70,600) a full clear at 0.01 books 51,482.97 CAD, within the limit, and from 0.02 it is above. Arithmetic on the served settings and the statement; not observed. | Step 10 `detail`; Step 22 (i) |
| **DL-8** | Layout-level serial independence. The scored serial statistic consumes one integer per round, the first drawn tile. | Adding a second indicator changes the producer. | Not measured in this package. | Finding F16; `src/simulate.ts` |
| **DL-9** | That LIQD served no nonce beyond the ones in the captures. | The window is what the capture requested under each seed, not an operator-side counter. | 36/36 epochs complete against the declared windows, 0 gaps against 0 declared, 0 duplicates, 0 out of order. | Step 4 `detail` |
| **DL-11** | That "all declared mutations are caught" means every guard is independently load-bearing. | A guard that is invisible on honest data is invisible until someone supplies dishonest data — the forged-evidence battery's job. | The 10 entries in `tests/survivors.json`, each paired with a forgery. | `tests/survivors.json` |
| **DL-12** | That the two free-text `description` strings inside `outputs/simulation-results.json` match the current chapters. | They are written by `src/simulate.ts` and read by no predicate. | 2 strings. | `tests/steps/simulation.ts` |
| **DL-14** *(disclosed, not a deviation: ruling 2; bound to the data)* | That every USDT wallet field equals `floor8(betAmountWallet × exact multiplier)`. It equals LIQD's own rule, `floor8(betAmountWallet × floor8(exact))`, on 2,691/2,691 wins. | The rule is LIQD's settlement arithmetic. | **62 of 2,691 wins one 1e-8 unit below the exact product**, 0.00000062 USDT in total, all in capture 1; 0 above. | Step 22 (f); `PROD_WALLET_BELOW_EXACT` |
| **DL-16** | Intermediate-rung parity of MINES-17 — that the multiplier offered after each reveal equals the formula at that depth. | LIQD's `open-tile` reply serves no multiplier: a safe reveal returns `{ mineTile: false }` only, and a mine reveal returns the settled round. | **3 of 19,498** open-tile replies carry a multiplier, the 3 self-settled rounds. What is checked is the cash-out rung at 40 cells. | Step 22 (e); `PROD_DECLARED_PER_STEP_MULTIPLIERS` |
| **DL-17** *(a disclosure, bound to the data)* | That the booked fiat win equals the wallet field in the reply. The booked win is cut to the cent; the wallet field keeps 8 decimals. | LIQD's booking arithmetic. | 2,582 of 2,691 wins booked below the unrounded amount: capture 1 1,979 wins, 11.56861635 CAD; capture 2 603 wins, 3.49221236 USD (= the excess of wallet fields over booked wins); capture 3 0 of 109. | Step 8; Step 22 (f); `BOOKED_BELOW_UNROUNDED` |
| **DL-18** *(a disclosure, bound to the data)* | Rounds LIQD settles by itself: a round that opens its last safe tile is settled in the open-tile reply. | LIQD's game flow. | 3 rounds (24 mines, one tile), each a win booked, and in the wallet field, by the same rules; no cash-out request exists for them. | Step 22 (e); `PROD_AUTO_FINISH_ROUNDS` |
| **DL-19** *(a limit of the capture)* | The on-screen player path: the labels of LIQD's provably-fair panel, and which cell of the board on screen carries which tile number. | No screen was captured on production; the path is evidenced from the API replies. | Not measured. | [Verify a bet](#verify-a-bet); docs/ALGORITHM.md O5 |
| **DL-20** *(a limit of the capture)* | The same cell at two stakes. Phase C played (3, 1) at 10.00 only; 3 mines at 0.10 were played at depths 2, 4, 6 and 8. The phase D seeds were generated by the runner and submitted as a player's seed, not typed by hand. | The capture plan. | 124 rounds at 10.00; 1,100 rounds at 3 mines at 0.10. | Steps 14 and 18 `detail` |
| **DL-21** *(a limit of the capture)* | One unbroken commitment chain across the three captures. | The captures are separate runs; other games were played on the account between them. Capture 2 stopped once and was resumed. | 33 links inside the captures, 3 pre-capture links; 0 between captures; 1 stop, 1 round rebuilt from its stored replies. | Step 2 `detail`; Step 22 (a) |
| **DL-22** *(a limit of the method)* | A first-draw early window equal to each epoch's own length. The Pass-2 first-draw diagnostic uses the first 100 nonces for every seed. | One bootstrap null per mine count requires one window length. The served-configuration test uses each epoch's full captured range. | Epoch lengths 100, 124, 190, 200; 2,974 of the 6,574 captured nonces fall in the late window of the first-draw diagnostic. | `PASS2_EARLY_WINDOW`; Step 17 `detail` |

### Operator trust

LIQD Mines uses the **Client Seed + Server Seed** model: the server seed is secret until reveal and not player-controllable; its commitment is observable before any round; the client seed is observable and player-editable; the nonce is LIQD state. What commit-reveal proves on these captures: no post-bet change of layout on the recorded order (Steps 1, 2, 5), truthful reveal (36/36), client-seed consumption (Steps 6, 14), faithful execution (6,574/6,574) and conformance of the amounts LIQD reported (2,691 wins, 3,883 losses: booked amounts and wallet fields). What it does not prove:

- **No account balance was read.** Payouts are the amounts in LIQD's bet replies, not observed balance changes (DL-5).
- **R-CHERRY — server-seed cherry-picking.** Containment: **STRUCTURAL (medium)**. The defence is the client seed submitted after the commitment: on 36/36 epochs the capture's own record puts the client-seed submission after the commitment was active and before the epoch's first bet (Step 14). Pass 2 (4 of 36 flags) and the served-configuration test (0/36) are secondary.
- **R-ORPHAN — server-side selective orphaning.** Not detectable from a client-side dataset (these captures have no nonce gaps and no lost replies). Containment: **DISCLOSED (out of scope for client-side capture).**
- **R-PAYOUT — payout-formula integrity.** Full coverage on the 40 witnessed cells; a deviation confined to an unwitnessed cell would not be caught.
- **R-TRUNC — displayed-multiplier truncation and the cent-cut booked amount.** The display and the booked amount are below the wallet field in the reply; at a 0.10 stake the booked figure returns as little as 92.0000% at one setting (DL-5). Containment: **DISCLOSED.**
- **R-MULTI — multi-account seed correlation.** Not detectable from a single-account dataset. **OUT OF SCOPE (disclosed).**
- **R-BRACKET — parameter boundary edge cases.** All 24 mine counts and depths 1 to 15 were played; the deepest depths were not; the payout limit was not triggered. **DISCLOSED.**
- **R-CREDIT — credit confirmation channel.** The amounts LIQD reported are verified against the replies; no balance was served, and LIQD's ledger debits are read but not used to infer one (A4, DL-5). **DISCLOSED.**
- **R-RACE — mid-round seed-rotation race (TOCTOU).** Not exercised (A5). **OUT OF SCOPE (disclosed).**

### Load-bearing premises

| Premise | Witness artifact | Could the captured data contradict it? |
|---------|------------------|----------------------------------------|
| RNG = HMAC-SHA256, hex-decoded key, `clientSeed:nonce:cursor` (the `maxFair` rejection is ASSUMED, not witnessed — DL-3) | `data/mines-prod-full-6574bets.json` | yes for the HMAC, key, message and cursor — 6,574/6,574 layouts reproduce from raw seeds (Step 5). The rejection branch is NOT witnessed: 1.929e-4 events expected in 164,350 draws, none occurred |
| Sequential Fisher-Yates mine placement (cursor = mine index, range 25→1) | `data/mines-prod-full-6574bets.json` | yes — every layout and every one of the 19,498 reveal replies recomputes; 0 disagreements |
| Commitment = SHA-256(utf8(hex string)) | `data/mines-prod-full-6574bets.json` | yes — 36/36 revealed seeds hash to their commitments |
| Next-seed pre-commitment chain | `data/liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson` | yes — 33/33 links inside the captures plus the 3 pre-capture links, each seed record equal to the rotation replies (Step 22 c) |
| Multiplier = (1 − houseEdge)·∏ (25−i)/(25−m−i); booked `floor2(stake × mult)`; wallet field `floor8(walletStake × floor8(mult))` | `data/liqd-mines-prod-capture-2026-11-10T06-06-19-772Z.ndjson` | yes — 2,691/2,691 displays, booked amounts and USDT wallet fields equal the rules; 62 wallet fields one 1e-8 unit below the exact product (DL-14) |
| The same rules at the elevated stake | `data/liqd-mines-prod-capture-2026-11-10T10-27-49-259Z.ndjson` | yes — 109/109 wins at 10.00 booked, and in the wallet field, by the rules (Step 18) |
| House edge exactly 1.00% on the played cells | `data/mines-prod-full-6574bets.json` | yes — every win at the 40 played cells pays the formula; the other 260 cells are formula-only (DL-4) |
| No multiplier cap on the production build | `data/liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson` | yes for the setting — 3,886 settings records, none carries `maxOdds` (DL-7); no round approached a large multiplier |
| Round payout limit (`maxExposure`) ends the round and pays the full multiplier for the revealed tiles | ASSUMED — LIQD's statement of 15 October 2026 (DL-7); no captured round reached the limit | no |
| The amount that reaches the balance (booked or wallet field) reconciled against a balance delta | ASSUMED — no reply carries a balance field and no balance was read (R-CREDIT, DL-5). LIQD's account history records the wallet field as the payout on 2,691 of 2,691 wins (E24, E25) | no |
| The build that served the captures is the build other players are served | ASSUMED — one account, three windows (R-MULTI, DL-6) | no |

### Recommendations

**For LIQD.** **P1 — Publish the algorithm and multiplier formula:** the byte-level HMAC-SHA256 description (hex-decoded 16-byte key, message `${clientSeed}:${nonce}:${cursor}`, 4-byte big-endian chunks, and whether modulo-bias rejection is applied — ASSUMED in this audit, DL-3), the mine-placement rule, the commitment convention, the exact closed-form multiplier and the two settlement rules, and a validation vector (`serverSeed=c5777675456c54fb9096287dfb1cd804`, `clientSeed=audit5065faa79b0b`, `nonce=0`, `mineCount=1` → `mineTiles=[24]`). **P2 — Show one win amount:** book the win at the wallet amount, or show the wallet field beside the booked figure, and state on the page that the displayed multiplier is cut and that the wallet field uses the multiplier at 8 decimals. **P3 — State the payout-limit rule where players can read it.**

**For future audit iterations.** **A1** — more depths per mine count on production. **A2** — a multi-account correlation study (R-MULTI). **A3** — a browser-ready single-file wrapper of `src/rng.ts`. **A4** — record the balance before and after each round (R-CREDIT). **A5** — a mid-round seed-rotation race probe (R-RACE). **A6** — a production screen capture of the player path (DL-19). **A7** — a whole-layout serial indicator in Pass 1 (DL-8).

## Terms

**Commit-reveal:** the server publishes `hashedServerSeed` before any bet and reveals the plaintext `serverSeed` after rotation. **Server seed:** a 32-character (16-byte) hex string; the HMAC key in its hex-decoded form. **Commitment:** `SHA-256(utf8(serverSeed hex string))`. **Client seed:** a player-controlled string mixed into the HMAC message. **Nonce:** bet position within an epoch, starting at 0. **Cursor:** the draw index `i`, 0…24. **Epoch:** the rounds played under one seed pair (200, 100, 190 or 124 on these captures). **Capture:** one run of the capture runner; this dataset has three. **Phase id:** A, A+ (the phase A top-up), C or D. **`mineTiles`:** mine positions in draw order. **Booked amount:** `winningAmount`, in the account's display fiat. **Wallet field:** `winningAmountWallet`, in USDT. **Self-settled round:** a round LIQD settles in the open-tile reply (`autoFinish`). **SE:** standard error, σ/√n.

### Guard codes

**G-BIND** — every population assertion binds to source records and to `src/pins.ts` / `src/config.ts` constants, never to a count the artifact supplies about itself. **A row count is not an identity.** **G-VALID** — no rejection of the merely surprising: a statistic exactly on its expectation is legal. **G-NONVACUOUS** — a predicate cannot pass by being undefined; every field a comparison reads is checked finite first. **G-PRODUCING** — every quantitative claim in the report is emitted by a committed pipeline step and copied from its artifact. **G-EXEC** — a verdict is printed only when every scored step ran: the executed step count is compared with a constant in `src/pins.ts` before any summary. **G-SIMDERIVE** — a simulation step recomputes its predicate from the artifact's detail rows, never from the summary scalars it also carries. **G-WITNESS** — a claim says what the capture witnessed and what it did not. **G-SCOPE** — a claim is no wider than the population it was measured on.

## Release history

**`v1.1.0`** (prepared 10 November 2026 in the private workshop; not tagged or published) — the audit scored on production data.

- **Data.** `data/mines-prod-full-6574bets.json` (6,574 rounds, 8–10 November 2026, `liqd.com`) is the scored dataset, converted from the three raw captures in `data/`; all pinned in `src/pins.ts` with the population plan (`PHASE_BLOCKS`, `EPOCH_PLAN`, `SETTINGS_PLAN`).
- **Steps.** All 22 steps score the production dataset. Step 2 scores three chains and three anchors; Steps 4 and 12 the per-phase epoch sizes; Step 8 the booked amount per fiat and the cent-cut disclosure; Step 9 the 60 planned (phase, setting) pairs and every mine count; Step 14 phase D's player-set seeds; Step 15 the multi-reveal rounds of phases A and D; Step 17 the 36 seeds; Step 18 phase C at the elevated stake; Step 22 the raw captures: row binding, every reveal, the self-settled rounds, the wallet field and LIQD's verifier.
- **Artifacts.** `outputs/` regenerated on the production dataset (Pass 1 replayed from its recorded seed pairs; Pass 2 over the 36 production seeds).
- **Documents.** `evidence.md` (evidence register), `exploit-testing.md` (fairness-integrity matrix and battery results) and `SUMMARY.md` (contents) added; `docs/ALGORITHM.md` gives the evidence for every step of the algorithm on the production captures, its vectors are production rounds, and `scripts/spec-check.mjs` re-runs it.
- **Money, provenance and limits.** Money claims are the amounts LIQD reported (the wallet field in the reply, the booked amount); LIQD's 3,886 ledger debits are read in Step 22 (k) and stated in DL-5 with LIQD's account bet history for the three runs (E24, E25); rulings 1 and 2 are stated under [Rulings](#rulings); LIQD's verifier inputs are enumerated in Step 22 (j), LIQD's Date header is checked in Step 2, and LIQD's verifier was read without a login on one round (E23) (DL-6); the 5,148,297× arithmetic against the served round limit is in DL-7.
- **Verdict.** PROVABLY FAIR — Full Pass, 22/22, `npm test` exit 0.

**`v1.0.1`** and **`v1.0.0`** (first released 21 October 2026) are the earlier releases of this audit; the wording errata prepared after `v1.0.1` are carried in this release's sources.
