/**
 * Steps 1–4: Commit-Reveal Integrity
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_SEEDS } from '../../src/pins';
import { commitHash, revealMines, sameMines } from '../../src/rng';

export function run(ctx: VerifyContext): StepResult[] {
  const { seeds, byHash, bets, seedMap, meta } = ctx;

  // ── Step 1: Seed hash integrity ─────────────────────────────────────────────
  // liqd commitment = SHA-256( utf8_bytes( serverSeed_hex_string ) ), via commitHash.
  let checked = 0, fails = 0;
  for (const s of seeds) {
    if (!s.serverSeed) continue;
    if (commitHash(s.serverSeed) !== s.hashedServerSeed) fails++;
    checked++;
  }
  // Coverage guard: a delivered dataset rotates 100% of seeds, so every seed record must
  // carry a revealed serverSeed. checked === seeds.length or the step is vacuous (0 reveals
  // must FAIL, never pass on `fails === 0`).
  //
  // G-BIND (H-G class sweep, 2026-09-09): `seeds.length` is a property of the file being scored,
  // so "138/138" would still read 138/138 on a capture that shipped 100 seeds. The headline number
  // this step produces is quoted throughout the report, so it is ALSO compared to EXPECTED_SEEDS
  // from src/pins.ts. Steps 11–12 hard-fail on the same condition; the redundancy is deliberate —
  // a figure the report quotes should not depend on another step having run.
  const s1PopulationOk = seeds.length === EXPECTED_SEEDS;
  const s1 = step(1, 'Seed Hash Integrity',
    fails === 0 && checked === seeds.length && s1PopulationOk ? 'PASS' : 'FAIL',
    `${checked}/${seeds.length} revealed seeds checked against the pinned population of ${EXPECTED_SEEDS} (src/pins.ts EXPECTED_SEEDS, a code constant — not the dataset's own count); SHA-256(utf8(serverSeed)) == hashedServerSeed; ${fails} mismatches`
      + (s1PopulationOk ? '' : `; POPULATION FAIL: ${seeds.length} seed records loaded, ${EXPECTED_SEEDS} pinned`),
  );

  // ── Step 2: Next-seed pre-commitment chain ──────────────────────────────────
  // Each epoch's nextHashedServerSeed must equal the following epoch's hashedServerSeed.
  const byEpoch = [...seeds].sort((a, b) => a.epoch - b.epoch);
  let promoChecked = 0, promoFails = 0;
  for (let i = 0; i + 1 < byEpoch.length; i++) {
    promoChecked++;
    if (byEpoch[i].nextHashedServerSeed !== byEpoch[i + 1].hashedServerSeed) promoFails++;
  }
  // Coverage guard: N−1 transitions across N seed epochs must all be exercised.
  const expectedTransitions = seeds.length - 1;
  // Pre-capture link: the MANIFEST lists meta.preCapture as a data-witnessed chain anchor,
  // but no step read it — a zeroed/absent link would pass unnoticed. Assert it here (folded
  // into Step 2, no new scored step): the pre-capture round's revealed serverSeed must hash
  // to its own commitment AND its nextHashedServerSeed must chain into epoch 0's
  // hashedServerSeed (the first captured epoch).
  const pc: any = (meta as any)?.preCapture ?? null;
  const firstEpochHash = byEpoch.length > 0 ? byEpoch[0].hashedServerSeed : null;
  const preRevealOk = !!pc && typeof pc.revealedServerSeed === 'string'
    && commitHash(pc.revealedServerSeed) === pc.hashedServerSeed;
  const preChainOk = !!pc && typeof pc.nextHashedServerSeed === 'string'
    && pc.nextHashedServerSeed === firstEpochHash;
  const preOk = preRevealOk && preChainOk;
  const s2 = step(2, 'Next-Seed Pre-Commitment Chain',
    promoFails === 0 && promoChecked === expectedTransitions && preOk ? 'PASS' : 'FAIL',
    (promoFails === 0
      ? `${promoChecked}/${expectedTransitions} transitions: nextHashedServerSeed == next epoch's hashedServerSeed (chain INTACT)`
      : `${promoChecked - promoFails}/${expectedTransitions} match; ${promoFails} mismatch`)
      + `; pre-capture link: reveal→commitment ${preRevealOk ? 'OK' : 'FAIL'}, chains into epoch 0 ${preChainOk ? 'OK' : 'FAIL'}`,
  );

  // ── Step 3: Hash consistency within epoch ────────────────────────────────────
  // Group by epoch (NOT by hash) so this can genuinely FAIL if any epoch mixed
  // hashedServerSeed values. Grouping by hash would be tautological.
  const betsByEpoch = new Map<number, typeof bets>();
  for (const b of bets) {
    const arr = betsByEpoch.get(b.epoch) ?? [];
    arr.push(b);
    betsByEpoch.set(b.epoch, arr);
  }
  let epochsMultipleHashes = 0;
  for (const [, epochBets] of betsByEpoch) {
    const hashes = new Set(epochBets.map(b => b.hashedServerSeed));
    if (hashes.size !== 1) epochsMultipleHashes++;
  }
  // Coverage guard: every seed epoch must be represented by bets — and there must be
  // EXPECTED_SEEDS of them (G-BIND, same reasoning as Step 1).
  const s3CoverageOk = betsByEpoch.size === seeds.length && betsByEpoch.size === EXPECTED_SEEDS;
  const s3 = step(3, 'Hash Consistency Within Epoch',
    epochsMultipleHashes === 0 && s3CoverageOk ? 'PASS' : 'FAIL',
    `${betsByEpoch.size}/${EXPECTED_SEEDS} epochs (pinned in src/pins.ts, not counted from the dataset): all bets within each epoch share the same hashedServerSeed; ${epochsMultipleHashes} violations`,
  );

  // ── Step 4: Nonce audit ──────────────────────────────────────────────────────
  // Per epoch: single client seed, nonces unique and contiguous across the epoch's DECLARED
  // window [nonceStart, nonceEnd] — both bounds asserted against the seed record, not
  // hard-coded and not inferred from the bets themselves.
  //
  // P0-5. This step used to PASS an interior gap "with disclosure" whenever the remaining bets
  // replayed, and it never looked at nonceEnd at all. Both were wrong:
  //   * Replaying the bets that ARE present cannot establish why a nonce is ABSENT. A gap is
  //     consistent with a capture retry AND with a settled round the capture never saw — and
  //     those are different claims about completeness. A gap now FLAGs (→ Conditional Pass);
  //     the disclosure stays, but it stops being scored as a clean pass.
  //   * Only the lower bound was checked (against a hard-coded 0), so an epoch that stopped
  //     early — nonces 0..48 of a declared 0..49 window — was internally contiguous and passed.
  // Both bounds now come from the epoch's own seed record.
  //
  // HONEST LIMIT (G-WITNESS): nonceStart/nonceEnd are the CAPTURE's own record of the window it
  // served, not an operator-side counter. This assertion therefore proves the bet rows agree
  // with the capture's declared window; it cannot prove the operator served no other nonce
  // under that seed. That is the selective-orphaning exposure, disclosed in
  // AUDIT_CONTEXT.md#nonce-coverage and unchanged by this check.
  const hardFailures: string[] = [];
  const disclosedGaps: string[] = [];
  const boundFailures: string[] = [];
  let epochsChecked = 0;
  // hashedServerSeed → the full Seed record (ctx.seedMap only carries the revealed string).
  const seedRecordByHash = new Map(seeds.map(s => [s.hashedServerSeed, s]));

  for (const [hash, epochBets] of byHash) {
    const sorted = [...epochBets].sort((a, b) => a.nonce - b.nonce);
    const nonces = sorted.map(b => b.nonce);
    const epochNum = sorted[0].epoch;
    const phase = sorted[0].phase;

    const clientSeeds = new Set(sorted.map(b => b.clientSeed));
    if (clientSeeds.size !== 1) {
      hardFailures.push(`Epoch ${epochNum}: ${clientSeeds.size} distinct client seeds`);
    }

    const nonceSet = new Set(nonces);
    // Nonce-reuse guard: a duplicated nonce leaves min..max contiguous (the gap scan below
    // sees nothing), so uniqueness must be asserted directly — Set.size must equal the bet
    // count or a reused nonce is invisible.
    if (nonceSet.size !== sorted.length) {
      hardFailures.push(`Epoch ${epochNum}: ${sorted.length - nonceSet.size} duplicate nonce(s) (reuse)`);
    }
    const minNonce = Math.min(...nonces);
    const maxNonce = Math.max(...nonces);
    // BOTH bounds against the epoch's declared window (P0-5). A shifted window (1..50) is
    // internally contiguous and passes the gap scan below; so is a truncated one (0..48).
    const rec = seedRecordByHash.get(hash);
    if (!rec) {
      hardFailures.push(`Epoch ${epochNum}: no seed record for hashedServerSeed ${hash.slice(0, 12)}…`);
    } else {
      if (minNonce !== rec.nonceStart) {
        boundFailures.push(`Epoch ${epochNum}: nonces start at ${minNonce}, declared nonceStart ${rec.nonceStart}`);
      }
      if (rec.nonceEnd === null || rec.nonceEnd === undefined) {
        boundFailures.push(`Epoch ${epochNum}: seed record declares no nonceEnd — the served window is unbounded and cannot be audited for completeness`);
      } else if (maxNonce !== rec.nonceEnd) {
        boundFailures.push(`Epoch ${epochNum}: highest recorded nonce ${maxNonce}, declared nonceEnd ${rec.nonceEnd}`);
      }
    }
    const missing: number[] = [];
    for (let n = minNonce; n <= maxNonce; n++) if (!nonceSet.has(n)) missing.push(n);

    if (missing.length > 0) {
      // A gap is a disclosed artifact iff the seed is revealed AND every recorded
      // bet in this epoch recomputes correctly (orphaned nonce simply never landed).
      const ss = seedMap.get(hash);
      let allVerify = ss !== undefined;
      if (ss) {
        for (const b of sorted) {
          const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
          if (!sameMines(mines, b.mineTiles)) { allVerify = false; break; }
        }
      }
      if (allVerify) {
        disclosedGaps.push(
          `epoch ${epochNum} (Phase ${phase}, mineCount ${sorted[0].mineCount}), nonce ${missing.join(',')} orphaned; all recorded bets verify`,
        );
      } else {
        hardFailures.push(`Epoch ${epochNum}: unverifiable nonce gap at ${missing.join(',')}`);
      }
    }
    epochsChecked++;
  }

  let s4detail: string;
  let s4status: 'PASS' | 'FLAG' | 'FAIL';
  // Coverage guard: every epoch (one per seed record) must have been audited.
  if (epochsChecked !== seeds.length) {
    hardFailures.push(`coverage: audited ${epochsChecked}/${seeds.length} epochs`);
  }
  // A window-bound violation is a hard failure: the recorded bets do not fill the window the
  // capture declares it served, which is a different and stronger defect than an interior gap.
  const allHard = [...hardFailures, ...boundFailures];
  const base = `${epochsChecked}/${seeds.length} epochs: single client seed each, nonces unique, and the recorded nonces fill the epoch's declared window [nonceStart, nonceEnd] exactly `
    + `(both bounds read from the epoch's seed record — nonceStart 0, nonceEnd 49 throughout this capture — not hard-coded and not inferred from the bets). `
    + `nonceStart/nonceEnd are the CAPTURE's own record of the window it served, not an operator-side counter: this establishes that the bet rows are complete against that record, not that no other nonce was ever served (selective orphaning — see AUDIT_CONTEXT.md#nonce-coverage).`;
  if (allHard.length > 0) {
    s4status = 'FAIL';
    s4detail = `${allHard.length} violations: ${allHard.slice(0, 3).join('; ')}`;
  } else if (disclosedGaps.length > 0) {
    // P0-5: a gap FLAGs. Replaying the bets that ARE present cannot establish why one is
    // absent, so an interior gap is a Conditional Pass with the gap disclosed — never a clean
    // pass, and never a detail line that claims "no interior gaps" in the same breath.
    s4status = 'FLAG';
    s4detail = `${epochsChecked}/${seeds.length} epochs audited; ${disclosedGaps.length} epoch(s) have an INTERIOR NONCE GAP: ${disclosedGaps.join('; ')}. `
      + `Every recorded bet in those epochs recomputes from the revealed seed, and the epoch's declared window bounds hold, so the gap is consistent with a capture retry — but a replay of the bets that are present cannot establish why a nonce is absent, so this is reported as a FLAG (Conditional Pass), not a pass with disclosure. `
      + `All other epochs: single client seed, nonces unique and filling [nonceStart, nonceEnd] exactly.`;
  } else {
    s4status = 'PASS';
    s4detail = `${base} No interior gaps in any epoch.`;
  }
  const s4 = step(4, 'Nonce Audit', s4status, s4detail);

  return [s1, s2, s3, s4];
}
