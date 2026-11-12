/**
 * Integrity pins — ONE definition, imported by every reader.
 *
 * The scored dataset is the load-bearing artifact of this audit: every scored step reads it, and
 * the simulation's Pass 2 reads its revealed casino seeds. Its SHA-256 is pinned so that ANY edit —
 * a flipped nibble in a serverSeed, a moved decimal in a winningAmount, a deleted bet — aborts the
 * run instead of being audited as if it were the capture.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  WHAT IS SCORED (v1.1.0): THREE PRODUCTION CAPTURES ON liqd.com, AND ONLY THEM
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 6,574 rounds played on liqd.com from one account, in three runs of the capture runner:
 *
 *   capture 1   8–9 Nov 2026   phase A    5,000 rounds  0.10 booked in CAD   25 epochs of 200
 *                              5 mine counts (1, 3, 5, 8, 12) × 4 depths × 250, multi-reveal
 *   capture 2   10 Nov 2026    phase D      500 rounds  0.10 booked in USD    5 epochs of 100
 *                              the 20 phase A settings under 5 player-set client seeds
 *                              phase A+     950 rounds  0.10 booked in USD    5 epochs of 190
 *                              the 19 mine counts phase A did not play × 50, single reveal
 *   capture 3   10 Nov 2026    phase C      124 rounds  10.00 booked in USD   1 epoch of 124
 *                              3 mines, single reveal
 *
 * Each capture is its own run: its own pre-capture anchor, its own commitment chain, its own raw
 * export (PROD_CAPTURES). The dataset numbers the epochs 0…35 across them (EPOCH_PLAN). There is
 * no separate multi-reveal phase: phase A is multi-reveal on every round, and phase D replays its
 * 20 settings.
 */

import { createHash } from 'crypto';

/** SHA-256 of data/mines-prod-full-6574bets.json, byte-for-byte as converted from the raw captures. */
export const EXPECTED_DATASET_HASH =
  '4d684d5e035e0be384685a2b44b9f5ab13b3f638e58686310cd778945c31741b';

/** Path of the pinned dataset, relative to the repo root. */
export const DATASET_RELATIVE_PATH = 'data/mines-prod-full-6574bets.json';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE AUDITED POPULATION — G-BIND. A ROW COUNT IS NOT AN IDENTITY.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * The SHA-256 above proves the dataset has not changed since WE pinned it. It does NOT prove the
 * file is the capture: shrink the data, doctor the header to agree, re-pin, and the repo is
 * internally consistent again on a smaller population than the one this report describes.
 *
 * These constants are the fix, and they are constants for a reason: they live in source, are
 * quoted in the report, and are asserted by Steps 1–5, 9, 11, 12 and 22. Changing one is a code
 * change with a diff, not a header edit inside an evidence file. They were set from the three
 * raw captures' plans and are checked against the bets; the dataset's own meta is cross-checked
 * against them, never used in their place.
 */

/** One block of consecutive epochs of one capture, played as one phase. */
export interface PhaseBlock {
  /** 1-based index into PROD_CAPTURES. */
  capture: number;
  /** The phase letter the runner recorded (the top-up rounds are phase A). */
  phase: string;
  /** The runner's phase id: A, A+ (the phase A top-up), C or D. */
  phaseId: string;
  /** Epochs in the block, and rounds per epoch (nonces 0 … size − 1 under one seed pair). */
  epochs: number;
  size: number;
  /** The stake of every round of the block, in the fiat the rounds were booked in. */
  stake: number;
  fiat: string;
}

/** The plan, in dataset order. Everything below about epochs and phases is derived from it. */
export const PHASE_BLOCKS: ReadonlyArray<PhaseBlock> = [
  { capture: 1, phase: 'A', phaseId: 'A', epochs: 25, size: 200, stake: 0.1, fiat: 'CAD' },
  { capture: 2, phase: 'D', phaseId: 'D', epochs: 5, size: 100, stake: 0.1, fiat: 'USD' },
  { capture: 2, phase: 'A', phaseId: 'A+', epochs: 5, size: 190, stake: 0.1, fiat: 'USD' },
  { capture: 3, phase: 'C', phaseId: 'C', epochs: 1, size: 124, stake: 10, fiat: 'USD' },
];

export interface EpochPlan extends Omit<PhaseBlock, 'epochs'> {
  /** The dataset's epoch number, 0 … EXPECTED_SEEDS − 1. */
  epoch: number;
  /** The epoch's number inside its own capture (each capture numbers from 0). */
  captureEpoch: number;
}

/** One entry per epoch, in dataset order. */
export const EPOCH_PLAN: ReadonlyArray<EpochPlan> = (() => {
  const out: EpochPlan[] = [];
  const perCapture = new Map<number, number>();
  for (const b of PHASE_BLOCKS) {
    for (let i = 0; i < b.epochs; i++) {
      const captureEpoch = perCapture.get(b.capture) ?? 0;
      perCapture.set(b.capture, captureEpoch + 1);
      out.push({ epoch: out.length, captureEpoch, capture: b.capture, phase: b.phase, phaseId: b.phaseId, size: b.size, stake: b.stake, fiat: b.fiat });
    }
  }
  return out;
})();

/** Bets in the scored dataset. Quoted throughout the report as "6,574 rounds". */
export const EXPECTED_BETS = 6574;

/** Seed epochs in the scored dataset. Quoted throughout as "36 epochs / 36 seeds". */
export const EXPECTED_SEEDS = 36;

/** Rounds per phase letter and per phase id. `EXPECTED_BETS` must be their sum — asserted in Step 11. */
export const EXPECTED_PHASE_BETS: Readonly<Record<string, number>> = { A: 5950, C: 124, D: 500 };
export const EXPECTED_PHASE_ID_BETS: Readonly<Record<string, number>> = { A: 5000, 'A+': 950, C: 124, D: 500 };

/** The distinct epoch sizes of the plan, ascending (100, 124, 190, 200). */
export const EPOCH_SIZES: ReadonlyArray<number> = [...new Set(PHASE_BLOCKS.map(b => b.size))].sort((a, z) => a - z);

/** The plan entry of a dataset epoch, or undefined when the epoch is not in the plan. */
export const epochPlan = (epoch: number): EpochPlan | undefined => EPOCH_PLAN[epoch];

/** Commitment links between successive epochs of the SAME capture (24 + 9 + 0). */
export const EXPECTED_CHAIN_LINKS = EPOCH_PLAN.filter((e, i) => i > 0 && EPOCH_PLAN[i - 1].capture === e.capture).length;

/**
 * THE SETTINGS PLAN, BOUND IN SOURCE (Steps 9, 15, 22).
 *   PROD_DEPTHS       mineCount → the depths played to before cash-out: 5 mine counts × 4 depths =
 *                     20 multi-reveal settings. Phase A: PROD_PER_SETTING (250) rounds each, round i of
 *                     the plan on setting i mod 20. Phase D: PHASE_D_PER_SETTING (25) each.
 *   TOPUP_MINE_COUNTS the 19 mine counts phase A did not play; phase A+ plays each
 *                     TOPUP_PER_MINE_COUNT (50) times, one tile opened.
 *   PHASE_C_SETTING   3 mines, one tile opened, PHASE_C_ROUNDS (124) rounds at the elevated stake.
 */
export const PROD_DEPTHS: Readonly<Record<number, readonly number[]>> =
  { 1: [2, 5, 10, 15], 3: [2, 4, 6, 8], 5: [2, 3, 5, 6], 8: [2, 3, 4, 5], 12: [2, 3, 4, 5] };
export const PROD_PER_SETTING = 250;
export const PHASE_D_PER_SETTING = 25;
export const TOPUP_MINE_COUNTS: ReadonlyArray<number> = [2, 4, 6, 7, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
export const TOPUP_PER_MINE_COUNT = 50;
export const PHASE_C_SETTING: Readonly<{ mineCount: number; depth: number }> = { mineCount: 3, depth: 1 };
export const PHASE_C_ROUNDS = 124;

/** The plan as `${phaseId}|${mineCount}:${depth}` → rounds. 20 + 20 + 19 + 1 = 60 entries. */
export const SETTINGS_PLAN: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [mc, ks] of Object.entries(PROD_DEPTHS)) for (const k of ks) {
    m.set(`A|${mc}:${k}`, PROD_PER_SETTING);
    m.set(`D|${mc}:${k}`, PHASE_D_PER_SETTING);
  }
  for (const mc of TOPUP_MINE_COUNTS) m.set(`A+|${mc}:1`, TOPUP_PER_MINE_COUNT);
  m.set(`C|${PHASE_C_SETTING.mineCount}:${PHASE_C_SETTING.depth}`, PHASE_C_ROUNDS);
  return m;
})();
/** Distinct (mineCount, depth) cells played in any phase: the 20 multi-reveal cells, 19 top-up cells and (3, 1). */
export const PLAYED_CELLS: ReadonlyArray<string> = [...new Set([...SETTINGS_PLAN.keys()].map(k => k.split('|')[1]))];

/**
 * THE STAKES, AS BOOKED. LIQD's fast-games place-bet takes `betAmount` in the account's display
 * fiat and records `betAmount` / `winningAmount` in it; the reply's wallet fields are in the
 * bet currency, USDT, as `betAmountWallet` / `winningAmountWallet` (in the raw captures only).
 * Capture 1 was booked in CAD (the account's display fiat on 8–9 November); the account's fiat
 * setting was changed to USD on 9 November and captures 2 and 3 were booked in USD. Nothing is
 * converted or relabelled: every amount is checked in the currency LIQD recorded it in. Step 18
 * binds every row to its phase's stake and fiat; the stake is not an input to revealMines.
 */
export const PROD_BASE_STAKE = 0.1;
export const PROD_ELEVATED_STAKE = 10;
export const PROD_WALLET_CURRENCY = 'USDT';
export const PROD_HOST = 'liqd.com';
/** Step 18: the least number of elevated-stake wins the stake-invariance arm requires (MINES-12). */
export const PHASE_C_MIN_WINS = 100;

/**
 * The first nonce of every epoch — a DECLARED constant, not the minimum observed and not the
 * `nonceStart` a seed record carries. LIQD resets the nonce to 0 on every server-seed rotation, and
 * the capture rotates before each epoch, so every epoch's window is NONCE_BASE … NONCE_BASE + size − 1
 * with `size` the epoch's entry in EPOCH_PLAN. Step 4 asserts the bets against THIS window and then
 * separately asserts that each seed record's own `nonceStart`/`nonceEnd` agree with it.
 */
export const NONCE_BASE = 0;

/**
 * Auditor-side capture-retry nonce gaps this dataset is DECLARED to contain. A retry leaves one nonce
 * unrecorded inside an otherwise complete window; it is disclosed as a capture-origin FLAG
 * (verdict-neutral). The three captures have none (the runner's record: 0 refusals, 0 lost replies, 0
 * gaps), so any gap at all is a different dataset from the one declared and hard-fails Step 4.
 */
export const EXPECTED_CAPTURE_RETRY_GAPS = 0;

/**
 * The Pass-2 early window (Step 17, src/simulate.ts): nonces 0 … PASS2_EARLY_WINDOW − 1, the first
 * 100 nonces of every seed — the longest prefix that all 36 epochs played in full (the shortest
 * epochs, phase D, played exactly 100). It must equal the smallest epoch size of the plan (asserted
 * in Step 17). The served-configuration test of Step 17 uses each epoch's own full length instead.
 */
export const PASS2_EARLY_WINDOW = 100;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE RAW PRODUCTION CAPTURES — vendored byte-identical, pinned, bound row by row (Step 22)
 * ══════════════════════════════════════════════════════════════════════════════════════
 * The files the runner exported from the logged-in liqd.com tab (src/prod-capture.ts describes their
 * events). The dataset was converted from them; Step 22 requires every scored
 * row to equal the settling reply recorded here, and reads from here what the Bet type has no field
 * for: the USDT wallet amounts, each round's planned tile order, the per-reveal replies and LIQD's
 * verifier replies. Lines, events by type and requests by name were measured on 10 November 2026.
 *
 * Capture 2 stopped once, at its round 538 (the first round LIQD settled by itself on its last safe
 * tile, a reply shape the runner build 4dbf8ae8f846 did not know), and was resumed on build
 * bfa80f1fc59d, which rebuilt that round's record from its stored place-bet and open-tile replies:
 * its `stop`, `resume-check` and `recovered` events are that. The file is the complete run.
 */
export interface CapturePin {
  capture: number;
  file: string;
  sha256: string;
  lines: number;
  /** Events by type tag. */
  events: Readonly<Record<string, number>>;
  /** Requests by name. */
  requests: Readonly<Record<string, number>>;
  rounds: number;
  wins: number;
  /** The fiat every round of the capture was booked in. */
  fiat: string;
  dates: string;
  /** The runner build that started the run (the capture's meta.script) and the one that exported it (its export note). */
  runnerBuild: string;
  exportBuild: string;
  /** Wallet totals in 1e-8 USDT units: Σ betAmountWallet, Σ winningAmountWallet. */
  walletStakedUnits: bigint;
  walletPaidUnits: bigint;
  /** Booked fiat totals in cents: Σ betAmount, Σ winningAmount. */
  bookedStakedCents: bigint;
  bookedPaidCents: bigint;
}
export const PROD_CAPTURES: ReadonlyArray<CapturePin> = [
  {
    capture: 1, file: 'data/liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson',
    sha256: 'f4a35b0635fd8a196d31ebccd64fa3b617ab127716def789a0f1529b9ffe7d60', lines: 38801,
    events: { meta: 1, pre: 1, rotate: 26, epoch: 25, intent: 5000, step: 23745, bet: 5000, 'bets-done': 1, verify: 5000, done: 1, 'export-note': 1 },
    requests: { 'place-bet': 5000, 'open-tile': 16766, 'cash-out': 1979 },
    rounds: 5000, wins: 1979, fiat: 'CAD', dates: '2026-11-08/09', runnerBuild: '218861d920b8', exportBuild: '218861d920b8',
    walletStakedUnits: 35452607511n, walletPaidUnits: 35395401893n, bookedStakedCents: 50000n, bookedPaidCents: 48762n,
  },
  {
    capture: 2, file: 'data/liqd-mines-prod-capture-2026-11-10T06-06-19-772Z.ndjson',
    sha256: '3b8f81d5de58ccbf60fc809a53a34174d2c088aa78aba67ab1a0742a6d866141', lines: 9038,
    events: { meta: 1, option: 1, pre: 1, rotate: 11, epoch: 10, intent: 1450, step: 4658, bet: 1450, stop: 1, 'resume-check': 1, recovered: 1, 'bets-done': 1, verify: 1450, done: 1, 'export-note': 1 },
    requests: { 'place-bet': 1450, 'open-tile': 2608, 'cash-out': 600 },
    rounds: 1450, wins: 603, fiat: 'USD', dates: '2026-11-10', runnerBuild: '4dbf8ae8f846', exportBuild: 'bfa80f1fc59d',
    walletStakedUnits: 14500000000n, walletPaidUnits: 14088221236n, bookedStakedCents: 14500n, bookedPaidCents: 13739n,
  },
  {
    capture: 3, file: 'data/liqd-mines-prod-capture-2026-11-10T10-27-49-259Z.ndjson',
    sha256: '795825a548d786946d8ab0d9331dcd80d86a59b5b73dcea197707482bf177376', lines: 738,
    events: { meta: 1, option: 1, pre: 1, rotate: 2, epoch: 1, intent: 124, step: 357, bet: 124, 'bets-done': 1, verify: 124, done: 1, 'export-note': 1 },
    requests: { 'place-bet': 124, 'open-tile': 124, 'cash-out': 109 },
    rounds: 124, wins: 109, fiat: 'USD', dates: '2026-11-10', runnerBuild: 'bfa80f1fc59d', exportBuild: 'bfa80f1fc59d',
    walletStakedUnits: 124000000000n, walletPaidUnits: 122625000000n, bookedStakedCents: 124000n, bookedPaidCents: 122625n,
  },
];
/** Totals over the three captures: 6,574 place-bet, 19,498 open-tile, 2,688 cash-out requests; 2,691 wins. */
export const PROD_REQUESTS: Readonly<Record<string, number>> = (() => {
  const t: Record<string, number> = {};
  for (const c of PROD_CAPTURES) for (const [k, n] of Object.entries(c.requests)) t[k] = (t[k] ?? 0) + n;
  return t;
})();
export const PROD_WINS = PROD_CAPTURES.reduce((a, c) => a + c.wins, 0);


/**
 * ROUNDS LIQD SETTLED BY ITSELF — DECLARED, asserted against the data by Step 22. When a round opens
 * its last safe tile, the open-tile reply IS the settled round (`autoFinish: true`, result won, the
 * multiplier and both amounts) and no cash-out request exists. Only a 24-mine board has one safe
 * tile after one reveal: the 3 wins of the 50 phase A+ rounds at 24 mines. They are also the only
 * open-tile replies that carry a multiplier (PROD_DECLARED_PER_STEP_MULTIPLIERS): a safe tile is
 * otherwise answered `{ mineTile: false }` and nothing else, and a mine reveal returns the settled
 * record, which carries no multiplier.
 */
export const PROD_AUTO_FINISH_ROUNDS: ReadonlyArray<string> = ['Z6B5Y_EKOsIi9rFGBZ8XX', '4FlJdIKXL00eGGkh2OQkS', 'I_uwyzpsU5tyFl4_rmzfZ'];
export const PROD_DECLARED_PER_STEP_MULTIPLIERS = 3;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  THE SETTLEMENT RULES — measured on the three captures, declared here, scored by Steps 8 and 22
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Let mult = (1 − edge) · C(25,k)/C(25−m,k), the exact rational multiplier (src/config.ts
 * minesMultiplierRational).
 *
 *   booked (fiat)     winningAmount       = floor2(betAmount × mult)                     Step 8, 0 tolerance
 *   displayed         multiplier          = floor2(mult)                                 Step 7
 *   wallet (USDT)     winningAmountWallet = floor8(betAmountWallet × floor8(mult))       Step 22
 *
 * Measured: the booked rule holds on 2,691 of 2,691 wins (1,979 CAD, 712 USD) and the wallet rule on
 * 2,691 of 2,691. TWO DISCLOSURES follow from the rules; both are bound to the data here and a count
 * that moves FAILs Step 22.
 *
 * (1) THE WALLET FLOORS THE MULTIPLIER FIRST. Against the exact product floor8(betAmountWallet × mult)
 *     the wallet field is one 1e-8 USDT unit lower on PROD_WALLET_BELOW_EXACT wins, all in capture 1, where
 *     the wallet stake is a non-round USDT amount (0.10 CAD at the served rate); never higher. On the
 *     USD captures the wallet stake is 0.10000000 or 10.00000000 and the two products are equal on
 *     every win.
 *
 * (2) THE BOOKED WIN IS FLOORED TO THE CENT; THE WALLET IS NOT. The fiat `winningAmount` LIQD books
 *     drops the fraction of a cent that the wallet field keeps. Per capture (BOOKED_BELOW_UNROUNDED):
 *     the wins whose booked amount is below floor8(betAmount × mult), and the sum dropped, in 1e-8
 *     units of the booked fiat.
 *       capture 1 (CAD, 0.10)   1,979 of 1,979 wins   11.56861635 CAD dropped from the booked figure
 *       capture 2 (USD, 0.10)     603 of   603 wins    3.49221236 USD
 *       capture 3 (USD, 10.00)      0 of   109 wins    0 (10.00 × 1.125 is a whole number of cents)
 *     On the USD captures the served rate is 1.00000000 and the wallet stake equals the fiat stake, so
 *     the sum dropped IS the amount by which the wallet fields exceed the booked wins: capture 2
 *     books 137.39 USD of wins against 140.88221236 USDT of wallet fields. On capture 1 the wallet fields are in
 *     USDT at the served CAD rate and the two totals are in different currencies; they are reported
 *     side by side and not converted. No balances were captured, so which amount moved the balance is not verified.
 */
export const PROD_WALLET_BELOW_EXACT = 62;
export const PROD_WALLET_BELOW_EXACT_TOTAL_UNITS = 62;
/** The 62, by cell `${mineCount}:${depth}` (all in capture 1). */
export const PROD_WALLET_BELOW_EXACT_CELLS: Readonly<Record<string, number>> = {
  '1:2': 3, '3:2': 18, '5:2': 2, '5:3': 1, '5:5': 10, '8:2': 12, '8:4': 5, '8:5': 1, '12:2': 5, '12:3': 4, '12:4': 1,
};
/** Disclosure (2), per capture: wins booked below the unrounded amount, and the total dropped in 1e-8 fiat units (floor). */
export const BOOKED_BELOW_UNROUNDED: ReadonlyArray<{ capture: number; wins: number; droppedUnits: bigint }> = [
  { capture: 1, wins: 1979, droppedUnits: 1156861635n },
  { capture: 2, wins: 603, droppedUnits: 349221236n },
  { capture: 3, wins: 0, droppedUnits: 0n },
];

/**
 * THE PRODUCTION BUILD'S OPERATOR SETTINGS — declared from the data, asserted by Step 22, read by
 * Step 10. A settling reply that is an open-tile reply carries `currentGameSettings` (every loss, and
 * the 3 rounds LIQD settled by itself); a cash-out reply carries none. The limits are stated in the
 * fiat the round was booked in: 7060 / 70600 and 7050 / 70500 in capture 1 (CAD), 5000 / 50000 in
 * captures 2 and 3 (USD); maxExposureUsdc 50000 and maxBetUsdc "5000.00000000" in all three. None
 * carries a maxOdds key. Step 22 FAILs unless the records are exactly these values with these counts.
 */
export const PROD_GAME_SETTINGS: ReadonlyArray<{ capture: number; records: number; value: string }> = [
  { capture: 1, records: 413, value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":7060,"maxExposure":70600,"maxExposureUsdc":50000,"maxBetUsdc":"5000.00000000","exposureSource":"game","maxBetSource":"game"}' },
  { capture: 1, records: 2608, value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":7050,"maxExposure":70500,"maxExposureUsdc":50000,"maxBetUsdc":"5000.00000000","exposureSource":"game","maxBetSource":"game"}' },
  { capture: 2, records: 850, value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":5000,"maxExposure":50000,"maxExposureUsdc":50000,"maxBetUsdc":"5000.00000000","exposureSource":"game","maxBetSource":"game"}' },
  { capture: 3, records: 15, value: '{"minOdds":1.01,"houseEdge":1,"minBet":0.01,"maxBet":5000,"maxExposure":50000,"maxExposureUsdc":50000,"maxBetUsdc":"5000.00000000","exposureSource":"game","maxBetSource":"game"}' },
];

/**
 * THE LEDGER DEBITS IN LIQD'S REPLIES — declared from the data, asserted by Step 22 (k). The settling
 * reply that is an open-tile reply (every loss, and the 3 rounds LIQD settled by itself) also carries
 * `betTransaction`, a ledger record of the stake debit; no place-bet, cash-out or safe open-tile reply
 * carries one. Measured on 11 November 2026 on the three captures: 3,886 records (capture 1 3,021,
 * capture 2 850, capture 3 15), each one per round on its settling reply; each `amount` equals the
 * round's stake in the booking fiat (`betAmount`: 0.1 CAD, 0.1 USD, 10 USD); each `currencyId` is the
 * round's own currencyId "3", the wallet's (the id the runner placed every bet under, meta.currencyId 3,
 * meta.stakeCurrency USDT); transactionType "bet", status "success", betId the round's id. On capture 1
 * the amount (0.1, under the wallet's currency id) is not the round's USDT stake (betAmountWallet about
 * 0.0709) on 3,021 of 3,021; on captures 2 and 3 the two are equal. The audit does not use these
 * records to infer a balance (MANIFEST DL-5). A count or a fact that moves FAILs Step 22.
 */
export const PROD_LEDGER_DEBITS: ReadonlyArray<{ capture: number; records: number; amountNotWalletStake: number }> = [
  { capture: 1, records: 3021, amountNotWalletStake: 3021 },
  { capture: 2, records: 850, amountNotWalletStake: 0 },
  { capture: 3, records: 15, amountNotWalletStake: 0 },
];
/** The currency id of the wallet the bets were placed under (every place-bet request and every reply: "3"). */
export const PROD_WALLET_CURRENCY_ID = '3';

/**
 * The on-grid test of Steps 8, 17 and 22: a served value × 10^digits must sit within this of an
 * integer — far tighter than one grid unit, loose enough for the binary64 representation of the
 * decimal literal.
 */
export const PROD_ON_GRID_TOLERANCE = 0.000001;

/**
 * THE CLIENT SEEDS. Phases A, A+ and C: "audit" + 12 hex digits from the browser CSPRNG, a fresh one
 * per epoch. Phase D: five PLAYER-SET seeds, "pfaudit-prod-mines-d<k>-" + 12 hex digits from the
 * browser CSPRNG (k = 1…5, one per epoch), written into the capture's meta before its anchor
 * rotation and submitted at the rotation that opens their epoch (Step 14).
 */
export const AUDIT_SEED_FORMAT = /^audit[0-9a-f]{12}$/;
export const PLAYER_SEED_FORMAT = /^pfaudit-prod-mines-d([1-5])-[0-9a-f]{12}$/;
export const PHASE_D_DISTINCT_SEEDS = 5;

/** The audit ID assigned to this package. Emitted into verification-results.json; MANIFEST.md must carry the same ID (checked by scripts/check-standalone.mjs). */
export const AUDIT_ID = 'PF-2026-LQ02';

/**
 * Scored steps a verify run must EXECUTE. A summary over a partial result set looks exactly like a
 * summary over a complete one, so tests/verify.ts compares the number of step results (and of distinct
 * step numbers) with this constant before it prints any verdict, and exits 1 without one when they
 * differ. Changing the suite's step count means changing this number, in a diff.
 */
export const EXPECTED_STEPS = 22;

/**
 * Unit specs `npm test` must report as PASSING. The zero-install runner (scripts/standalone-runtime.cjs)
 * counts the specs that actually ran to completion and exits 1 when the count differs, so a
 * silently skipped or cancelled describe block cannot leave `npm test` green. Changing the unit
 * suite means changing this number, in a diff.
 */
export const EXPECTED_UNIT_TESTS = 43;

/**
 * ARTIFACTS OF RECORD — every artifact the report quotes, SHA-256 pinned (MINES-27).
 *
 * Step 19 re-hashes each one; an edit or a deletion FAILS it. Each must also be un-ignored BY NAME
 * in .gitignore, carry no run metadata (src/domains.ts RUN_METADATA_KEY) and, when it is JSON, have a
 * declared value domain for every numeric leaf (src/domains.ts). The pin asserts the identity of the
 * committed evidence; reproduction across machines is compared field by field at the reproduction
 * tolerance (src/diff.ts), never by these bytes.
 *
 * NOTHING THE PACKAGE RUNS BY DEFAULT WRITES THESE FILES. `npm run verify` writes only outputs/run/;
 * `npm run simulate`, `npm run figures` and `npm run bootstrap-replay` write to outputs/run/ unless
 * a caller deliberately names outputs/ (OUT_DIR / --out), and `npm run deep-replay` writes only
 * where --out points. The one deliberate in-place path for the scored record is PF_EMIT=1, and every
 * such regeneration is re-pinned here in the same diff.
 *
 * v1.1.0 (10 November 2026), scored on the three production captures: simulation-results.json,
 *   simulation-provenance.json and bootstrap-nulls.float64le regenerated by
 *   `SIM_REPLAY=1 OUT_DIR=<scratch> npm run simulate` (Pass 1 replayed from its recorded seed pairs;
 *   Pass 2 over the 36 production seeds, early window 0..99) and copied in;
 *   bootstrap-replay-report.json re-run by scripts/replay-bootstrap.py; deep-replay-report.json
 *   reproduced; audit-figures.json by `OUT_DIR=outputs npm run figures`; verification-results.json
 *   re-emitted by PF_EMIT=1 to its fixed point.
 */
export const ARTIFACT_PINS: ReadonlyArray<{ file: string; sha256: string }> = [
  { file: 'outputs/simulation-results.json', sha256: '50bef42d729a973376dee69e274900a037d6baa1d4b17a600c144beb46b329e6' },
  { file: 'outputs/simulation-provenance.json', sha256: '036f4b3c0c4f9d241206bff2317a3d8632c3547844335653cdd89f9ed8532a86' },
  { file: 'outputs/bootstrap-nulls.float64le', sha256: 'c8a946c806faa4e8896d68a70f66c6f20fa282571cfc4e14ef29fd29dae160a0' },
  { file: 'outputs/rtp-convergence.html', sha256: 'ad969c106e979f3f0eabcea69b5d2d881eb4a44be248e670a215e6a561989d2d' },
  { file: 'outputs/deep-replay-report.json', sha256: '6de3935092af3db155c9e608f7f5993b68b31ac25364ad24ac0c0ce021c8d6bc' },
  { file: 'outputs/bootstrap-replay-report.json', sha256: '2064e369b17b74d7798dfa5440cbc8f4a71427cb49212fbd270e4aedb3c68d4e' },
  { file: 'outputs/audit-figures.json', sha256: '5319211bcaf7011b2c88f8e264705ba583cfc2a7e8c68a634a436c187d3d6d9e' },
  { file: 'outputs/verification-results.json', sha256: 'e1142b07f920b2702a46d9b5e240cdcfc829bc77d9946f879632deb240cbfb33' },
];

/**
 * PLAYER-VERIFIER PARITY (MINES-24). The Mines verifier a player uses on the ProvablyFair.org
 * site is the VerifyBets component: `games/mines/derive.js` plus the one library file it
 * imports, `lib/hmac-sha256.js` (both under src/components/VerifyBets/ in the site repository).
 * Those exact bytes are vendored in verifier-parity/ at the same relative paths, and these are
 * their SHA-256 digests. Step 5 hashes the vendored copies against these pins and then runs the
 * vendored derive.js on every captured round, requiring the same draw-order layout as
 * src/rng.ts revealMines; a hash mismatch or a layout mismatch FAILs it.
 * `scripts/check-site-verifier.mjs <path-to-site-derive.js>` compares a live site checkout
 * against the same pins (exit 1 on mismatch). A change to the site file is a re-pin here, in a
 * diff, together with a fresh vendored copy — never an edit to the vendored bytes.
 */
export const SITE_VERIFIER_PINS: ReadonlyArray<{ file: string; sitePath: string; sha256: string }> = [
  { file: 'games/mines/derive.js', sitePath: 'src/components/VerifyBets/games/mines/derive.js',
    sha256: '0ee08caf082e0e1a88b6e1ff0123b6bdae06ff372303fdf4512161d2340d2d11' },
  { file: 'lib/hmac-sha256.js', sitePath: 'src/components/VerifyBets/lib/hmac-sha256.js',
    sha256: '2095571fecd77f536bb3363c801cd70786856e687d108e0ff2102a4e2a18b847' },
];
export const SITE_VERIFIER_DIR = 'verifier-parity';

/**
 * Canonical digest of a Pass-2 row set's `earlyBootstrapP` vector. ONE definition, so the pin
 * above and the check that reads it can never drift apart. Order-insensitive by construction
 * (rows are sorted by epoch); a row missing either field digests as the literal `undefined`,
 * so a truncated or blanked row set can never collide with the pin.
 */
export function earlyBootstrapPDigest(rows: ReadonlyArray<any>): string {
  const canon = [...rows]
    .sort((a, b) => (a?.epoch ?? -1) - (b?.epoch ?? -1))
    .map(r => `${r?.epoch}:${r?.earlyBootstrapP}`)
    .join('\n');
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}
