# LIQD Mines Fairness Audit

**QA result: all 6,900 captured outcomes and settlement amounts verified. All 21 scored checks passed, with zero flags and zero hard failures.**

This repository presents the fairness audit of LIQD Mines for the published pre-release QA sample. It includes the captured dataset, the auditor's independent reconstruction, executable verification, and mathematical and statistical analysis. All **6,900 recorded mine layouts** match recomputation, and all **138 revealed server seeds** match their recorded commitments.

**Certification status: provisional pending anonymous production verification.** The findings below apply to the published QA sample and reference model. Extending certification to public production requires a separate anonymous capture and a passing review of the production evidence.

| Audit scope | Recorded value |
|---|---|
| Game | LIQD Mines, `fast-games-13` |
| Audit attribution | ProvablyFair.org |
| Captured environment | `qa.liqd.com`, pre-release QA |
| Capture window | 30 July 2026, 16:23–18:05 UTC |
| Population | 6,900 bets across 138 seed epochs |
| Account scope | One account, as attested by the auditor |
| Currency and stakes | USDC; $0.10 and $10.00 |
| Captured game path | Atomic auto-bet, including planned reveal depths of one and five |

Capture origin, account scope, and capture method are auditor-attested. The repository supports independent checks of the published records; [evidence provenance](AUDIT_CONTEXT.md#dataset-and-evidence-provenance) identifies the retained artifacts.

## What the audit verifies

- **Reproducible outcomes.** The recorded server seed, client seed, nonce, and mine count reproduce all 6,900 mine layouts in their recorded draw order, with zero mismatches.
- **Seed commitment integrity.** All 138 revealed seeds satisfy the recorded SHA-256 commitments. All 137 links between successive seed commitments are intact.
- **Deterministic mine placement.** In the reconstructed algorithm, the seed inputs, nonce, and mine count determine the layout. The player's reveal positions do not enter the mine-generation calculation.
- **Layout parity at both captured stakes.** The $0.10 sample and all 200 $10 bets agree with the same reference function, which takes no wager amount as an input. This verifies the sampled outcomes; it does not establish universal stake independence in the operator's backend.
- **Analytical RTP.** The uncapped reference formula gives `winProbability × exactMultiplier = 0.99` for all 300 legal combinations of mine count and reveal depth. The theoretical RTP is 99.0000%, with a 1.00% house edge, before settlement rounding and payout limits.
- **Verified settlement calculations.** All 3,104 recorded winning amounts equal the stake multiplied by the exact multiplier, floored to eight decimal places. All 3,796 losses report zero payout. Winning settlements cover 25 of the 300 configurations; the full grid is covered analytically. The two-decimal display multiplier does not determine these settlement amounts.
- **Published simulation results.** Pass 1 records 24 million rounds from the independent implementation, one million per mine count. Its first-draw uniformity, pairwise, and first-draw serial checks pass at the declared adjusted thresholds. Mean simulated RTP is 98.9427%, consistent with 99.0000% under the stated sampling-variance model. Full Pass-1 replay is available as a separate command.
- **Reproducible captured-seed analysis.** Pass 2 evaluates all 138 revealed seeds. Its 240,000 bootstrap statistics and all 138 early p-values reproduce from the recorded master seed. The seed-selection diagnostic passes, with four flagged seeds under the stated nominal model.
- **Client-seed participation.** Player-supplied seeds were accepted in the captured custom-seed phase. Replacing the recorded client seed with the test control seed changed 6,891 of 6,900 recomputed layouts, or 99.87%.

The [technical report](AUDIT_CONTEXT.md) maps these findings to their evidence, gives worked examples, and defines the statistical and verification methods. It distinguishes properties of the reconstruction from observations of the captured game.

## Reproduce the published checks

With Node.js and npm available, run from the repository root:

```sh
npm test
```

This runs the bundled **45 unit tests**, followed by the **21 scored verification checks**, including complete Pass-2 bootstrap reconstruction. Dependency installation is not required for these bundled commands. To run only the scored verifier:

```sh
node verify.js
```

Results are written to `outputs/run/`, including a field-level comparison with the published results. The committed evidence remains unchanged under these default commands. Read the reported pass, flag, and failure counts: a hard failure returns a nonzero exit code; a conditional result containing flags returns zero.

For the TypeScript tools, install the locked dependencies with `npm ci`:

| Command | Purpose |
|---|---|
| `npm run build` | Rebuild the bundled tools from the TypeScript sources |
| `npm run build:check` | Check that the bundled tools exactly match their source build |
| `npm exec -- mocha` | Run the 45 unit tests from their TypeScript sources |
| `npm run verify` | Run the scored verifier from source; write results to `outputs/run/` |
| `npm run deep-replay` | Recompute all 24 million published Pass-1 rounds and compare their statistics; read-only |
| `npm run mutations` | Exercise the declared source-mutation cases in disposable copies |
| `npm run forgeries` | Exercise the declared dataset and report-forgery cases in disposable copies |
| `npm run test:toolchain` | Run source tests, generate a new simulation, regenerate figures, verify, and run both adversarial batteries |

`test:toolchain` is a new experiment and replaces the simulation and figure artifacts. Use a separate working copy for it. Full Pass-1 replay is a separate command from both `npm test` and `test:toolchain`.

**Reproduction coverage:** the published captured outcomes, commitments, and payouts are recalculated. Step 17 reconstructs the full Pass-2 bootstrap from its recorded master seed and checks all 138 early p-values. Pass 1 retains its own per-configuration seed pairs for full deep replay.

For a second implementation of the bootstrap replay, using Python 3.9 or later and no third-party packages:

```sh
npm run bootstrap-replay
```

This independently reconstructs all 240,000 bootstrap statistics, checks them against the retained null, and recalculates the captured-seed statistics, p-values, and flag decisions. It writes a report under `outputs/run/` and preserves published evidence. The [reproduction guide](AUDIT_CONTEXT.md#reproduction-and-test-coverage) and [simulation provenance](outputs/simulation-provenance.json) identify the separate replay inputs for each pass. The published master seed applies to Pass 2; the existing Pass-1 results replay from their recorded row seeds.

## Dataset integrity

The dataset is `data/mines-master-6900bets.json`. Its SHA-256 is:

```text
c7c2e8a930549e11e3e564a962aea0ca2875b6eb94bc1f4347cc703bc410b222
```

The verifier checks this digest before scoring the dataset. It identifies the exact bytes covered by the audit. Capture provenance and the distinction between recorded responses and auditor-calculated fields are documented in the [technical report](AUDIT_CONTEXT.md#dataset-and-evidence-provenance).

## What the audit excludes

- Infrastructure, server, and platform security.
- Wallet balance reconciliation, payment processing, custody, and account systems beyond the recorded game-settlement responses.
- Enforcement of maximum-profit, maximum-odds, and other payout limits.
- Uncaptured game paths, including interactive cash-out and mid-round seed rotation.
- Public-production behavior and behavior outside the captured sample.
- Promotional, bonus, and loyalty programs.

The statistical findings concern the specified tests of the auditor's implementation and captured seed inputs. Their thresholds use approximations where described in the technical report. They do not establish universal backend independence or the absence of adversarial seed selection. The theoretical payout identity concerns the uncapped reference formula.

## Anonymous production verification

The production audit will retain the independent outcome and payout checks and add the following work using ordinary player-facing access:

| Planned production work | Intended evidence and closure |
|---|---|
| Anonymous production capture | Recompute production outcomes and commitments; record the environment, settings, dates, and exposed build identifiers. This addresses the QA-only scope for the observed production sample. |
| Wallet reconciliation | Record before-and-after balances and player-accessible transaction history where available. Establish which sampled settlements reconcile to wallet entries. |
| Interactive play and recovery | Exercise reveal, cash-out, reconnect, retry, and seed-rotation behavior supported by the production interface. Verify settlement and commitment consistency for those paths. |
| Broader payout coverage | Add legal reveal depths, mine counts, and stake values; publish the resulting winning-settlement coverage matrix. |
| Payout-limit investigation | Record production limits and observed placement, reveal, or settlement enforcement. A cap remains excluded if the relevant behavior cannot be observed. |
| Seed and evidence capture | Record the server commitment before generating each fresh cryptographically random client seed; retain acknowledgements, bet responses, seed reveals, failures, retries, and capture-time hash records. This strengthens the evidence for commitment timing and unpredictable client inputs. |
| Reproducible production analysis | Publish the new dataset and simulation with a recorded master seed, derivation version, parameters, full Pass-1 replay results, and the outcome of each planned check. This maintains the same complete bootstrap replay coverage used in this release. |

Anonymous production capture is required to extend certification beyond QA. The production report must support its findings, resolve material discrepancies, and identify checks that remain unobserved or unavailable through player-facing access. Wallet-system security, custody, and infrastructure security remain separate audit subjects.

## Repository guide

- [AUDIT_CONTEXT.md](AUDIT_CONTEXT.md): methodology, evidence map, worked examples, test coverage, and production acceptance criteria.
- `src/`: independent game reconstruction, statistics, simulation, and verification helpers.
- `tests/`: source tests, scored verification steps, fixtures, and adversarial test registries.
- `scripts/`: reproducible build tooling and the independent Python bootstrap replay.
- `data/`: the captured dataset.
- `outputs/`: published simulation, analysis provenance, retained bootstrap null, derived figures, verification results, and both replay reports.
- `capture/capture-mines.reference.mjs`: sanitized capture-method reference; authentication and transport are omitted, so it cannot perform a network capture.
- `evidence/`: supporting interface screenshots.

## License

MIT. See [LICENSE](LICENSE).
