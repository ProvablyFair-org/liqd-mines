#!/usr/bin/env node
// ============================================================================
//  LIQD Mines — CAPTURE v3: the MULTI-REVEAL capture (written 2026-09-26). The auditor runs it.
//
//  capture-mines.reference.mjs is the record of the audited capture (6,900 rounds) and
//  capture-mines.mjs (v2, liqd 2fc4e5a) is the full-replacement plan written 24 Sep; both are kept
//  unchanged. v3 is the SUPPLEMENT that closes the two checks the audited dataset cannot:
//
//   MINES-17  multi-reveal parity — rounds played interactively (place-bet → open-tile × depth →
//             cash-out-bet), the raw response of EVERY reveal kept and any multiplier it carries
//             recorded per depth (`steps[].servedMultiplier`), tiles opened in a CSPRNG-shuffled
//             order that is recorded (`openOrder`) for the position/order-independence arms.
//   MINES-15  depth & mine-count coverage — 5 mine counts × 4 depths × 50 = 1,000 rounds (the audited
//             Phase E was mineCount 3 at depth 5 only). Phase A coverage stays with the audited
//             dataset (24 × 200), which v3 does not replace.
//
//  Depths are chosen per mine count so deep rungs are actually reached (expected, by exact
//  hypergeometric survival C(25−m,k)/C(25,k) × 50 per config): ≈ 2,772 served per-step multipliers
//  in total, every (m, k) rung up to the planned depth expected ≥ 1 time, ≈ 397 full-depth cash-outs.
//
//  Also, as in every 2026-09-26 LIQD capture (liqd-capture-core.mjs): pre-capture anchor before any bet
//  (MINES-02), CSPRNG client seeds with the generator disclosed (MINES-06), epochSize 50 closed by a
//  rotation each, per-rotation nonceEnd, journal + --resume, credential scrubbing. Transport = the
//  limbo capture's (set-cookie.sh + curl_cffi), because qa.liqd.com gates on the TLS fingerprint and
//  plain Node fetch (which v2 used) is what that gate rejects.
//
//  Usage (from the package root):
//    node capture/capture-mines-v3.mjs --plan        print the plan, no network
//    node capture/capture-mines-v3.mjs --probe       2 multi-reveal rounds ($0.10) + rotations, then stop
//    node capture/capture-mines-v3.mjs               full run: 1,000 rounds, 20 epochs
//    node capture/capture-mines-v3.mjs --resume      continue the last unfinished run
//    node capture/capture-mines-v3.mjs --cells=1:10,1:15   only those (mineCount:depth) configs, 50 rounds each
//
//  2026-10-03 RE-CAPTURE: the 2026-09-26 run credited 50 wins one 1e-8 unit short ((1,10) 29, (1,15) 21; DL-14)
//  and its settings records carried no maxOdds (DL-7). LIQD stated a fix on 2026-09-30. `--cells=1:10,1:15` plays
//  only the two cells where the gap occurred (100 rounds, 2 epochs) to see whether qa now credits the exact payout.
//  API change seen on limbo 2026-10-02: place-bet may require body.stakeCurrency. If place-bet is refused for it
//  (HTTP 400 naming stakeCurrency — a refused request places no bet), the script resends with stakeCurrency
//  'USDC' and keeps sending it; --stake-currency=USDC sends it from the first bet.
// ============================================================================
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomInt, createHmac } from 'node:crypto';
import { makeApi, pythonTransport, runCapture, parseFlags, latestJournal, secretNeedles, retrying, sleep, AUDIT_SEED_GENERATOR, API_BASE_DEFAULT, makeProgress, colourVerdicts } from './liqd-capture-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(HERE, 'out');
export const RUN_NAME = 'liqd-mines-capture-v3';
export const GRID = 25, HOUSE_EDGE = 0.01, EPOCH = 50, AMT = 0.10, PER_CONFIG = 50;
export const CURRENCY_ID = '2', CURRENCY_CODE = 'USDC';
/** mine count → the depths played (tiles opened before cash-out). */
export const DEPTHS = { 1: [2, 5, 10, 15], 3: [2, 4, 6, 8], 5: [2, 3, 5, 6], 8: [2, 3, 4, 5], 12: [2, 3, 4, 5] };
const DELAY_STEP = 0; // no pacing between reveals (was 150 ms); errors still back off

// ── Reference (capture-time self-check only; the audit verifier is src/rng.ts) ──
export function minesFor(serverSeed, clientSeed, nonce, mineCount) {
  const key = Buffer.from(serverSeed, 'hex'), t = Array.from({ length: GRID }, (_, i) => i + 1);
  for (let i = 0; i < GRID; i++) {
    const range = GRID - i, maxFair = Math.floor(2 ** 32 / range) * range;
    for (let cursor = i; ; cursor += 1_000_000) {
      const d = createHmac('sha256', key).update(`${clientSeed}:${nonce}:${cursor}`).digest();
      let r = -1;
      for (let o = 0; o + 4 <= d.length; o += 4) { const v = d.readUInt32BE(o); if (v < maxFair) { r = v % range; break; } }
      if (r >= 0) { const j = i + r; [t[i], t[j]] = [t[j], t[i]]; break; }
    }
  }
  return t.slice(0, mineCount);
}
export const multExact = (m, k) => { let x = 1 - HOUSE_EDGE; for (let i = 0; i < k; i++) x *= (GRID - i) / (GRID - m - i); return x; };
const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
// 2026-10-03: the credit rule every win is held to (MINES-11 / DL-14), printed live so the auditor sees the answer:
// winningAmount == floor8(stake × 0.99 × C(25,k)/C(25−m,k)) in 1e-8 units, BigInt, k = tiles opened. On the 2026-09-26
// supplement this reproduces the package exactly: 404 wins, 354 exact, 50 one unit short ((1,10) 29, (1,15) 21), 0 over.
const binom = (n, k) => { let r = 1n; for (let i = 0n; i < BigInt(k); i++) r = r * (BigInt(n) - i) / (i + 1n); return r; };
export const exactCreditUnits = (stake, m, k) => BigInt(Math.round(Number(stake) * 1e8)) * 99n * binom(GRID, k) / (100n * binom(GRID - m, k));
export function creditCheck(bets) {
  const out = { wins: 0, exact: 0, short: 0, over: 0, settings: 0, withMaxOdds: 0 };
  for (const b of bets) {
    // currentGameSettings arrives as a JSON STRING; parse it before reading keys (fixed 2026-10-03 after the 3 Oct run —
    // the counter in the version that ran (27d0b66) read .maxOdds off the string and always printed 0; scoring parses it).
    for (const r of [b.settleRaw, ...(b.steps ?? []).map((x) => x.raw)]) if (r && r.currentGameSettings) {
      out.settings++;
      let gs = r.currentGameSettings; if (typeof gs === 'string') { try { gs = JSON.parse(gs); } catch { gs = {}; } }
      if (gs && gs.maxOdds != null) out.withMaxOdds++;
      break;
    }
    if (b.result !== 'won' || !Array.isArray(b.openTiles) || b.winningAmount == null) continue;
    out.wins++;
    const want = exactCreditUnits(b.betAmount, b.mineCount, b.openTiles.length), got = BigInt(Math.round(Number(b.winningAmount) * 1e8));
    if (got === want) out.exact++; else if (got < want) out.short++; else out.over++;
  }
  return out;
}
export const creditLine = (c) => `credits: ${c.wins} wins, exact ${c.exact}, 1e-8 SHORT ${c.short}, over ${c.over}  ·  settings records ${c.settings}, with maxOdds ${c.withMaxOdds}`;
export const TILE_ORDER_GENERATOR = 'crypto.randomInt Fisher-Yates over tiles 1..25 per round, recorded as openOrder';
export function shuffledTiles() {
  const o = Array.from({ length: GRID }, (_, i) => i + 1);
  for (let i = GRID - 1; i > 0; i--) { const j = randomInt(i + 1); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// ── Plan: 20 configs cycled over 1,000 rounds → exactly 50 per config, every epoch mixes configs ──
export function parseCells(v) {
  if (!v || v === true) return null;
  return String(v).split(',').map((c) => { const [m, d] = c.split(':').map(Number);
    if (!(m >= 1 && m <= 24 && d >= 1 && d <= GRID - m)) throw new Error(`--cells: bad cell "${c}" (mineCount:depth)`); return { mineCount: m, depth: d }; });
}
export function buildPlan(cells = null) {
  const cfg = cells ?? Object.entries(DEPTHS).flatMap(([m, ds]) => ds.map((d) => ({ mineCount: Number(m), depth: d })));
  const total = cfg.length * PER_CONFIG, plan = [];
  for (let e = 0; e < total / EPOCH; e++) plan.push({ phase: 'E', group: null, seed: { tag: 'audit' },
    bets: Array.from({ length: EPOCH }, (_, j) => ({ ...cfg[(e * EPOCH + j) % cfg.length], amount: AMT })) });
  return plan;
}
export const probePlan = () => [{ phase: 'probe', group: null, seed: { tag: 'audit' }, bets: [{ mineCount: 3, depth: 3, amount: AMT }, { mineCount: 3, depth: 3, amount: AMT }] }];

// ── Game adapter ─────────────────────────────────────────────────────────────────
const STEP_MULT_KEYS = ['multiplier', 'currentMultiplier', 'payoutMultiplier', 'odds'];
const pickK = (o, ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; return null; };
export function makeGame({ stepDelayMs = DELAY_STEP, stakeCurrency = null } = {}) {
  const post = (api, path, body) => api.http('POST', path, body);
  let sendStakeCurrency = stakeCurrency;   // null until the API asks for it (or forced by --stake-currency)
  const inProgress = async (api, log) => { const a = await retrying(() => api.active(), { label: 'active', log }); return Array.isArray(a.gamesInProgress) && a.gamesInProgress.length > 0; };
  return {
    name: 'mines',
    async play(spec, ctx) {
      const order = shuffledTiles(); const tiles = order.slice(0, spec.depth);
      ctx.journal.append({ t: 'intent', epoch: ctx.epoch, seq: ctx.seq, mineCount: spec.mineCount, tiles });
      const body = () => ({ betAmount: spec.amount, currencyId: CURRENCY_ID, clientSeed: ctx.clientSeed, mineCount: spec.mineCount, ...(sendStakeCurrency ? { stakeCurrency: sendStakeCurrency } : {}) });
      // place-bet has no idempotency key: on a lost response, the account's gamesInProgress says whether it was placed.
      let placed;
      for (let a = 1; ; a++) {
        try { placed = await post(ctx.api, '/fast-games/mine-game/place-bet', body()); break; } catch (e) {
          if (e.kind === 'API' && !sendStakeCurrency && /stakeCurrency/i.test(e.message)) {
            sendStakeCurrency = CURRENCY_CODE;   // refused, not placed: resend with the field from now on
            ctx.log(`  place-bet refused for missing stakeCurrency — resending with stakeCurrency ${CURRENCY_CODE}`);
            continue;
          }
          if (e.kind !== 'TRANSIENT' || a >= 20) throw e;
          await sleep(Math.min(2000 * a, 20000));
          if (await inProgress(ctx.api, ctx.log)) { placed = { lostResponse: true }; break; }
        }
      }
      const steps = []; let settle = null; const notes = [];
      for (const tile of tiles) {
        await sleep(stepDelayMs);
        let r;
        // A 429 means the request was NOT processed, so the same tile is simply sent again; any other
        // lost response leaves it unknown whether the tile opened.
        const openTile = retrying(() => post(ctx.api, '/fast-games/mine-game/open-tile', { tile }).catch((e) => { if (!e.rateLimited) e.kind = e.kind === 'TRANSIENT' ? 'LOST' : e.kind; throw e; }), { label: 'open-tile (429)', max: 10, log: ctx.log });
        try { r = await openTile; } catch (e) {
          if (e.kind !== 'LOST' && e.kind !== 'TRANSIENT') throw e;
          notes.push(`open-tile ${tile}: response lost (${e.message.slice(0, 40)})`);
          r = null;
        }
        if (!r) {   // unknown whether the tile opened: end the round cleanly and let the reveal settle it
          if (await inProgress(ctx.api, ctx.log)) settle = await retrying(() => post(ctx.api, '/fast-games/mine-game/cash-out-bet', { currencyCode: CURRENCY_CODE }), { label: 'cash-out', log: ctx.log }).catch(() => null);
          notes.push('round ended early after a lost response — steps after this point were not played');
          break;
        }
        steps.push({ depth: steps.length + 1, tile, mineTile: r.mineTile ?? null, servedMultiplier: pickK(r, STEP_MULT_KEYS), keys: Object.keys(r), raw: r });
        if (r.mineTile === true) { settle = r; break; }
      }
      if (!settle && !notes.length) {
        await sleep(stepDelayMs);
        try { settle = await post(ctx.api, '/fast-games/mine-game/cash-out-bet', { currencyCode: CURRENCY_CODE }); } catch (e) {
          if (e.kind !== 'TRANSIENT') throw e;
          notes.push('cash-out response lost');
          if (await inProgress(ctx.api, ctx.log)) settle = await post(ctx.api, '/fast-games/mine-game/cash-out-bet', { currencyCode: CURRENCY_CODE }).catch(() => null);
        }
      }
      const s = settle ?? {};
      return { epoch: ctx.epoch, phase: ctx.phase, seq: ctx.seq, at: new Date().toISOString(), mineCount: spec.mineCount, reveals: spec.depth, stakeCurrencySent: sendStakeCurrency,
        interactive: true, openOrder: tiles, hashedServerSeed: ctx.hashedServerSeed, steps, placeRaw: placed, settleRaw: settle,
        openTiles: s.openTiles ?? null, mineTiles: s.mineTiles ?? null, nonce: s.nonce ?? placed?.nonce ?? null,
        // settle response lost: the nonce is the round's position in the epoch (base 0 after every rotation), flagged as inferred
        ...((s.nonce ?? placed?.nonce) == null ? { nonceInferred: ctx.seq } : {}), clientSeed: s.clientSeed ?? ctx.clientSeed,
        id: s.id ?? placed?.id ?? null, betAmount: s.betAmount ?? spec.amount, winningAmount: s.winningAmount ?? null, multiplier: s.multiplier ?? null,
        result: s.result ?? null, notes };
    },
    async recover(intent, ctx) {
      if (!(ctx.active && Array.isArray(ctx.active.gamesInProgress) && ctx.active.gamesInProgress.length)) return null;
      const s = await post(ctx.api, '/fast-games/mine-game/cash-out-bet', { currencyCode: CURRENCY_CODE });
      return { epoch: ctx.epoch, phase: 'E', seq: ctx.seq, at: new Date().toISOString(), mineCount: intent.mineCount, reveals: intent.tiles.length, interactive: true,
        openOrder: intent.tiles, hashedServerSeed: ctx.active.hashedServerSeed, steps: [], placeRaw: null, settleRaw: s, openTiles: s.openTiles ?? null,
        mineTiles: s.mineTiles ?? null, nonce: s.nonce ?? null, clientSeed: s.clientSeed ?? ctx.clientSeed, id: s.id ?? null, betAmount: s.betAmount ?? null,
        winningAmount: s.winningAmount ?? null, multiplier: s.multiplier ?? null, result: s.result ?? null, recovered: true,
        notes: ['recovered on --resume: the round was in progress when the run stopped; per-step responses before the stop were not recorded'] };
    },
    verifyEpoch(sd, bets) {
      let layoutBad = 0, statusBad = 0, stepSeen = 0, stepFloorOk = 0, stepExactOk = 0, cashBad = 0, nonceBad = 0;
      bets.forEach((b, i) => {
        if (b.nonce !== (sd.nonceStart ?? 0) + i) nonceBad++;
        if (!sd.serverSeed) return;
        const layout = minesFor(sd.serverSeed, b.clientSeed, b.nonce, b.mineCount);
        if (Array.isArray(b.mineTiles) && [...layout].sort((x, y) => x - y).join() !== [...b.mineTiles].sort((x, y) => x - y).join()) layoutBad++;
        for (const s of b.steps ?? []) {
          if (s.mineTile !== layout.includes(s.tile)) statusBad++;
          if (s.mineTile || s.servedMultiplier == null) continue;
          stepSeen++;
          const ex = multExact(b.mineCount, s.depth), v = Number(s.servedMultiplier);
          if (Math.abs(v - ex) <= 1e-9 * ex) stepExactOk++;
          if (Math.abs(v - floor2(ex)) < 1e-9 || Math.abs(v - ex) <= 0.01) stepFloorOk++;
        }
        if (b.result === 'won' && Array.isArray(b.openTiles) && Math.abs(Number(b.multiplier) - multExact(b.mineCount, b.openTiles.length)) > 0.01) cashBad++;
      });
      return `layouts ${layoutBad ? layoutBad + ' BAD' : 'OK'}  reveal status ${statusBad ? statusBad + ' BAD' : 'OK'}  nonces ${nonceBad ? nonceBad + ' BAD' : 'OK'}  `
        + `per-step multipliers served ${stepSeen} (exact ${stepExactOk}, within 0.01/2dp-floor ${stepFloorOk})  cash-out ${cashBad ? cashBad + ' BAD' : 'OK'}\n    ${creditLine(creditCheck(bets))}`;
    },
  };
}

function probeReport(ds) {
  const steps = ds.bets.flatMap((b) => b.steps ?? []);
  const withMult = steps.filter((s) => s.servedMultiplier != null && !s.mineTile).length, safe = steps.filter((s) => !s.mineTile).length;
  return ['', 'PROBE RESULT',
    `  pre-capture anchor: commit ${ds.meta.preCapture?.commitVerified ? 'OK' : 'FAIL'}, link ${ds.meta.preCapture?.anchorLinkOk ? 'OK' : 'FAIL'}; epoch 0 commit ${ds.seeds[0]?.commitVerified ? 'OK' : 'FAIL'}, chain ${ds.seeds[0]?.chainLinkOk ? 'OK' : 'FAIL'}`,
    `  ${ds.bets.length} rounds, ${steps.length} reveals (${safe} safe), ${withMult} safe reveals carried a per-step multiplier`,
    `  open-tile response keys seen: ${[...new Set(steps.flatMap((s) => s.keys))].join(', ') || '(none)'}`,
    withMult ? '  Per-step multipliers ARE served → run the full capture (it closes the MINES-17 rung arm).'
      : safe ? '  NO per-step multiplier in open-tile responses → a full run would NOT close the rung arm of MINES-17. Stop and send this output.'
        : '  Both probe rounds hit a mine on the first reveal — run --probe again (costs $0.20).',
  ].join('\n');
}

async function main() {
  const F = parseFlags(process.argv.slice(2));
  const cells = parseCells(F.get('cells', null));
  const plan = F.probe ? probePlan() : buildPlan(cells);
  const n = plan.reduce((s, e) => s + e.bets.length, 0);
  const prog = makeProgress({ total: n, title: `LIQD Mines capture v3 (multi-reveal) — ${F.probe ? 'PROBE' : 'FULL RUN'}` });
  prog.header([`${n.toLocaleString('en-US')} rounds · ${plan.length} epochs · stake $${(n * AMT).toFixed(2)}`, 'no pacing delay · Ctrl-C stops cleanly after the current round · --resume continues']);
  if (F.plan) { if (cells) cells.forEach((c) => console.log(`  mineCount ${c.mineCount}: depth ${c.depth} — ${PER_CONFIG} rounds`)); else for (const [m, ds] of Object.entries(DEPTHS)) console.log(`  mineCount ${m}: depths ${ds.join(', ')} — ${PER_CONFIG} rounds each`); return; }
  const cookie = process.env.LIQD_COOKIE || '';
  if (!cookie) { console.error('LIQD_COOKIE is not set — copy any qa.liqd.com /api/v1 request as cURL and export its cookie header as LIQD_COOKIE'); process.exit(2); }
  const api = makeApi({ transport: pythonTransport({ reqPy: join(HERE, 'req-v2.py'), referer: 'https://qa.liqd.com/originals/mines' }), base: process.env.LIQD_BASE || API_BASE_DEFAULT });
  const stopFlag = { stop: false };
  process.on('SIGINT', () => { if (stopFlag.stop) process.exit(130); stopFlag.stop = true; prog.log('\nCtrl-C: stopping after the current round (again to quit at once). Continue with --resume.'); });
  const runName = F.probe ? RUN_NAME + '-probe' : cells ? RUN_NAME + '-cells' : RUN_NAME;
  const resumeFile = F.resume ? (F.resume === true ? latestJournal(OUT_DIR, runName) : F.resume) : null;
  if (F.resume && !resumeFile) { console.error('--resume: no journal found in capture/out'); process.exit(2); }
  const meta = { audit: 'LIQD Mines', platform: 'qa.liqd.com', schema: 'liqd-mines-capture-v3', probe: F.probe, script: 'capture/capture-mines-v3.mjs',
    supplementTo: 'data/mines-master-6900bets.json (audited dataset; Phase A-D coverage stays there)', houseEdge: HOUSE_EDGE, epochSize: EPOCH, nonceBase: 0,
    clientSeedGenerator: AUDIT_SEED_GENERATOR, tileOrderGenerator: TILE_ORDER_GENERATOR, currencyId: CURRENCY_ID,
    phaseE: { depthsByMineCount: cells ? null : DEPTHS, cells: cells ?? null, perConfig: PER_CONFIG, mode: 'interactive place-bet → open-tile × depth → cash-out-bet' },
    stakeCurrencyForced: F.get('stake-currency', null) ? String(F.get('stake-currency', null)) : null };
  try {
    const r = await runCapture({ api, game: makeGame({ stakeCurrency: F.get('stake-currency', null) ? String(F.get('stake-currency', null)) : null }), plan, meta, outDir: OUT_DIR, runName, resumeFile, needles: secretNeedles(cookie), stopFlag, progress: prog, log: prog.log });
    prog.end();
    if (F.probe) console.log(colourVerdicts(probeReport(r.ds)));
    console.log(`\n${r.finished ? 'DONE' : 'STOPPED (resume with --resume)'} — ${r.ds.bets.length} rounds, ${r.ds.seeds.filter((s) => s?.serverSeed).length} epochs revealed\n  dataset: ${r.outFile}\n  journal: ${r.journalFile}`);
    const rev = r.ds.seeds.filter((s) => s?.serverSeed), bad = rev.filter((s) => !s.commitVerified || !s.chainLinkOk).length;
    prog.summary(r.finished ? 'CAPTURE COMPLETE' : 'CAPTURE STOPPED — resume with --resume', [`rounds      ${r.ds.bets.length.toLocaleString('en-US')} / ${n.toLocaleString('en-US')}`, `epochs      ${rev.length} revealed · commit+chain ${bad ? bad + ' FAIL' : 'all OK'}${r.ds.meta.preCapture ? ` · anchor commit ${r.ds.meta.preCapture.commitVerified ? 'OK' : 'FAIL'} link ${r.ds.meta.preCapture.anchorLinkOk ? 'OK' : 'FAIL'}` : ''}`, creditLine(creditCheck(r.ds.bets)), `dataset     ${r.outFile.split('/').pop()}`], r.finished && !bad);
  } catch (e) {
    prog.end();
    console.error(`\nFATAL (${e.kind ?? 'error'}): ${e.message}`);
    console.error(e.kind === 'AUTH' ? '  → cookie expired/blocked: re-copy the cURL, re-source set-cookie.sh, then run again with --resume' : '  → run again with --resume to continue the same capture');
    process.exit(1);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
