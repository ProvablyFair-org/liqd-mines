# LIQD Mines — Provably Fair Audit

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** `PF-2026-LQ02` · **Release:** `v1.1.0`, [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json) · **Capture:** 8–10 November 2026 on `liqd.com` (production)

**Result: PROVABLY FAIR — Full Pass.** 6,574 production rounds verified: every mine layout, seed commitment, reveal and reported win amount. 22 of 22 scored checks passed, zero flags, zero hard failures.

**Scope:** 6,574 rounds played on `liqd.com` from one account in three capture runs. Phase A: 5,000 multi-reveal rounds at 5 mine counts (1, 3, 5, 8, 12) × 4 depths, plus 950 single-reveal rounds at the other 19 mine counts, so all 24 mine counts were played. Phase D: 500 rounds under five client seeds set by the player. Phase C: 124 rounds at a 10.00 stake; every other round staked 0.10. Production played 40 of the 300 legal (mine count, depth) settings. Payout-limit enforcement is outside the evidence. No account balance was read: payouts are the amounts in LIQD's bet replies, not observed balance changes (DL-5).

**Stakes as LIQD booked them.** LIQD books each bet in the account's display currency. The 5,000 rounds of 8–9 November were booked in CAD; the account's display currency was changed to USD on 9 November and the 1,574 rounds of 10 November were booked in USD. The wallet fields of each reply (`betAmountWallet`, `winningAmountWallet`) are in USDT throughout. Nothing in this report is converted: each amount is checked in the currency it was recorded in.

**What a player should know about the money.**

- **Return to player.** Exactly 99% on the game's formula at every setting, and 99.0000% on the wallet field in LIQD's replies. The win LIQD books is cut to the cent, which costs up to 7 points at a 0.10 stake: at the worst setting (1 mine, 2 tiles) every win is booked as 0.10, a booked return of 92%. No balance was read. LIQD's own account bet history records the wallet field as the payout on 2,691 of 2,691 wins and charges each bet as the USDT equivalent of its fiat stake, so the 99% on the wallet field is what LIQD's ledger shows.
- **The win LIQD books is cut to the cent; the wallet field in the reply is not.** A win is booked as stake × exact multiplier cut to the cent, and the wallet field in the reply is the USDT stake (`betAmountWallet`) × the exact multiplier, to 8 decimals. At a 0.10 stake the cent cut is large: on the 1,450 rounds of 10 November at 0.10 the booked figures show 145.00 USD staked and 137.39 USD won (a loss of 7.61), while the wallet fields of the same replies total 145.00000000 USDT staked and 140.88221236 won (a loss of 4.11778764). All 603 wins of that run were booked below the wallet field of the same reply, 3.49221236 in total. On the CAD run all 1,979 wins were booked below the unrounded amount (11.56861635 CAD in total). At the 10.00 stake the two agree on all 109 wins. Which of the two amounts moved the balance is not verified.
- **One wallet rounding, never in the player's favour, never more than 0.00000001.** The wallet field multiplies the stake by the multiplier cut to 8 decimals. On 62 of the 2,691 wins (all on the CAD run, where the USDT stake is not a round number) that is 0.00000001 USDT less than the exact product: 0.00000062 USDT in total. Every wallet field equals LIQD's own rule.
- **A round on its last safe tile ended by itself.** On the 3 rounds that opened the single safe tile of a 24-mine board, LIQD settled the round as a win in the same reply, with no cash-out step; its booked amount and wallet field follow the same rules. No other captured round reached its last safe tile.

## What was verified

| Check | Captured evidence |
|---|---|
| Outcomes | 6,574 of 6,574 recorded mine layouts recompute in draw order from server seed, client seed, nonce and mine count |
| Commitments | 36 of 36 revealed seeds match their SHA-256 commitments; 33 of 33 links between successive commitments of the same capture run intact, plus each run's link from the seed active before it (3 of 3); on LIQD's own clock (the Date header of its replies) each commitment was published no later than the rotation that sent its client seed, 36 of 36 (35 strictly earlier, 1 in the same second) |
| Client seeds | Every epoch's client seed was submitted after that epoch's commitment was active (36 of 36); 500 rounds were played under 5 seeds set by the player and all recompute; a wrong client seed changes 6,531 of 6,574 layouts |
| Reveals | 19,498 of 19,498 reveal replies agree with the recomputed layout; every round opened its pre-registered tiles in order |
| Booked amount | 2,691 of 2,691 wins equal the stake × exact multiplier cut to the cent, in the currency booked (1,979 CAD, 712 USD); 3,883 of 3,883 losses book zero |
| Wallet field (USDT) | 2,691 of 2,691 wins equal LIQD's rule `floor8(betAmountWallet × floor8(exact multiplier))`; 62 of them one 1e-8 unit below the exact product, none above |
| Stake size | 124 rounds at 10.00 (109 wins) follow the same engine and the same two payout rules as the rounds at 0.10 |
| Analytical RTP | `winProbability × exactMultiplier = 0.99` at all 300 legal (mine count, depth) cells |
| Simulation | Pass 1: 24 million rounds, replayed in full in every verify run; Pass 2: the 36 production seeds, the bootstrap null rebuilt from its recorded master seed |
| LIQD's verifier | Queried for every round after its seed was revealed, with only the seeds, nonce and mine count: 6,574 of 6,574 replies give the recomputed mines and name the tiles the round opened, which it can only know from its own stored round; it also answers without a login (one round read on 11 November 2026) |
| LIQD's ledger debits | 3,886 stake-debit records in LIQD's replies (one per loss and per self-settled round) read and held to their declaration; each amount is the stake in the booking currency, under the wallet's currency id, which on the CAD run is not the USDT stake. They are not used to infer a balance |

The RNG module that recomputes the outcomes, `src/rng.ts`, was built from a written specification, [docs/ALGORITHM.md](docs/ALGORITHM.md), by an implementer who never opened LIQD's code. LIQD's code is run as a second check, not used as the source: the validation vectors from the RNG specification LIQD supplied privately pass 3 of 3, and the ProvablyFair.org site verifier agrees with the module on all 6,574 production rounds (check 5).

The 22 checks are not 22 independent tests of what LIQD served; [the overview](MANIFEST.md#conclusion-and-scope) says which are. Capture origin, account scope and capture method are auditor-attested; the raw capture of every request and reply ships in `data/` and the scored dataset is bound to it row by row (check 22). LIQD's verifier replies and LIQD's own Date headers tie the captured rounds to rounds LIQD holds (limitation DL-6). The limitations, residual risks and premises are in the [overview's limitations](MANIFEST.md#limitations-and-trust).

## Run the audit

Requires Node.js 22.23.1 or a later 22.x (`.nvmrc` 22.23.1, `package.json` `engines` `>=22.23.1 <23`).

```sh
npm ci
npm test
```

Expected: the staleness gate ok; **43/43 unit tests**; the verifier prints **Passed 22/22, Hard fails 0, Flags 0 (0 verdict-affecting, 0 capture-origin), VERDICT: PROVABLY FAIR — Full Pass** and "Reproduction vs the committed artifacts on Node 22.23.1: REPRODUCED"; the release-manifest check ok. `npm test` exits **0**, the verifier's code for a Full Pass. Every verify run replays all 24,000,000 Pass-1 rounds, which takes minutes. `npm test` needs no dependency installation; `npm ci` installs the TypeScript tools.

```sh
npm run test:toolchain                    # build check, source tests, new simulation, figures, verify, both adversarial batteries
```

Run the 43 unit tests from source with `npm exec -- mocha`. Ordinary runs write only to `outputs/run/`; the committed artifacts are hash-pinned. All commands are in the [overview](MANIFEST.md#reproduce-the-audit).

## Verify a bet

**First way: the ProvablyFair.org verifier.** [provablyfair.org/verify-bets/liqd](https://provablyfair.org/verify-bets/liqd) recomputes a LIQD Mines round. Its Mines code is the file in `verifier-parity/`, and it gives the same layout as this package on 6,574 of 6,574 production rounds (check 5).

**Second way: LIQD's own verifier, no login.** Open any `liqd.com` page in a browser (a plain `curl` gets Cloudflare's "Security Check" page), open the browser console and run, with a round's `serverSeed`, `clientSeed`, `nonce` and `mineCount` from the dataset:

```js
const r = await fetch('/api/v1/fast-games/provably-fair/verify/mine', { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ serverSeed: 'c5777675456c54fb9096287dfb1cd804', clientSeed: 'audit5065faa79b0b', nonce: 0, mineCount: 1 }) });
console.log(r.status, await r.text());
```

For the first production round this returned `{"mines":[24],"openTiles":[2,21]}` on 11 November 2026 without a login, the same as the capture (exhibit E23 in the [evidence register](evidence.md)). The opened tiles in the reply are not determined by the four inputs: LIQD can only know them from its stored round.

**Third way: by hand.** The manual path follows.

The values below are the fields LIQD's own endpoints return, as recorded in the raw captures.

1. **Before you rotate, keep the commitment.** The active pair's `activeServerSeedHash` (this dataset's `hashedServerSeed`) is published before any round is played under it.
2. **Rotate the seed pair** to retire it. The rotation reply reveals the retired server seed as `revealedServerSeed` (`serverSeed`). Its SHA-256, taken over the 32-character hex **string** as UTF-8 text, not over the 16 bytes it decodes to, must equal the commitment.
3. **Take the round's inputs:** `clientSeed`, `nonce` (0 for the first round after a rotation, +1 per round) and `mineCount`.
4. **Recompute the mines.** The HMAC key is the hex-decoded seed. For each draw `i` = 0 … `mineCount` − 1, with `r` = 25 − `i`: compute `HMAC-SHA256(key, "clientSeed:nonce:i")`, read it as eight 4-byte big-endian integers and use the first one below `floor(2^32 / r) × r`, modulo `r`; swap position `i` with position `i` + that value in the list 1 … 25. The first `mineCount` entries are the mines, in draw order ([docs/ALGORITHM.md](docs/ALGORITHM.md) §2). Tiles are numbered 1 to 25.
5. **Check the result.** A round is a win exactly when no opened tile is a mine. A win is booked as stake × `0.99 × C(25,k)/C(25−m,k)` cut to the cent, and the wallet field in the reply is `floor8(betAmountWallet × floor8(exact multiplier))`. Here `betAmountWallet` is the USDT stake in the place-bet reply, and the exact multiplier is `0.99 × C(25,k)/C(25−m,k)`, not the reply's `multiplier` field (that field is the exact multiplier cut to two decimals). For bet `k09hZxP4ZhUYw3SuDhspz` (1 mine, 2 tiles): `floor8(0.99 × 300/276) = 1.07608695`, and `floor8(0.07085468 × 1.07608695) = 0.07624579`, the reply's `winningAmountWallet`.

A script with a worked production round, and five worked rounds, are in the [overview](MANIFEST.md#verify-a-bet). This path is evidenced from the production API replies; LIQD's on-screen panel and the position of each tile number on the board were not captured on production (limitation DL-19).

## Files and evidence

The report is this README, the [audit overview](MANIFEST.md) (game rules, algorithm, RTP and payout analysis, verification results, limitations and release history), the [evidence register](evidence.md) and the [integrity, forgery and mutation testing](exploit-testing.md) chapter; [SUMMARY.md](SUMMARY.md) lists them in reading order.

- [Scored dataset](data/mines-prod-full-6574bets.json) — SHA-256 `4d684d5e035e0be384685a2b44b9f5ab13b3f638e58686310cd778945c31741b`, converted from the three raw production captures in `data/` (8–9 November: `f4a35b0635fd8a196d31ebccd64fa3b617ab127716def789a0f1529b9ffe7d60`; 10 November, phases D and A top-up: `3b8f81d5de58ccbf60fc809a53a34174d2c088aa78aba67ab1a0742a6d866141`; 10 November, phase C: `795825a548d786946d8ab0d9331dcd80d86a59b5b73dcea197707482bf177376`). Mines has no multiplier-table config file: the payout is a closed-form function of mine count and tiles revealed.
- [Verification results](outputs/verification-results.json), [derived figures](outputs/audit-figures.json), [simulation results](outputs/simulation-results.json), [RTP claim table](outputs/rtp-claim-table.json) and [release manifest](RELEASE-MANIFEST.json).
- [Audit report](https://audit.provablyfair.org/casino/liqd/games/mines/overview) · [Public repository](https://github.com/ProvablyFair-org/liqd-mines) · [MIT license](LICENSE).
