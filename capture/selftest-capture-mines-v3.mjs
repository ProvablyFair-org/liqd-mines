// Offline self-test for capture-mines-v3.mjs — NO network, NO casino. Runs the real capture engine
// against selftest-mock-liqd.mjs. Usage:  node capture/selftest-capture-mines-v3.mjs [outDir]
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createMock } from './selftest-mock-liqd.mjs';
import { makeApi, runCapture, secretNeedles, AUDIT_SEED_RE, commitHash } from './liqd-capture-core.mjs';
import { buildPlan, probePlan, makeGame, minesFor, multExact, shuffledTiles, DEPTHS, EPOCH } from './capture-mines-v3.mjs';

const OUT = process.argv[2] || mkdtempSync(join(tmpdir(), 'mines-selftest-'));
const COOKIE = 'CF_Authorization=abcDEF1234567890ghijklmnop; AccessToken=zyxwVUT9876543210qponml';
const needles = secretNeedles(COOKIE);
let passed = 0; const t = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };
const mk = (faults = {}, perStepMultiplier = true) => { const m = createMock({ minesFor, minesMult: multExact, perStepMultiplier, faults }); return { m, api: makeApi({ transport: m.transport, base: 'https://mock.invalid/api/v1' }) }; };
const lines = []; const log = (l) => lines.push(l);
const run = (api, plan, runName, extra = {}) => runCapture({ api, game: makeGame({ stepDelayMs: 0 }), plan, meta: { test: runName }, outDir: OUT, runName, needles, log, rotateDelayMs: 0, ...extra });
const allText = (prefix) => readdirSync(OUT).filter((f) => f.startsWith(prefix)).map((f) => readFileSync(join(OUT, f), 'utf8')).join('\n');
console.log(`mines capture v3 self-test (out: ${OUT})`);

await t('plan: 5 mine counts x 4 depths x 50 = 1,000 rounds, 20 epochs of exactly 50, every config exactly 50', () => {
  const plan = buildPlan(); const c = {};
  for (const b of plan.flatMap((e) => e.bets)) c[`${b.mineCount}/${b.depth}`] = (c[`${b.mineCount}/${b.depth}`] ?? 0) + 1;
  assert.equal(plan.length, 20); assert.ok(plan.every((e) => e.bets.length === EPOCH && e.phase === 'E'));
  assert.equal(Object.keys(c).length, 20); assert.ok(Object.values(c).every((n) => n === 50));
  assert.deepEqual(Object.keys(DEPTHS).map(Number), [1, 3, 5, 8, 12]);
});

await t('tile order: CSPRNG permutation of 1..25; 2,000 first picks cover all 25 tiles', () => {
  const firsts = new Set();
  for (let i = 0; i < 2000; i++) { const o = shuffledTiles(); assert.deepEqual([...o].sort((a, b) => a - b), Array.from({ length: 25 }, (_, k) => k + 1)); firsts.add(o[0]); }
  assert.equal(firsts.size, 25);
});

await t('layout adapter: recomputes every round of the audited dataset (data/mines-master-6900bets.json)', () => {
  const d = JSON.parse(readFileSync(new URL('../data/mines-master-6900bets.json', import.meta.url), 'utf8'));
  const seeds = new Map(d.seeds.map((s) => [s.hashedServerSeed, s.serverSeed]));
  let n = 0; for (const b of d.bets) { assert.deepEqual(minesFor(seeds.get(b.hashedServerSeed), b.clientSeed, b.nonce, b.mineCount), b.mineTiles); n++; }
  assert.equal(n, 6900);
});

await t('probe (per-step multiplier served): anchor + 2 interactive rounds + rotation; steps recorded; secrets scrubbed', async () => {
  const { api } = mk({ plantSecrets: true });
  const { ds } = await run(api, probePlan(), 'probe-ok');
  assert.equal(ds.bets.length, 2); assert.equal(ds.meta.preCapture.commitVerified, true); assert.equal(ds.meta.preCapture.anchorLinkOk, true);
  assert.equal(ds.seeds[0].commitVerified, true); assert.equal(ds.seeds[0].chainLinkOk, true); assert.equal(ds.seeds[0].nonceEnd, 1);
  for (const b of ds.bets) { assert.ok(b.steps.length >= 1 && b.openOrder.length === 3); for (const k of ['mineCount', 'reveals', 'openOrder', 'steps', 'mineTiles', 'nonce', 'clientSeed', 'multiplier', 'result', 'hashedServerSeed']) assert.ok(k in b, k); }
  const txt = allText('probe-ok'); assert.ok(!txt.includes('someone@example.com') && !/eyJ[A-Za-z0-9_-]{8,}\./.test(txt)); for (const n of needles) assert.ok(!txt.includes(n));
});

await t('mini run (2 epochs) with lost place-bet / open-tile responses and a 429: nonces contiguous, layouts, reveal status and every served rung recompute', async () => {
  const plan = buildPlan().slice(0, 2);
  const { api } = mk({ dropAfterAct: [3, 9, 40], rate429: [25] });
  const { ds } = await run(api, plan, 'mini');
  assert.equal(ds.bets.length, 100); assert.equal(ds.seeds.length, 2);
  for (const [E, sd] of ds.seeds.entries()) {
    assert.equal(sd.commitVerified, true); assert.equal(sd.chainLinkOk, true); assert.equal(sd.nonceEnd, 49); assert.match(sd.clientSeed, AUDIT_SEED_RE);
    assert.equal(sd.clientSeedDrawnAfterCommitment, E === 0 ? ds.meta.preCapture.nextHashedServerSeed : ds.seeds[E - 1].nextHashedServerSeed);
    assert.equal(commitHash(sd.serverSeed), sd.hashedServerSeed);
    const bs = ds.bets.filter((b) => b.epoch === E); bs.forEach((b, i) => assert.equal(b.nonce, i));
    let rungs = 0;
    for (const b of bs) {
      const layout = minesFor(sd.serverSeed, b.clientSeed, b.nonce, b.mineCount);
      if (b.mineTiles === null) assert.ok(b.notes.length > 0, 'a round without a settle must carry a note'); else assert.deepEqual(b.mineTiles, layout);
      for (const s of b.steps) { assert.equal(s.mineTile, layout.includes(s.tile)); if (!s.mineTile) { rungs++; assert.ok(Math.abs(s.servedMultiplier - multExact(b.mineCount, s.depth)) <= 0.01); } }
    }
    assert.ok(rungs > 0);
  }
  assert.ok(ds.bets.some((b) => b.notes.length), 'the lost open-tile response was not noted');
  assert.ok(lines.some((l) => /per-step multipliers served \d+/.test(l)));
});

await t('probe WITHOUT per-step multipliers: the run still records, and every safe step has servedMultiplier null', async () => {
  const { api } = mk({}, false);
  const { ds } = await run(api, probePlan(), 'probe-nomult');
  assert.ok(ds.bets.flatMap((b) => b.steps).every((s) => s.servedMultiplier === null || s.mineTile));
});

await t('resume: cookie expires mid-round → AUTH stop; --resume cashes the open round out, records it, and finishes', async () => {
  const plan = buildPlan().slice(0, 2);
  const { api, m } = mk({ authAt: 60 });
  await assert.rejects(run(api, plan, 'resume'), (e) => e.kind === 'AUTH');
  const inProg = !!m.st.mine;
  m.faults.authAt = null;
  const jf = join(OUT, readdirSync(OUT).find((f) => f.startsWith('resume-') && f.endsWith('.journal.ndjson')));
  const r = await run(api, plan, 'resume', { resumeFile: jf });
  assert.equal(r.finished, true); assert.equal(r.ds.seeds.length, 2);
  const e0 = r.ds.bets.filter((b) => b.epoch === 0);
  assert.equal(e0.length + r.ds.meta.captureGaps.filter((g) => g.epoch === 0).length, 50);
  assert.ok(r.ds.seeds.every((s) => s.commitVerified && s.chainLinkOk));
  if (inProg) assert.ok(r.ds.bets.some((b) => b.recovered));
});

console.log(`SELF-TEST PASS — ${passed}/7 checks (mines capture v3, offline mock)`);
