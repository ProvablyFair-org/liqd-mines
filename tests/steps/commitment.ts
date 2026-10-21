/**
 * Steps 1–4: Commit-Reveal Integrity
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_SEEDS, EXPECTED_EPOCH_SIZE, NONCE_BASE, EXPECTED_CAPTURE_RETRY_GAPS } from '../../src/pins';
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
  // G-BIND: `seeds.length` is a property of the file being scored,
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

  // ── Step 2, chronology arm (QA 2026-10-02, A10) ──────────────────────────────────────────
  // "The commitment was recorded before the bet" was stated in the report but rested on
  // timestamps no step read: moving them made nothing fail. Three orderings are now asserted
  // per epoch, on the capture's own recorded times (`at`):
  //   (a) the commitment the epoch's bets are bound to was recorded before the epoch's first bet —
  //       for epoch 0 the pre-capture record whose nextHashedServerSeed it is, for every later
  //       epoch the previous epoch's seed record whose nextHashedServerSeed it is;
  //   (b) the epoch's own seed record was written before its first bet;
  //   (c) the rotation that revealed the epoch's seed (the next epoch's seed record) was written
  //       after the epoch's last bet — 137 transitions; the closing rotation of the last epoch is
  //       not a seed record and is not timed here.
  // SCOPE: these are the auditor's capture-clock times. They establish the order the capture
  // RECORDED, not an operator-side event order. A violation hard-fails: a capture whose recorded
  // order puts a bet before the commitment it is bound to cannot support "commitment before bet".
  const tAt = (x: unknown): number => (typeof x === 'string' ? Date.parse(x) : NaN);
  const betsOfEpoch = new Map<number, typeof bets>();
  for (const b of bets) { const a = betsOfEpoch.get(b.epoch) ?? []; a.push(b); betsOfEpoch.set(b.epoch, a); }
  let commitBeforeBet = 0, recordBeforeBet = 0, revealAfterBet = 0, chronoChecked = 0, revealChecked = 0;
  let firstChronoFault = '';
  byEpoch.forEach((s, i) => {
    const eb = betsOfEpoch.get(s.epoch) ?? [];
    if (eb.length === 0) return;
    chronoChecked++;
    const times = eb.map(b => tAt(b.at));
    const firstBet = Math.min(...times), lastBet = Math.max(...times);
    const commitRec = i === 0 ? { at: pc?.at, next: pc?.nextHashedServerSeed } : { at: byEpoch[i - 1].at, next: byEpoch[i - 1].nextHashedServerSeed };
    const commitOk = commitRec.next === s.hashedServerSeed && tAt(commitRec.at) < firstBet;
    const recordOk = tAt(s.at) < firstBet;
    if (commitOk) commitBeforeBet++;
    if (recordOk) recordBeforeBet++;
    if (i + 1 < byEpoch.length) {
      revealChecked++;
      if (lastBet < tAt(byEpoch[i + 1].at)) revealAfterBet++;
      else if (!firstChronoFault) firstChronoFault = `epoch ${s.epoch}: last bet ${new Date(lastBet).toISOString()} not before the next seed record ${byEpoch[i + 1].at}`;
    }
    if (!firstChronoFault && !commitOk) firstChronoFault = `epoch ${s.epoch}: commitment record ${commitRec.at} not before first bet ${new Date(firstBet).toISOString()}`;
    if (!firstChronoFault && !recordOk) firstChronoFault = `epoch ${s.epoch}: seed record ${s.at} not before first bet ${new Date(firstBet).toISOString()}`;
  });
  const chronoOk = chronoChecked === EXPECTED_SEEDS && commitBeforeBet === chronoChecked && recordBeforeBet === chronoChecked
    && revealChecked === EXPECTED_SEEDS - 1 && revealAfterBet === revealChecked;

  const s2 = step(2, 'Next-Seed Pre-Commitment Chain',
    promoFails === 0 && promoChecked === expectedTransitions && preOk && chronoOk ? 'PASS' : 'FAIL',
    (promoFails === 0
      ? `${promoChecked}/${expectedTransitions} transitions: nextHashedServerSeed == next epoch's hashedServerSeed (chain INTACT)`
      : `${promoChecked - promoFails}/${expectedTransitions} match; ${promoFails} mismatch`)
      + `; pre-capture link: reveal→commitment ${preRevealOk ? 'OK' : 'FAIL'}, chains into epoch 0 ${preChainOk ? 'OK' : 'FAIL'}`
      + `; recorded order (capture clock, the order the capture RECORDED — not an operator-side event order): `
      + `${commitBeforeBet}/${chronoChecked} epochs' commitment recorded before their first bet (pre-capture record for epoch 0, the previous seed record's next-hash after that), `
      + `${recordBeforeBet}/${chronoChecked} seed records written before their epoch's first bet, `
      + `${revealAfterBet}/${revealChecked} rotations (the next seed record) written after the retiring epoch's last bet (the closing rotation of the last epoch is not a seed record and is not timed)`
      + (firstChronoFault ? `; first fault: ${firstChronoFault}` : ''),
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

  // ── Step 3, operator seed-reference arm (QA 2026-10-02, A9) ────────────────────────────────
  // `hashedServerSeed` on a bet row is written by the CAPTURE SCRIPT from the epoch it opened —
  // LIQD's bet responses carry no hash (the auto-bet field list in capture/capture-mines.reference.mjs
  // has none, and none of the 1,000 raw place-bet/settle responses of either supplement capture,
  // 2026-09-26 or 2026-10-03, has one) — so the
  // arm above checks the capture's own labelling.
  // The one seed reference LIQD itself serves on every settle is `serverSeedId`. Until this arm no
  // step read it, and swapping one bet's serverSeedId for another epoch's made nothing fail.
  // Asserted: every bet carries a non-empty serverSeedId, it is ONE value within each epoch, and
  // the per-epoch values are pairwise DISTINCT across all EXPECTED_SEEDS epochs (one operator seed
  // reference per committed seed). A violation hard-fails, like the hash arm.
  let idMissing = 0, epochsMultipleIds = 0;
  const idOfEpoch = new Map<number, string>();
  for (const [ep, epochBets] of betsByEpoch) {
    const ids = new Set<string>();
    for (const b of epochBets) {
      const id = (b as { serverSeedId?: unknown }).serverSeedId;
      if (typeof id !== 'string' || id === '') idMissing++;
      else ids.add(id);
    }
    if (ids.size !== 1) epochsMultipleIds++;
    else idOfEpoch.set(ep, [...ids][0]);
  }
  const distinctIds = new Set(idOfEpoch.values()).size;
  const idsOk = idMissing === 0 && epochsMultipleIds === 0 && idOfEpoch.size === EXPECTED_SEEDS && distinctIds === EXPECTED_SEEDS;

  const s3 = step(3, 'Hash Consistency Within Epoch',
    epochsMultipleHashes === 0 && s3CoverageOk && idsOk ? 'PASS' : 'FAIL',
    `${betsByEpoch.size}/${EXPECTED_SEEDS} epochs (pinned in src/pins.ts, not counted from the dataset): all bets within each epoch share the same hashedServerSeed; ${epochsMultipleHashes} violations `
      + `(that field is written onto each bet row by the capture script from the epoch it opened; LIQD's bet responses carry no hash — none in the auto-bet field list of capture/capture-mines.reference.mjs, none in the 1,000 raw place-bet and settle responses of either multi-reveal supplement capture, 2026-09-26 or 2026-10-03 — so this arm checks the capture's labelling). `
      + `Operator-served seed reference serverSeedId (on every settle response): ${idOfEpoch.size}/${EXPECTED_SEEDS} epochs carry one value across all their bets (${epochsMultipleIds} epochs with more than one, ${idMissing} bets without one), `
      + `${distinctIds} distinct across the ${EXPECTED_SEEDS} epochs`,
  );

  // ── Step 4: Nonce audit ──────────────────────────────────────────────────────
  // Per epoch: a single client seed, and the nonces EXACTLY NONCE_BASE … NONCE_BASE+EPOCH_SIZE−1
  // with no gap, repeat or reorder.
  //
  // THE WINDOW IS DECLARED IN CODE, NOT READ FROM THE DATA. Both ends come from src/pins.ts
  // (NONCE_BASE, EXPECTED_EPOCH_SIZE). The earlier form read the window from each seed record's
  // own `nonceStart`/`nonceEnd` — the dataset being scored — so a capture whose records and bets
  // were shifted together (1 … 50) passed by agreeing with itself. The seed record is still read,
  // but now as a CLAIM checked against the declaration: a record whose window disagrees with
  // [NONCE_BASE, NONCE_BASE+EPOCH_SIZE−1] hard-fails.
  //
  // GAPS ARE COUNTED AGAINST A DECLARED NUMBER. A gap the revealed seed cannot account for, a
  // duplicate, a second client seed, a nonce outside the window, or a record/declaration
  // disagreement is a HARD FAIL. A gap whose epoch seed is revealed and whose remaining bets all
  // recompute is consistent with an auditor-side capture retry — but only the number of those
  // declared in src/pins.ts EXPECTED_CAPTURE_RETRY_GAPS may be attributed to the capture. A count
  // that differs from the declaration is a different dataset and hard-fails; a count that matches a
  // non-zero declaration is a capture-origin FLAG (disclosed, verdict-neutral). This capture
  // declares 0.
  //
  // HONEST LIMIT (G-WITNESS): the window is what the capture requested under each seed, not an
  // operator-side counter. This establishes that the bet rows are complete against that window,
  // not that no other nonce was ever served (selective orphaning — see
  // MANIFEST.md#dataset-and-capture and MANIFEST DL-9).
  const hardFailures: string[] = [];
  const retryGaps: string[] = [];
  let gapCount = 0;
  let epochsChecked = 0;
  const windowStart = NONCE_BASE;
  const windowEnd = NONCE_BASE + EXPECTED_EPOCH_SIZE - 1;
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
    // Reorder: the capture records bets in the order they settled; within an epoch that order
    // must be the nonce order. A served sequence 0,1,3,2,… is a reorder even though the set is
    // complete.
    const inCaptureOrder = epochBets.map(b => b.nonce);
    if (inCaptureOrder.some((n, i) => i > 0 && n <= inCaptureOrder[i - 1])) {
      hardFailures.push(`Epoch ${epochNum}: nonces out of order in the capture sequence`);
    }

    const nonceSet = new Set(nonces);
    // Nonce-reuse guard: a duplicated nonce leaves the window looking complete, so uniqueness is
    // asserted directly — Set.size must equal the bet count or a reused nonce is invisible.
    if (nonceSet.size !== sorted.length) {
      hardFailures.push(`Epoch ${epochNum}: ${sorted.length - nonceSet.size} duplicate nonce(s) (reuse)`);
    }
    const outside = nonces.filter(n => !Number.isInteger(n) || n < windowStart || n > windowEnd);
    if (outside.length > 0) {
      hardFailures.push(`Epoch ${epochNum}: ${outside.length} nonce(s) outside the declared window [${windowStart}, ${windowEnd}] (first ${outside[0]})`);
    }
    const rec = seedRecordByHash.get(hash);
    if (!rec) {
      hardFailures.push(`Epoch ${epochNum}: no seed record for hashedServerSeed ${hash.slice(0, 12)}…`);
    } else if (rec.nonceStart !== windowStart || rec.nonceEnd !== windowEnd) {
      hardFailures.push(`Epoch ${epochNum}: seed record window [${rec.nonceStart}, ${rec.nonceEnd}] disagrees with the declared [${windowStart}, ${windowEnd}] (src/pins.ts NONCE_BASE, EXPECTED_EPOCH_SIZE)`);
    }
    const missing: number[] = [];
    for (let n = windowStart; n <= windowEnd; n++) if (!nonceSet.has(n)) missing.push(n);

    if (missing.length > 0) {
      gapCount += missing.length;
      // Attributable to the capture only if the seed is revealed AND every recorded bet in the
      // epoch recomputes (the missing round simply never landed in the capture).
      const ss = seedMap.get(hash);
      let allVerify = ss !== undefined;
      if (ss) {
        for (const b of sorted) {
          const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
          if (!sameMines(mines, b.mineTiles)) { allVerify = false; break; }
        }
      }
      if (allVerify) {
        retryGaps.push(`epoch ${epochNum} (Phase ${phase}, mineCount ${sorted[0].mineCount}), nonce ${missing.join(',')} unrecorded; all recorded bets verify`);
      } else {
        hardFailures.push(`Epoch ${epochNum}: unverifiable nonce gap at ${missing.join(',')}`);
      }
    }
    epochsChecked++;
  }

  // Coverage guard: every epoch (one per seed record, EXPECTED_SEEDS of them) must be audited.
  if (epochsChecked !== seeds.length || epochsChecked !== EXPECTED_SEEDS) {
    hardFailures.push(`coverage: audited ${epochsChecked}/${EXPECTED_SEEDS} epochs`);
  }
  if (gapCount !== EXPECTED_CAPTURE_RETRY_GAPS) {
    hardFailures.push(`${gapCount} nonce gap(s) found, ${EXPECTED_CAPTURE_RETRY_GAPS} capture-retry gap(s) declared (src/pins.ts EXPECTED_CAPTURE_RETRY_GAPS) — an undeclared gap is not attributable to the capture`);
  }
  const base = `${epochsChecked}/${EXPECTED_SEEDS} epochs: single client seed each, nonces in capture order, unique, and exactly the DECLARED window [${windowStart}, ${windowEnd}] `
    + `(NONCE_BASE ${NONCE_BASE} and EXPECTED_EPOCH_SIZE ${EXPECTED_EPOCH_SIZE} are code constants in src/pins.ts — not the minimum observed, and not the seed records' own nonceStart/nonceEnd, which are checked AGAINST the declaration: 0 disagreements). `
    + `Gaps: ${gapCount} found, ${EXPECTED_CAPTURE_RETRY_GAPS} capture-retry gap(s) declared. `
    + `The window is what the capture requested under each seed, not an operator-side counter: this establishes that the bet rows are complete against it, not that no other nonce was ever served (selective orphaning — see MANIFEST.md#dataset-and-capture).`;
  let s4: StepResult;
  if (hardFailures.length > 0) {
    s4 = step(4, 'Nonce Audit', 'FAIL', `${hardFailures.length} violations: ${hardFailures.slice(0, 3).join('; ')}`);
  } else if (gapCount > 0) {
    // Only reachable when the declaration is non-zero AND the gaps found match it exactly.
    s4 = step(4, 'Nonce Audit', 'FLAG',
      `${base} Capture-origin FLAG (disclosed, verdict-neutral): ${retryGaps.join('; ')}. Every recorded bet in those epochs recomputes from the revealed seed; the missing round itself was not captured and is NOT verified.`,
      'capture');
  } else {
    s4 = step(4, 'Nonce Audit', 'PASS', `${base} No gaps in any epoch.`);
  }

  return [s1, s2, s3, s4];
}
