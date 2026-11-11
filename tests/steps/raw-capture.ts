/**
 * Step 22: Production Raw-Capture Binding — the wallet field, every reveal, LIQD's verifier.
 *
 * Steps 1–21 score the dataset rows. What the Bet type cannot carry stays in the three raw captures
 * the runner exported, and this step scores it, binding the scored dataset to those captures row by
 * row. Every arm has a coverage guard bound to src/pins.ts, never to a file's own meta:
 *
 *   (a) integrity — each raw capture hashes to its pin; its lines, events by type and requests by
 *       name equal the declaration; each capture's meta and export note name the declared runner
 *       builds; the one stop of capture 2 and its resume are the declared events;
 *   (b) row binding — scored row i is raw bet record i: id, epoch, nonce, mine count, opened tiles,
 *       mine tiles, result, client seed, serverSeedId, betAmount, booked fiat, winningAmount,
 *       multiplier, autoFinish and currentGameSettings equal the settling reply; phase and phase id
 *       equal the runner's record; `reveals` equals the planned depth; the round's intent (its planned
 *       tiles) was journalled before its first request and equals the plan the runner wrote into the
 *       capture's meta before any bet (meta.plan[epoch].bets[seq]);
 *   (c) seed records — each scored seed record equals the epoch event that opened it (commitment,
 *       next commitment, client seed, first nonce, phase), and its serverSeed is the one revealed by
 *       the rotation that closed the epoch;
 *   (d) reveals — every open-tile request's tile is the next tile of the round's plan, and the reply's
 *       mine/safe flag equals the recomputed layout (revealMines from the revealed seed); a win ends
 *       with a cash-out after exactly its planned depth, a loss on its first mine;
 *   (e) ROUNDS LIQD SETTLED BY ITSELF — a round whose last safe tile was opened is settled in the
 *       open-tile reply (autoFinish true) and has no cash-out. They must be exactly the declared rounds
 *       (PROD_AUTO_FINISH_ROUNDS), each a win on a board with no safe tile left, its booked amount
 *       and wallet field at the same rules; they are also the only open-tile replies that carry a multiplier
 *       (PROD_DECLARED_PER_STEP_MULTIPLIERS): no per-step rung is served on the wire;
 *   (f) THE WALLET FIELD — every win's winningAmountWallet equals LIQD's measured rule
 *       floor8(betAmountWallet × floor8(exact multiplier)); a wallet field below or above it FAILs. Against
 *       the exact product floor8(betAmountWallet × exact) the wallet fields below, by cell, and their total
 *       must equal the DISCLOSURE in src/pins.ts (PROD_WALLET_BELOW_EXACT…): a rounding disclosure,
 *       not a fail — but a disclosure bound to the data, so a moved count FAILs, and a wallet field ABOVE
 *       exact math FAILs. The wallet stake must be on the 1e-8 grid and the same in the place-bet and
 *       settling replies; a loss pays nothing. Per capture the wallet totals equal the declaration,
 *       and on the captures booked in USD at rate 1.00000000 the wallet fields exceed the booked wins
 *       by exactly the amount Step 8 reports as dropped by the cent floor;
 *   (g) order independence at the cash-out — per (mineCount, depth, stake, fiat), one displayed
 *       multiplier and one booked amount across every reveal order that reached it;
 *   (h) coverage — every planned (phase, setting) with a possible win witnessed by at least one win,
 *       the unwitnessed ones enumerated;
 *   (i) operator settings — every currentGameSettings record equals PROD_GAME_SETTINGS, with exactly
 *       its counts per capture (Step 10 discloses them);
 *   (j) LIQD's verifier — one reply per round, HTTP 200, requested with the round's revealed inputs, its
 *       mine tiles equal to the recomputed layout (as a set: the order of LIQD's list is not compared)
 *       and its open tiles to the served ones. The request carries only the revealed server seed, the
 *       client seed, the nonce and the mine count (its body keys are enumerated), yet the reply names
 *       the tiles the round opened, which those inputs do not determine: the verifier can only know them
 *       from its own stored round. That ties each captured round to a round LIQD holds; it does not make
 *       an operator-run verifier an independent check of the operator's outcomes;
 *   (k) LIQD's ledger debits — the settling open-tile reply of every loss and of every self-settled round
 *       carries `betTransaction`, a record of the stake debit; no other reply carries one. Bound to
 *       src/pins.ts PROD_LEDGER_DEBITS: the count per capture, amount == the round's stake in the
 *       booking fiat, currencyId == the wallet's (PROD_WALLET_CURRENCY_ID), type "bet", status
 *       "success", betId the round's, and the count whose amount is not the round's USDT stake. Read
 *       and reported; the audit does not use them to infer a balance.
 */

import * as path from 'path';
import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { revealMines, sameMines } from '../../src/rng';
import { GRID, minesMultiplierRational } from '../../src/config';
import { decimalUnits, unitsToDecimal } from '../../src/prod-capture';
import {
  PROD_CAPTURES, PROD_REQUESTS, EPOCH_PLAN, SETTINGS_PLAN,
  PROD_DECLARED_PER_STEP_MULTIPLIERS, PROD_AUTO_FINISH_ROUNDS, PROD_WALLET_BELOW_EXACT, PROD_WALLET_BELOW_EXACT_TOTAL_UNITS,
  PROD_WALLET_BELOW_EXACT_CELLS, PROD_WINS, PROD_GAME_SETTINGS, BOOKED_BELOW_UNROUNDED,
  PROD_WALLET_CURRENCY, PROD_HOST, EXPECTED_BETS, EXPECTED_SEEDS, PROD_LEDGER_DEBITS, PROD_WALLET_CURRENCY_ID,
} from '../../src/pins';

export const STEP_NUMBER = 22;
export const STEP_NAME = 'Production Raw-Capture Binding (wallet field, reveals, LIQD verifier)';

/** Keys a multiplier could be served under on an open-tile reply. */
const STEP_MULT_KEYS = ['multiplier', 'currentMultiplier', 'payoutMultiplier', 'odds'];
/** The served rate at which a fiat amount and a USDT amount are the same number. */
const UNIT_RATE = '1.00000000';

/** THE WALLET RULE (LIQD's, as measured): floor8(stake × floor8(exact)), all in 1e-8 units. */
export function walletFieldRule(stakeUnits: bigint, m: number, k: number): bigint | null {
  const r = minesMultiplierRational(m, k);
  if (!r) return null;
  const mult8 = (100_000_000n * r.num) / r.den;
  return (stakeUnits * mult8) / 100_000_000n;
}
/** Exact math: floor8(stake × exact rational multiplier), 1e-8 units. */
export function walletFieldExact(stakeUnits: bigint, m: number, k: number): bigint | null {
  const r = minesMultiplierRational(m, k);
  return r ? (stakeUnits * r.num) / r.den : null;
}

const sameCells = (got: Map<string, number>, want: Readonly<Record<string, number>>) =>
  got.size === Object.keys(want).length && [...got].every(([k, n]) => want[k] === n);
const cellOrder = ([a]: [string, number], [z]: [string, number]) => {
  const [am, ak] = a.split(':').map(Number), [zm, zk] = z.split(':').map(Number);
  return am - zm || ak - zk;
};
const fmtCells = (m: Map<string, number>) => [...m].sort(cellOrder).map(([k, n]) => `(${k.replace(':', ', ')}) ×${n}`).join(', ') || 'none';
const eqArr = (a: unknown, b: unknown) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
const sameCounts = (got: Record<string, number>, want: Readonly<Record<string, number>>) =>
  Object.keys(got).length === Object.keys(want).length && Object.entries(want).every(([t, n]) => got[t] === n);

export function run(ctx: VerifyContext): StepResult[] {
  const cap = ctx.prodCapture;
  const repoRoot = path.resolve(ctx.outputsDir, '..');
  const faults: string[] = [];
  const fault = (s: string) => { if (faults.length < 6) faults.push(s); };

  if (cap.problem) {
    return [step(STEP_NUMBER, STEP_NAME, 'FAIL', `raw production captures not loaded: ${cap.problem}`)];
  }

  // ── (a) integrity of each capture's shape, and the runner builds ─────────────
  let shapeOk = 0, metaOk = 0;
  const totalRequests: Record<string, number> = {};
  for (const pin of PROD_CAPTURES) {
    const f = cap.files.find(x => x.capture === pin.capture);
    if (!f) { fault(`capture ${pin.capture} not loaded`); continue; }
    const evCounts: Record<string, number> = {};
    for (const ev of f.events) evCounts[ev.t] = (evCounts[ev.t] ?? 0) + 1;
    const reqCounts: Record<string, number> = {};
    for (const ev of f.events) if (ev.t === 'step') { reqCounts[ev.name] = (reqCounts[ev.name] ?? 0) + 1; totalRequests[ev.name] = (totalRequests[ev.name] ?? 0) + 1; }
    const ok = f.lines === pin.lines && sameCounts(evCounts, pin.events) && sameCounts(reqCounts, pin.requests);
    if (ok) shapeOk++; else fault(`capture ${pin.capture}: ${f.lines} lines, events ${JSON.stringify(evCounts)}, requests ${JSON.stringify(reqCounts)} != the declaration`);
    // The meta names the build that started the run, the export note the build that exported it. The run was made on liqd.com, and in the planned fiat where the plan names one.
    const note = f.events.find(ev => ev.t === 'export-note');
    const started = String(f.meta?.script ?? ''), exported = String(note?.script ?? '');
    const mOk = started.endsWith(`build ${pin.runnerBuild}`) && exported.endsWith(`build ${pin.exportBuild}`)
      && f.meta?.origin === `https://${PROD_HOST}` && f.meta?.platform === PROD_HOST
      && (f.meta?.stakeFiat === undefined || f.meta.stakeFiat === pin.fiat);
    if (mOk) metaOk++; else fault(`capture ${pin.capture}: meta (runner "${started}", export "${exported}", origin ${f.meta?.origin}) is not the declaration`);
  }
  const integrityOk = shapeOk === PROD_CAPTURES.length && metaOk === PROD_CAPTURES.length
    && sameCounts(totalRequests, PROD_REQUESTS) && cap.files.length === PROD_CAPTURES.length;

  // ── (b) row binding ───────────────────────────────────────────────────────────
  const bets = ctx.bets;
  const fileOf = new Map(cap.files.map(f => [f.capture, f]));
  let rowsBound = 0, intentsBefore = 0, planBound = 0;
  const n = Math.min(bets.length, cap.bets.length);
  for (let i = 0; i < n; i++) {
    const b = bets[i] as any, entry = cap.bets[i], rec = entry.rec ?? {}, s = rec.settleRaw ?? {};
    const same = b.id === s.id && b.epoch === entry.epoch && b.capture === entry.capture && b.captureEpoch === rec.epoch
      && b.phase === rec.phase && b.phaseId === (rec.phaseId ?? rec.phase)
      && b.nonce === s.nonce && b.mineCount === s.mineCount
      && eqArr(b.openTiles, s.openTiles) && eqArr(b.mineTiles, s.mineTiles) && b.result === s.result
      && b.clientSeed === s.clientSeed && b.serverSeedId === s.serverSeedId
      && Number(b.betAmount) === Number(s.betAmount) && b.fiatCurrency === s.fiatCurrency
      && Number(b.winningAmount) === Number(s.winningAmount)
      && (b.result === 'won' ? Number(b.multiplier) === Number(s.multiplier) : b.multiplier === undefined)
      && (b.autoFinish === true) === (s.autoFinish === true)
      && (b.currentGameSettings ?? null) === (s.currentGameSettings ?? null)
      && b.reveals === rec.spec?.depth;
    if (same) rowsBound++; else fault(`row ${i} (${b.id}) differs from the raw settling reply`);
    const it = cap.intents.get(String(rec.key));
    const firstStepLine = cap.firstStepLine.get(String(rec.key)) ?? -1;
    if (it && it.capture === entry.capture && firstStepLine > it.line && eqArr(it.ev.spec?.tiles, rec.spec?.tiles) && it.ev.spec?.mineCount === rec.spec?.mineCount) intentsBefore++;
    else fault(`round ${b.id}: intent not journalled before its first request, or different from the spec`);
    const metaPlan: any[] = Array.isArray(fileOf.get(entry.capture)?.meta?.plan) ? fileOf.get(entry.capture)!.meta.plan : [];
    const pb = metaPlan[rec.epoch]?.bets?.[rec.seq];
    if (pb && pb.mineCount === rec.spec?.mineCount && pb.depth === rec.spec?.depth && eqArr(pb.tiles, rec.spec?.tiles)
      && eqArr(rec.plannedTiles, pb.tiles)) planBound++;
    else fault(`round ${b.id}: not the plan written into meta before any bet (capture ${entry.capture}, epoch ${rec.epoch}, seq ${rec.seq})`);
  }
  const rowsOk = bets.length === EXPECTED_BETS && cap.bets.length === EXPECTED_BETS && rowsBound === EXPECTED_BETS
    && intentsBefore === EXPECTED_BETS && planBound === EXPECTED_BETS;

  // ── (c) seed records against the captures' epoch and rotation events ──────────
  let seedsBound = 0;
  for (const sd of ctx.seeds) {
    const ev = cap.epochs.find(e => e.datasetEpoch === sd.epoch);
    const closing = cap.rotates.find(r => r.capture === sd.capture && r.closes === sd.captureEpoch && r.raw?.revealedServerSeed === sd.serverSeed);
    if (ev && ev.capture === sd.capture && ev.epoch === sd.captureEpoch && ev.hashedServerSeed === sd.hashedServerSeed
      && ev.nextHashedServerSeed === sd.nextHashedServerSeed && ev.clientSeed === sd.clientSeed && ev.nonceStart === sd.nonceStart
      && ev.phase === sd.phase && (ev.phaseId ?? ev.phase) === sd.phaseId && ev.plannedBets === EPOCH_PLAN[sd.epoch]?.size && closing) seedsBound++;
    else fault(`seed record epoch ${sd.epoch}: not the capture's epoch event / closing rotation`);
  }
  const seedsOk = seedsBound === EXPECTED_SEEDS && ctx.seeds.length === EXPECTED_SEEDS;

  // ── (d) reveals, (e) self-settled rounds, (f) wallet, (g) order independence ──
  let reveals = 0, revealStatusOk = 0, revealOrderOk = 0, roundsShapeOk = 0, stepMults = 0;
  let wins = 0, walletRuleOk = 0, walletBelowRule = 0, walletAboveRule = 0, walletStakeBad = 0, lossPaid = 0;
  let exactEqual = 0, exactBelow = 0, exactAbove = 0, exactBelowUnits = 0n, offGrid = 0;
  const autoIds: string[] = [];
  let autoOk = 0;
  const perCapture = new Map<number, { staked: bigint; paid: bigint; wins: number; bookedPaidCents: bigint; unitRate: number; rates: Set<string>; below: number }>();
  const belowCells = new Map<string, number>();
  const cellDisplay = new Map<string, Set<string>>();
  const cellFiat = new Map<string, Set<string>>();
  const wonSettings = new Set<string>();
  for (let i = 0; i < n; i++) {
    const b = bets[i] as any, entry = cap.bets[i], rec = entry.rec ?? {}, s = rec.settleRaw ?? {};
    const ss = ctx.seedMap.get(b.hashedServerSeed);
    const mines = ss ? new Set(revealMines(ss, b.clientSeed, b.nonce, b.mineCount)) : null;
    const evs = cap.steps.get(String(rec.key)) ?? [];
    const opens = evs.filter(e => e.name === 'open-tile');
    const plan: number[] = Array.isArray(rec.plannedTiles) ? rec.plannedTiles : [];
    const auto = s.autoFinish === true;
    let orderOk = opens.length === b.openTiles.length;
    opens.forEach((e, j) => {
      reveals++;
      const t = Number(e.request?.tile);
      if (t !== plan[j] || t !== b.openTiles[j]) orderOk = false;
      const last = j === opens.length - 1;
      // A self-settled round's last reply is the settled record: it carries no mineTile flag, and the
      // tile is safe by the recomputed layout.
      if (auto && last) {
        if (mines && !mines.has(t) && e.reply?.autoFinish === true && e.reply?.mineTile === undefined) revealStatusOk++;
        else fault(`round ${b.id}: self-settled reply on tile ${t} is not a safe tile of the recomputed layout`);
      } else {
        const flag = e.reply?.mineTile;
        if (mines && typeof flag === 'boolean' && flag === mines.has(t)) revealStatusOk++;
        else fault(`round ${b.id} reveal ${j + 1}: served mineTile ${JSON.stringify(flag)} vs recomputed ${mines ? mines.has(t) : 'n/a'}`);
      }
      if (e.reply && STEP_MULT_KEYS.some(k => k in e.reply)) stepMults++;
    });
    if (orderOk) revealOrderOk++; else fault(`round ${b.id}: open-tile sequence is not the plan / the opened tiles`);
    const cash = evs.filter(e => e.name === 'cash-out');
    const placed = evs.filter(e => e.name === 'place-bet');
    const safeLeft = GRID - b.mineCount - b.openTiles.length;
    let shape: boolean;
    if (auto) {
      // settled by LIQD: a win, no cash-out, every tile before the last answered safe, no safe tile left.
      shape = placed.length === 1 && b.result === 'won' && cash.length === 0 && b.openTiles.length === b.reveals
        && opens.slice(0, -1).every(e => e.reply?.mineTile === false) && safeLeft === 0;
      autoIds.push(b.id);
      if (shape) autoOk++;
    } else {
      shape = placed.length === 1 && (b.result === 'won'
        ? cash.length === 1 && b.openTiles.length === b.reveals && opens.every(e => e.reply?.mineTile === false) && safeLeft > 0
        : cash.length === 0 && opens.length >= 1 && opens[opens.length - 1].reply?.mineTile === true && opens.slice(0, -1).every(e => e.reply?.mineTile === false));
    }
    if (shape) roundsShapeOk++; else fault(`round ${b.id}: request sequence does not match its result`);

    const pc = perCapture.get(entry.capture) ?? { staked: 0n, paid: 0n, wins: 0, bookedPaidCents: 0n, unitRate: 0, rates: new Set<string>(), below: 0 };
    perCapture.set(entry.capture, pc);
    pc.rates.add(String(rec.placeRaw?.exchangeRate));
    if (rec.placeRaw?.exchangeRate === UNIT_RATE && s.exchangeRate === UNIT_RATE) pc.unitRate++;
    const stake = decimalUnits(rec.placeRaw?.betAmountWallet, 8);
    if (stake === null || stake <= 0n) { walletStakeBad++; fault(`round ${b.id}: betAmountWallet ${JSON.stringify(rec.placeRaw?.betAmountWallet)} not on the 1e-8 grid`); continue; }
    pc.staked += stake;
    const cell = `${b.mineCount}:${b.openTiles.length}`;
    if (b.result === 'won') {
      wins++; pc.wins++;
      wonSettings.add(`${b.phaseId}|${b.mineCount}:${b.reveals}`);
      if (s.betAmountWallet !== undefined && decimalUnits(s.betAmountWallet, 8) !== stake) { walletStakeBad++; fault(`round ${b.id}: wallet stake differs between place-bet and the settling reply`); }
      const walletAmt = decimalUnits(s.winningAmountWallet, 8);
      if (walletAmt === null) { offGrid++; fault(`round ${b.id}: winningAmountWallet ${JSON.stringify(s.winningAmountWallet)} not on the 1e-8 grid`); continue; }
      pc.paid += walletAmt;
      pc.bookedPaidCents += BigInt(Math.round(Number(s.winningAmount) * 100));
      const rule = walletFieldRule(stake, b.mineCount, b.openTiles.length);
      const exact = walletFieldExact(stake, b.mineCount, b.openTiles.length);
      if (rule === null || exact === null) { walletBelowRule++; continue; }
      if (walletAmt === rule) walletRuleOk++;
      else if (walletAmt < rule) { walletBelowRule++; fault(`round ${b.id}: wallet field ${walletAmt} units, LIQD's own rule gives ${rule}`); }
      else { walletAboveRule++; fault(`round ${b.id}: wallet field ${walletAmt} units, above LIQD's rule ${rule}`); }
      if (walletAmt === exact) exactEqual++;
      else if (walletAmt < exact) { exactBelow++; pc.below++; exactBelowUnits += exact - walletAmt; belowCells.set(cell, (belowCells.get(cell) ?? 0) + 1); }
      else exactAbove++;
      const key = `${cell}@${Number(s.betAmount)} ${s.fiatCurrency}`;
      const ds = cellDisplay.get(key) ?? new Set<string>(); ds.add(String(s.multiplier)); cellDisplay.set(key, ds);
      const fs2 = cellFiat.get(key) ?? new Set<string>(); fs2.add(String(s.winningAmount)); cellFiat.set(key, fs2);
    } else {
      const w = s.winningAmountWallet;
      if (w !== undefined && w !== null && decimalUnits(w, 8) !== 0n) { lossPaid++; fault(`round ${b.id}: a loss carries the wallet field ${w}`); }
    }
  }
  const revealsOk = reveals === PROD_REQUESTS['open-tile'] && revealStatusOk === reveals && revealOrderOk === EXPECTED_BETS
    && roundsShapeOk === EXPECTED_BETS;
  // (e) the self-settled rounds are exactly the declared ones, and no other open-tile reply carries a multiplier.
  const autoDeclOk = autoIds.length === PROD_AUTO_FINISH_ROUNDS.length && autoIds.every((id, i) => id === PROD_AUTO_FINISH_ROUNDS[i]) && autoOk === autoIds.length;
  if (!autoDeclOk) fault(`rounds LIQD settled by itself: ${autoIds.join(', ') || 'none'} (${autoOk} of the expected shape), declared ${PROD_AUTO_FINISH_ROUNDS.join(', ')}`);
  const stepMultOk = stepMults === PROD_DECLARED_PER_STEP_MULTIPLIERS && stepMults === autoIds.length;
  if (!stepMultOk) fault(`${stepMults} open-tile replies carried a multiplier, ${PROD_DECLARED_PER_STEP_MULTIPLIERS} declared (the self-settled rounds)`);
  const cashOuts = PROD_REQUESTS['cash-out'];
  const cashOk = cashOuts === wins - autoIds.length;
  if (!cashOk) fault(`${cashOuts} cash-out requests declared, ${wins} wins − ${autoIds.length} self-settled`);
  const disclosureOk = exactBelow === PROD_WALLET_BELOW_EXACT && exactBelowUnits === BigInt(PROD_WALLET_BELOW_EXACT_TOTAL_UNITS)
    && sameCells(belowCells, PROD_WALLET_BELOW_EXACT_CELLS);
  if (!disclosureOk) fault(`wallet fields below exact math: ${exactBelow} (${exactBelowUnits} units, ${fmtCells(belowCells)}), declared ${PROD_WALLET_BELOW_EXACT} (${PROD_WALLET_BELOW_EXACT_TOTAL_UNITS} units)`);
  // Per capture: wallet totals as declared; on a capture booked at the unit rate the wallet fields
  // exceed the booked wins by exactly the declared amount dropped by the cent floor.
  let totalsOk = true, bookedGapOk = true;
  const captureLines: string[] = [];
  for (const pin of PROD_CAPTURES) {
    const g = perCapture.get(pin.capture);
    const decl = BOOKED_BELOW_UNROUNDED.find(x => x.capture === pin.capture);
    if (!g || !decl) { totalsOk = false; continue; }
    if (g.staked !== pin.walletStakedUnits || g.paid !== pin.walletPaidUnits || g.wins !== pin.wins || g.bookedPaidCents !== pin.bookedPaidCents) {
      totalsOk = false; fault(`capture ${pin.capture}: wallet totals ${g.staked}/${g.paid} units over ${g.wins} wins != declared ${pin.walletStakedUnits}/${pin.walletPaidUnits} over ${pin.wins}`);
    }
    const net = g.paid - g.staked;
    let line = `capture ${pin.capture} (booked in ${pin.fiat}; served rate ${[...g.rates].sort().join(' / ')}): ${unitsToDecimal(g.staked, 8)} ${PROD_WALLET_CURRENCY} staked, ${unitsToDecimal(g.paid, 8)} in the wallet field of the replies, net ${unitsToDecimal(net, 8)}`;
    if (g.unitRate === pin.rounds) {
      const gap = g.paid - g.bookedPaidCents * 1_000_000n;
      if (gap !== decl.droppedUnits) { bookedGapOk = false; fault(`capture ${pin.capture}: wallet fields exceed booked wins by ${gap} units, declared ${decl.droppedUnits}`); }
      line += `; booked wins ${unitsToDecimal(g.bookedPaidCents, 2)} ${pin.fiat}, so the wallet fields total ${unitsToDecimal(gap, 8)} more than the booked figure (net by the booked figures ${unitsToDecimal(g.bookedPaidCents * 1_000_000n - g.staked, 8)})`;
    } else {
      line += `; booked wins ${unitsToDecimal(g.bookedPaidCents, 2)} ${pin.fiat} — a different currency from the wallet's, reported side by side, not converted`;
    }
    captureLines.push(line);
  }
  const walletOk = wins === PROD_WINS && walletRuleOk === wins && walletBelowRule === 0 && walletAboveRule === 0
    && walletStakeBad === 0 && offGrid === 0 && lossPaid === 0 && exactAbove === 0 && disclosureOk && totalsOk && bookedGapOk;
  const orderIndOk = [...cellDisplay.values()].every(v => v.size === 1) && [...cellFiat.values()].every(v => v.size === 1);
  if (!orderIndOk) fault('a cash-out cell carries more than one displayed multiplier or booked amount across reveal orders');
  // (h) every planned (phase, setting) witnessed by a win; the ones with none are enumerated.
  const planKeys = [...SETTINGS_PLAN.keys()];
  const unwitnessed = planKeys.filter(k => !wonSettings.has(k));
  const witnessed = planKeys.length - unwitnessed.length;
  // Phase A (250 per setting) must witness all 20; a 25-round phase D setting may by chance have no win.
  const coverageOk = planKeys.filter(k => !k.startsWith('D|')).every(k => wonSettings.has(k)) && witnessed > 0;
  if (!coverageOk) fault(`settings with no win outside phase D: ${unwitnessed.filter(k => !k.startsWith('D|')).join(', ')}`);

  // ── (i) operator settings, per capture ────────────────────────────────────────
  const settings = new Map<string, number>();
  for (const { rec, capture } of cap.bets) {
    const g = rec?.settleRaw?.currentGameSettings;
    if (g !== undefined && g !== null) { const t = `${capture}|${typeof g === 'string' ? g : JSON.stringify(g)}`; settings.set(t, (settings.get(t) ?? 0) + 1); }
  }
  const settingsOk = settings.size === PROD_GAME_SETTINGS.length && PROD_GAME_SETTINGS.every(g => settings.get(`${g.capture}|${g.value}`) === g.records);
  if (!settingsOk) fault(`settings records ${[...settings].map(([v, c]) => `${c} × ${v}`).join('; ')} != the declaration`);
  const settingsRecords = [...settings.values()].reduce((a, c) => a + c, 0);
  const settingsCountOk = settingsRecords === (EXPECTED_BETS - wins) + autoIds.length;
  if (!settingsCountOk) fault(`${settingsRecords} settings records, expected one per loss and per self-settled round (${EXPECTED_BETS - wins} + ${autoIds.length})`);

  // ── (j) LIQD's verifier ───────────────────────────────────────────────────────
  let verOk = 0, verReq = 0, verOpenTiles = 0;
  const verifyUrl = `https://${PROD_HOST}/api/v1/fast-games/provably-fair/verify/mine`;
  /** The only inputs the verifier request may carry: none of them names the round or its opened tiles. */
  const VERIFY_INPUT_KEYS = 'clientSeed,mineCount,nonce,serverSeed';
  for (let i = 0; i < n; i++) {
    const b = bets[i] as any;
    const v = cap.verify.get(b.id);
    const ss = ctx.seedMap.get(b.hashedServerSeed);
    if (!v || v.status !== 200 || !ss) { fault(`round ${b.id}: no HTTP 200 verifier reply`); continue; }
    let body: any = null, reqBody: any = null;
    try { body = JSON.parse(v.body); reqBody = JSON.parse(v.request?.body); } catch { /* counted below */ }
    if (reqBody && v.request?.url === verifyUrl && Object.keys(reqBody).sort().join(',') === VERIFY_INPUT_KEYS
      && reqBody.serverSeed === ss && reqBody.clientSeed === b.clientSeed && reqBody.nonce === b.nonce && reqBody.mineCount === b.mineCount) verReq++;
    const recomputed = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
    const sortN = (a: number[]) => [...a].sort((x, z) => x - z);
    if (body && eqArr(body.openTiles, b.openTiles) && b.openTiles.length > 0) verOpenTiles++;
    if (body && Array.isArray(body.mines) && sameMines(sortN(body.mines), sortN(recomputed)) && eqArr(body.openTiles, b.openTiles)) verOk++;
    else fault(`round ${b.id}: LIQD's verifier reply differs from the recomputed round`);
  }
  const verifierOk = verOk === EXPECTED_BETS && verReq === EXPECTED_BETS && verOpenTiles === EXPECTED_BETS && cap.verify.size === EXPECTED_BETS;

  // ── (k) LIQD's ledger debits ──────────────────────────────────────────────────
  // Every step reply is scanned, so a debit record on a reply other than a settling open-tile reply is
  // counted too. Each record is held to the facts declared in src/pins.ts PROD_LEDGER_DEBITS; none of
  // it is used to infer a balance.
  let ledgerAll = 0, ledgerOnSettle = 0, ledgerFactsOk = 0, ledgerMissing = 0;
  const ledgerByCapture = new Map<number, { records: number; notWallet: number }>();
  for (const evs of cap.steps.values()) for (const e of evs) if (e.reply && typeof e.reply === 'object' && 'betTransaction' in e.reply) ledgerAll++;
  for (let i = 0; i < n; i++) {
    const b = bets[i] as any, entry = cap.bets[i], rec = entry.rec ?? {}, s = rec.settleRaw ?? {};
    const evs = cap.steps.get(String(rec.key)) ?? [];
    const withDebit = evs.filter(e => e.reply && typeof e.reply === 'object' && 'betTransaction' in e.reply);
    const settlesOnOpenTile = b.result === 'lost' || s.autoFinish === true;
    const last = evs[evs.length - 1];
    if (!settlesOnOpenTile) { if (withDebit.length !== 0) fault(`round ${b.id}: a ledger debit on a round settled by cash-out`); continue; }
    if (withDebit.length !== 1 || withDebit[0] !== last || last?.name !== 'open-tile') { ledgerMissing++; fault(`round ${b.id}: ${withDebit.length} ledger debit(s), expected one on its settling open-tile reply`); continue; }
    ledgerOnSettle++;
    const bt = last.reply.betTransaction ?? {};
    const lc = ledgerByCapture.get(entry.capture) ?? { records: 0, notWallet: 0 };
    ledgerByCapture.set(entry.capture, lc);
    lc.records++;
    const fileMeta = fileOf.get(entry.capture)?.meta;
    const facts = Number(bt.amount) === Number(s.betAmount) && Number(bt.amount) === Number(rec.placeRaw?.betAmount)
      && bt.currencyId === PROD_WALLET_CURRENCY_ID && s.currencyId === PROD_WALLET_CURRENCY_ID && rec.placeRaw?.currencyId === PROD_WALLET_CURRENCY_ID
      && String(fileMeta?.currencyId) === PROD_WALLET_CURRENCY_ID && fileMeta?.stakeCurrency === PROD_WALLET_CURRENCY
      && bt.transactionType === 'bet' && bt.status === 'success' && bt.betId === b.id && bt.gameId === s.gameId;
    if (facts) ledgerFactsOk++;
    else fault(`round ${b.id}: ledger debit ${JSON.stringify({ amount: bt.amount, currencyId: bt.currencyId, transactionType: bt.transactionType, status: bt.status, betId: bt.betId })} is not the declared record`);
    if (decimalUnits(bt.amount, 8) !== decimalUnits(rec.placeRaw?.betAmountWallet, 8)) lc.notWallet++;
  }
  const ledgerDeclared = PROD_LEDGER_DEBITS.reduce((a, c) => a + c.records, 0);
  const ledgerPerCaptureOk = PROD_LEDGER_DEBITS.length === PROD_CAPTURES.length
    && PROD_LEDGER_DEBITS.every(d => ledgerByCapture.get(d.capture)?.records === d.records && ledgerByCapture.get(d.capture)?.notWallet === d.amountNotWalletStake);
  const ledgerOk = ledgerAll === ledgerDeclared && ledgerOnSettle === ledgerDeclared && ledgerFactsOk === ledgerDeclared
    && ledgerMissing === 0 && ledgerPerCaptureOk && ledgerDeclared === (EXPECTED_BETS - wins) + autoIds.length;
  if (!ledgerOk) fault(`ledger debits: ${ledgerAll} in the replies, ${ledgerOnSettle} on settling open-tile replies, ${ledgerFactsOk} with the declared facts, per capture ${[...ledgerByCapture].map(([c, x]) => `${c}: ${x.records} (${x.notWallet} not the USDT stake)`).join(', ')}; declared ${ledgerDeclared}`);

  const ok = integrityOk && rowsOk && seedsOk && revealsOk && autoDeclOk && stepMultOk && cashOk
    && walletOk && orderIndOk && coverageOk && settingsOk && settingsCountOk && verifierOk && ledgerOk;
  return [step(STEP_NUMBER, STEP_NAME, ok ? 'PASS' : 'FAIL',
    `RAW CAPTURES (${PROD_HOST}): ${PROD_CAPTURES.map(c => `capture ${c.capture} ${c.file.replace('data/', '')} (${c.dates}, ${c.rounds} rounds, ${c.lines} lines)`).join('; ')} — SHA-256 pins match; ${shapeOk}/${PROD_CAPTURES.length} files carry the declared lines, events by type and requests by name; ${metaOk}/${PROD_CAPTURES.length} name the declared runner builds (${PROD_CAPTURES.map(c => c.runnerBuild === c.exportBuild ? c.runnerBuild : `${c.runnerBuild} then ${c.exportBuild}`).join('; ')}), origin https://${PROD_HOST} and planned fiat; requests in total ${Object.entries(totalRequests).map(([k, v]) => `${k} ${v}`).join(', ')} (${sameCounts(totalRequests, PROD_REQUESTS) ? 'as declared' : 'NOT as declared'}). Capture 2 stopped once (the first round LIQD settled by itself, a reply shape its starting build did not know) and was resumed on the next build, which rebuilt that round's record from its stored replies: its stop, resume-check and recovered events are in the declared event counts. `
    + `(b) row binding: ${rowsBound}/${EXPECTED_BETS} scored rows equal their settling reply field for field, with the runner's phase tags; ${intentsBefore}/${EXPECTED_BETS} rounds' planned tiles journalled before their first request; ${planBound}/${EXPECTED_BETS} equal the plan the runner wrote into the capture's meta before any bet. `
    + `(c) ${seedsBound}/${EXPECTED_SEEDS} seed records equal their capture's epoch event and the rotation that revealed them. `
    + `(d) reveals: ${revealStatusOk}/${reveals} open-tile replies agree with the recomputed layout (mine/safe flag; on a self-settled round's last reply, a safe tile and no flag); ${revealOrderOk}/${EXPECTED_BETS} rounds opened their planned tiles in order; ${roundsShapeOk}/${EXPECTED_BETS} request sequences match the result (one place-bet; a win cashes out after its planned depth, a loss stops on its first mine). `
    + `(e) ROUNDS LIQD SETTLED BY ITSELF: ${autoIds.length} (${autoIds.join(', ')}; declared ${PROD_AUTO_FINISH_ROUNDS.length}) — each opened the last safe tile of a 24-mine board, the open-tile reply is the settled round (autoFinish true, won) and no cash-out was sent: ${autoOk}/${autoIds.length} of that shape, booked and carried in the wallet field by the same rules as every other win; cash-out requests ${cashOuts} = ${wins} wins − ${autoIds.length}. On these rounds the reply settled the win without a cash-out from the player; no other captured round reached its last safe tile. Open-tile replies carrying a multiplier: ${stepMults} of ${reveals} (declared ${PROD_DECLARED_PER_STEP_MULTIPLIERS}, those ${autoIds.length} settled replies) — no per-step rung is served on the wire. `
    + `(f) WALLET FIELD (${PROD_WALLET_CURRENCY}): ${walletRuleOk}/${wins} wins carry exactly LIQD's measured rule floor8(betAmountWallet × floor8(exact)), ${walletBelowRule} below it, ${walletAboveRule} above it; against the exact product floor8(betAmountWallet × exact): ${exactEqual} equal, ${exactBelow} one 1e-8 unit lower (${unitsToDecimal(exactBelowUnits, 8)} ${PROD_WALLET_CURRENCY} in total; ${fmtCells(belowCells)}; by capture ${PROD_CAPTURES.map(c => `${c.capture}: ${perCapture.get(c.capture)?.below ?? 0}`).join(', ')}), ${exactAbove} higher — the disclosed rounding (src/pins.ts PROD_WALLET_BELOW_EXACT ${PROD_WALLET_BELOW_EXACT}, ${disclosureOk ? 'bound' : 'DOES NOT MATCH'}; a rounding disclosure, not a fail); ${lossPaid} losses carry a non-zero wallet field; ${walletStakeBad} wallet stakes off the grid or differing between replies. Per capture — ${captureLines.join('; ')} (${totalsOk && bookedGapOk ? 'as declared' : 'NOT as declared'}). `
    + `(g) order independence: ${[...cellDisplay.values()].filter(v => v.size === 1).length}/${cellDisplay.size} winning (cell, stake, fiat) groups carry one displayed multiplier and one booked amount across every reveal order that reached them. `
    + `(h) ${witnessed}/${planKeys.length} planned (phase, setting) pairs witnessed by a win${unwitnessed.length ? `; none in ${unwitnessed.map(k => k.replace('|', ' (').replace(':', ', ') + ')').join(', ')} (25 rounds at that setting, all lost; the same cell is won in phase A)` : ''}. `
    + `(i) operator settings: ${settingsRecords} records (one per loss and per self-settled round), ${settings.size} (capture, value) pairs — ${settingsOk ? 'equal to' : 'NOT'} src/pins.ts PROD_GAME_SETTINGS (no maxOdds key; Step 10 discloses them). `
    + `(j) LIQD's verifier (POST ${verifyUrl.replace(`https://${PROD_HOST}`, '')}, requested after each epoch's seed was revealed): ${verReq}/${EXPECTED_BETS} requests carry the round's revealed inputs and nothing else (body keys exactly serverSeed, clientSeed, nonce, mineCount); ${verOk}/${EXPECTED_BETS} replies give the recomputed mine tiles (as a set) and the served open tiles. Those inputs do not determine which tiles a round opened, yet ${verOpenTiles}/${EXPECTED_BETS} replies name exactly the tiles the captured round opened: LIQD's verifier can only know them from its own stored round, so each captured round matches a round LIQD holds. It is still the operator's own tool, not an independent check of the operator's outcomes; whether it answers for a round played by another account was not tested. `
    + `(k) LIQD's ledger debits: ${ledgerAll} betTransaction records in the replies, ${ledgerOnSettle} of them one per round on the settling open-tile reply (every loss and the ${autoIds.length} self-settled rounds; no place-bet, safe open-tile or cash-out reply carries one), per capture ${PROD_CAPTURES.map(c => `${c.capture}: ${ledgerByCapture.get(c.capture)?.records ?? 0}`).join(', ')}; ${ledgerFactsOk}/${ledgerOnSettle} with amount equal to the round's stake in the booking fiat, currencyId "${PROD_WALLET_CURRENCY_ID}" (the round's own currency id, the wallet's: ${PROD_WALLET_CURRENCY}), type "bet", status "success" and the round's betId; the amount is not the round's ${PROD_WALLET_CURRENCY} stake on ${PROD_CAPTURES.map(c => `${ledgerByCapture.get(c.capture)?.notWallet ?? 0} of ${ledgerByCapture.get(c.capture)?.records ?? 0} in capture ${c.capture} (booked in ${c.fiat})`).join(', ')} — ${ledgerOk ? 'as declared in' : 'NOT as declared in'} src/pins.ts PROD_LEDGER_DEBITS. Read and reported; the audit does not use them to infer a balance.`
    + (faults.length ? ` FAULTS: ${faults.join('; ')}` : ''),
  )];
}
