// docs/ALGORITHM.md §7: the specification and its nearest candidates, run on every production round. Node crypto only;
// imports nothing from this package. Usage: node scripts/spec-check.mjs
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
const ROOT = process.argv[2] ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const d = JSON.parse(readFileSync(ROOT + '/data/mines-prod-full-6574bets.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const seeds = d.seeds, bets = d.bets;
const anchors = d.meta.captures.map((c) => c.preCapture);
const revealed = new Set([...seeds.map((s) => s.serverSeed), ...anchors.map((a) => a.revealedServerSeed)]);
const commits = new Set(bets.map((b) => b.hashedServerSeed));
const byAscii = new Map([...revealed].map((s) => [sha(Buffer.from(s, 'utf8')), s]));
const byBytes = new Map([...revealed].map((s) => [sha(Buffer.from(s, 'hex')), s]));
console.log(`revealed seeds ${revealed.size} distinct (36 epoch seeds + 3 pre-capture); distinct bet commitments ${commits.size}`);
console.log(`commitment SHA256(ascii 32-char seed) resolves ${[...commits].filter((c) => byAscii.has(c)).length} / ${commits.size} commitments, ${bets.filter((b) => byAscii.has(b.hashedServerSeed)).length} / ${bets.length} bets`);
console.log(`commitment SHA256(hex-decoded 16 bytes) resolves ${[...commits].filter((c) => byBytes.has(c)).length} / ${commits.size}`);
console.log(`all revealed seeds are 32 lowercase hex characters: ${[...revealed].filter((s) => /^[0-9a-f]{32}$/.test(s)).length} / ${revealed.size}`);
let rej = 0, draws = 0;
function layout(seed, client, nonce, m, v = {}) {
  const key = v.asciiKey ? Buffer.from(seed, 'utf8') : Buffer.from(seed, 'hex');
  const a = Array.from({ length: 25 }, (_, t) => t + 1);
  for (let i = 0; i < m; i++) {
    const cur = v.cursor === 'i+1' ? i + 1 : v.cursor === '24-i' ? 24 - i : i;
    const msg = v.msg === 'c:n-i' ? `${client}:${nonce}-${cur}` : `${client}:${nonce}:${cur}`;
    const dg = createHmac('sha256', key).update(msg, 'utf8').digest();
    const r = 25 - i; let x = null;
    const LIMIT = Math.floor(2 ** 32 / r) * r;
    for (let o = 0; o < 32; o += 4) { const u = v.le ? dg.readUInt32LE(o) : dg.readUInt32BE(o); if (v.plain || u < LIMIT) { x = u % r; break; } if (v.count) rej++; }
    if (v.count) draws++;
    const j = i + x; [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, m);
}
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const setEq = (a, b) => eq([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));
for (const [name, v] of [['spec (hex key, c:n:i, u32BE, rejection, forward FY, first m)', { count: true }], ['same, plain v mod r', { plain: true }], ['ascii key', { asciiKey: true }], ['cursor i+1', { cursor: 'i+1' }], ['cursor 24-i', { cursor: '24-i' }], ['message c:n-i', { msg: 'c:n-i' }], ['u32 little-endian', { le: true }]]) {
  let s = 0, o = 0;
  for (const b of bets) { const L = layout(byAscii.get(b.hashedServerSeed), b.clientSeed, b.nonce, b.mineCount, v); if (setEq(L, b.mineTiles)) s++; if (eq(L, b.mineTiles)) o++; }
  console.log(`${name}: as set ${s}/${bets.length}, in served order ${o}/${bets.length}`);
}
console.log(`rejection census over the draws that place a mine: ${rej} rejected chunks in ${draws} draws`);
// forward chain and nonces
let links = 0, linkN = 0; for (let i = 0; i + 1 < seeds.length; i++) if (seeds[i].capture === seeds[i + 1].capture) { linkN++; if (seeds[i].nextHashedServerSeed === seeds[i + 1].hashedServerSeed) links++; }
console.log(`next hash == active hash after ${links} / ${linkN} rotations between epochs of the same capture; pre-capture link ${d.meta.captures.filter((c) => c.preCapture.nextHashedServerSeed === seeds[c.epochs.first].hashedServerSeed).length} / ${d.meta.captures.length}`);
const sizes = {}; let nonceOk = 0, oneSeed = 0;
for (const s of seeds) { const e = bets.filter((b) => b.epoch === s.epoch); sizes[e.length] = (sizes[e.length] ?? 0) + 1; if (e.every((b, i) => b.nonce === i)) nonceOk++; if (new Set(e.map((b) => b.clientSeed)).size === 1) oneSeed++; }
console.log(`nonces exactly 0…size−1 in ${nonceOk} / ${seeds.length} epochs (sizes ${JSON.stringify(sizes)}); one client seed per epoch ${oneSeed} / ${seeds.length}`);
console.log(`client seeds: audit+12hex on ${bets.filter((b) => /^audit[0-9a-f]{12}$/.test(b.clientSeed)).length} rounds (${b17(bets)} chars), player-set on ${bets.filter((b) => /^pfaudit-prod-mines-d[1-5]-[0-9a-f]{12}$/.test(b.clientSeed)).length} rounds (${[...new Set(bets.filter((b) => b.phaseId === 'D').map((b) => b.clientSeed.length))]} chars)`);
function b17(bs) { return [...new Set(bs.filter((b) => b.phaseId !== 'D').map((b) => b.clientSeed.length))].join(','); }
console.log(`mine counts played: ${new Set(bets.map((b) => b.mineCount)).size}; tile range over opened and mine tiles: ${Math.min(...bets.flatMap((b) => [...b.openTiles, ...b.mineTiles]))}…${Math.max(...bets.flatMap((b) => [...b.openTiles, ...b.mineTiles]))}`);
// outcomes and payouts
const binom = (n, k) => { let r = 1n; for (let i = 0n; i < BigInt(k); i++) r = (r * (BigInt(n) - i)) / (i + 1n); return r; };
let outcome = 0, wins = 0, depthOk = 0, mFloor = 0, mHalf = 0, bFloor2 = 0, bHalf2 = 0, bDisp = 0, bustLast = 0, losses = 0, loss0 = 0, lossNoMult = 0;
for (const b of bets) {
  const set = new Set(b.mineTiles), hit = b.openTiles.findIndex((t) => set.has(t));
  if ((hit < 0) === (b.result === 'won')) outcome++;
  const m = b.mineCount, k = b.openTiles.length;
  if (b.result === 'won') {
    wins++; if (k === b.reveals) depthOk++;
    const num = 99n * binom(25, k), den = 100n * binom(25 - m, k);
    const f2 = Number((num * 100n) / den) / 100, h2 = Number((num * 200n + den) / (2n * den)) / 100;
    if (b.multiplier === f2) mFloor++; if (b.multiplier === h2) mHalf++;
    const st = BigInt(Math.round(b.betAmount * 100)), got = BigInt(Math.round(b.winningAmount * 100));
    if (got === (st * num) / den) bFloor2++; if (got === (st * num * 2n + den) / (2n * den)) bHalf2++;
    if (got === (st * ((num * 100n) / den)) / 100n) bDisp++;
  } else { losses++; if (hit === k - 1) bustLast++; if (b.winningAmount === 0) loss0++; if (b.multiplier === undefined) lossNoMult++; }
}
console.log(`outcome match: ${outcome} / ${bets.length}; wins ${wins}; win depth == planned reveals ${depthOk}`);
console.log(`multiplier == floor2(0.99*fair): ${mFloor}; == half_up2: ${mHalf}`);
console.log(`booked winningAmount == floor2(amount*0.99*fair): ${bFloor2}; == half_up2: ${bHalf2}; == floor2(amount*floor2 multiplier): ${bDisp}`);
console.log(`losses ${losses}: bust ends on first mine (mine is last opened) ${bustLast}; loss books 0: ${loss0}; multiplier absent on a loss: ${lossNoMult}`);
// wallet + reveal flags from the raw captures
let wwins = 0, wRule = 0, wExact = 0, wDisp = 0, steps = 0, stepOk = 0, auto = 0; const stakes = new Set(); const rates = {};
const u8 = (s) => { const [i, f = ''] = String(s).split('.'); return BigInt(i) * 100000000n + BigInt(f.padEnd(8, '0').slice(0, 8)); };
for (const c of d.meta.captures) for (const l of readFileSync(ROOT + '/data/' + c.file, 'utf8').split('\n')) {
  if (!l.includes('"t":"bet"')) continue; const e = JSON.parse(l); if (e.t !== 'bet') continue; const r = e.rec, s = r.settleRaw;
  rates[`${c.capture}:${s.fiatCurrency}:${r.placeRaw.exchangeRate}`] = (rates[`${c.capture}:${s.fiatCurrency}:${r.placeRaw.exchangeRate}`] ?? 0) + 1;
  const set = new Set(s.mineTiles);
  for (const st of r.steps) { steps++; if (st.autoFinish ? !set.has(st.tile) : st.mineTile === set.has(st.tile)) stepOk++; if (st.autoFinish) auto++; }
  if (s.result !== 'won') continue;
  wwins++; const m = s.mineCount, k = s.openTiles.length, num = 99n * binom(25, k), den = 100n * binom(25 - m, k), ws = u8(r.placeRaw.betAmountWallet), wc = u8(s.winningAmountWallet);
  stakes.add(r.placeRaw.betAmountWallet);
  if (wc === (ws * ((100000000n * num) / den)) / 100000000n) wRule++; if (wc === (ws * num) / den) wExact++; if (wc === (ws * ((100n * num) / den)) / 100n) wDisp++;
}
console.log(`wallet field on ${wwins} wins: == floor8(stake*floor8(0.99*fair)) ${wRule}; == floor8(stake*0.99*fair) ${wExact}; == floor8(stake*floor2 multiplier) ${wDisp}; distinct wallet stakes ${stakes.size}`);
console.log(`reveal replies: ${steps}; flag (or, on a self-settled reply, safe tile) agrees with the layout ${stepOk}; self-settled ${auto}`);
console.log(`served exchangeRate by capture:fiat:rate ${JSON.stringify(rates)}`);
