import { strict as assert } from 'node:assert';
import { revealMines, commitHash, sameMines, firstMineTile, generateProvablyFairNumber } from '../../src/rng';
import { minesMultiplier, minesMultiplierExact } from '../../src/config';

// Real captured validation vectors, taken directly from the scored production dataset
// (data/mines-prod-full-6574bets.json) and recomputed offline via src/rng.ts.
// Vector A — bet WFQiZHXzP5KIiKp1mw5UO (capture 1, phase A, epoch 0, nonce 4, mineCount 3).
const A_SERVER_SEED = 'c5777675456c54fb9096287dfb1cd804';
const A_CLIENT_SEED = 'audit5065faa79b0b';
// Vector B — bet Z6B5Y_EKOsIi9rFGBZ8XX (capture 2, phase A+, epoch 30, nonce 37, mineCount 24, full
// draw order): the first round LIQD settled by itself on its last safe tile.
const B_SERVER_SEED = '00e770d6e05988f3ad2541120747356d';
const B_CLIENT_SEED = 'audit85eaa242e54a';

// The OPERATOR'S own validation vectors, from the byte-level RNG specification LIQD supplied
// privately for this audit (cited, not quoted, in src/rng.ts). Inputs and expected outputs are the
// operator's, not the auditor's: serverSeed a3f90b1c2d4e5f60718293a4b5c6d7e8, clientSeed
// `client-seed`. The Mines vector is the result of the operator's verify endpoint for nonce 7,
// mineCount 3, as the specification records it.
describe('rng: operator-supplied validation vectors', () => {
  const OP_SERVER_SEED = 'a3f90b1c2d4e5f60718293a4b5c6d7e8';
  const OP_CLIENT_SEED = 'client-seed';
  it('generateProvablyFairNumber(nonce 7, cursor 0, range 25) -> 2', () => {
    assert.equal(generateProvablyFairNumber(OP_SERVER_SEED, OP_CLIENT_SEED, 7, 0, 25), 2);
  });
  it('generateProvablyFairNumber(nonce 7, cursor 3, range 52) -> 49', () => {
    assert.equal(generateProvablyFairNumber(OP_SERVER_SEED, OP_CLIENT_SEED, 7, 3, 52), 49);
  });
  it('revealMines(nonce 7, mineCount 3) -> [3, 17, 16] (tiles numbered 1..25, draw order)', () => {
    const mines = revealMines(OP_SERVER_SEED, OP_CLIENT_SEED, 7, 3);
    assert.ok(sameMines(mines, [3, 17, 16]), `got ${JSON.stringify(mines)}`);
  });
});

describe('mines: real captured mine-layout reproduction', () => {
  it('bet WFQiZHXzP5KIiKp1mw5UO (serverSeed c577…, nonce=4, mineCount=3) -> [22,16,20]', () => {
    const mines = revealMines(A_SERVER_SEED, A_CLIENT_SEED, 4, 3);
    assert.ok(sameMines(mines, [22, 16, 20]), `got ${JSON.stringify(mines)}`);
  });

  it('bet Z6B5Y_EKOsIi9rFGBZ8XX (serverSeed 00e7…, nonce=37, mineCount=24) -> full 24-tile draw order, tile 23 the one safe tile', () => {
    const mines = revealMines(B_SERVER_SEED, B_CLIENT_SEED, 37, 24);
    assert.ok(
      sameMines(mines, [4, 19, 14, 10, 5, 17, 3, 18, 6, 20, 11, 8, 13, 24, 22, 21, 7, 1, 15, 16, 12, 9, 25, 2]),
      `got ${JSON.stringify(mines)}`,
    );
    assert.equal(mines.includes(23), false);
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
  it('commitHash(1725…) -> 9167d5e1…, the commitment of epoch 1 (SHA-256 of utf8 hex string)', () => {
    // Epoch 1 of capture 1: serverSeed 17259e56806ba7ed6ebe6e4ef03858be, committed as epoch 0's next hash.
    assert.equal(
      commitHash('17259e56806ba7ed6ebe6e4ef03858be'),
      '9167d5e1dfb29d6da7ba2d2d1d500f10a97b13836940451ab6abc2518b51957e',
    );
  });
});

describe('mines: multiplier — exact payout vs floored display', () => {
  it('minesMultiplierExact(3, 1) === 1.125 (phase C: 11.25 booked, and in the wallet field, on a 10.00 stake)', () => {
    assert.ok(Math.abs(minesMultiplierExact(3, 1) - 1.125) < 1e-12);
  });
  it('minesMultiplier(3, 1) === 1.12 (floored display field, cosmetic)', () => {
    assert.equal(minesMultiplier(3, 1), 1.12);
  });
});
