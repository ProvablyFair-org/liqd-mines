# LIQD Mines — Provably Fair Audit

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** `PF-2026-LQ02` · **Release:** `v1.0.0` (the first public release), [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json) · **Capture:** 30 July 2026 on `qa.liqd.com` (LIQD's QA environment), with a multi-reveal supplement captured 3 October 2026

**Result: PROVABLY FAIR — Full Pass, provisional.** All 6,900 captured outcomes and settlement amounts verified. 22 of 22 scored checks passed, zero flags, zero hard failures. Check 10 no longer scores payout caps (since 15 October 2026): payout caps are excluded from the audit, and LIQD states that Mines has had no multiplier cap since the end of August 2026, which is why the later builds' game settings carry none where the audited July build's carried 10,000×. Check 22 scores the multi-reveal supplement captured on 3 October 2026: all 393 wins credited the exact amount. **Two rulings are open** — which RTP statement on LIQD's page LIQD is held to; and whether a win paid $0.00000001 short is a FAIL or a FLAG (it moves no result today). The third, the payout-cap rule, was settled on 15 October 2026. They are stated in [Open rulings](MANIFEST.md#open-rulings--pending-the-profile-owner); the result above holds the package's current treatment of each.

**Scope:** The findings apply to the published QA sample and the reference model. **Certification status: provisional pending anonymous production verification**: extending certification to public production requires a separate anonymous capture and a passing review of the production evidence. The reference formula gives 99.0000% theoretical RTP (1.00% house edge) at all 300 legal configurations, uncapped and before settlement rounding; paid wins were checked against it at 25 configurations in the audited dataset and 20 more in the supplement. Payout-limit enforcement, wallet balances and production behaviour are outside the evidence.

**What the audit excludes:** round payout limit enforcement (`maxExposure` 50,000, labelled `global`). LIQD states the round ends and pays the full multiplier for the revealed tiles; not tested, no captured round reached it (largest win 24.75×); where players see the limit was not stated.

## What was verified

| Check | Captured evidence |
|---|---|
| Outcomes | 6,900 of 6,900 recorded mine layouts recompute in recorded draw order from server seed, client seed, nonce and mine count |
| Commitments | 138 of 138 revealed seeds match their SHA-256 commitments; 137 of 137 links between successive commitments intact |
| Settlement (audited dataset) | 3,104 of 3,104 wins equal stake × exact multiplier floored to eight decimals; 3,796 of 3,796 losses pay zero |
| Multi-reveal supplement (3 October 2026) | 1,000 interactive rounds: 1,000 layouts and 3,314 reveals recompute; 393 of 393 wins credited at the exact rule and displayed at the exact multiplier floored to two decimals |
| Analytical RTP | `winProbability × exactMultiplier = 0.99` at all 300 legal (mine count, reveal depth) cells |
| Simulation | Pass 1: 24 million rounds, replayed in full in every verify run; Pass 2: all 138 revealed seeds, 240,000 bootstrap statistics reproduced from the recorded master seed |
| Client seed | Replacing the recorded client seed changed 6,891 of 6,900 recomputed layouts (99.87%) |
| Game settings | The supplement build's settings records carry no `maxOdds`, matching LIQD's statement that the multiplier cap was removed at the end of August 2026; check 10 prints this and does not score it |

The RNG module that recomputes the outcomes, `src/rng.ts`, was rebuilt from a written specification, [docs/ALGORITHM.md](docs/ALGORITHM.md), by an implementer who never opened LIQD's code. LIQD's code is run as a second check, not used as the source: the validation vectors from the RNG specification LIQD supplied privately pass 3 of 3, and the ProvablyFair.org site verifier agrees with it on all 6,900 audited rounds (check 5).

The 22 checks are not 22 independent tests of what LIQD served: nine test what LIQD served (checks 1, 2, 4, 5, 7, 8, 17, 20 and 22), and since 2 October 2026 checks 3 and 10 each carry one part that reads a served field. Capture origin, account scope and capture method are auditor-attested. The limitations, residual risks and premises are in the [overview's limitations](MANIFEST.md#limitations-and-trust).

## Run the audit

Open a terminal in this `mines` directory. Use **Node 22.x**, as pinned in `package.json` `engines` and [.nvmrc](.nvmrc).

```sh
npm ci
npm test
```

Expected: the staleness gate ok; **49/49 unit tests**; the verifier prints **Passed 22/22, Hard fails 0, Flags 0 (0 verdict-affecting, 0 capture-origin), VERDICT: PROVABLY FAIR — Full Pass** and "Reproduction vs the committed artifacts on Node 22.23.1: REPRODUCED"; the release-manifest check ok. `npm test` exits **0**, the verifier's code for a Full Pass. Every verify run replays all 24,000,000 Pass-1 rounds (about 70 s on a 12-core machine). `npm test` needs no dependency installation; `npm ci` installs the TypeScript tools.

```sh
npm run test:toolchain                    # build check, source tests, new simulation, figures, verify, both adversarial batteries
node scripts/release-manifest.mjs --check
```

Run the 49 unit tests from source with `npm exec -- mocha`. Ordinary runs write to `outputs/run/` and leave the committed evidence intact. The comparison rules, exit codes, adversarial batteries and the deliberate artifact-refresh procedure are in [reproduction details](MANIFEST.md#reproduce-the-audit).

## Verify a bet

Before you rotate, copy the **Active Server Seed (Hashed)** from the Seeds panel: the round view does not show it. Rotate the seed pair to reveal the retired server seed; it is shown in My Bets, under the round's Provably Fair section (E21). Its SHA-256, taken over the hex **string** as UTF-8, must equal the commitment. The HMAC key is the hex-decoded seed; for each draw 0 … `mineCount` − 1 the first 4-byte big-endian chunk below `floor(2^32 / r) × r` (r = 25 − draw) drives a forward Fisher–Yates swap over tiles 1…25, and the first `mineCount` tiles are the mines, in draw order ([docs/ALGORITHM.md](docs/ALGORITHM.md) §2). Tiles are numbered across rows: tile 1 is the top-left square, tile 5 the top-right, tile 25 the bottom-right (E22, the E21 round's finished board). The [complete instructions](MANIFEST.md#verify-a-bet) give the field names, a script filled in with a captured bet and six worked examples.

## Files and evidence

There are two documentation files: this README and [MANIFEST.md — consolidated audit overview](MANIFEST.md). The overview contains the game rules, algorithm, RTP and payout analysis, verification results, evidence register, limitations, open rulings and release history.

- [Captured dataset](data/mines-master-6900bets.json) — SHA-256 `c7c2e8a930549e11e3e564a962aea0ca2875b6eb94bc1f4347cc703bc410b222`. Mines has no multiplier-table config file: the payout is a closed-form function of mine count and tiles revealed.
- [Multi-reveal supplement, 3 October 2026](data/liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.json) — SHA-256 `a7737572394215b0262eb467eec4fe5ff083e87c0d132746aa6e66c271277b45`, with its [journal](data/liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.journal.ndjson); the 26 September 2026 capture of the same plan is kept as dated history.
- [Verification results](outputs/verification-results.json), [derived figures](outputs/audit-figures.json), [simulation results](outputs/simulation-results.json), [RTP claim table](outputs/rtp-claim-table.json) and [release manifest](RELEASE-MANIFEST.json).
- [Audit report](https://audit.provablyfair.org/casino/liqd/games/mines/overview) · [Public repository](https://github.com/ProvablyFair-org/liqd-mines) · [MIT license](LICENSE).
