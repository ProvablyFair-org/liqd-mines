import { strict as assert } from 'node:assert';
import { balanceRound, betweenRoundChanges, units8 } from '../../src/balance-check';

// Step 23's per-round arithmetic (src/balance-check.ts), on records built in the shape of the balance-check
// capture. The amounts are those of the two settings played on 12 November 2026: a win at (1 mine, 2 tiles)
// on 0.10 books 0.10 and carries 0.10760869 in the wallet field; at (3 mines, 5 tiles) on 0.01 it books 0.01
// and carries 0.01997368.
function rec(o: { won: boolean; stake: number; booked: number; wallet?: string; before: string; after: string; afterAmounts?: string[] }) {
  return {
    phaseId: 'BC1', epoch: 0, betId: 'x', mineCount: 1, clientSeed: 'c',
    placeRaw: { betAmountWallet: o.stake.toFixed(8), fiatCurrency: 'USD', exchangeRate: '1.00000000' },
    settleRaw: {
      id: 'x', nonce: 0, mineCount: 1, openTiles: [1, 2], mineTiles: [3], result: o.won ? 'won' : 'lost',
      betAmount: o.stake, winningAmount: o.booked, fiatCurrency: 'USD', exchangeRate: '1.00000000',
      ...(o.wallet === undefined ? {} : { winningAmountWallet: o.wallet }),
    },
    balanceCheck: {
      before: { ok: true, amount: o.before, currency: 'USDT', field: 'user.wallets[0].amount' },
      after: { ok: true, amount: o.after, currency: 'USDT', field: 'user.wallets[0].amount', reads: 2, amounts: o.afterAmounts ?? [o.after, o.after] },
    },
  };
}

describe('balance check: which amount moved the balance (Step 23)', () => {
  it('a win that moved the balance by the wallet field is classed "wallet", not "booked"', () => {
    // 76.15870866 -> 76.16868234 is +0.00997368 = 0.01997368 - 0.01 (the first BC2 win of the capture)
    const r = balanceRound(rec({ won: true, stake: 0.01, booked: 0.01, wallet: '0.01997368', before: '76.15870866', after: '76.16868234' }));
    assert.equal(r.moved, 997368n);
    assert.equal(r.wallet, 997368n);
    assert.equal(r.booked, 0n);
    assert.equal(r.cls, 'wallet');
  });
  it('a win that moved the balance by the booked amount is classed "booked"', () => {
    const r = balanceRound(rec({ won: true, stake: 0.1, booked: 0.1, wallet: '0.10760869', before: '10.00000000', after: '10.00000000' }));
    assert.equal(r.cls, 'booked');
  });
  it('a win that moved the balance by neither amount is classed "neither"', () => {
    const r = balanceRound(rec({ won: true, stake: 0.1, booked: 0.1, wallet: '0.10760869', before: '10.00000000', after: '10.00760868' }));
    assert.equal(r.cls, 'neither');
  });
  it('a loss carries no wallet win: both predictions are -stake, and -stake is classed "both"', () => {
    const r = balanceRound(rec({ won: false, stake: 0.1, booked: 0, before: '76.40001320', after: '76.30001320' }));
    assert.equal(r.wallet, -10_000_000n);
    assert.equal(r.booked, -10_000_000n);
    assert.equal(r.cls, 'both');
    const s = balanceRound(rec({ won: false, stake: 0.1, booked: 0, before: '76.40001320', after: '76.40001320' }));
    assert.equal(s.cls, 'neither');
  });
  it('a change between rounds is found, and after-settle reads that do not agree are not "settled"', () => {
    const a = balanceRound(rec({ won: false, stake: 0.1, booked: 0, before: '1.00000000', after: '0.90000000' }));
    const b = balanceRound(rec({ won: false, stake: 0.1, booked: 0, before: '0.90000001', after: '0.80000001', afterAmounts: ['0.80000000', '0.80000001'] }));
    assert.deepEqual(betweenRoundChanges([a, b]), [{ index: 1, delta: 1n }]);
    assert.deepEqual(betweenRoundChanges([a, a]).length, 1);
    assert.equal(a.afterSettled, true);
    assert.equal(b.afterSettled, false);
    assert.equal(units8('0.123456789'), null);
  });
});
