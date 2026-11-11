/**
 * Steps 1–4: Commit-Reveal Integrity
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_SEEDS, EXPECTED_CHAIN_LINKS, EPOCH_PLAN, EPOCH_SIZES, PROD_CAPTURES, NONCE_BASE, EXPECTED_CAPTURE_RETRY_GAPS } from '../../src/pins';
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
  // so "36/36" would still read 36/36 on a capture that shipped 30 seeds. The headline number
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
  // The dataset holds THREE captures, each its own run with its own chain. Within a capture each
  // epoch's nextHashedServerSeed must equal the following epoch's hashedServerSeed
  // (EXPECTED_CHAIN_LINKS transitions, from src/pins.ts EPOCH_PLAN: 24 + 9 + 0). Between captures
  // no link is recorded or claimed: other games were played on the account between the runs, so the
  // next capture starts from its own pre-capture anchor.
  const byEpoch = [...seeds].sort((a, b) => a.epoch - b.epoch);
  const captureOf = (epoch: number) => EPOCH_PLAN[epoch]?.capture;
  let promoChecked = 0, promoFails = 0, captureLabelFails = 0;
  for (const sd of byEpoch) if (sd.capture !== captureOf(sd.epoch) || sd.captureEpoch !== EPOCH_PLAN[sd.epoch]?.captureEpoch) captureLabelFails++;
  for (let i = 0; i + 1 < byEpoch.length; i++) {
    if (captureOf(byEpoch[i].epoch) !== captureOf(byEpoch[i + 1].epoch)) continue;
    promoChecked++;
    if (byEpoch[i].nextHashedServerSeed !== byEpoch[i + 1].hashedServerSeed) promoFails++;
  }
  // Coverage guard: every within-capture transition of the PLAN must be exercised.
  const expectedTransitions = EXPECTED_CHAIN_LINKS;
  // Pre-capture link, ONE PER CAPTURE (meta.captures[i].preCapture): the seed pair that was active
  // before the capture's first bet. Its revealed serverSeed must hash to its own commitment AND its
  // nextHashedServerSeed must be the hashedServerSeed of the capture's first epoch. An absent or
  // zeroed anchor FAILs.
  const metaCaptures: any[] = Array.isArray((meta as any)?.captures) ? (meta as any).captures : [];
  const anchorOf = new Map<number, any>(metaCaptures.map((c: any) => [c?.capture, c?.preCapture ?? null]));
  const firstEpochOf = new Map<number, typeof byEpoch[number]>();
  for (const sd of byEpoch) { const c = captureOf(sd.epoch); if (c !== undefined && !firstEpochOf.has(c)) firstEpochOf.set(c, sd); }
  let preRevealOk = 0, preChainOk = 0;
  for (const pin of PROD_CAPTURES) {
    const pc = anchorOf.get(pin.capture);
    if (pc && typeof pc.revealedServerSeed === 'string' && commitHash(pc.revealedServerSeed) === pc.hashedServerSeed) preRevealOk++;
    if (pc && typeof pc.nextHashedServerSeed === 'string' && pc.nextHashedServerSeed === firstEpochOf.get(pin.capture)?.hashedServerSeed) preChainOk++;
  }
  const preOk = preRevealOk === PROD_CAPTURES.length && preChainOk === PROD_CAPTURES.length && metaCaptures.length === PROD_CAPTURES.length;

  // ── Step 2, chronology arm ────────────────────────────────────────────────────────────────
  // Three orderings are asserted per epoch, on the capture's own recorded times (`at`):
  //   (a) the commitment the epoch's bets are bound to was recorded before the epoch's first bet —
  //       for the first epoch of a capture that capture's pre-capture record, whose
  //       nextHashedServerSeed it is; for every later epoch the previous epoch's seed record;
  //   (b) the epoch's own seed record was written before its first bet;
  //   (c) the rotation that revealed the epoch's seed (the next epoch's seed record, same capture)
  //       was written after the epoch's last bet — EXPECTED_CHAIN_LINKS transitions; the closing
  //       rotation of each capture's last epoch is not a seed record and is not timed here.
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
    const firstOfCapture = i === 0 || captureOf(byEpoch[i - 1].epoch) !== captureOf(s.epoch);
    const pc = anchorOf.get(captureOf(s.epoch) as number);
    const commitRec = firstOfCapture ? { at: pc?.at, next: pc?.nextHashedServerSeed } : { at: byEpoch[i - 1].at, next: byEpoch[i - 1].nextHashedServerSeed };
    const commitOk = commitRec.next === s.hashedServerSeed && tAt(commitRec.at) < firstBet;
    const recordOk = tAt(s.at) < firstBet;
    if (commitOk) commitBeforeBet++;
    if (recordOk) recordBeforeBet++;
    if (i + 1 < byEpoch.length && captureOf(byEpoch[i + 1].epoch) === captureOf(s.epoch)) {
      revealChecked++;
      if (lastBet < tAt(byEpoch[i + 1].at)) revealAfterBet++;
      else if (!firstChronoFault) firstChronoFault = `epoch ${s.epoch}: last bet ${new Date(lastBet).toISOString()} not before the next seed record ${byEpoch[i + 1].at}`;
    }
    if (!firstChronoFault && !commitOk) firstChronoFault = `epoch ${s.epoch}: commitment record ${commitRec.at} not before first bet ${new Date(firstBet).toISOString()}`;
    if (!firstChronoFault && !recordOk) firstChronoFault = `epoch ${s.epoch}: seed record ${s.at} not before first bet ${new Date(firstBet).toISOString()}`;
  });
  const chronoOk = chronoChecked === EXPECTED_SEEDS && commitBeforeBet === chronoChecked && recordBeforeBet === chronoChecked
    && revealChecked === EXPECTED_CHAIN_LINKS && revealAfterBet === revealChecked;

  // ── Step 2, LIQD's clock ──────────────────────────────────────────────────────────────────
  // The arm above orders events on the runner's clock. This one orders them on LIQD's: the HTTP
  // `Date` header of LIQD's own replies, as recorded in the raw captures. For each of the
  // EXPECTED_SEEDS epochs, the reply that PUBLISHED its commitment (the first reply in its capture
  // whose LIQD body names it as the next seed's hash: the pre-capture seed read for a capture's first
  // epoch, the previous rotation after that) must be dated no later than the rotation reply that SENT
  // the epoch's client seed (LIQD's body names the commitment as active and the submitted seed as the
  // client seed). The header has one-second resolution, so the same second is counted, not failed;
  // the counts strictly earlier and in the same second are printed. A reply missing, undated, or dated
  // after the rotation FAILs.
  const cap0 = ctx.prodCapture;
  const httpT = (ev: any): number => Date.parse(String(ev?.http?.date ?? ''));
  let liqdChecked = 0, liqdNotAfter = 0, liqdStrict = 0, liqdSame = 0;
  let firstLiqdFault = '';
  const sameSecond: string[] = [];
  for (const ep of cap0.epochs) {
    liqdChecked++;
    const file = cap0.files.find(f => f.capture === ep.capture);
    const pubs: any[] = [file?.pre, ...cap0.rotates.filter(r => r.capture === ep.capture)].filter(Boolean);
    const pub = pubs.find(e => e.raw?.nextServerSeedHash === ep.hashedServerSeed);
    const rot = cap0.rotates.find(r => r.capture === ep.capture && r.raw?.activeServerSeedHash === ep.hashedServerSeed
      && r.raw?.clientSeed === ep.clientSeed && r.submitted === ep.clientSeed);
    const tp = httpT(pub), tr = httpT(rot);
    if (pub && rot && Number.isFinite(tp) && Number.isFinite(tr) && tp <= tr) {
      liqdNotAfter++;
      if (tp < tr) liqdStrict++; else { liqdSame++; sameSecond.push(`epoch ${ep.datasetEpoch} (capture ${ep.capture}, ${pub.t === 'pre' ? 'pre-capture seed read' : 'rotation'} and rotation both dated ${rot.http.date})`); }
    } else if (!firstLiqdFault) {
      firstLiqdFault = `epoch ${ep.datasetEpoch}: commitment published ${pub ? (pub.http?.date ?? 'undated') : 'nowhere'}, client seed sent ${rot ? (rot.http?.date ?? 'undated') : 'nowhere'}`;
    }
  }
  const liqdClockOk = cap0.problem === null && liqdChecked === EXPECTED_SEEDS && liqdNotAfter === liqdChecked;

  const s2 = step(2, 'Next-Seed Pre-Commitment Chain',
    promoFails === 0 && promoChecked === expectedTransitions && captureLabelFails === 0 && preOk && chronoOk && liqdClockOk ? 'PASS' : 'FAIL',
    (promoFails === 0
      ? `${promoChecked}/${expectedTransitions} transitions between successive epochs of the same capture: nextHashedServerSeed == next epoch's hashedServerSeed (chain INTACT within each of the ${PROD_CAPTURES.length} captures; no link between captures is recorded or claimed — each capture is its own run with its own anchor)`
      : `${promoChecked - promoFails}/${expectedTransitions} match; ${promoFails} mismatch`)
      + `; ${byEpoch.length - captureLabelFails}/${EXPECTED_SEEDS} seed records carry the capture and capture-epoch of the plan (src/pins.ts EPOCH_PLAN)`
      + `; pre-capture link, one per capture: reveal→commitment ${preRevealOk}/${PROD_CAPTURES.length}, chains into the capture's first epoch ${preChainOk}/${PROD_CAPTURES.length}`
      + `; recorded order (capture clock, the order the capture RECORDED — not an operator-side event order): `
      + `${commitBeforeBet}/${chronoChecked} epochs' commitment recorded before their first bet (the capture's pre-capture record for its first epoch, the previous seed record's next-hash after that), `
      + `${recordBeforeBet}/${chronoChecked} seed records written before their epoch's first bet, `
      + `${revealAfterBet}/${revealChecked} rotations (the next seed record of the same capture) written after the retiring epoch's last bet (the closing rotation of each capture's last epoch is not a seed record and is not timed)`
      + (firstChronoFault ? `; first fault: ${firstChronoFault}` : '')
      + `; on LIQD's clock (the HTTP Date header of LIQD's own replies, one-second resolution): ${liqdNotAfter}/${liqdChecked} epochs' commitment published in a reply dated no later than the rotation reply that sent the epoch's client seed — ${liqdStrict} strictly earlier, ${liqdSame} in the same second${sameSecond.length ? ` (${sameSecond.join('; ')})` : ''}`
      + (firstLiqdFault ? `; first fault on LIQD's clock: ${firstLiqdFault}` : ''),
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

  // ── Step 3, operator seed-reference arm ───────────────────────────────────────────────────
  // `hashedServerSeed` on a bet row is written by the CAPTURE from the epoch it opened — LIQD's
  // mines replies carry no seed hash. That is MEASURED here on the raw production captures rather
  // than asserted: every place-bet, open-tile and cash-out reply of every round is scanned for a key
  // naming a hash. So the arm above checks the capture's labelling.
  // The one seed reference LIQD itself serves on every settle is `serverSeedId`. Asserted: every bet
  // carries a non-empty serverSeedId, it is ONE value within each epoch, and the per-epoch values are
  // pairwise DISTINCT across all EXPECTED_SEEDS epochs (one operator seed reference per committed
  // seed). A violation hard-fails, like the hash arm.
  const cap = ctx.prodCapture;
  let repliesScanned = 0, repliesWithHash = 0;
  for (const evs of cap.steps.values()) {
    for (const ev of evs) {
      const r = ev.reply;
      if (!r || typeof r !== 'object') continue;
      repliesScanned++;
      if (Object.keys(r).some(k => /hash/i.test(k))) repliesWithHash++;
    }
  }
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
  const idsOk = idMissing === 0 && epochsMultipleIds === 0 && idOfEpoch.size === EXPECTED_SEEDS && distinctIds === EXPECTED_SEEDS
    && cap.problem === null && repliesScanned > 0;

  const s3 = step(3, 'Hash Consistency Within Epoch',
    epochsMultipleHashes === 0 && s3CoverageOk && idsOk ? 'PASS' : 'FAIL',
    `${betsByEpoch.size}/${EXPECTED_SEEDS} epochs (pinned in src/pins.ts, not counted from the dataset): all bets within each epoch share the same hashedServerSeed; ${epochsMultipleHashes} violations `
      + `(that field is written onto each bet row by the capture from the epoch it opened; LIQD's replies carry no hash — measured: ${repliesWithHash} of ${repliesScanned} place-bet, open-tile and cash-out replies in the raw production captures carry a key naming a hash${cap.problem ? `; RAW CAPTURE NOT LOADED: ${cap.problem}` : ''} — so this arm checks the capture's labelling). `
      + `Operator-served seed reference serverSeedId (on every settle response): ${idOfEpoch.size}/${EXPECTED_SEEDS} epochs carry one value across all their bets (${epochsMultipleIds} epochs with more than one, ${idMissing} bets without one), `
      + `${distinctIds} distinct across the ${EXPECTED_SEEDS} epochs`,
  );

  // ── Step 4: Nonce audit ──────────────────────────────────────────────────────
  // Per epoch: a single client seed, and the nonces EXACTLY NONCE_BASE … NONCE_BASE + size − 1
  // with no gap, repeat or reorder, where `size` is the epoch's length in the PLAN.
  //
  // THE WINDOW IS DECLARED IN CODE, NOT READ FROM THE DATA. Both ends come from src/pins.ts
  // (NONCE_BASE, EPOCH_PLAN[epoch].size: 200 in phase A, 100 in phase D, 190 in phase A+, 124 in
  // phase C). The seed record's own `nonceStart`/`nonceEnd` are read as a CLAIM checked against the
  // declaration: a record whose window disagrees with it hard-fails, so a dataset whose records and
  // bets were shifted together does not pass by agreeing with itself.
  //
  // GAPS ARE COUNTED AGAINST A DECLARED NUMBER. A gap the revealed seed cannot account for, a
  // duplicate, a second client seed, a nonce outside the window, or a record/declaration
  // disagreement is a HARD FAIL. A gap whose epoch seed is revealed and whose remaining bets all
  // recompute is consistent with an auditor-side capture retry — but only the number of those
  // declared in src/pins.ts EXPECTED_CAPTURE_RETRY_GAPS may be attributed to the capture. A count
  // that differs from the declaration is a different dataset and hard-fails; a count that matches a
  // non-zero declaration is a capture-origin FLAG (disclosed, verdict-neutral). This dataset
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
  let windowDisagreements = 0;
  // hashedServerSeed → the full Seed record (ctx.seedMap only carries the revealed string).
  const seedRecordByHash = new Map(seeds.map(s => [s.hashedServerSeed, s]));

  for (const [hash, epochBets] of byHash) {
    const sorted = [...epochBets].sort((a, b) => a.nonce - b.nonce);
    const nonces = sorted.map(b => b.nonce);
    const epochNum = sorted[0].epoch;
    const planned = EPOCH_PLAN[epochNum];
    if (!planned) { hardFailures.push(`Epoch ${epochNum}: not an epoch of the plan (src/pins.ts EPOCH_PLAN)`); epochsChecked++; continue; }
    const windowEnd = NONCE_BASE + planned.size - 1;
    if (new Set(sorted.map(b => b.epoch)).size !== 1) hardFailures.push(`Epoch ${epochNum}: bets under one commitment carry more than one epoch number`);
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
    } else if (rec.nonceStart !== windowStart || rec.nonceEnd !== windowEnd || rec.epoch !== epochNum) {
      windowDisagreements++;
      hardFailures.push(`Epoch ${epochNum}: seed record (epoch ${rec.epoch}) window [${rec.nonceStart}, ${rec.nonceEnd}] disagrees with the declared [${windowStart}, ${windowEnd}] (src/pins.ts NONCE_BASE, EPOCH_PLAN)`);
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
  const base = `${epochsChecked}/${EXPECTED_SEEDS} epochs: single client seed each, nonces in capture order, unique, and exactly the DECLARED window [${windowStart}, ${windowStart} + size − 1] of the epoch `
    + `(NONCE_BASE ${NONCE_BASE} and the epoch sizes ${EPOCH_SIZES.join(', ')} are code constants in src/pins.ts EPOCH_PLAN: ${PROD_CAPTURES.map(c => `capture ${c.capture} ${[...new Set(EPOCH_PLAN.filter(e => e.capture === c.capture).map(e => `${e.phaseId} ${EPOCH_PLAN.filter(x => x.capture === c.capture && x.phaseId === e.phaseId).length} × ${e.size}`))].join(', ')}`).join('; ')} — not the minimum observed, and not the seed records' own nonceStart/nonceEnd, which are checked AGAINST the declaration: ${windowDisagreements} disagreements). `
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
