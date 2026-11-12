/**
 * THE BALANCE CHECK (liqd.com, 12 November 2026) — which amount of a win reaches the account balance.
 *
 * LIQD's settling reply states a win twice: the BOOKED amount, `winningAmount`, the stake × exact
 * multiplier cut to the cent in the account's display fiat (Step 8), and the WALLET FIELD,
 * `winningAmountWallet`, floor8(betAmountWallet × floor8(exact multiplier)) in USDT (Step 22). No mines
 * reply carries a balance, so the three scored captures cannot say which of the two is paid.
 *
 * This file is a fourth raw capture, played for that question alone and NOT part of the scored dataset:
 * 100 rounds in two settings chosen so that the two amounts differ on every win —
 *
 *   BC1   50 rounds at 0.10, 1 mine, 2 tiles   a win books 0.10, the wallet field is 0.10760869
 *   BC2   50 rounds at 0.01, 3 mines, 5 tiles  a win books 0.01, the wallet field is 0.01997368
 *
 * — with the account's USDT wallet read (GET /api/v1/user/get-user, `user.wallets[0].amount`) once just
 * before each place-bet and after the settle, until two reads in a row agree. The account was in USD at
 * the served rate 1.00000000, so the booked figure and the wallet field are amounts of the same unit and
 * the balance movement can be set against each.
 *
 * The file is vendored byte-identical and pinned by SHA-256 (src/pins.ts BALANCE_CHECK_CAPTURE). Its
 * events have the shape of the other three captures (src/prod-capture.ts), plus `rec.balanceCheck`
 * { before, after } on every bet record and `settle-check` / `balance-read` step events. Nothing here
 * interprets a value beyond the arithmetic below; Step 23 scores it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { BALANCE_CHECK_CAPTURE } from './pins';
import { decimalUnits } from './prod-capture';

export interface BalanceEvent { t: string; [k: string]: any }

export interface BalanceCapture {
  /** Null when the file was read, hashed to its pin and parsed line for line. */
  problem: string | null;
  file: string;
  sha256: string | null;
  lines: number;
  events: BalanceEvent[];
}

let cached: { root: string; cap: BalanceCapture } | null = null;

/** Load (once per process) and pin-check the balance-check capture under `repoRoot`. */
export function loadBalanceCapture(repoRoot: string): BalanceCapture {
  if (cached && cached.root === repoRoot) return cached.cap;
  const pin = BALANCE_CHECK_CAPTURE;
  const out = (problem: string | null, sha256: string | null, lines: number, events: BalanceEvent[]): BalanceCapture =>
    ({ problem, file: pin.file, sha256, lines, events });
  let cap: BalanceCapture;
  const p = path.join(repoRoot, pin.file);
  if (!existsSync(p)) cap = out(`${pin.file} is absent`, null, 0, []);
  else {
    const raw = readFileSync(p);
    const sha256 = createHash('sha256').update(raw).digest('hex');
    if (sha256 !== pin.sha256) cap = out(`${pin.file} hashes to ${sha256}, pinned ${pin.sha256}`, sha256, 0, []);
    else {
      const text = raw.toString('utf8').split('\n');
      if (text[text.length - 1] === '') text.pop();
      const events: BalanceEvent[] = [];
      let bad = -1;
      text.forEach((l, i) => { try { events.push(JSON.parse(l)); } catch { if (bad < 0) bad = i + 1; } });
      cap = bad >= 0 ? out(`${pin.file} line ${bad} is not JSON`, sha256, 0, []) : out(null, sha256, text.length, events);
    }
  }
  cached = { root: repoRoot, cap };
  return cap;
}

/** 1e-8 units of an amount as LIQD or the runner wrote it (number or decimal string); null when not on the grid. */
export const units8 = (v: unknown): bigint | null => (v === null || v === undefined || v === '' ? null : decimalUnits(v, 8));

/**
 * One round of the balance check: what the wallet did, and what each amount of the reply predicts.
 *   moved   = balance after the settle − balance before the place-bet
 *   booked  = winningAmount − betAmount                     (the booked fiat amounts)
 *   wallet  = winningAmountWallet − betAmountWallet         (the wallet fields; a loss carries no wallet win: 0)
 * `cls` says which prediction the movement equals:
 *   'wallet'  the two predictions differ and the movement is the wallet field's
 *   'booked'  the two predictions differ and the movement is the booked amount's
 *   'both'    the two predictions are equal (every loss) and the movement is that amount
 *   'neither' the movement is neither prediction
 *   'unread'  a read is missing or failed; 'no-amounts' an amount is missing or off the 1e-8 grid
 */
export type BalanceClass = 'wallet' | 'booked' | 'both' | 'neither' | 'unread' | 'no-amounts';
export interface BalanceRound {
  phaseId: string;
  epoch: number;
  nonce: number;
  betId: string;
  mineCount: number;
  opened: number[];
  mineTiles: number[];
  clientSeed: string;
  won: boolean;
  before: bigint | null;
  after: bigint | null;
  moved: bigint | null;
  booked: bigint | null;
  wallet: bigint | null;
  bookedStake: bigint | null;
  walletStake: bigint | null;
  bookedWin: bigint | null;
  walletWin: bigint | null;
  fiat: unknown;
  rate: unknown;
  readCurrency: unknown;
  readField: unknown;
  /** The after-settle reads the runner took, and whether its last two agree. */
  afterReads: number | null;
  afterSettled: boolean;
  cls: BalanceClass;
}

export function balanceRound(rec: any): BalanceRound {
  const s = rec?.settleRaw ?? {}, p = rec?.placeRaw ?? {}, bc = rec?.balanceCheck ?? {};
  const before = bc.before?.ok === true ? units8(bc.before.amount) : null;
  const after = bc.after?.ok === true ? units8(bc.after.amount) : null;
  const won = s.result === 'won';
  const bookedStake = units8(s.betAmount), bookedWin = units8(s.winningAmount);
  const walletStake = units8(p.betAmountWallet ?? s.betAmountWallet);
  const walletWin = won ? units8(s.winningAmountWallet) : (s.winningAmountWallet == null ? 0n : units8(s.winningAmountWallet));
  const booked = bookedStake !== null && bookedWin !== null ? bookedWin - bookedStake : null;
  const wallet = walletStake !== null && walletWin !== null ? walletWin - walletStake : null;
  const moved = before !== null && after !== null ? after - before : null;
  let cls: BalanceClass;
  if (moved === null) cls = 'unread';
  else if (booked === null || wallet === null) cls = 'no-amounts';
  else if (booked === wallet) cls = moved === booked ? 'both' : 'neither';
  else cls = moved === wallet ? 'wallet' : moved === booked ? 'booked' : 'neither';
  const amounts: unknown[] = Array.isArray(bc.after?.amounts) ? bc.after.amounts : [];
  const lastTwo = amounts.slice(-2).map(units8);
  return {
    phaseId: String(rec?.phaseId ?? '?'), epoch: Number(rec?.epoch), nonce: Number(s.nonce ?? rec?.nonce), betId: String(s.id ?? rec?.betId),
    mineCount: Number(s.mineCount ?? rec?.mineCount), opened: Array.isArray(s.openTiles) ? s.openTiles : [], mineTiles: Array.isArray(s.mineTiles) ? s.mineTiles : [],
    clientSeed: String(s.clientSeed ?? rec?.clientSeed), won,
    before, after, moved, booked, wallet, bookedStake, walletStake, bookedWin, walletWin,
    fiat: s.fiatCurrency ?? p.fiatCurrency ?? null, rate: s.exchangeRate ?? p.exchangeRate ?? null,
    readCurrency: bc.after?.currency ?? null, readField: bc.after?.field ?? null,
    afterReads: Number.isInteger(bc.after?.reads) ? bc.after.reads : null,
    afterSettled: lastTwo.length === 2 && lastTwo[0] !== null && lastTwo[0] === lastTwo[1] && lastTwo[1] === after,
    cls,
  };
}

/** Between rounds: each round's read before its place-bet against the previous round's read after its settle. */
export function betweenRoundChanges(rounds: ReadonlyArray<BalanceRound>): Array<{ index: number; delta: bigint | null }> {
  const out: Array<{ index: number; delta: bigint | null }> = [];
  for (let i = 1; i < rounds.length; i++) {
    const a = rounds[i - 1].after, b = rounds[i].before;
    if (a === null || b === null) out.push({ index: i, delta: null });
    else if (b !== a) out.push({ index: i, delta: b - a });
  }
  return out;
}

/** The bet records of the capture, in file order (the order they were played). */
export function balanceRounds(events: ReadonlyArray<BalanceEvent>): BalanceRound[] {
  return events.filter(e => e.t === 'bet' && e.rec && e.rec.balanceCheck).map(e => balanceRound(e.rec));
}
