import { strict as assert } from 'node:assert';
import { revealMines, commitHash, sameMines, firstMineTile } from '../../src/rng';
import { minesMultiplier, minesMultiplierExact } from '../../src/config';

// Real captured validation vectors, taken directly from the delivered dataset
// (data/mines-master-6900bets.json, SHA-256 c7c2e8a9…) and recomputed offline via src/rng.ts.
// Vector A — bet GbqOuPvhQekqcARNtHZ3_ (Phase A, mineCount 3).
const A_SERVER_SEED = '8b2fc7e909d2fff439692f648a9df0ba';
const A_CLIENT_SEED = 'audit59c2b0bf86aa';
// Vector B — bet j2ICJ7NM_TrD_UMtv6Av0 (Phase A, mineCount 24, full draw order).
const B_SERVER_SEED = '1973480c6bf1a4e3b62f7f8eb3f663d5';
const B_CLIENT_SEED = 'audite90633066c80';

describe('mines: real captured mine-layout reproduction', () => {
  it('bet GbqOuPvhQekqcARNtHZ3_ (serverSeed 8b2f…, nonce=25, mineCount=3) -> [6,20,7]', () => {
    const mines = revealMines(A_SERVER_SEED, A_CLIENT_SEED, 25, 3);
    assert.ok(sameMines(mines, [6, 20, 7]), `got ${JSON.stringify(mines)}`);
  });

  it('bet j2ICJ7NM_TrD_UMtv6Av0 (serverSeed 1973…, nonce=0, mineCount=24) -> full 24-tile draw order', () => {
    const mines = revealMines(B_SERVER_SEED, B_CLIENT_SEED, 0, 24);
    assert.ok(
      sameMines(mines, [23, 11, 2, 8, 20, 22, 16, 24, 12, 9, 5, 19, 1, 18, 15, 7, 21, 3, 6, 10, 17, 13, 25, 14]),
      `got ${JSON.stringify(mines)}`,
    );
  });
});

describe('mines: firstMineTile is revealMines()[0] — the one-HMAC fast path Step 17 re-derives with', () => {
  // Step 17 re-derives every Pass-2 chi² statistic from the dataset's revealed serverSeeds using
  // firstMineTile (one HMAC per round instead of 25). That shortcut is only legitimate if it is
  // EXACTLY the first element of the full shuffle — asserted here against both captured vectors
  // and across mineCounts, not left as a comment claiming it is obvious.
  it('agrees with revealMines()[0] for 200 nonce/mine-count pairs on vector A, cycling mine counts 1..24', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const m = (nonce % 24) + 1;
      const full = revealMines(A_SERVER_SEED, A_CLIENT_SEED, nonce, m);
      assert.equal(firstMineTile(A_SERVER_SEED, A_CLIENT_SEED, nonce), full[0],
        `nonce ${nonce}, mineCount ${m}`);
    }
  });
  it('agrees with revealMines()[0] over 200 nonces on vector B', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const full = revealMines(B_SERVER_SEED, B_CLIENT_SEED, nonce, 24);
      assert.equal(firstMineTile(B_SERVER_SEED, B_CLIENT_SEED, nonce), full[0], `nonce ${nonce}`);
    }
  });
});

describe('mines: commitment hash (SHA-256 of utf8 hex string)', () => {
  it('commitHash(8b2f…) -> 5d6c4f10… (SHA-256 of utf8 hex string)', () => {
    assert.equal(
      commitHash(A_SERVER_SEED),
      '5d6c4f105f182f9798063a4ca29d2c4ad2c575449bc5742a9680ec31bd9d79a0',
    );
  });
});

describe('mines: multiplier — exact payout vs floored display', () => {
  it('minesMultiplierExact(3, 1) === 1.125 (the amount credited)', () => {
    assert.ok(Math.abs(minesMultiplierExact(3, 1) - 1.125) < 1e-12);
  });
  it('minesMultiplier(3, 1) === 1.12 (floored display field, cosmetic)', () => {
    assert.equal(minesMultiplier(3, 1), 1.12);
  });
});
