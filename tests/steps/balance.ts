/**
 * Step 23: Balance Reconciliation — which amount of a win reaches the balance (the balance check of 12 November 2026).
 *
 * The three scored captures read no balance (no mines reply carries one), so Steps 8 and 22 verify the two
 * amounts LIQD states for a win — the booked fiat amount and the USDT wallet field — and not which one is
 * paid. The balance check (src/balance-check.ts, pinned in src/pins.ts BALANCE_CHECK_CAPTURE) is a fourth
 * raw capture, played for that question: 100 rounds at two settings where the two amounts differ on every
 * win, with the account's USDT wallet read just before each place-bet and after each settle. For every
 * round this step recomputes, from the capture alone,
 *
 *   moved   = balance after − balance before
 *   (a)     = winningAmount − betAmount                     the booked amounts
 *   (b)     = winningAmountWallet − betAmountWallet         the wallet fields (a loss: −betAmountWallet)
 *
 * and PASSes only if
 *   - every WIN where (a) ≠ (b) moved the balance by exactly (b), 1e-8 exact, and none by (a) or by anything else;
 *   - every LOSS moved it by exactly −stake;
 *   - nothing moved it BETWEEN rounds: each round's read before its place-bet equals the previous round's
 *     read after its settle;
 *   - the rounds are booked in USD at the served rate 1.00000000 with betAmount = betAmountWallet, so (a)
 *     and (b) are amounts of the same unit, and the reads are the USDT wallet.
 *
 * Integrity and coverage arms, bound to the pin and never to the file's own meta: the file hashes to its
 * pin; its lines, events by type and requests by name are as declared; every round has both reads, its
 * after-settle reads agree, and the runner's per-round summary equals the round's raw balance-read replies; rounds, wins, mine count, depth and stake per phase are as declared; every
 * win's two amounts follow the rules Steps 8 and 22 hold the scored rounds to (booked floor2(stake ×
 * exact), wallet floor8(stake × floor8(exact))); every revealed seed hashes to its commitment, every
 * mine layout recomputes from it in draw order, won ⇔ no opened tile is a mine, and LIQD's verifier
 * reply names the recomputed mines for every round. A fault there FAILs: the comparison would be made on
 * a file that is not the one declared.
 *
 * Profile check MINES-16 (wallet / balance reconciliation, policy FLAG): a balance movement that is not
 * what the reply states FLAGs, it does not hard-fail.
 */
import * as path from 'path';
import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { revealMines, sameMines, commitHash } from '../../src/rng';
import { minesMultiplierRational } from '../../src/config';
import { BALANCE_CHECK_CAPTURE } from '../../src/pins';
import { loadBalanceCapture, balanceRounds, betweenRoundChanges, units8 } from '../../src/balance-check';
import { unitsToDecimal } from '../../src/prod-capture';
import { walletFieldRule } from './raw-capture';

export const STEP_NUMBER = 23;
export const STEP_NAME = 'Balance Reconciliation (12 November balance check: the wallet field reaches the balance)';

const sameCounts = (got: Record<string, number>, want: Readonly<Record<string, number>>) =>
  Object.keys(got).length === Object.keys(want).length && Object.entries(want).every(([t, n]) => got[t] === n);
const d8 = (u: bigint | null) => (u === null ? 'n/a' : unitsToDecimal(u, 8));

/** The booked rule of Step 8, in 1e-8 units: floor2(stake × exact). */
function bookedRule(stakeUnits: bigint, m: number, k: number): bigint | null {
  const r = minesMultiplierRational(m, k);
  if (!r) return null;
  return ((stakeUnits * r.num) / r.den / 1_000_000n) * 1_000_000n;
}

export function run(ctx: VerifyContext): StepResult[] {
  const pin = BALANCE_CHECK_CAPTURE;
  const cap = loadBalanceCapture(path.resolve(ctx.outputsDir, '..'));
  if (cap.problem) return [step(STEP_NUMBER, STEP_NAME, 'FAIL', `balance-check capture not loaded: ${cap.problem}`)];

  const faults: string[] = [];
  const fault = (s: string) => { if (faults.length < 6) faults.push(s); };
  const flags: string[] = [];
  const flag = (s: string) => { if (flags.length < 6) flags.push(s); };

  // ── Integrity: the file is the declared one ────────────────────────────────
  const evCounts: Record<string, number> = {}, reqCounts: Record<string, number> = {};
  for (const ev of cap.events) {
    evCounts[ev.t] = (evCounts[ev.t] ?? 0) + 1;
    if (ev.t === 'step') reqCounts[String(ev.name)] = (reqCounts[String(ev.name)] ?? 0) + 1;
  }
  const meta: any = cap.events.find(e => e.t === 'meta')?.meta ?? {};
  const note: any = cap.events.find(e => e.t === 'export-note') ?? {};
  const shapeOk = cap.lines === pin.lines && sameCounts(evCounts, pin.events) && sameCounts(reqCounts, pin.requests);
  if (!shapeOk) fault(`file shape: ${cap.lines} lines (declared ${pin.lines}), events ${JSON.stringify(evCounts)}, requests ${JSON.stringify(reqCounts)}`);
  const buildOk = String(meta.script ?? '').endsWith(`build ${pin.runnerBuild}`) && String(note.script ?? '').endsWith(`build ${pin.runnerBuild}`);
  if (!buildOk) fault(`runner build: meta "${meta.script}", export note "${note.script}", declared ${pin.runnerBuild}`);

  // ── Rounds ─────────────────────────────────────────────────────────────────
  const rounds = balanceRounds(cap.events);
  const declaredRounds = pin.phases.reduce((a, p) => a + p.rounds, 0);
  const perPhase = pin.phases.map(p => {
    const rs = rounds.filter(r => r.phaseId === p.phaseId);
    const wins = rs.filter(r => r.won), losses = rs.filter(r => !r.won);
    const settingOk = rs.every(r => r.mineCount === p.mineCount && r.opened.length === (r.won ? p.depth : r.opened.length) && r.opened.length <= p.depth
      && r.bookedStake === p.stakeUnits && r.walletStake === p.stakeUnits);
    return { p, rs, wins, losses, settingOk };
  });
  const coverageOk = rounds.length === declaredRounds && perPhase.every(x => x.rs.length === x.p.rounds && x.wins.length === x.p.wins && x.settingOk);
  if (!coverageOk) fault(`coverage: ${rounds.length} rounds (declared ${declaredRounds}); ${perPhase.map(x => `${x.p.phaseId} ${x.rs.length} rounds, ${x.wins.length} wins (declared ${x.p.rounds}, ${x.p.wins}), setting/stake ${x.settingOk ? 'as declared' : 'NOT as declared'}`).join('; ')}`);

  // Every round read before and after; the after-settle reads settled (the last two agree, at least two taken).
  const unread = rounds.filter(r => r.cls === 'unread' || r.cls === 'no-amounts');
  const unsettled = rounds.filter(r => !(r.afterReads !== null && r.afterReads >= 2 && r.afterSettled));
  if (unread.length) fault(`${unread.length} round(s) without both reads or both amounts (first ${unread[0].betId}: ${unread[0].cls})`);
  if (unsettled.length) fault(`${unsettled.length} round(s) whose after-settle reads do not agree (first ${unsettled[0].betId})`);

  // The runner's per-round summary (rec.balanceCheck) is bound to the raw reads it was made from: the round's
  // `balance-read` step events, HTTP 200, the read before its place-bet first and then each read after the
  // settle, in order, with LIQD's game state showing no open game before the bet and after the settle.
  const stepsByKey = new Map<string, any[]>();
  for (const e of cap.events) if (e.t === 'step') { const a = stepsByKey.get(String(e.key)) ?? []; a.push(e); stepsByKey.set(String(e.key), a); }
  let readsBound = 0;
  for (const e of cap.events) {
    if (e.t !== 'bet' || !e.rec?.balanceCheck) continue;
    const bc = e.rec.balanceCheck, st = stepsByKey.get(String(e.rec.key)) ?? [];
    const reads = st.filter(x => x.name === 'balance-read'), checks = st.filter(x => x.name === 'settle-check');
    const want = [bc.before?.amount, ...(Array.isArray(bc.after?.amounts) ? bc.after.amounts : [])];
    const ok = reads.length === want.length && reads.every((x, i) => x.ok === true && x.http?.status === 200 && x.currency === pin.readCurrency
        && x.field === pin.readField && units8(x.amount) !== null && units8(x.amount) === units8(want[i]) && (i === 0 ? x.when === 'before' : x.when === `after ${i}`))
      && st.indexOf(reads[0]) < st.findIndex(x => x.name === 'place-bet')
      && checks.length === 2 && checks.every(x => x.ok === true && x.gamesInProgress === 0) && checks[0].when === 'before' && checks[1].when === 'after'
      && units8(bc.after?.amount) === units8(want[want.length - 1]) && bc.after?.reads === want.length - 1;
    if (ok) readsBound++; else fault(`${e.rec.betId}: rec.balanceCheck does not equal the round's balance-read replies`);
  }

  // Currency: USD at 1.00000000, betAmount = betAmountWallet, the reads are the USDT wallet.
  const rate1 = units8(pin.rate);
  const offCurrency = rounds.filter(r => r.fiat !== pin.fiat || units8(r.rate) !== rate1 || r.bookedStake === null || r.bookedStake !== r.walletStake
    || r.readCurrency !== pin.readCurrency || r.readField !== pin.readField);
  if (offCurrency.length) fault(`${offCurrency.length} round(s) not booked in ${pin.fiat} at ${pin.rate} with betAmount = betAmountWallet and a ${pin.readCurrency} read (first ${offCurrency[0].betId}: ${String(offCurrency[0].fiat)}@${String(offCurrency[0].rate)})`);

  // The two amounts of every win follow the rules of Steps 8 and 22.
  let bookedRuleOk = 0, walletRuleOk = 0;
  const wins = rounds.filter(r => r.won);
  for (const r of wins) {
    const k = r.opened.length;
    const bw = r.bookedStake === null ? null : bookedRule(r.bookedStake, r.mineCount, k);
    const ww = r.walletStake === null ? null : walletFieldRule(r.walletStake, r.mineCount, k);
    if (bw !== null && bw === r.bookedWin) bookedRuleOk++; else fault(`${r.betId}: booked ${d8(r.bookedWin)}, rule floor2(stake × exact) ${d8(bw)}`);
    if (ww !== null && ww === r.walletWin) walletRuleOk++; else fault(`${r.betId}: wallet field ${d8(r.walletWin)}, rule floor8(stake × floor8(exact)) ${d8(ww)}`);
  }
  for (const r of rounds) if (!r.won && r.walletWin !== 0n) fault(`${r.betId}: a loss carries a wallet win ${d8(r.walletWin)}`);

  // Outcomes: every revealed seed hashes to its commitment, every layout recomputes, LIQD's verifier agrees.
  const epochHash = new Map<number, string>();
  for (const e of cap.events) if (e.t === 'epoch') epochHash.set(Number(e.epoch), String(e.hashedServerSeed));
  const revealed = new Map<number, string>();
  let commitOk = 0;
  for (const e of cap.events) {
    if (e.t !== 'rotate' || typeof e.closes !== 'number') continue;
    const seed = String(e.state?.revealedServerSeed ?? e.raw?.revealedServerSeed ?? '');
    revealed.set(e.closes, seed);
    if (commitHash(seed) === epochHash.get(e.closes)) commitOk++;
    else fault(`epoch ${e.closes}: revealed seed does not hash to its commitment`);
  }
  const verify = new Map<string, any>();
  for (const e of cap.events) if (e.t === 'verify' && typeof e.betId === 'string') verify.set(e.betId, e);
  let layoutOk = 0, labelOk = 0, verifierOk = 0;
  for (const r of rounds) {
    const seed = revealed.get(r.epoch);
    const mines = seed ? revealMines(seed, r.clientSeed, r.nonce, r.mineCount) : null;
    if (mines && sameMines(mines, r.mineTiles)) layoutOk++; else fault(`${r.betId}: mine layout does not recompute`);
    if (mines && r.won === !r.opened.some(t => mines.includes(t))) labelOk++; else fault(`${r.betId}: result ${r.won ? 'won' : 'lost'} against the recomputed layout`);
    const v = verify.get(r.betId);
    let body: any = null; try { body = JSON.parse(String(v?.body)); } catch { body = null; }
    const vm: number[] = Array.isArray(body?.mines) ? [...body.mines].sort((a, z) => a - z) : [];
    if (v?.status === 200 && mines && vm.length === mines.length && [...mines].sort((a, z) => a - z).every((t, i) => t === vm[i])) verifierOk++;
    else fault(`${r.betId}: LIQD verifier reply does not name the recomputed mines`);
  }
  const outcomesOk = commitOk === pin.phases.length && revealed.size === pin.phases.length && layoutOk === rounds.length && labelOk === rounds.length && verifierOk === rounds.length;

  // ── The question: which amount moved the balance ─────────────────────────
  const apart = wins.filter(r => r.booked !== null && r.wallet !== null && r.booked !== r.wallet);
  const winsWallet = apart.filter(r => r.cls === 'wallet').length;
  const winsBooked = apart.filter(r => r.cls === 'booked').length;
  const winsNeither = wins.filter(r => r.cls === 'neither').length;
  const winsEqual = wins.filter(r => r.cls === 'both').length;
  const losses = rounds.filter(r => !r.won);
  const lossesStake = losses.filter(r => r.moved !== null && r.walletStake !== null && r.moved === -r.walletStake).length;
  const gaps = betweenRoundChanges(rounds);
  for (const r of apart) if (r.cls !== 'wallet') flag(`${r.phaseId} ${r.betId}: moved ${d8(r.moved)}, (a) booked ${d8(r.booked)}, (b) wallet field ${d8(r.wallet)}`);
  for (const r of losses) if (!(r.moved !== null && r.walletStake !== null && r.moved === -r.walletStake)) flag(`${r.phaseId} ${r.betId}: a loss moved ${d8(r.moved)}, stake ${d8(r.walletStake)}`);
  for (const g of gaps.slice(0, 3)) flag(`between rounds before ${rounds[g.index].betId}: the balance changed by ${d8(g.delta)}`);
  const sum = (xs: Array<bigint | null>) => xs.reduce<bigint | null>((s, x) => (s === null || x === null ? null : s + x), 0n);
  const phaseLine = perPhase.map(x => {
    const ap = x.wins.filter(r => r.booked !== r.wallet);
    return `${x.p.phaseId} (${x.p.rounds} rounds at ${d8(x.p.stakeUnits)}, ${x.p.mineCount} mine${x.p.mineCount > 1 ? 's' : ''}, ${x.p.depth} tiles): `
      + `${x.wins.length} wins, the wallet field on ${ap.filter(r => r.cls === 'wallet').length} of ${ap.length} where the two differ, the booked amount on ${ap.filter(r => r.cls === 'booked').length}; `
      + `${x.losses.length} losses, −stake on ${x.losses.filter(r => r.moved === (r.walletStake === null ? null : -r.walletStake)).length}; `
      + `summed: moved ${d8(sum(x.rs.map(r => r.moved)))}, (a) ${d8(sum(x.rs.map(r => r.booked)))}, (b) ${d8(sum(x.rs.map(r => r.wallet)))}`;
  }).join('; ');

  const moneyOk = apart.length > 0 && winsWallet === apart.length && winsBooked === 0 && winsNeither === 0
    && lossesStake === losses.length && gaps.length === 0;
  const integrityOk = faults.length === 0 && shapeOk && buildOk && coverageOk && unread.length === 0 && unsettled.length === 0 && readsBound === rounds.length
    && offCurrency.length === 0 && outcomesOk && bookedRuleOk === wins.length && walletRuleOk === wins.length;
  const status = !integrityOk ? 'FAIL' : moneyOk ? 'PASS' : 'FLAG';

  const detail = `SCOPE: the balance check of 12 November 2026 (${pin.file}, SHA-256 pinned; ${rounds.length} rounds on liqd.com, one account, booked in ${pin.fiat} at the served rate ${pin.rate}, two settings, two stakes), not the scored dataset; `
    + `the account's ${pin.readCurrency} wallet (\`${pin.readField}\` of GET /api/v1/user/get-user) read just before each place-bet and after each settle until two reads agreed. `
    + `Per round: moved = after − before, (a) = winningAmount − betAmount (booked), (b) = winningAmountWallet − betAmountWallet (wallet field; a loss carries none), exact in 1e-8 units. `
    + `ANSWER: on the ${apart.length} wins where (a) and (b) differ the balance moved by (b), the wallet field, on ${winsWallet}, by (a), the booked amount, on ${winsBooked}, by neither on ${winsNeither} (${winsEqual} wins where the two are equal); `
    + `${lossesStake} of ${losses.length} losses moved it by exactly −stake; between rounds: ${Math.max(rounds.length - 1, 0)} pairs, ${gaps.length} where a round's read before its bet differs from the previous round's read after its settle. `
    + `Per phase: ${phaseLine}. `
    + `Currency: ${rounds.length - offCurrency.length}/${rounds.length} rounds in ${pin.fiat} at ${pin.rate} with betAmount = betAmountWallet, so (a) and (b) are in one unit. `
    + `Integrity: file shape and runner build ${shapeOk && buildOk ? 'as declared' : 'NOT as declared'} (${cap.lines} lines; events and requests by name as src/pins.ts BALANCE_CHECK_CAPTURE); ${rounds.length - unread.length}/${rounds.length} rounds with both reads, ${rounds.length - unsettled.length}/${rounds.length} with agreeing after-settle reads, ${readsBound}/${rounds.length} whose reads equal the raw balance-read replies (HTTP 200, the read before the place-bet, then each read after the settle, no open game before the bet or after the settle); `
    + `amounts by the rules of Steps 8 and 22: booked floor2(stake × exact) ${bookedRuleOk}/${wins.length}, wallet field floor8(stake × floor8(exact)) ${walletRuleOk}/${wins.length}; `
    + `outcomes: ${commitOk}/${pin.phases.length} revealed seeds hash to their commitments, ${layoutOk}/${rounds.length} layouts recompute in draw order, ${labelOk}/${rounds.length} results agree with them, LIQD's verifier names the recomputed mines on ${verifierOk}/${rounds.length}. `
    + `What this does not establish: the balance on the ${ctx.bets.length.toLocaleString('en-US')} scored rounds (no balance was read there), other settings or stakes, or the CAD booking of capture 1, where the wallet field is in USDT at a served rate and (a) and (b) are not in one unit (the exchange rate remains outside the audit). `
    + `MINES-16 policy FLAG: a movement other than the reply's wallet field FLAGs; a file other than the declared one FAILs.`
    + (faults.length ? ` FAULTS: ${faults.join('; ')}` : '')
    + (flags.length ? ` FLAGGED: ${flags.join('; ')}` : '');

  return [step(STEP_NUMBER, STEP_NAME, status, detail)];
}
