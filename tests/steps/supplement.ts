/**
 * Step 22: Multi-Reveal Supplement — capture v3 (1,000 interactive rounds). SCORED: the 2026-10-03
 * capture (today's build). DATED HISTORY: the 2026-09-26 capture of the same plan (arm k).
 *
 * The audited dataset (data/mines-master-6900bets.json) is the population Steps 1–21 score; it
 * has ONE multi-reveal configuration (mineCount 3, depth 5). This step scores the SUPPLEMENT
 * captured by capture/capture-mines-v3.mjs — 5 mine counts × 4 depths × 50 rounds, played
 * place-bet → open-tile × depth → cash-out-bet, the raw response of every reveal kept, the reveal
 * order drawn by a CSPRNG shuffle and journalled BEFORE the bet was placed — and nothing else.
 * No figure from it enters Steps 1–21, the simulation or the published RTP — except its operator-
 * settings declaration (arm j), which Step 10 also reads for the MINES-14 cap half (disclosed, not
 * scored since 2026-10-15).
 *
 * WHICH CAPTURE (2026-10-03). The plan was captured on 2026-09-26 and again on 2026-10-03, after
 * LIQD stated (2026-09-30) that a fix for the 1e-8 short credit ships in its next release. Arms
 * (a)–(j) score the 2026-10-03 capture — today's behaviour is what is scored. The 2026-09-26
 * capture stays pinned as a dated history exhibit: arm (k) re-derives the figures the history
 * quotes from its pinned bytes and FAILs only if those bytes or figures moved; it never sets
 * today's status.
 *
 * What it asserts, every arm over the whole supplement with a coverage guard bound to the
 * constants in src/pins.ts (never to the file's own meta):
 *
 *   (a) integrity — both vendored files hash to their pins; the journal's 1,000 `bet` records are
 *       the dataset rows byte-for-byte (JSON), and each round's `intent` (its reveal order) was
 *       journalled before its `bet`;
 *   (b) population — 20 epochs × 50; exactly 50 rounds at each planned (mineCount, depth), none
 *       outside the plan;
 *   (c) commitment — commitHash(serverSeed) == hashedServerSeed for all 20 epochs, the 19 chain
 *       links, and the pre-capture anchor (revealed seed hashes to the anchor commitment, whose
 *       next-hash is epoch 0's commitment); nonces 0…49 per epoch, each row bound to its epoch's
 *       commitment and client seed;
 *   (d) layouts — revealMines(serverSeed, clientSeed, nonce, m) == served mineTiles, draw order;
 *   (e) reveals — every revealed tile's served mine/safe status equals the recomputed layout; the
 *       recorded reveal order == the tiles opened, in order; a win opens exactly its planned depth
 *       and no mine; a loss busts on exactly its last reveal;
 *   (f) the per-step rung — how many reveals carried a multiplier, asserted equal to the declared
 *       SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS (0: LIQD does not serve one on the wire);
 *   (g) the cash-out rung — every win scored against the ONE declared settlement rule every win in
 *       this package is held to (src/pins.ts, "ONE SETTLEMENT RULE"): credit = floor8(stake × exact
 *       rational multiplier) — Step 8's rule on the audited dataset — and display = floor2(exact) —
 *       Step 7's rule. A win ABOVE the rule is a FAIL. A win below it is a GAP against the rule,
 *       and the gap's count, cells and total must equal the declaration in src/pins.ts — ZERO on
 *       the 2026-10-03 capture — so any short credit or short display FAILs the step, the same
 *       severity a short credit has on the audited dataset in Step 8 (MINES-11, HARD_FAIL).
 *       Losses credit exactly 0. (Until 2026-10-03 this arm scored the 2026-09-26 capture, whose
 *       50 short credits were held at FLAG pending open ruling 2 — now arm (k), dated history);
 *   (h) order independence at the cash-out rung — per (mineCount, depth) cell, one served
 *       multiplier and one credit across every reveal order that reached it;
 *   (i) coverage — ≥ SUPPLEMENT_MIN_CASHOUT_RUNGS cells witnessed by a cash-out;
 *   (j) operator settings (QA 2026-10-02, A4) — every `currentGameSettings` record the supplement
 *       carries (on each mine-reveal settle, and again in that round's last reveal) equals the
 *       declared SUPPLEMENT_GAME_SETTINGS value, and there are exactly its `records` of them. A
 *       drift FAILs. The declaration carries no maxOdds; Step 10 discloses it (MINES-14 cap half, not
 *       scored since 2026-10-15: no multiplier cap on this build, payout limits excluded);
 *   (k) DATED HISTORY (2026-10-03) — the 2026-09-26 capture, exhibits E17/E18: both files hash to
 *       their SUPPLEMENT_HISTORY_* pins (mismatch or absence FAILs — an exhibit of record was
 *       altered), and the figures the history quotes are re-derived from the pinned dataset with
 *       the SAME rule functions as arm (g) — wins, credits below/above floor8(stake × exact) by
 *       cell with their per-win size and total, displays below/above floor2(exact) by cell, and
 *       the settings records — and must equal their declarations (FAIL if one moves: a history
 *       line that no longer describes the pinned bytes). Not scored as today's behaviour; how the
 *       history's short credits are classed (FAIL or FLAG) is open ruling 2, stated, not decided.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  "CONSISTENT WITH BINARY64 ARITHMETIC" — AN EXPLANATORY NOTE, NEVER THE AUDIT'S RULE
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Until 2026-09-29 this step gated the supplement's wins on a binary64 model fitted to LIQD's own
 * output, while Step 8 held the audited dataset to the exact rule — two rules for one game, and the
 * fitted one adopted the operator's behaviour exactly where it missed the exact rule
 * (withdrawn 2026-09-29). The step now scores every win against the exact rule only (arm g above).
 *
 * The functions below are kept as a HYPOTHESIS ABOUT THE OPERATOR, emitted in the detail and gated
 * on nothing. On the 2026-09-26 capture the cells that missed the rule were where binary64 lands one
 * ulp below an exact decimal boundary (m = 1, k = 10: 99/100 × 25/15 = 33/20 = 1.65 exactly, binary64
 * 1.6499999999999997), and the served values matched
 *   display  = Math.floor(multF × 100) / 100
 *   credit   = Math.floor(stake × multF × 1e8)   (three IEEE-754 operations, left to right)
 * where multF = minesMultiplierExact(m, k) (src/config.ts, binary64 product) and stake =
 * Number(betAmount). A second model — the exact product of the two doubles, floored to 8 dp — and a
 * third — model A with the product formed edge-first — are emitted beside it. Measured 2026-09-26:
 * A 404/404, B 404/404, C 365/404; an independent re-derivation with another binary64 construction
 * matched 315/404. LIQD's settlement source is not available; the fit depends on how the product is
 * formed, so the most that was said is "consistent with binary64 arithmetic in the settlement". On
 * the scored 2026-10-03 capture the same models are emitted again, with their counts, beside the
 * exact rule's.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { revealMines, sameMines, commitHash } from '../../src/rng';
import { GRID, HOUSE_EDGE, MAX_ODDS_DECLARED, minesMultiplierExact, minesMultiplierRational } from '../../src/config';
import {
  SUPPLEMENT_DATASET_RELATIVE_PATH, SUPPLEMENT_DATASET_HASH,
  SUPPLEMENT_JOURNAL_RELATIVE_PATH, SUPPLEMENT_JOURNAL_HASH, SUPPLEMENT_CAPTURE_DATE,
  SUPPLEMENT_EXPECTED_BETS, SUPPLEMENT_EXPECTED_SEEDS, SUPPLEMENT_PER_CONFIG, SUPPLEMENT_DEPTHS,
  SUPPLEMENT_MIN_CASHOUT_RUNGS, SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS,
  SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW, SUPPLEMENT_DISCLOSED_DISPLAY_CENT_BELOW,
  SUPPLEMENT_CREDIT_GAP_CELLS, SUPPLEMENT_CREDIT_GAP_TOTAL_UNITS,
  SUPPLEMENT_DISPLAY_GAP_CELLS, SUPPLEMENT_GAME_SETTINGS,
  SUPPLEMENT_HISTORY_CAPTURE_DATE, SUPPLEMENT_HISTORY_DATASET_RELATIVE_PATH, SUPPLEMENT_HISTORY_DATASET_HASH,
  SUPPLEMENT_HISTORY_JOURNAL_RELATIVE_PATH, SUPPLEMENT_HISTORY_JOURNAL_HASH,
  SUPPLEMENT_HISTORY_BETS, SUPPLEMENT_HISTORY_WINS,
  SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW, SUPPLEMENT_HISTORY_CREDIT_GAP_CELLS,
  SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN, SUPPLEMENT_HISTORY_CREDIT_GAP_TOTAL_UNITS,
  SUPPLEMENT_HISTORY_DISPLAY_CENT_BELOW, SUPPLEMENT_HISTORY_DISPLAY_GAP_CELLS, SUPPLEMENT_HISTORY_GAME_SETTINGS,
  SUPPLEMENT_ON_GRID_TOLERANCE, EXPECTED_EPOCH_SIZE, NONCE_BASE,
} from '../../src/pins';

export const STEP_NUMBER = 22;
export const STEP_NAME = 'Multi-Reveal Supplement (capture v3, 1,000 rounds)';

/** Keys a multiplier could be served under on an open-tile response (the capture's own list). */
const STEP_MULT_KEYS = ['multiplier', 'currentMultiplier', 'payoutMultiplier', 'odds'];

/** Exact value of a finite binary64 as a BigInt rational (num/den, den a power of two). */
export function doubleToRational(x: number): { num: bigint; den: bigint } | null {
  if (!Number.isFinite(x)) return null;
  if (x === 0) return { num: 0n, den: 1n };
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n;
  const exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e: number;
  if (exp === 0) e = -1074; else { mant |= 1n << 52n; e = exp - 1075; }
  return e >= 0 ? { num: sign * (mant << BigInt(e)), den: 1n } : { num: sign * mant, den: 1n << BigInt(-e) };
}

/** Credit model A (explanatory, NOT gated): Math.floor(stake × multF × 1e8), binary64, left to right. */
export function creditModelBinary64(stake: number, m: number, k: number): number {
  return Math.floor(stake * minesMultiplierExact(m, k) * 1e8);
}
/** Credit model B (emitted only): floor(exact(float(stake)) × exact(multF) × 1e8). */
export function creditModelExactProductOfDoubles(stake: number, m: number, k: number): bigint | null {
  const s = doubleToRational(stake), f = doubleToRational(minesMultiplierExact(m, k));
  if (!s || !f) return null;
  return (s.num * f.num * 100_000_000n) / (s.den * f.den);
}
/**
 * Credit model C (emitted only): as model A but with the binary64 multiplier formed EDGE-FIRST,
 * 0.99 × ∏ (25−i)/(25−m−i). Emitted to show that the fit depends on how the product is formed —
 * which is why no specific LIQD computation is claimed.
 */
export function creditModelEdgeFirst(stake: number, m: number, k: number): number {
  let p = 1 - HOUSE_EDGE;
  for (let i = 0; i < k; i++) p *= (GRID - i) / (GRID - m - i);
  return Math.floor(stake * p * 1e8);
}
/** THE RULE (credit): exact floor8(stake × exact rational multiplier), stake taken as its 1e-8 grid value. */
export function creditExactFloor8(stake: number, m: number, k: number): bigint | null {
  const r = minesMultiplierRational(m, k);
  if (!r) return null;
  return (BigInt(Math.round(stake * 1e8)) * r.num) / r.den;
}
/** Display model (explanatory, NOT gated): Math.floor(multF × 100) / 100, binary64. */
export function displayModelBinary64(m: number, k: number): number {
  return Math.floor(minesMultiplierExact(m, k) * 100) / 100;
}
/** THE RULE (display): exact floor2 in cents, floor(100 · num / den), BigInt. */
export function displayExactCents(m: number, k: number): bigint | null {
  const r = minesMultiplierRational(m, k);
  return r ? (100n * r.num) / r.den : null;
}

/** Same cell counts as declared? (keys `${mineCount}:${depth}`) */
const sameCells = (got: Map<string, number>, want: Readonly<Record<string, number>>) =>
  got.size === Object.keys(want).length && [...got].every(([k, n]) => want[k] === n);
/** `(m, k) ×n, …` for a cell-count map. */
const fmtCells = (m: Map<string, number>) => [...m].map(([k, n]) => `(${k.replace(':', ', ')}) ×${n}`).join(', ') || 'none';
/** A settings record as text — the record LIQD serves is a JSON string; an object is stringified. */
const gsText = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

/** What arm (k) measured on the DATED HISTORY exhibit (src/pins.ts SUPPLEMENT_HISTORY_*). */
export interface HistoryMeasure {
  ok: boolean;
  /** Set when the exhibit could not be read at all (absent, pin mismatch, unparseable). */
  problem: string | null;
  bets: number; wins: number; nonFinite: number;
  credExact: number; credBelow: number; credAbove: number; credOffSize: number; credGapUnits: bigint;
  credCells: Map<string, number>;
  dispExact: number; dispBelow: number; dispAbove: number; dispOut: number;
  dispCells: Map<string, number>;
  settingsRecords: number; settingsValues: Map<string, number>; settingsCopies: number; settingsCopyMismatch: number;
}

/**
 * Arm (k): the 2026-09-26 capture, kept as a DATED HISTORY exhibit. Hashes both pinned files, then
 * re-derives from the dataset every figure the history quotes, with the SAME rule functions arm (g)
 * scores today's capture with (creditExactFloor8, displayExactCents), and compares each figure to its
 * declaration in src/pins.ts. `ok` is false on an absent file, a pin mismatch, an unparseable file or
 * any figure that moved — never because of what the history says about the operator.
 */
export function historyArm(repoRoot: string): HistoryMeasure {
  const m: HistoryMeasure = {
    ok: false, problem: null, bets: 0, wins: 0, nonFinite: 0,
    credExact: 0, credBelow: 0, credAbove: 0, credOffSize: 0, credGapUnits: 0n, credCells: new Map(),
    dispExact: 0, dispBelow: 0, dispAbove: 0, dispOut: 0, dispCells: new Map(),
    settingsRecords: 0, settingsValues: new Map(), settingsCopies: 0, settingsCopyMismatch: 0,
  };
  const dsPath = path.join(repoRoot, SUPPLEMENT_HISTORY_DATASET_RELATIVE_PATH);
  const jPath = path.join(repoRoot, SUPPLEMENT_HISTORY_JOURNAL_RELATIVE_PATH);
  if (!fs.existsSync(dsPath) || !fs.existsSync(jPath)) {
    m.problem = `history exhibit absent: ${[fs.existsSync(dsPath) ? '' : SUPPLEMENT_HISTORY_DATASET_RELATIVE_PATH, fs.existsSync(jPath) ? '' : SUPPLEMENT_HISTORY_JOURNAL_RELATIVE_PATH].filter(Boolean).join(', ')}`;
    return m;
  }
  const dsRaw = fs.readFileSync(dsPath);
  const dsSha = createHash('sha256').update(dsRaw).digest('hex');
  const jSha = createHash('sha256').update(fs.readFileSync(jPath)).digest('hex');
  if (dsSha !== SUPPLEMENT_HISTORY_DATASET_HASH || jSha !== SUPPLEMENT_HISTORY_JOURNAL_HASH) {
    m.problem = `history exhibit pin mismatch: dataset ${dsSha === SUPPLEMENT_HISTORY_DATASET_HASH ? 'ok' : dsSha}, journal ${jSha === SUPPLEMENT_HISTORY_JOURNAL_HASH ? 'ok' : jSha}`;
    return m;
  }
  let ds: any;
  try { ds = JSON.parse(dsRaw.toString('utf8')); } catch (e: any) { m.problem = `history exhibit unparseable: ${e.message}`; return m; }
  const bets: any[] = Array.isArray(ds?.bets) ? ds.bets : [];
  m.bets = bets.length;
  for (const b of bets) {
    // settings — the same reading as arm (j)
    const gs = b?.settleRaw?.currentGameSettings;
    if (gs !== undefined && gs !== null) {
      m.settingsRecords++;
      const t = gsText(gs);
      m.settingsValues.set(t, (m.settingsValues.get(t) ?? 0) + 1);
      for (const x of (Array.isArray(b.steps) ? b.steps : [])) {
        const c = x?.raw?.currentGameSettings;
        if (c === undefined || c === null) continue;
        m.settingsCopies++;
        if (gsText(c) !== t) m.settingsCopyMismatch++;
      }
    }
    if (b.result !== 'won') continue;
    m.wins++;
    const k = Array.isArray(b.openTiles) ? b.openTiles.length : NaN;
    const key = `${b.mineCount}:${k}`;
    const stake = Number(b.betAmount), credit = Number(b.winningAmount), mult = Number(b.multiplier);
    const ex = creditExactFloor8(stake, b.mineCount, k), cents = displayExactCents(b.mineCount, k);
    if (!Number.isFinite(stake) || !Number.isFinite(credit) || !Number.isFinite(mult) || ex === null || cents === null) { m.nonFinite++; continue; }
    const got = BigInt(Math.round(credit * 1e8));
    if (got === ex) m.credExact++;
    else if (got > ex) m.credAbove++;
    else {
      m.credBelow++;
      const short = ex - got;
      m.credGapUnits += short;
      if (short !== BigInt(SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN)) m.credOffSize++;
      m.credCells.set(key, (m.credCells.get(key) ?? 0) + 1);
    }
    const d = cents - BigInt(Math.round(mult * 100));
    if (d === 0n) m.dispExact++;
    else if (d < 0n) m.dispAbove++;
    else if (d === 1n) { m.dispBelow++; m.dispCells.set(key, (m.dispCells.get(key) ?? 0) + 1); }
    else m.dispOut++;
  }
  m.ok = m.bets === SUPPLEMENT_HISTORY_BETS && m.wins === SUPPLEMENT_HISTORY_WINS && m.nonFinite === 0
    && m.credAbove === 0 && m.credExact + m.credBelow === m.wins
    && m.credBelow === SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW && sameCells(m.credCells, SUPPLEMENT_HISTORY_CREDIT_GAP_CELLS)
    && m.credOffSize === 0 && m.credGapUnits === BigInt(SUPPLEMENT_HISTORY_CREDIT_GAP_TOTAL_UNITS)
    && m.dispAbove === 0 && m.dispOut === 0 && m.dispExact + m.dispBelow === m.wins
    && m.dispBelow === SUPPLEMENT_HISTORY_DISPLAY_CENT_BELOW && sameCells(m.dispCells, SUPPLEMENT_HISTORY_DISPLAY_GAP_CELLS)
    && m.settingsRecords === SUPPLEMENT_HISTORY_GAME_SETTINGS.records && m.settingsValues.size === 1
    && m.settingsValues.has(SUPPLEMENT_HISTORY_GAME_SETTINGS.value)
    && m.settingsCopies === m.settingsRecords && m.settingsCopyMismatch === 0;
  return m;
}

export function run(ctx: VerifyContext): StepResult[] {
  const repoRoot = path.resolve(ctx.outputsDir, '..');
  const fails: string[] = [];
  const note = (s: string) => { if (fails.length < 6) fails.push(s); };

  // ── (a) integrity ────────────────────────────────────────────────────────────────────────
  const dsPath = path.join(repoRoot, SUPPLEMENT_DATASET_RELATIVE_PATH);
  const jPath = path.join(repoRoot, SUPPLEMENT_JOURNAL_RELATIVE_PATH);
  if (!fs.existsSync(dsPath) || !fs.existsSync(jPath)) {
    return [step(STEP_NUMBER, STEP_NAME, 'FAIL',
      `supplement absent: ${fs.existsSync(dsPath) ? '' : SUPPLEMENT_DATASET_RELATIVE_PATH + ' '}${fs.existsSync(jPath) ? '' : SUPPLEMENT_JOURNAL_RELATIVE_PATH}`.trim())];
  }
  const dsRaw = fs.readFileSync(dsPath), jRaw = fs.readFileSync(jPath);
  const dsSha = createHash('sha256').update(dsRaw).digest('hex');
  const jSha = createHash('sha256').update(jRaw).digest('hex');
  const pinOk = dsSha === SUPPLEMENT_DATASET_HASH && jSha === SUPPLEMENT_JOURNAL_HASH;
  if (!pinOk) {
    return [step(STEP_NUMBER, STEP_NAME, 'FAIL',
      `supplement pin mismatch: dataset ${dsSha === SUPPLEMENT_DATASET_HASH ? 'ok' : dsSha} , journal ${jSha === SUPPLEMENT_JOURNAL_HASH ? 'ok' : jSha}`)];
  }
  let ds: any;
  let journal: any[];
  try {
    ds = JSON.parse(dsRaw.toString('utf8'));
    journal = jRaw.toString('utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  } catch (e: any) {
    return [step(STEP_NUMBER, STEP_NAME, 'FAIL', `supplement unparseable: ${e.message}`)];
  }
  const bets: any[] = Array.isArray(ds?.bets) ? ds.bets : [];
  const seeds: any[] = Array.isArray(ds?.seeds) ? [...ds.seeds].sort((a, b) => a.epoch - b.epoch) : [];

  const jBets = journal.map((r, i) => ({ r, i })).filter((x) => x.r?.t === 'bet');
  const jIntents = journal.map((r, i) => ({ r, i })).filter((x) => x.r?.t === 'intent');
  let journalRowBad = 0, intentBad = 0;
  if (jBets.length !== bets.length) note(`journal holds ${jBets.length} bet records, dataset ${bets.length}`);
  for (let i = 0; i < bets.length; i++) {
    if (!jBets[i] || JSON.stringify(jBets[i].r.rec) !== JSON.stringify(bets[i])) { journalRowBad++; note(`row ${i}: journal bet record differs from the dataset row`); }
    const it = jIntents[i];
    if (!it || JSON.stringify(it.r.tiles) !== JSON.stringify(bets[i].openOrder) || !jBets[i] || it.i > jBets[i].i
      || it.r.epoch !== bets[i].epoch || it.r.seq !== bets[i].seq) {
      intentBad++; note(`row ${i}: reveal order not journalled before the bet (or differs)`);
    }
  }
  const journalOk = jBets.length === SUPPLEMENT_EXPECTED_BETS && jIntents.length === SUPPLEMENT_EXPECTED_BETS
    && journalRowBad === 0 && intentBad === 0;

  // ── (b) population, bound to src/pins.ts ────────────────────────────────────────────────────
  const planned = new Map<string, number>();
  for (const [m, ds_] of Object.entries(SUPPLEMENT_DEPTHS)) for (const d of ds_) planned.set(`${m}@${d}`, 0);
  let offPlan = 0;
  for (const b of bets) {
    const key = `${b.mineCount}@${b.reveals}`;
    if (!planned.has(key)) { offPlan++; note(`round ${b.id}: (mineCount ${b.mineCount}, depth ${b.reveals}) is not in the plan`); continue; }
    planned.set(key, (planned.get(key) as number) + 1);
  }
  const shortCfg = [...planned].filter(([, n]) => n !== SUPPLEMENT_PER_CONFIG);
  const metaDepthsAgree = JSON.stringify(ds?.meta?.phaseE?.depthsByMineCount) === JSON.stringify(SUPPLEMENT_DEPTHS);
  const popOk = bets.length === SUPPLEMENT_EXPECTED_BETS && seeds.length === SUPPLEMENT_EXPECTED_SEEDS
    && planned.size * SUPPLEMENT_PER_CONFIG === SUPPLEMENT_EXPECTED_BETS && offPlan === 0 && shortCfg.length === 0;
  if (shortCfg.length) note(`configurations off the ${SUPPLEMENT_PER_CONFIG}-round plan: ${shortCfg.map(([k, n]) => `${k}=${n}`).join(', ')}`);

  // ── (c) commitment, chain, anchor, nonces ───────────────────────────────────────────────────
  let commitBad = 0, chainBad = 0, nonceBad = 0, bindBad = 0;
  const seedByEpoch = new Map<number, any>();
  seeds.forEach((s, i) => {
    seedByEpoch.set(s.epoch, s);
    if (typeof s.serverSeed !== 'string' || commitHash(s.serverSeed) !== s.hashedServerSeed) { commitBad++; note(`epoch ${s.epoch}: commitment does not verify`); }
    if (i + 1 < seeds.length && s.nextHashedServerSeed !== seeds[i + 1].hashedServerSeed) { chainBad++; note(`epoch ${s.epoch}: next-hash does not link to epoch ${seeds[i + 1].epoch}`); }
    if (s.nonceStart !== NONCE_BASE || s.nonceEnd !== NONCE_BASE + EXPECTED_EPOCH_SIZE - 1) { nonceBad++; note(`epoch ${s.epoch}: nonce window ${s.nonceStart}…${s.nonceEnd}`); }
  });
  const pre = ds?.meta?.preCapture;
  const anchorOk = !!pre && typeof pre.revealedServerSeed === 'string' && commitHash(pre.revealedServerSeed) === pre.hashedServerSeed
    && seeds.length > 0 && pre.nextHashedServerSeed === seeds[0].hashedServerSeed;
  if (!anchorOk) note('pre-capture anchor absent or does not link to epoch 0');
  const perEpoch = new Map<number, any[]>();
  for (const b of bets) { const a = perEpoch.get(b.epoch) ?? []; a.push(b); perEpoch.set(b.epoch, a); }
  for (const [ep, rows] of perEpoch) {
    const s = seedByEpoch.get(ep);
    if (rows.length !== EXPECTED_EPOCH_SIZE) { nonceBad++; note(`epoch ${ep}: ${rows.length} rounds`); }
    rows.forEach((b, i) => {
      if (b.nonce !== NONCE_BASE + i || b.nonceInferred !== undefined) { nonceBad++; note(`round ${b.id}: nonce ${b.nonce} at position ${i}`); }
      if (!s || b.hashedServerSeed !== s.hashedServerSeed || b.clientSeed !== s.clientSeed) { bindBad++; note(`round ${b.id}: not bound to epoch ${ep}'s commitment / client seed`); }
    });
  }
  const commitOk = commitBad === 0 && chainBad === 0 && anchorOk && nonceBad === 0 && bindBad === 0
    && seeds.every((s) => typeof s.serverSeed === 'string');

  // ── (d)–(h) per round ───────────────────────────────────────────────────────────────────────
  let layoutChk = 0, layoutBad = 0, revealChk = 0, statusBad = 0, seqBad = 0, winBad = 0, lossBad = 0, labelBad = 0;
  let perStepServed = 0, safeBare = 0, settleOnReveal = 0;
  let wins = 0, losses = 0, dispModelOk = 0, dispExactOk = 0, dispCentBelow = 0, dispAbove = 0, dispOutOfBound = 0;
  let credModelA = 0, credModelB = 0, credModelC = 0, credExact = 0, credUnitBelow = 0, credAbove = 0, credOutOfBound = 0, offGrid = 0;
  // Gap against the ONE rule: total shortfall in 1e-8 units (declared 0 on the scored capture).
  let credGapUnits = 0n;
  const unitBelowCells = new Map<string, number>(), centBelowCells = new Map<string, number>();
  // Wins credited exactly at the rule, by cell — read back for the cells the dated history names.
  const exactByCell = new Map<string, number>();
  const cell = new Map<string, { wins: number; mult: Set<number>; credit: Set<string>; orders: Set<string> }>();
  const firstPicks = new Set<number>();
  const safeRungCells = new Set<string>();
  const legal = (t: any) => Number.isInteger(t) && t >= 1 && t <= GRID;

  for (const b of bets) {
    const s = seedByEpoch.get(b.epoch);
    const layout = s && typeof s.serverSeed === 'string' ? revealMines(s.serverSeed, b.clientSeed, b.nonce, b.mineCount) : null;
    if (!layout) { note(`round ${b.id}: layout not recomputable`); continue; }
    layoutChk++;
    if (!Array.isArray(b.mineTiles) || !sameMines(layout, b.mineTiles)) { layoutBad++; note(`round ${b.id}: mineTiles ≠ recomputed layout`); }
    const mines = new Set(layout);
    const steps: any[] = Array.isArray(b.steps) ? b.steps : [];
    const opened: number[] = Array.isArray(b.openTiles) ? b.openTiles : [];
    const order: number[] = Array.isArray(b.openOrder) ? b.openOrder : [];
    if (order.length) firstPicks.add(order[0]);
    // recorded order == tiles revealed, in order == the settled openTiles; tiles legal, unrepeated
    const stepTiles = steps.map((x) => x.tile);
    if (JSON.stringify(stepTiles) !== JSON.stringify(opened) || JSON.stringify(order.slice(0, steps.length)) !== JSON.stringify(stepTiles)
      || order.length !== b.reveals || !opened.every(legal) || new Set(opened).size !== opened.length
      || steps.some((x, i) => x.depth !== i + 1)) {
      seqBad++; note(`round ${b.id}: reveal sequence ≠ recorded order / openTiles`);
    }
    steps.forEach((x, i) => {
      revealChk++;
      if (x.mineTile !== mines.has(x.tile)) { statusBad++; note(`round ${b.id} reveal ${i + 1}: served mineTile ${x.mineTile}, layout says ${mines.has(x.tile)}`); }
      const raw = x.raw ?? {};
      if (x.servedMultiplier != null || STEP_MULT_KEYS.some((k) => raw[k] != null)) perStepServed++;
      if (x.mineTile === false && JSON.stringify(Object.keys(raw)) === '["mineTile"]') safeBare++;
      if (raw.result !== undefined) settleOnReveal++;
      if (x.mineTile === false) safeRungCells.add(`${b.mineCount}:${x.depth}`);
    });
    const stake = Number(b.betAmount), credit = Number(b.winningAmount);
    if (b.result === 'won') {
      wins++;
      const k = opened.length;
      if (k !== b.reveals || steps.length !== k || steps.some((x) => x.mineTile !== false) || opened.some((t) => mines.has(t))) { winBad++; note(`round ${b.id}: win did not open exactly its ${b.reveals} planned safe tiles`); }
      const mult = Number(b.multiplier);
      // display
      const dModel = displayModelBinary64(b.mineCount, k), dCents = displayExactCents(b.mineCount, k);
      if (!Number.isFinite(mult) || dCents === null || !Number.isFinite(dModel)) { dispOutOfBound++; note(`round ${b.id}: multiplier or reference non-finite`); }
      else {
        const servedCents = Math.round(mult * 100);
        if (Math.abs(mult * 100 - servedCents) > SUPPLEMENT_ON_GRID_TOLERANCE) { dispOutOfBound++; note(`round ${b.id}: multiplier ${mult} is not a whole cent`); }
        if (Math.abs(mult - dModel) <= 1e-9) dispModelOk++;
        // THE RULE: served display == floor2(exact). Above it FAILs; below it is a gap against the
        // declared display gap (0 on the scored capture).
        const diff = Number(dCents) - servedCents;
        if (diff === 0) dispExactOk++;
        else if (diff < 0) { dispAbove++; note(`round ${b.id}: multiplier ${mult} is ABOVE the rule floor2(exact) = ${Number(dCents) / 100}`); }
        else if (diff === 1) { dispCentBelow++; const c = `${b.mineCount}:${k}`; centBelowCells.set(c, (centBelowCells.get(c) ?? 0) + 1); note(`round ${b.id}: multiplier ${mult} is one cent BELOW the rule floor2(exact) = ${Number(dCents) / 100}`); }
        else { dispOutOfBound++; note(`round ${b.id}: multiplier ${mult} is ${diff} cents below the rule floor2(exact) = ${Number(dCents) / 100}`); }
      }
      // credit
      const units = credit * 1e8;
      const ex = creditExactFloor8(stake, b.mineCount, k);
      if (!Number.isFinite(credit) || !Number.isFinite(stake) || ex === null) { credOutOfBound++; note(`round ${b.id}: credit/stake/reference non-finite`); }
      else {
        if (Math.abs(units - Math.round(units)) > SUPPLEMENT_ON_GRID_TOLERANCE) { offGrid++; note(`round ${b.id}: winningAmount ${b.winningAmount} is off the 1e-8 grid`); }
        const got = BigInt(Math.round(units));
        if (Number(got) === creditModelBinary64(stake, b.mineCount, k)) credModelA++;
        if (got === creditModelExactProductOfDoubles(stake, b.mineCount, k)) credModelB++;
        if (Number(got) === creditModelEdgeFirst(stake, b.mineCount, k)) credModelC++;
        // THE RULE: credit == floor8(stake × exact). Above it FAILs; below it is a gap against the
        // rule, counted by cell and summed — asserted against the declaration (0), not absorbed.
        if (got === ex) { credExact++; const c = `${b.mineCount}:${k}`; exactByCell.set(c, (exactByCell.get(c) ?? 0) + 1); }
        else if (got > ex) { credAbove++; note(`round ${b.id}: credit ${b.winningAmount} is ABOVE the rule floor8(stake × exact) = ${Number(ex) / 1e8}`); }
        else {
          credUnitBelow++;
          const short = ex - got;
          credGapUnits += short;
          note(`round ${b.id}: credit ${b.winningAmount} is ${short} × 1e-8 BELOW the rule floor8(stake × exact) = ${Number(ex) / 1e8}`);
          const c = `${b.mineCount}:${k}`; unitBelowCells.set(c, (unitBelowCells.get(c) ?? 0) + 1);
        }
      }
      const key = `${b.mineCount}:${k}`;
      const c = cell.get(key) ?? { wins: 0, mult: new Set<number>(), credit: new Set<string>(), orders: new Set<string>() };
      c.wins++; c.mult.add(mult); c.credit.add(`${stake}→${b.winningAmount}`); c.orders.add(opened.join(','));
      cell.set(key, c);
    } else if (b.result === 'lost') {
      losses++;
      const last = steps[steps.length - 1];
      if (!last || last.mineTile !== true || steps.slice(0, -1).some((x) => x.mineTile !== false) || steps.length > b.reveals) { lossBad++; note(`round ${b.id}: loss did not bust on exactly its last reveal`); }
      if (!(credit === 0) || (b.multiplier ?? 0) !== 0) { lossBad++; note(`round ${b.id}: loss credited ${b.winningAmount}`); }
    } else { labelBad++; note(`round ${b.id}: result ${JSON.stringify(b.result)}`); }
  }

  // (h) order independence at the cash-out rung
  const cells = [...cell].sort(([a], [z]) => { const [am, ak] = a.split(':').map(Number), [zm, zk] = z.split(':').map(Number); return am - zm || ak - zk; });
  const orderVariant = cells.filter(([, c]) => c.mult.size !== 1 || c.credit.size !== 1);
  const multiOrderCells = cells.filter(([, c]) => c.orders.size > 1).length;
  const cellsWithTwoWins = cells.filter(([, c]) => c.wins > 1).length;
  if (orderVariant.length) note(`cells whose served multiplier/credit varies with reveal order: ${orderVariant.map(([k]) => k).join(', ')}`);

  // (j) operator settings, bound to the declaration in src/pins.ts (A4)
  const settingsValues = new Map<string, number>();
  let settingsRecords = 0, settingsRevealCopies = 0, settingsCopyMismatch = 0;
  for (const b of bets) {
    const gs = b?.settleRaw?.currentGameSettings;
    if (gs === undefined || gs === null) continue;
    settingsRecords++;
    const t = gsText(gs);
    settingsValues.set(t, (settingsValues.get(t) ?? 0) + 1);
    const steps: any[] = Array.isArray(b.steps) ? b.steps : [];
    for (const x of steps) {
      const c = x?.raw?.currentGameSettings;
      if (c === undefined || c === null) continue;
      settingsRevealCopies++;
      if (gsText(c) !== t) settingsCopyMismatch++;
    }
  }
  const settingsOk = settingsRecords === SUPPLEMENT_GAME_SETTINGS.records && settingsValues.size === 1
    && settingsValues.has(SUPPLEMENT_GAME_SETTINGS.value) && settingsRevealCopies === settingsRecords && settingsCopyMismatch === 0;
  if (!settingsOk) note(`operator settings moved: ${settingsRecords} settle records (declared ${SUPPLEMENT_GAME_SETTINGS.records}), values ${JSON.stringify([...settingsValues])} (declared ${SUPPLEMENT_GAME_SETTINGS.value}), ${settingsRevealCopies} reveal copies, ${settingsCopyMismatch} differing`);
  let declaredMaxOdds: unknown = undefined;
  try { declaredMaxOdds = (JSON.parse(SUPPLEMENT_GAME_SETTINGS.value) as { maxOdds?: unknown }).maxOdds; } catch { declaredMaxOdds = 'unparseable'; }

  const perStepOk = perStepServed === SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS;
  if (!perStepOk) note(`reveals carrying a multiplier: ${perStepServed}, declared ${SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS}`);
  // The gap against the ONE rule, bound to its declaration — 0 on the scored capture: count, cells and total.
  const credGapOk = credUnitBelow === SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW && sameCells(unitBelowCells, SUPPLEMENT_CREDIT_GAP_CELLS)
    && credGapUnits === BigInt(SUPPLEMENT_CREDIT_GAP_TOTAL_UNITS);
  const dispGapOk = dispCentBelow === SUPPLEMENT_DISCLOSED_DISPLAY_CENT_BELOW && sameCells(centBelowCells, SUPPLEMENT_DISPLAY_GAP_CELLS);
  const discloseOk = credGapOk && dispGapOk;
  if (!credGapOk) note(`credit gap against the rule moved: ${credUnitBelow} wins below it (declared ${SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW} for the ${SUPPLEMENT_CAPTURE_DATE} capture), cells ${JSON.stringify(Object.fromEntries(unitBelowCells))} (declared ${JSON.stringify(SUPPLEMENT_CREDIT_GAP_CELLS)}), total ${credGapUnits} × 1e-8 (declared ${SUPPLEMENT_CREDIT_GAP_TOTAL_UNITS})`);
  if (!dispGapOk) note(`display gap against the rule moved: ${dispCentBelow} wins one cent below it (declared ${SUPPLEMENT_DISCLOSED_DISPLAY_CENT_BELOW} for the ${SUPPLEMENT_CAPTURE_DATE} capture), cells ${JSON.stringify(Object.fromEntries(centBelowCells))} (declared ${JSON.stringify(SUPPLEMENT_DISPLAY_GAP_CELLS)})`);
  // Every win is accounted for by the rule: exact, or inside the declared gap (0); none above.
  const settleOk = wins > 0 && losses > 0 && winBad === 0 && lossBad === 0 && labelBad === 0
    && dispExactOk + dispCentBelow === wins && dispAbove === 0 && dispOutOfBound === 0
    && credExact + credUnitBelow === wins && credAbove === 0 && credOutOfBound === 0 && offGrid === 0;
  const layoutOk = layoutChk === SUPPLEMENT_EXPECTED_BETS && layoutBad === 0 && statusBad === 0 && seqBad === 0 && revealChk > 0;
  const coverageOk = cells.length >= SUPPLEMENT_MIN_CASHOUT_RUNGS && orderVariant.length === 0;

  // (k) DATED HISTORY — the 2026-09-26 capture, re-derived from its pinned bytes. Its integrity and its
  // declared figures can FAIL the step; what it says about the operator never sets today's status.
  const hist = historyArm(repoRoot);
  if (!hist.ok) {
    note(hist.problem ?? `dated history (${SUPPLEMENT_HISTORY_CAPTURE_DATE}) moved off its declaration in src/pins.ts SUPPLEMENT_HISTORY_*: `
      + `${hist.bets} rounds (declared ${SUPPLEMENT_HISTORY_BETS}), ${hist.wins} wins (declared ${SUPPLEMENT_HISTORY_WINS}), ${hist.nonFinite} non-finite; `
      + `${hist.credBelow} credits below the rule (declared ${SUPPLEMENT_HISTORY_CREDIT_UNIT_BELOW}) at ${JSON.stringify(Object.fromEntries(hist.credCells))} (declared ${JSON.stringify(SUPPLEMENT_HISTORY_CREDIT_GAP_CELLS)}), `
      + `total ${hist.credGapUnits} × 1e-8 (declared ${SUPPLEMENT_HISTORY_CREDIT_GAP_TOTAL_UNITS}), ${hist.credOffSize} short by other than ${SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN} × 1e-8, ${hist.credAbove} above; `
      + `${hist.dispBelow} displays one cent below (declared ${SUPPLEMENT_HISTORY_DISPLAY_CENT_BELOW}) at ${JSON.stringify(Object.fromEntries(hist.dispCells))} (declared ${JSON.stringify(SUPPLEMENT_HISTORY_DISPLAY_GAP_CELLS)}), ${hist.dispAbove} above, ${hist.dispOut} further below; `
      + `${hist.settingsRecords} settings records (declared ${SUPPLEMENT_HISTORY_GAME_SETTINGS.records}), ${hist.settingsValues.size} distinct value(s), ${hist.settingsCopies - hist.settingsCopyMismatch}/${hist.settingsCopies} reveal copies agree`);
  }

  const ok = pinOk && journalOk && popOk && commitOk && layoutOk && perStepOk && settleOk && discloseOk && coverageOk && settingsOk && hist.ok;
  // NO FLAG BRANCH (2026-10-03). The scored capture's declared gap is 0, so a win below the rule FAILs
  // through the binding above — the severity profile MINES-11 (HARD_FAIL) gives it, and the one Step 8
  // gives a short credit on the audited dataset. The switch that held the 2026-09-26 gap at FLAG
  // (2026-10-01 to 2026-10-03, pending open ruling 2) was removed with that capture's move to arm (k).
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  // The cells the dated history names, read back on the scored capture.
  const historyCellsToday = Object.keys(SUPPLEMENT_HISTORY_CREDIT_GAP_CELLS)
    .map((k) => `(${k.replace(':', ', ')}) ${cell.get(k)?.wins ?? 0} wins, ${exactByCell.get(k) ?? 0} credited at the rule`).join('; ');
  const histText = hist.problem
    ? `(k) DATED HISTORY (${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture, exhibits E17/E18): ${hist.problem}. `
    : `(k) DATED HISTORY, NOT SCORED AS TODAY'S BEHAVIOUR — the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture of the same plan (${SUPPLEMENT_HISTORY_DATASET_RELATIVE_PATH} and its journal, both SHA-256 pinned in src/pins.ts SUPPLEMENT_HISTORY_*; exhibits E17/E18), the scored supplement until 2026-10-03, re-derived from the pinned bytes with the rule functions of (g): `
      + `on the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} build ${hist.credBelow} of ${hist.wins} wins were credited below floor8(stake × exact) — ${fmtCells(hist.credCells)}, ${hist.credOffSize === 0 ? `each ${SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN} × 1e-8 short` : `${hist.credOffSize} short by other than ${SUPPLEMENT_HISTORY_CREDIT_GAP_UNITS_PER_WIN} × 1e-8`}, total ${hist.credGapUnits} × 1e-8 = $${(Number(hist.credGapUnits) / 1e8).toFixed(8)}, ${hist.credAbove} above, ${hist.credExact} at the rule (DL-14, history); `
      + `${hist.dispBelow} displayed one cent below floor2(exact) — ${fmtCells(hist.dispCells)}, ${hist.dispAbove} above (DL-15, history); its ${hist.settingsRecords} settings records carry ${[...hist.settingsValues.keys()].join(' | ') || 'none'}. `
      + `LIQD stated a fix on 2026-09-30; the ${SUPPLEMENT_CAPTURE_DATE} capture of the same plan, scored in (g), credits ${credExact} of its ${wins} wins exactly at the rule. `
      + `OPEN RULING 2 (profile owner: is a win credited 1e-8 below floor8(stake × exact) a FAIL or a FLAG?) now bears only on how this history is classed: from 2026-10-01 to 2026-10-03 the package held these wins at a Step 22 FLAG pending the ruling (profile MINES-11's policy is HARD_FAIL; the same shortfall on the audited dataset hard-fails Step 8, forgery D26). It does not move today's status, and nothing here decides it. `
      + `History figures ${hist.ok ? 'equal' : 'DO NOT equal'} their declarations (a figure that moves FAILs this step: the published history would no longer describe the pinned bytes). `;
  const detail =
    `SUPPLEMENT ${SUPPLEMENT_DATASET_RELATIVE_PATH} (captured ${SUPPLEMENT_CAPTURE_DATE}) — scored here; Steps 1–21 score the audited 6,900-round dataset (Step 10 also reads this supplement's settings declaration, bound here in (j)); the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture of the same plan is dated history, arm (k), not scored. `
    + `(a) integrity: dataset and journal SHA-256 match their pins; ${jBets.length - journalRowBad}/${bets.length} journal bet records equal the dataset rows; ${bets.length - intentBad}/${bets.length} reveal orders journalled before their bet. `
    + `(b) population: ${bets.length}/${SUPPLEMENT_EXPECTED_BETS} rounds, ${seeds.length}/${SUPPLEMENT_EXPECTED_SEEDS} epochs, ${planned.size} (mineCount, depth) configurations × ${SUPPLEMENT_PER_CONFIG} (${shortCfg.length} off plan, ${offPlan} rounds outside it; capture meta plan ${metaDepthsAgree ? 'agrees' : 'DISAGREES'} with src/pins.ts). `
    + `(c) commitment: ${seeds.length - commitBad}/${seeds.length} commitments verify, ${Math.max(seeds.length - 1, 0) - chainBad}/${Math.max(seeds.length - 1, 0)} chain links, pre-capture anchor ${anchorOk ? 'links to epoch 0' : 'FAILS'}; nonce violations ${nonceBad}, rows unbound to their epoch ${bindBad}. `
    + `(d) layouts: ${layoutChk - layoutBad}/${SUPPLEMENT_EXPECTED_BETS} recompute (draw order). `
    + `(e) reveals: ${revealChk - statusBad}/${revealChk} served mine/safe statuses equal the recomputed layout; ${seqBad} rounds whose reveals differ from the recorded order; ${wins} wins (${winBad} not opening exactly the planned safe tiles), ${losses} losses (${lossBad} not busting on exactly the last reveal or credited ≠ 0). `
    + `(f) per-step multiplier: ${perStepServed} of ${revealChk} reveals carried one (declared ${SUPPLEMENT_DECLARED_PER_STEP_MULTIPLIERS}) — NOT SERVED ON THE WIRE: ${safeBare} safe reveals returned only {mineTile}, ${settleOnReveal} mine reveals returned the settled record; the intermediate-rung arm of MINES-17 is not checkable from the operator's responses. `
    + `(g) cash-out rung, ${wins} wins, scored against ONE rule — the rule every win in this package is held to (Steps 7–8 on the audited dataset's 3,104 wins): credit = floor8(stake × exact rational multiplier), display = floor2(exact). `
    + `CREDIT: == the rule ${credExact}/${wins}; ABOVE the rule ${credAbove}; BELOW the rule ${credUnitBelow}${credUnitBelow ? ` (${fmtCells(unitBelowCells)}, total ${credGapUnits} × 1e-8)` : ''} — declared gap ${SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW} (src/pins.ts SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW); non-finite ${credOutOfBound}, off-grid ${offGrid}. `
    + `The cells that missed the rule on ${SUPPLEMENT_HISTORY_CAPTURE_DATE} (arm k), on this capture: ${historyCellsToday}. `
    + `DISPLAY: == the rule ${dispExactOk}/${wins}; above ${dispAbove}; one cent below ${dispCentBelow}${dispCentBelow ? ` (${fmtCells(centBelowCells)})` : ''} — declared gap ${SUPPLEMENT_DISCLOSED_DISPLAY_CENT_BELOW}; out of bound ${dispOutOfBound}. `
    + `VERDICT TREATMENT: a credit or a display below the rule on this capture FAILs this step — the declared gap is ${SUPPLEMENT_DISCLOSED_CREDIT_UNIT_BELOW}, so any short win moves it — which is the severity profile MINES-11 (HARD_FAIL, an exact comparison under a declared settlement rule) gives it, and the one Step 8 gives a short credit on the audited dataset; nothing on this capture is held at FLAG. `
    + `EXPLANATORY ONLY — hypotheses about the operator, gated on nothing, never the audit's rule: the binary64 models that matched every credit of the ${SUPPLEMENT_HISTORY_CAPTURE_DATE} capture match this one as follows — credit == Math.floor(stake×multF×1e8) ${credModelA}/${wins}, == exact product of the two doubles floored to 8 dp ${credModelB}/${wins}, == that model with the multiplier formed edge-first ${credModelC}/${wins}; display == Math.floor(multF×100)/100 ${dispModelOk}/${wins}; against the exact rule: credit ${credExact}/${wins}, display ${dispExactOk}/${wins}. `
    + `(h) order independence at the cash-out rung: ${cells.length - orderVariant.length}/${cells.length} witnessed cells carry one served multiplier and one credit across every reveal order (${multiOrderCells} cells reached by more than one opened-tile order; ${cellsWithTwoWins} with ≥ 2 wins); first picks span ${firstPicks.size}/${GRID} positions. `
    + `(i) coverage: ${cells.length} cash-out rungs witnessed (floor ${SUPPLEMENT_MIN_CASHOUT_RUNGS}): ${cells.map(([k, c]) => `(${k.replace(':', ',')})×${c.wins}`).join(' ')}; safe reveals reached ${safeRungCells.size} (mineCount, depth) rungs. `
    + `(j) operator settings: ${settingsRecords} settle responses carry currentGameSettings (declared ${SUPPLEMENT_GAME_SETTINGS.records}), ${settingsValues.size} distinct value${settingsValues.size === 1 ? '' : 's'}, ${settingsValues.size === 1 && settingsValues.has(SUPPLEMENT_GAME_SETTINGS.value) ? 'equal to' : 'NOT equal to'} the declaration ${SUPPLEMENT_GAME_SETTINGS.value} (src/pins.ts SUPPLEMENT_GAME_SETTINGS); ${settingsRevealCopies - settingsCopyMismatch}/${settingsRevealCopies} reveal copies agree. `
    + `The declared value carries ${declaredMaxOdds === undefined ? 'NO maxOdds key' : `maxOdds ${JSON.stringify(declaredMaxOdds)}`}; the declared cap is ${MAX_ODDS_DECLARED}× (src/config.ts MAX_ODDS_DECLARED, from the audited dataset's settings records), so this build's settings ${Number(declaredMaxOdds) === MAX_ODDS_DECLARED ? 'carry' : 'do not carry'} the July build's cap; LIQD states the multiplier cap was removed at the end of August 2026, and Step 10 discloses this without scoring it (MINES-14 cap half, not scored since 2026-10-15; MANIFEST DL-7). `
    + histText.trimEnd()
    + (fails.length ? ` E.g. ${fails.join('; ')}` : '');
  return [step(STEP_NUMBER, STEP_NAME, status, detail)];
}
