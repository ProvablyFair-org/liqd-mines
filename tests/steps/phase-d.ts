/**
 * Step 14: Client Seed Variation — Phase D (player-set seeds) and the order of every epoch's seed.
 *
 * Phase D, capture 2 (10 November 2026): 500 rounds over the 20 multi-reveal settings in 5 epochs of
 * 100, each epoch under a PLAYER-SET client seed "pfaudit-prod-mines-d<k>-" + 12 hex digits from the
 * browser CSPRNG (k = 1…5). The five seeds were drawn when the plan was built and written into the
 * capture's meta before its anchor rotation; each was submitted at the rotation that opened its epoch.
 * The step asserts:
 *   - Phase D holds exactly its planned rounds and at least two distinct player-set seeds (it has
 *     PHASE_D_DISTINCT_SEEDS), every Phase D round carries its epoch's player-set seed, and every
 *     Phase D round recomputes under it;
 *   - each Phase D seed is of the declared form, is the one the capture's meta named for that epoch
 *     before any bet, and the rotation that submitted it records it as player-set and LIQD's reply
 *     to that rotation returns it as the active client seed (taken by the site);
 *   - no player-set seed is used outside Phase D;
 *   - no epoch uses a predictable timestamp construction (enumerated, must be 0);
 *   - ORDER, for every epoch of the dataset, from the raw captures: the epoch's client seed is the
 *     one submitted in a rotation whose reply made the epoch's commitment active
 *     (rotate.drawnAfter === the epoch's hashedServerSeed, rotate.submitted === its clientSeed),
 *     recorded before the epoch's first bet — so the server seed was committed before the client
 *     seed was submitted. The capture's own clock; not an operator-side event order.
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { revealMines, sameMines } from '../../src/rng';
import { EXPECTED_SEEDS, EXPECTED_PHASE_ID_BETS, EPOCH_PLAN, PLAYER_SEED_FORMAT, AUDIT_SEED_FORMAT, PHASE_D_DISTINCT_SEEDS } from '../../src/pins';

/** MINES-06 floor: Phase D must be played under at least this many distinct client seeds. */
const PHASE_D_SEED_FLOOR = 2;

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seeds, seedMap } = ctx;
  const cap = ctx.prodCapture;

  // ── Phase D ──────────────────────────────────────────────────────────────────────────────
  const d = bets.filter(b => b.phaseId === 'D');
  const dEpochs = EPOCH_PLAN.filter(e => e.phaseId === 'D');
  const dSeeds = seeds.filter(s => s.phaseId === 'D');
  const dClientSeeds = new Set(d.map(b => b.clientSeed));
  let dTested = 0, dMatched = 0, dSeedOfEpoch = 0;
  const seedOfEpoch = new Map(seeds.map(s => [s.epoch, s]));
  for (const b of d) {
    if (seedOfEpoch.get(b.epoch)?.clientSeed === b.clientSeed && PLAYER_SEED_FORMAT.test(b.clientSeed)) dSeedOfEpoch++;
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    dTested++;
    if (sameMines(revealMines(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles)) dMatched++;
  }
  // Each Phase D seed: the declared form, its index k = its position among the Phase D epochs, named in
  // the capture's meta plan for that epoch, submitted as player-set and returned by LIQD as active.
  let dFormOk = 0, dMetaOk = 0, dPlayerOk = 0, dTakenOk = 0;
  const dFaults: string[] = [];
  dSeeds.forEach((sd, i) => {
    const m = PLAYER_SEED_FORMAT.exec(sd.clientSeed);
    if (m && Number(m[1]) === i + 1) dFormOk++; else if (dFaults.length < 3) dFaults.push(`epoch ${sd.epoch}: client seed ${sd.clientSeed} is not the declared player-set form for seed ${i + 1}`);
    const file = cap.files.find(f => f.capture === sd.capture);
    const planned = file?.meta?.plan?.[sd.captureEpoch]?.seed;
    if (planned && planned.value === sd.clientSeed) dMetaOk++;
    const rot = cap.rotates.find(r => r.capture === sd.capture && r.drawnAfter === sd.hashedServerSeed && r.submitted === sd.clientSeed);
    if (rot?.seedMeta?.player === true && rot?.seedMeta?.phase === 'D' && rot?.seedMeta?.predictable === false) dPlayerOk++;
    if (rot?.raw?.clientSeed === sd.clientSeed && rot?.state?.clientSeed === sd.clientSeed) dTakenOk++;
  });
  const playerSeedsOutsideD = seeds.filter(s => s.phaseId !== 'D' && !AUDIT_SEED_FORMAT.test(s.clientSeed)).length
    + bets.filter(b => b.phaseId !== 'D' && PLAYER_SEED_FORMAT.test(b.clientSeed)).length;
  const dOk = d.length === EXPECTED_PHASE_ID_BETS.D && dEpochs.length === PHASE_D_DISTINCT_SEEDS && dSeeds.length === dEpochs.length
    && dClientSeeds.size === PHASE_D_DISTINCT_SEEDS && dClientSeeds.size >= PHASE_D_SEED_FLOOR
    && dSeedOfEpoch === d.length && dTested === d.length && dMatched === dTested
    && dFormOk === dSeeds.length && dMetaOk === dSeeds.length && dPlayerOk === dSeeds.length && dTakenOk === dSeeds.length && playerSeedsOutsideD === 0;

  // ── every round under its own client seed (whole dataset) ────────────────────────────────
  const clientSeeds = new Set(bets.map(b => b.clientSeed));
  let tested = 0, matched = 0;
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    tested++;
    if (sameMines(revealMines(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles)) matched++;
  }
  const coverageOk = tested === bets.length && tested > 0;

  // PREDICTABLE-SEED CENSUS, ENUMERATED FROM THE DATA: a client seed built from a millisecond timestamp.
  const PREDICTABLE = /\d{13}/;
  const predictableEpochs = [...new Set(bets.filter(b => PREDICTABLE.test(b.clientSeed)).map(b => b.epoch))].sort((a, z) => a - z);

  // ORDER: commitment before client seed, from the raw captures' rotation records.
  const firstBetAt = new Map<number, number>();
  for (const b of bets) {
    const t = Date.parse(b.at);
    if (!firstBetAt.has(b.epoch) || t < (firstBetAt.get(b.epoch) as number)) firstBetAt.set(b.epoch, t);
  }
  let ordered = 0, generatorDeclared = 0;
  const orderFaults: string[] = [];
  for (const s of seeds) {
    const rot = cap.rotates.find(r => r.capture === s.capture && r.drawnAfter === s.hashedServerSeed && r.submitted === s.clientSeed);
    const first = firstBetAt.get(s.epoch);
    if (!rot) { if (orderFaults.length < 3) orderFaults.push(`epoch ${s.epoch}: no rotation submitted ${s.clientSeed} after ${s.hashedServerSeed.slice(0, 12)}…`); continue; }
    const activated = rot.state?.hashedServerSeed === s.hashedServerSeed && rot.raw?.activeServerSeedHash === s.hashedServerSeed;
    const before = first !== undefined && Date.parse(String(rot.at)) < first;
    if (activated && before) ordered++;
    else if (orderFaults.length < 3) orderFaults.push(`epoch ${s.epoch}: rotation ${activated ? '' : 'did not activate the commitment '}${before ? '' : 'not recorded before the first bet'}`.trim());
    if (rot.seedMeta?.predictable === false && typeof rot.seedMeta?.generator === 'string') generatorDeclared++;
  }
  const orderOk = cap.problem === null && ordered === EXPECTED_SEEDS && seeds.length === EXPECTED_SEEDS;

  const ok = dOk && clientSeeds.size === EXPECTED_SEEDS && matched === tested && coverageOk && predictableEpochs.length === 0 && orderOk;
  const s14 = step(14, 'Client Seed Variation (Phase D player-set seeds; seed order on every epoch)',
    ok ? 'PASS' : 'FLAG',
    `PHASE D: ${d.length}/${EXPECTED_PHASE_ID_BETS.D} rounds in ${dEpochs.length} epochs under ${dClientSeeds.size} distinct player-set client seeds (floor ${PHASE_D_SEED_FLOOR}; declared ${PHASE_D_DISTINCT_SEEDS}, src/pins.ts): ${[...dClientSeeds].join(', ')}; `
      + `${dSeedOfEpoch}/${d.length} rounds carry their epoch's player-set seed; mine-layout recomputation under it: ${dMatched}/${dTested} match (${dTested}/${d.length} recomputed); `
      + `${dFormOk}/${dSeeds.length} seeds of the declared form "pfaudit-prod-mines-d<k>-" + 12 hex digits with k the epoch's position; ${dMetaOk}/${dSeeds.length} named for their epoch in the capture's meta, written before its anchor rotation; `
      + `${dPlayerOk}/${dSeeds.length} submitted in a rotation recorded as player-set and not predictable; ${dTakenOk}/${dSeeds.length} returned by LIQD's rotation reply as the active client seed (taken by the site); ${playerSeedsOutsideD} uses of a player-set seed outside Phase D`
      + (dFaults.length ? ` — ${dFaults.join('; ')}` : '') + '. '
      + `WHOLE DATASET: ${bets.length} rounds, ${clientSeeds.size} distinct client seeds across ${seeds.length} epochs; recomputation under each round's own client seed: ${matched}/${tested} match. `
      + `Predictable-seed census (a client seed carrying a 13-digit millisecond timestamp): ${predictableEpochs.length} epochs${predictableEpochs.length ? ` (${predictableEpochs.join(', ')})` : ''}. `
      + `Order, from the raw captures' rotation records (the capture's clock, not an operator-side order): ${ordered}/${EXPECTED_SEEDS} epochs' client seeds were submitted in the rotation whose reply made that epoch's commitment active, recorded before the epoch's first bet; ${generatorDeclared}/${EXPECTED_SEEDS} of those rotations record the generator and mark it not predictable`
      + (orderFaults.length ? `; faults: ${orderFaults.join('; ')}` : '')
      + (cap.problem ? `; RAW CAPTURE NOT LOADED: ${cap.problem}` : '')
      + `. The server seed was therefore committed before the client seed it was used with was submitted. The Phase D seeds were chosen by the auditor's runner, not typed by hand: they show that a seed the player sets is the seed the round is drawn with; client-seed participation alone does not prove the seed was unpredictable to the operator.`,
  );
  return [s14];
}
