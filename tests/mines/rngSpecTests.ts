/**
 * Spec self-test: docs/ALGORITHM.md vectors (V1-V5, production rounds) and properties, run against src/rng.ts.
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

const EXPECTED_CHECKS = 97;

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

  // ---------- vectors §5 (production rounds, liqd.com, 8–10 November 2026) ----------
  // amount / won: the booked fiat stake and win; wstake / wwon: the USDT wallet stake and wallet field.
  type Vec = {
    id: string; seed: string; commit: string; client: string; nonce: number; m: number; amount: string;
    hmac0: string; u32: number; off0: number; offsets?: number[]; mines: number[]; opened: number[];
    win: boolean; edged?: Q; fair?: Q; mult?: string; won: string; wstake: string; wwon?: string;
  };
  const V: Vec[] = [
    // V1: k09hZxP4ZhUYw3SuDhspz — capture 1, phase A, 1 mine, two tiles, 0.10 CAD
    { id: 'V1', seed: 'c5777675456c54fb9096287dfb1cd804', commit: '4378c7dcd852995859795f0bbc5a535c98bbb7fa2c97fc141aae5292811e4119',
      client: 'audit5065faa79b0b', nonce: 0, m: 1, amount: '0.1',
      hmac0: '561e4a30dea37fad39e8109c7d3fc7c34e94bb58f824845ac3b21f9a798dbd36', u32: 1444825648, off0: 23,
      mines: [24], opened: [2, 21], win: true, edged: q(99n, 92n), mult: '1.07', won: '0.10', wstake: '0.07085468', wwon: '0.07624579' },
    // V2: Z6B5Y_EKOsIi9rFGBZ8XX — capture 2, phase A+, 24 mines, the one safe tile: settled by LIQD itself, 0.10 USD
    { id: 'V2', seed: '00e770d6e05988f3ad2541120747356d', commit: '3d240b15cd531ef7e6b3d5b80382e6aaf3ed5fd6ab5b3c130a5ee114fb6992bd',
      client: 'audit85eaa242e54a', nonce: 37, m: 24, amount: '0.1',
      hmac0: '7f8acfbaafb92678d64a901c4ec8c2db497365c3df73df6df485bd8bede09d7c', u32: 2139803578, off0: 3,
      offsets: [3, 17, 11, 6, 0, 11, 7, 10, 8, 10, 0, 6, 0, 10, 7, 5, 7, 2, 3, 1, 0, 2, 2, 0],
      mines: [4, 19, 14, 10, 5, 17, 3, 18, 6, 20, 11, 8, 13, 24, 22, 21, 7, 1, 15, 16, 12, 9, 25, 2],
      opened: [23], win: true, edged: q(99n, 4n), mult: '24.75', won: '2.47', wstake: '0.10000000', wwon: '2.47500000' },
    // V3: 4QJN4i6P5Fxc_NB4gxkE4 — capture 3, phase C, 3 mines, one tile, 10.00 USD
    { id: 'V3', seed: '3cf098f6c5ba08f60eb228995ec061e6', commit: '0f2be4ce60e2cdf3309e0de3525a1a7a1a326f120568a6f756e0c0b07658778b',
      client: 'audit12902b0c80f4', nonce: 123, m: 3, amount: '10',
      hmac0: 'b54ee76c0d1dff48465551da5e900896cc42924a1107d59a50fc3c37584f7c7b', u32: 3041847148, off0: 23,
      offsets: [23, 5, 18], mines: [24, 7, 21], opened: [25], win: true, edged: q(9n, 8n), mult: '1.12', won: '11.25', wstake: '10.00000000', wwon: '11.25000000' },
    // V4: PQMz0IhGUim57nUHy0IwG — capture 1, phase A, 12 mines, five tiles, 0.10 CAD
    { id: 'V4', seed: 'c66188d98acb72928e588e353413e929', commit: '8b6cf0887521631e00ce27b8290712427f7cf2cdc2bdf9094569b424e384e4b1',
      client: 'audit1f90826fce1e', nonce: 139, m: 12, amount: '0.1',
      hmac0: '55c612cc7fe35fed2855d3146d8fec11aef37b10c0c3c4b72b5025f904c69d96', u32: 1439044300, off0: 0,
      offsets: [0, 5, 10, 2, 3, 11, 5, 5, 7, 5, 8, 5], mines: [1, 7, 13, 6, 8, 17, 12, 3, 16, 15, 19, 4],
      opened: [18, 9, 22, 24, 21], win: true, fair: q(1610n, 39n), edged: q(5313n, 130n), mult: '40.86', won: '4.08', wstake: '0.07088791', wwon: '2.89713435' },
    // V5: NkMq1Is_kkTu9ZYCiCXIV — capture 2, phase D (player-set client seed), 12 mines, bust on the third tile
    { id: 'V5', seed: 'dd0386a9ff7f578ad9369df19b6136ab', commit: '61669ff57a1550fe13e1066da7d7a0b194f8418a0ad31e15cb0692f753be8e12',
      client: 'pfaudit-prod-mines-d1-d55af3b7500b', nonce: 38, m: 12, amount: '0.1',
      hmac0: '0d0e0864868f13f14d76d255f201210296863dcdc6b9ebf9b204e9b7f33e986c', u32: 219023460, off0: 10,
      offsets: [10, 17, 9, 2, 7, 3, 5, 6, 7, 6, 14, 2], mines: [11, 19, 12, 6, 3, 9, 5, 14, 16, 4, 25, 8],
      opened: [10, 7, 12], win: false, won: '0', wstake: '0.10000000' },
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
      // §3.4 booked amount: floor to the cent of amount × edged, in the fiat the round was staked in.
      const booked = floorScaled(mul(decimalQ(v.amount), e), 2);
      check(`${P} booked winningAmount floor2 == ${v.won}`, booked === scaledOfDecimal(v.won, 2));
      // §3.5 wallet field: floor8(wallet stake × floor8(edged)).
      const mult8: Q = q(floorScaled(e, 8), 100000000n);
      const walletAmt = floorScaled(mul(decimalQ(v.wstake), mult8), 8);
      check(`${P} wallet field floor8(stake × floor8(edged)) == ${v.wwon}`, v.wwon !== undefined && walletAmt === scaledOfDecimal(v.wwon, 8));
    } else {
      check(`${P} loss pays 0`, !s.win && v.won === '0');
    }
    const cen = moduloRejectionCensus(v.seed, v.client, v.nonce);
    check(`${P} census draws 25, rejections 0`, cen.draws === 25 && cen.rejections === 0);
  }

  // §3.5: the wallet rule floors the multiplier first. Round r80BHxgDMcDuXkFpe-h40 (capture 1, epoch 0,
  // nonce 36, 12 mines, two tiles; wallet stake 0.07085468, wallet field 0.26979281) is one of the 62 wins
  // where that costs one 1e-8 unit against floor8(stake × edged) — never more, never the other way.
  {
    const e = edgedQ(12, 2);
    const rule = floorScaled(mul(decimalQ('0.07085468'), q(floorScaled(e, 8), 100000000n)), 8);
    const exact = floorScaled(mul(decimalQ('0.07085468'), e), 8);
    check('r80BHxgD wallet rule == served wallet field 0.26979281', rule === 26979281n, String(rule));
    check('r80BHxgD wallet rule is one 1e-8 unit below the exact product', exact - rule === 1n, `${exact} vs ${rule}`);
    const v4 = V[3]!;
    const e4 = edgedQ(v4.m, v4.opened.length);
    check('V4 wallet rule equals the exact product', floorScaled(mul(decimalQ(v4.wstake), q(floorScaled(e4, 8), 100000000n)), 8) === floorScaled(mul(decimalQ(v4.wstake), e4), 8));
    // §3.4: the booked cent floor against the wallet field at rate 1 (V2): 2.47 booked, 2.475 in the wallet field.
    check('V2 booked 2.47 is below the wallet field 2.475', scaledOfDecimal(V[1]!.won, 8) < scaledOfDecimal(V[1]!.wwon as string, 8));
    check('V3 booked 11.25 equals the wallet field 11.25', scaledOfDecimal(V[2]!.won, 8) === scaledOfDecimal(V[2]!.wwon as string, 8));
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
    check('expectedModuloRejections linear (6574 == 6574*per round)', expectedModuloRejections(6574) === 6574 * per);
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
