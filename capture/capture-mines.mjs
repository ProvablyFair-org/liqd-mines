#!/usr/bin/env node
// ============================================================================
//  LIQD Mines — NEXT-CAPTURE SCRIPT (planned 2026-09-24; NOT YET RUN)
//
//  capture-mines.reference.mjs records the capture that produced the audited
//  dataset (data/mines-master-6900bets.json) and is kept unchanged. THIS file is
//  the script for the next capture. It changes four things, each tied to a check
//  this package currently leaves open (MANIFEST.md#capture-plan-for-the-next-capture):
//
//   1. Every epoch's client seed is drawn from node:crypto randomBytes (a CSPRNG)
//      AFTER the epoch's server commitment was read, and the seed record carries
//      the generator, the submitted value and the commitment it was drawn after.
//      Phase D included — the executed capture's Phase D seeds were
//      `pfaudit-<one timestamp>-<epoch>` and therefore predictable (DL-13).
//   2. The pre-capture seed anchor is REQUIRED: the commitment and next-hash
//      active before epoch 0 are recorded, the pre-capture seed is revealed by the
//      first rotation, and the run aborts before placing a bet if the operator
//      does not expose a next-hash (MINES-02).
//   3. The multi-reveal phase plays interactively (place-bet → open-tile … →
//      cash-out-bet) and records the operator's raw response at EVERY reveal, so
//      a per-step multiplier can be checked against the formula at each depth
//      (MINES-17). The executed capture used the atomic auto-bet endpoint, which
//      returns one settled multiplier per round.
//   4. The multi-reveal phase is spread over several mine counts and depths, and
//      opens tiles in a CSPRNG-shuffled ORDER that is recorded, so reveal-order
//      independence can be tested (MINES-15, MINES-17). The executed Phase E was
//      mineCount 3 at depth 5 only.
//
//  Transport: cookie session supplied in the environment (LIQD_COOKIE) and the
//  API base (LIQD_BASE, e.g. https://<host>/api/v1) — nothing is defaulted and no
//  credential is stored here. The interactive endpoint bodies are the ones the
//  auditor's rig recorded as confirmed live on qa.liqd.com; WHETHER open-tile
//  returns a per-step multiplier has NOT been observed, which is what --probe
//  checks (2 rounds, then stop) before a full run is worth starting.
//
//  Usage (the auditor runs every capture):
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-mines.mjs --plan    # print the plan, no network
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-mines.mjs --probe   # 2 multi-reveal rounds + 1 rotation
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-mines.mjs           # full capture
// ============================================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt, createHmac, createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');
const argv = new Set(process.argv.slice(2));
const PLAN = argv.has('--plan'), PROBE = argv.has('--probe');
const BASE = process.env.LIQD_BASE || '';
const COOKIE = process.env.LIQD_COOKIE || '';
const CURRENCY_ID = '2', CURRENCY_CODE = 'USDC';
const EPOCH = 50, GRID = 25, HOUSE_EDGE = 0.01;
const MINE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1);
const AMT_LOW = 0.10, AMT_STAKE = 10;
const DELAY_BET = 400, DELAY_STEP = 250, DELAY_ROTATE = 1200;

// ── Client seeds: CSPRNG for every epoch (change 1) ─────────────────────────────
// Non-D keeps the executed capture's `audit` + 12 hex form (Step 6's format binding still
// applies); Phase D is a player-chosen seed of a different shape, but no longer predictable.
const CLIENT_SEED_GENERATOR = { audit: 'audit + randomBytes(6).hex', pfaudit: 'pfaudit- + randomBytes(8).hex' };
const newClientSeed = tag => tag === 'pfaudit' ? `pfaudit-${randomBytes(8).toString('hex')}` : `audit${randomBytes(6).toString('hex')}`;

// ── Plan ────────────────────────────────────────────────────────────────────────
// A–D as executed. E (change 4): 6 mine counts × 4 depths = 24 configs cycled over
// 16 epochs (800 rounds, ≈33 per config), tile order CSPRNG-shuffled per round.
const E_MINES = [1, 3, 5, 8, 12, 20];
const E_DEPTHS = [2, 3, 4, 5];
function buildEpochs() {
  const epochs = [];
  const ep = (phase, amount, seedTag, bets) => epochs.push({ phase, amount, seedTag, bets });
  const fill = (n, mineCount, reveals) => Array.from({ length: n }, () => ({ mineCount, reveals }));
  for (const mc of MINE_COUNTS) for (let e = 0; e < 4; e++) ep('A', AMT_LOW, 'audit', fill(EPOCH, mc, 1));
  for (let e = 0; e < 20; e++) ep('B', AMT_LOW, 'audit', fill(EPOCH, 24, 1));
  for (let e = 0; e < 4; e++) ep('C', AMT_STAKE, 'audit', fill(EPOCH, 3, 1));
  let k = 0;
  for (let e = 0; e < 10; e++) { const b = []; for (let j = 0; j < EPOCH; j++) b.push({ mineCount: MINE_COUNTS[k++ % 24], reveals: 1 }); ep('D', AMT_LOW, 'pfaudit', b); }
  const cfg = E_MINES.flatMap(m => E_DEPTHS.map(d => ({ mineCount: m, reveals: d })));
  let c = 0;
  for (let e = 0; e < 16; e++) { const b = []; for (let j = 0; j < EPOCH; j++) b.push({ ...cfg[c++ % cfg.length], interactive: true }); ep('E', AMT_LOW, 'audit', b); }
  return epochs;
}
const EPOCHS = buildEpochs();
const TOTAL = EPOCHS.reduce((s, e) => s + e.bets.length, 0);

// ── Inline reference (capture-time self-check only; the audit verifier is src/rng.ts) ──
const commitHash = s => createHash('sha256').update(s, 'utf8').digest('hex');
function minesFor(serverSeed, clientSeed, nonce, mineCount) {
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
const multExact = (m, k) => { let x = 1 - HOUSE_EDGE; for (let i = 0; i < k; i++) x *= (GRID - i) / (GRID - m - i); return x; };
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

// ── Transport ────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();
async function http(method, path, body) {
  const headers = { Accept: 'application/json', Cookie: COOKIE };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (res.status === 401 || res.status === 403 || /<html/i.test(text)) throw Object.assign(new Error(`${res.status} auth`), { kind: 'AUTH' });
  const json = JSON.parse(text);
  if (Array.isArray(json?.errors) && json.errors.length) throw Object.assign(new Error(JSON.stringify(json.errors).slice(0, 200)), { kind: 'API' });
  return json?.data !== undefined ? json.data : json;
}
const pick = (o, ...k) => { for (const x of k) if (o && o[x] != null) return o[x]; return undefined; };
const readSeedState = a => ({
  hashedServerSeed: pick(a, 'activeServerSeedHash', 'hashedServerSeed'),
  nextHashedServerSeed: pick(a, 'nextServerSeedHash', 'nextHashedServerSeed'),
  clientSeed: pick(a, 'activeClientSeed', 'clientSeed'), nonce: pick(a, 'nonce'),
  revealedServerSeed: pick(a, 'revealedServerSeed', 'serverSeed'),
});
const getActive = async () => readSeedState(await http('GET', '/fast-games/provably-fair/active'));
const rotate = async clientSeed => readSeedState(await http('POST', '/fast-games/provably-fair/rotate', { clientSeed }));
const autoBet = (clientSeed, mineCount, tiles, amount) =>
  http('POST', '/fast-games/mine-game/auto-bet', { betAmount: amount, currencyId: CURRENCY_ID, clientSeed, mineCount, tiles });

// Interactive round (change 3): every open-tile response is kept raw, and the multiplier the
// operator served at that depth is extracted if the response carries one.
const STEP_MULT_KEYS = ['multiplier', 'currentMultiplier', 'payoutMultiplier', 'odds'];
async function playInteractive(clientSeed, mineCount, depth, amount) {
  const order = [...Array(GRID).keys()].map(i => i + 1);
  for (let i = GRID - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const tiles = order.slice(0, depth);
  const placed = await http('POST', '/fast-games/mine-game/place-bet', { betAmount: amount, currencyId: CURRENCY_ID, clientSeed, mineCount });
  const steps = [];
  let settle = null;
  for (const tile of tiles) {
    await sleep(DELAY_STEP);
    const r = await http('POST', '/fast-games/mine-game/open-tile', { tile });
    const mult = pick(r, ...STEP_MULT_KEYS);
    steps.push({ depth: steps.length + 1, tile, mineTile: pick(r, 'mineTile'), servedMultiplier: mult ?? null, keys: Object.keys(r ?? {}), raw: r });
    if (pick(r, 'mineTile') === true) { settle = r; break; }
  }
  if (!settle) { await sleep(DELAY_STEP); settle = await http('POST', '/fast-games/mine-game/cash-out-bet', { currencyCode: CURRENCY_CODE }); }
  return { placed, settle, tiles, steps };
}

// ── Dataset ──────────────────────────────────────────────────────────────────────
const dataset = {
  meta: { audit: 'liqd Mines', schema: 'liqd-mines-capture-v2', base: BASE.replace(/\/\/[^/]*@/, '//'), houseEdge: HOUSE_EDGE,
    epochSize: EPOCH, plannedTotal: TOTAL, clientSeedGenerator: CLIENT_SEED_GENERATOR,
    phaseE: { mineCounts: E_MINES, depths: E_DEPTHS, tileOrder: 'crypto.randomInt Fisher-Yates per round, recorded as openOrder' },
    startedAt: null, finishedAt: null, preCapture: null },
  seeds: [], bets: [],
};
const outFile = () => join(OUT_DIR, `liqd-mines-capture-v2-${dataset.bets.length}bets.json`);
const save = () => { mkdirSync(OUT_DIR, { recursive: true }); writeFileSync(outFile(), JSON.stringify(dataset, null, 2)); };

function checkEpoch(E, revealed) {
  const sd = dataset.seeds[E];
  sd.serverSeed = revealed;
  sd.commitVerified = commitHash(revealed) === sd.hashedServerSeed;
  let bad = 0, stepBad = 0, stepSeen = 0;
  for (const b of dataset.bets.filter(x => x.epoch === E)) {
    const layout = minesFor(revealed, b.clientSeed, b.nonce, b.mineCount);
    b.verified = same(layout, b.mineTiles);
    if (!b.verified) bad++;
    for (const s of b.steps ?? []) {
      if (s.servedMultiplier == null || s.mineTile) continue;
      stepSeen++;
      if (Math.abs(Number(s.servedMultiplier) - multExact(b.mineCount, s.depth)) > 0.01) stepBad++;
    }
  }
  return { bad, stepSeen, stepBad };
}

async function main() {
  console.log(`LIQD Mines next capture — ${TOTAL} rounds, ${EPOCHS.length} epochs; Phase E ${E_MINES.length}×${E_DEPTHS.length} configs, interactive`);
  if (PLAN) { for (const [i, e] of EPOCHS.entries()) if (i === 0 || EPOCHS[i - 1].phase !== e.phase) console.log(`  epoch ${i}: phase ${e.phase} from here`); return; }
  if (!BASE || !COOKIE) { console.error('LIQD_BASE and LIQD_COOKIE must be set (no defaults).'); process.exit(2); }

  // Change 2: the pre-capture anchor, before any bet.
  const pre = await getActive();
  if (!pre.hashedServerSeed || !pre.nextHashedServerSeed) { console.error('ABORT: operator exposes no next-hash before epoch 0 — the pre-capture anchor cannot be recorded.'); process.exit(1); }
  dataset.meta.startedAt = now();
  dataset.meta.preCapture = { at: now(), hashedServerSeed: pre.hashedServerSeed, nextHashedServerSeed: pre.nextHashedServerSeed, clientSeed: pre.clientSeed, nonce: pre.nonce, revealedServerSeed: null, commitVerified: null };

  const epochs = PROBE ? [{ phase: 'E', amount: AMT_LOW, seedTag: 'audit', bets: [{ mineCount: 3, reveals: 3, interactive: true }, { mineCount: 3, reveals: 3, interactive: true }] }] : EPOCHS;
  let submitted = newClientSeed(epochs[0].seedTag);
  let cur = await rotate(submitted);
  dataset.meta.preCapture.revealedServerSeed = cur.revealedServerSeed;
  dataset.meta.preCapture.commitVerified = !!cur.revealedServerSeed && commitHash(cur.revealedServerSeed) === pre.hashedServerSeed;
  dataset.meta.preCapture.anchorLinkOk = pre.nextHashedServerSeed === cur.hashedServerSeed;

  for (let E = 0; E < epochs.length; E++) {
    const epc = epochs[E];
    dataset.seeds[E] = { epoch: E, phase: epc.phase, at: now(), clientSeed: cur.clientSeed,
      clientSeedSubmitted: submitted, clientSeedGenerator: CLIENT_SEED_GENERATOR[epc.seedTag],
      // The commitment this epoch's seed was drawn after is the hash of THIS epoch's server seed,
      // published as the previous epoch's next-hash (pre-capture record for epoch 0).
      clientSeedDrawnAfterCommitment: dataset.seeds[E - 1]?.nextHashedServerSeed ?? pre.nextHashedServerSeed,
      hashedServerSeed: cur.hashedServerSeed, nextHashedServerSeed: cur.nextHashedServerSeed,
      serverSeed: null, nonceStart: cur.nonce ?? 0, nonceEnd: null, commitVerified: null, chainLinkOk: null };
    for (const [j, bet] of epc.bets.entries()) {
      const tileStart = ((dataset.bets.length + 1) % GRID) + 1;
      let rec;
      if (bet.interactive) {
        const r = await playInteractive(cur.clientSeed, bet.mineCount, bet.reveals, epc.amount);
        const s = r.settle;
        rec = { openOrder: r.tiles, steps: r.steps, placeRaw: r.placed, settleRaw: s,
          openTiles: s.openTiles, mineTiles: s.mineTiles, nonce: s.nonce, clientSeed: s.clientSeed, id: s.id,
          betAmount: s.betAmount, winningAmount: s.winningAmount, multiplier: s.multiplier, result: s.result };
      } else {
        const tiles = [((tileStart - 1) % GRID) + 1];
        const s = await autoBet(cur.clientSeed, bet.mineCount, tiles, epc.amount);
        rec = { openTiles: s.openTiles, mineTiles: s.mineTiles, nonce: s.nonce, clientSeed: s.clientSeed, id: s.id,
          betAmount: s.betAmount, winningAmount: s.winningAmount, multiplier: s.multiplier, result: s.result,
          currentGameSettings: s.currentGameSettings };
      }
      dataset.bets.push({ at: now(), epoch: E, phase: epc.phase, seq: j, mineCount: bet.mineCount, reveals: bet.reveals, hashedServerSeed: cur.hashedServerSeed, ...rec });
      await sleep(DELAY_BET);
    }
    await sleep(DELAY_ROTATE);
    submitted = newClientSeed(epochs[E + 1]?.seedTag ?? 'audit');
    const next = await rotate(submitted);
    const v = checkEpoch(E, next.revealedServerSeed);
    const sd = dataset.seeds[E];
    sd.nonceEnd = dataset.bets[dataset.bets.length - 1].nonce;
    sd.chainLinkOk = sd.nextHashedServerSeed === next.hashedServerSeed;
    console.log(`epoch ${E} ${epc.phase}: commit ${sd.commitVerified ? 'OK' : 'FAIL'} chain ${sd.chainLinkOk ? 'OK' : 'FAIL'} layouts ${v.bad ? `${v.bad} BAD` : 'OK'} per-step multipliers ${v.stepSeen} seen, ${v.stepBad} off-formula`);
    save();
    cur = next;
  }
  dataset.meta.finishedAt = now();
  save();
  if (PROBE) {
    const steps = dataset.bets.flatMap(b => b.steps ?? []);
    const withMult = steps.filter(s => s.servedMultiplier != null).length;
    console.log(`PROBE: ${steps.length} reveals, ${withMult} carried a per-step multiplier (keys seen: ${[...new Set(steps.flatMap(s => s.keys))].join(', ')}).`);
    console.log(withMult ? 'Per-step multipliers are served — a full run can close the rung check.' : 'NO per-step multiplier in open-tile responses — a full run would NOT close the rung check; stop and report.');
  }
  console.log(`saved ${outFile()}`);
}
main().catch(e => { console.error(`FATAL (${e.kind ?? 'error'}): ${e.message}`); save(); process.exit(1); });
