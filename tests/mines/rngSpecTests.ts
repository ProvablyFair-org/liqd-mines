/**
 * Spec self-test: docs/ALGORITHM.md vectors (V1-V6) and properties, run against src/rng.ts.
 *
 * Written by the clean-room implementer together with src/rng.ts, from docs/ALGORITHM.md and the
 * module interface alone (never from LIQD's code). Integrated 20 Oct 2026: the checks are unchanged;
 * only the import path, the mocha wrapper and the reporting (failures collected instead of printed)
 * were adapted.
 */
import * as assert from 'assert';
// Self-test for rng.ts against the worked vectors in ALGORITHM.md §5, plus properties.
// Payout is not part of rng.ts; the vector payout lines are checked here with
// local helpers that follow §3.2–§3.5.

import { createHmac } from 'crypto';
import {
  GRID,
  commitHash,
  sha256Buffer,
  getProvablyFairHmacSalt,
  maxFairFor,
  generateProvablyFairNumber,
  revealMines,
  firstMineTile,
  moduloRejectionCensus,
  expectedModuloRejections,
  sameMines,
} from '../../src/rng';

const EXPECTED_CHECKS = 98;

function runSelftest(): { pass: number; total: number; failed: string[] } {
  let pass = 0;
  const failed: string[] = [];
  let total = 0;
  function check(name: string, ok: boolean, detail = ''): void {
    total++;
    if (ok) pass++;
    if (!ok) failed.push(`${name}${detail ? ` (${detail})` : ''}`);
  }
  function throws(fn: () => unknown): boolean {
    try { fn(); return false; } catch { return true; }
  }

  // ---------- local payout helpers (§3) ----------
  // Exact rationals with BigInt: {n, d}.
  type Q = { n: bigint; d: bigint };
  function gcd(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; while (b) { [a, b] = [b, a % b]; } return a; }
  function q(n: bigint, d: bigint): Q { const g = gcd(n, d); return { n: n / g, d: d / g }; }
  function mul(a: Q, b: Q): Q { return q(a.n * b.n, a.d * b.d); }
  function decimalQ(s: string): Q {
    const [i, f = ''] = s.split('.');
    return q(BigInt((i ?? '0') + f), 10n ** BigInt(f.length));
  }
  function fairQ(m: number, k: number): Q {
    let r: Q = { n: 1n, d: 1n };
    for (let t = 0; t < k; t++) r = mul(r, q(BigInt(25 - t), BigInt(25 - m - t)));
    return r;
  }
  const EDGE_KEEP: Q = q(99n, 100n);
  function edgedQ(m: number, k: number): Q { return mul(EDGE_KEEP, fairQ(m, k)); }
  // floor(x * 10^dp) as integer (x >= 0)
  function floorScaled(x: Q, dp: number): bigint { return (x.n * 10n ** BigInt(dp)) / x.d; }
  function scaledOfDecimal(s: string, dp: number): bigint { return floorScaled(decimalQ(s), dp); }

  // ---------- vectors §5 ----------
  type Vec = {
    id: string; seed: string; commit: string; client: string; nonce: number; m: number; amount: string;
    hmac0: string; u32: number; off0: number; offsets?: number[]; mines: number[]; opened: number[];
    win: boolean; edged?: Q; fair?: Q; mult?: string; won: string;
  };
  const V: Vec[] = [
    { id: 'V1', seed: 'd1148d001c0ce343dcd526a17ab07de0', commit: '7ec1c4082572c9024863cfd98d32626586094f8308bd73b90965d10bed5796e3',
      client: 'auditddad46097947', nonce: 0, m: 1, amount: '0.1',
      hmac0: 'd6a9b79cade413b0e5bba6627d488435fb546b080db3ba334a1c2da737b404e9', u32: 3601446812, off0: 12,
      mines: [13], opened: [2], win: true, edged: q(33n, 32n), mult: '1.03', won: '0.103125' },
    { id: 'V2', seed: '72209686500593d7ff971a3848ff17b2', commit: '88244482041d4da91e1121ef8c106fc2a01affca138458535578e1301361f152',
      client: 'audit36a14db8902c', nonce: 4, m: 24, amount: '0.1',
      hmac0: 'db7b9d15550ee2dd28f85bcd0744f49be501e13413af528298f95ddc3a849c96', u32: 3682311445, off0: 20,
      offsets: [20, 9, 11, 12, 17, 12, 6, 3, 2, 1, 3, 13, 9, 9, 9, 1, 0, 6, 3, 0, 1, 3, 0, 1],
      mines: [21, 11, 14, 16, 22, 18, 13, 2, 8, 9, 3, 25, 5, 23, 24, 17, 4, 15, 7, 20, 19, 12, 10, 1],
      opened: [6], win: true, edged: q(99n, 4n), mult: '24.75', won: '2.475' },
    { id: 'V3', seed: 'aa25dc6c599ec12f86008226ed60cb11', commit: '66c283a045f5fa95fe2f4a8102d8f59877c067aef045be210e9d59596b1bbd22',
      client: 'audit7a476e8c79bf', nonce: 0, m: 3, amount: '10',
      hmac0: '70229348792baf639954ef3402f529e4c413f27aa8feaa58029353ba8d142f55', u32: 1881314120, off0: 20,
      offsets: [20, 16, 11], mines: [21, 18, 14], opened: [2], win: true, edged: q(9n, 8n), mult: '1.12', won: '11.25' },
    { id: 'V4', seed: 'cf5c6ca7bb3a767e9d9821c01a0c48cf', commit: 'df6cbf4cfe28cc8f2903c910b5bf134b6faca3690bdc850d4ecba0bf2b36f08d',
      client: 'auditc956a502047c', nonce: 39, m: 12, amount: '0.1',
      hmac0: 'ce7c610ded9d82fcb73b1abc2d91cf1a12a4545bc8c92d20bb24bc933d36274b', u32: 3464257805, off0: 5,
      offsets: [5, 0, 18, 16, 7, 1, 2, 9, 9, 5, 3, 9], mines: [6, 2, 21, 20, 12, 7, 9, 17, 18, 15, 14, 3],
      opened: [5, 4, 25, 19, 23], win: true, fair: q(1610n, 39n), edged: q(5313n, 130n), mult: '40.86', won: '4.08692307' },
    { id: 'V5', seed: '58e66c2fe517062b6e8a80cfe57024fc', commit: 'd5eec12147e265db7b3d971670e9327145e1b8bd24421dcabfdfadbd2fcb8aca',
      client: 'audit1ef7fc9bc054', nonce: 38, m: 12, amount: '0.10000000',
      hmac0: 'c9740228cfc293d33c3c9981d5a9d9730c7992928fae62352f6b343fb5491aa1', u32: 3379823144, off0: 19,
      offsets: [19, 8, 16, 18, 19, 19, 8, 2, 5, 14, 1, 8], mines: [20, 10, 19, 22, 24, 25, 15, 2, 14, 5, 12, 1],
      opened: [11, 23, 2], win: false, won: '0' },
  ];

  // §3.1: walk opened tiles; loss on the first mine (which must be the last opened).
  function settle(mines: number[], opened: number[]): { win: boolean; k: number; bustIsLast: boolean } {
    const set = new Set(mines);
    for (let t = 0; t < opened.length; t++) {
      if (set.has(opened[t] as number)) return { win: false, k: t, bustIsLast: t === opened.length - 1 };
    }
    return { win: opened.length >= 1, k: opened.length, bustIsLast: true };
  }

  for (const v of V) {
    const P = v.id;
    check(`${P} commitHash == commitment`, commitHash(v.seed) === v.commit);
    check(`${P} commitment != SHA-256(hex-decoded bytes)`, sha256Buffer(Buffer.from(v.seed, 'hex')) !== v.commit);
    const salt0 = getProvablyFairHmacSalt(v.client, v.nonce, 0);
    check(`${P} salt == "${v.client}:${v.nonce}:0"`, salt0 === `${v.client}:${v.nonce}:0`);
    const d0 = createHmac('sha256', Buffer.from(v.seed, 'hex')).update(salt0, 'utf8').digest();
    check(`${P} HMAC(c:n:0) digest`, d0.toString('hex') === v.hmac0);
    check(`${P} first u32 BE == ${v.u32}`, d0.readUInt32BE(0) === v.u32);
    check(`${P} draw(0,25) == ${v.off0}`, generateProvablyFairNumber(v.seed, v.client, v.nonce, 0, 25) === v.off0);
    if (v.offsets) {
      const got = v.offsets.map((_, i) => generateProvablyFairNumber(v.seed, v.client, v.nonce, i, 25 - i));
      check(`${P} offsets`, sameMines(got, v.offsets), got.join(' '));
    }
    const mines = revealMines(v.seed, v.client, v.nonce, v.m);
    check(`${P} revealMines in order`, sameMines(mines, v.mines), mines.join(' '));
    check(`${P} firstMineTile == mines[0]`, firstMineTile(v.seed, v.client, v.nonce) === v.mines[0]);
    const s = settle(mines, v.opened);
    check(`${P} outcome ${v.win ? 'win' : 'loss'}, k=${v.opened.length}`, s.win === v.win && (v.win ? s.k === v.opened.length : s.bustIsLast));
    if (v.win && v.edged && v.mult) {
      const e = edgedQ(v.m, s.k);
      if (v.fair) check(`${P} fair == ${v.fair.n}/${v.fair.d}`, fairQ(v.m, s.k).n === v.fair.n && fairQ(v.m, s.k).d === v.fair.d);
      check(`${P} edged == ${v.edged.n}/${v.edged.d}`, e.n === v.edged.n && e.d === v.edged.d);
      check(`${P} multiplier floor2 == ${v.mult}`, floorScaled(e, 2) === scaledOfDecimal(v.mult, 2));
      const won = floorScaled(mul(decimalQ(v.amount), e), 8);
      check(`${P} winningAmount floor8 == ${v.won}`, won === scaledOfDecimal(v.won, 8));
    } else {
      check(`${P} loss pays 0`, !s.win && v.won === '0');
    }
    const cen = moduloRejectionCensus(v.seed, v.client, v.nonce);
    check(`${P} census draws 25, rejections 0`, cen.draws === 25 && cen.rejections === 0);
  }

  // V6 (§3.5): same cell m=1, k=10, amount 0.1.
  {
    const sep = { seed: 'ba11c95fa563fc543b853e7d6b7aa4db', client: 'audit9c27195c9cc2', nonce: 2, mines: [4], opened: [5, 14, 3, 18, 1, 2, 24, 15, 8, 25] };
    const oct = { seed: '58e66c2fe517062b6e8a80cfe57024fc', client: 'audit1ef7fc9bc054', nonce: 2, mines: [8], opened: [23, 17, 16, 9, 12, 13, 6, 18, 4, 7] };
    const ms = revealMines(sep.seed, sep.client, sep.nonce, 1);
    const mo = revealMines(oct.seed, oct.client, oct.nonce, 1);
    check('V6 26Sep mines [4]', sameMines(ms, sep.mines), ms.join(' '));
    check('V6 3Oct mines [8]', sameMines(mo, oct.mines), mo.join(' '));
    check('V6 26Sep win k=10', settle(ms, sep.opened).win && settle(ms, sep.opened).k === 10);
    check('V6 3Oct win k=10', settle(mo, oct.opened).win && settle(mo, oct.opened).k === 10);
    const e = edgedQ(1, 10);
    check('V6 exact edged == 1.65', e.n === 33n && e.d === 20n);
    // double form (§3.5)
    let x = 1.0;
    for (let t = 0; t < 10; t++) x = x * ((25 - t) / (25 - 1 - t));
    const M = x * 0.99;
    check('V6 double M == 1.6499999999999997', M === 1.6499999999999997, String(M));
    check('V6 26Sep double multiplier 1.64', Math.floor(M * 100) / 100 === 1.64);
    check('V6 26Sep double winningAmount 0.16499999', Math.floor(0.1 * M * 1e8) / 1e8 === 0.16499999);
    check('V6 3Oct exact multiplier 1.65', floorScaled(e, 2) === 165n);
    check('V6 3Oct exact winningAmount 0.165', floorScaled(mul(decimalQ('0.1'), e), 8) === 16500000n);
  }

  // §3.2 page checks
  check('edged(1,1) == 1.03125', (() => { const e = edgedQ(1, 1); return e.n === 33n && e.d === 32n; })());
  check('edged(12,13) == 5148297', (() => { const e = edgedQ(12, 13); return e.n === 5148297n && e.d === 1n; })());

  // ---------- properties ----------
  check('GRID == 25', GRID === 25);
  check('maxFairFor(25) == floor(2^32/25)*25', maxFairFor(25) === 4294967275);
  check('maxFairFor(1) == 2^32', maxFairFor(1) === 4294967296);
  check('maxFairFor(power of two 2,4,8,16) == 2^32', [2, 4, 8, 16].every((r) => maxFairFor(r) === 4294967296));
  check('maxFairFor < 2^32 for the other 20 ranges 2..25',
    Array.from({ length: 24 }, (_, i) => i + 2).filter((r) => maxFairFor(r) < 4294967296).length === 20);
  check('maxFairFor(r) divisible by r, within r of 2^32',
    Array.from({ length: 25 }, (_, i) => i + 1).every((r) => maxFairFor(r) % r === 0 && 4294967296 - maxFairFor(r) < r));
  check('generateProvablyFairNumber throws on range 0', throws(() => generateProvablyFairNumber(V[0]!.seed, 'x', 0, 0, 0)));
  check('bad server seed hex throws', throws(() => revealMines('zz', 'x', 0, 1)));
  check('mineCount 0 and 25 throw', throws(() => revealMines(V[0]!.seed, 'x', 0, 0)) && throws(() => revealMines(V[0]!.seed, 'x', 0, 25)));

  // Random-seed properties (seeds derived deterministically).
  {
    let okRange = true, okPrefix = true, okFirst = true, okDraw = true, okCensus = true, totalRej = 0;
    const N = 200;
    for (let n = 0; n < N; n++) {
      const seed = createHmac('sha256', 'selftest').update(String(n)).digest('hex').slice(0, 32);
      const client = `st${n}`;
      const full = revealMines(seed, client, n, 24);
      if (new Set(full).size !== 24 || !full.every((t) => Number.isInteger(t) && t >= 1 && t <= 25)) okRange = false;
      for (let m = 1; m <= 24; m++) {
        const mm = revealMines(seed, client, n, m);
        if (mm.length !== m || !sameMines(mm, full.slice(0, m))) okPrefix = false;
        if (mm[0] !== firstMineTile(seed, client, n)) okFirst = false;
      }
      for (let r = 1; r <= 25; r++) {
        const d = generateProvablyFairNumber(seed, client, n, 25 - r, r);
        if (!(Number.isInteger(d) && d >= 0 && d < r)) okDraw = false;
      }
      const c = moduloRejectionCensus(seed, client, n);
      if (c.draws !== 25 || c.rejections < 0 || c.rejections > 25) okCensus = false;
      totalRej += c.rejections;
    }
    check(`revealMines(24) distinct tiles in 1..25 (${N} rounds)`, okRange);
    check(`revealMines(m) == first m of revealMines(24), all m (${N} rounds)`, okPrefix);
    check(`firstMineTile == revealMines[0] for every m (${N} rounds)`, okFirst);
    check(`draws in [0, r) for r = 1..25 (${N} rounds)`, okDraw);
    check(`census shape draws=25 (${N} rounds)`, okCensus, `rejections ${totalRej}`);
  }

  // Bias report consistency: independent sum of (2^32 mod r)/2^32.
  {
    let s = 0;
    for (let r = 1; r <= 25; r++) s += (4294967296 - maxFairFor(r)) / 4294967296;
    const per = expectedModuloRejections(1);
    check('expectedModuloRejections(1) == sum (2^32 - maxFairFor(r))/2^32', per === s, String(per));
    check('expectedModuloRejections(0) == 0', expectedModuloRejections(0) === 0);
    check('expectedModuloRejections linear (8900 == 8900*per round)', expectedModuloRejections(8900) === 8900 * per);
    check('expectedModuloRejections per draw <= 4.9e-9 bound times 25', per <= 25 * 4.9e-9 && per > 0);
  }

  return { pass, total, failed };
}

describe('LIQD Mines RNG, spec self-test (docs/ALGORITHM.md)', () => {
  it(`passes all ${EXPECTED_CHECKS} spec vector and property checks`, () => {
    const r = runSelftest();
    assert.deepStrictEqual(r.failed, []);
    assert.strictEqual(r.total, EXPECTED_CHECKS);
    assert.strictEqual(r.pass, EXPECTED_CHECKS);
  });
});
