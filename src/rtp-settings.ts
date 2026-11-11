/**
 * RTP-CLAIM wiring — LIQD Mines: the per-setting exact RTP table and the claim it is held to.
 *
 * The rule is src/rtp-claim.ts, a byte-identical copy of the framework's core/rtp-claim.ts (its
 * SHA-256 is compared by conformance C-13), and the enforcement switch RTP_CLAIM_RULE_ENFORCED is
 * this package's src/rtp-claim-switch.ts, read by that copy. Rule 1.2.0 (Methodology v1.1) 2026-10-14: the claim
 * source names the game page, one of the rule's six places (decision D3); an enforced miss would be RTP FIGURE OVERSTATED. Rule RTP-CLAIM 1.0.0 agreed 2026-09-29,
 * 1.1.0 agreed 2026-10-01.
 *
 * SETTINGS. Every legal (mines m, cash-out after k reveals) cell: m = 1–24, k = 1 … 25 − m — 300.
 * EXACT RTP. survival C(25−m, k)/C(25, k) × the exact multiplier as a rational,
 * EDGE_NUM/EDGE_DEN · Π (25−i)/(25−m−i) (src/config.ts minesMultiplierRational — the full-precision
 * value both amounts in LIQD's replies are floored from). The wallet field in the reply is floored to
 * 8 dp, which lowers its RTP by a stake-dependent amount far below the band; the booked amount is
 * floored to the cent, which at a 0.10 stake costs up to 7 points (Step 10's settlement-floor arm).
 * Which amount reaches the balance is not verified. Neither floor is in this table.
 * CLAIM. Flat 1 % house edge = RTP 99/100: one of the figures the live page shows the player (liqd.com
 * "Edge: 1.00%", "99% RTP at every setting", read 2026-10-01, evidence/rtp-page-labels-2026-10-01.json),
 * the same as HOUSE_EDGE = 0.01 and the published 99.0000 % (src/config.ts:10, :43; declaration
 * gameModel.edge.claimed 0.01). The same page also states an edge range; ruling 1 (see RTP_CLAIM
 * below) holds the flat figure and records the range sentence as a discrepancy.
 *
 *   npm run rtp-claim:write    rewrite outputs/rtp-claim-table.json and print its SHA-256 to pin
 */
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { RtpClaim, RtpClaimAccumulator, RtpClaimResult, rtpClaimTable, rtpClaimGate, RtpClaimGate } from './rtp-claim';
import { GRID, MINE_COUNTS, combinationBig, minesMultiplierRational, PUBLISHED_RTP } from './config';

/**
 * The flat figure held is src/config.ts PUBLISHED_RTP, the one copy Step 10 also tests its closed-form
 * identity against, never a second literal (since 2026-10-14). Until this change the claim was
 * the literal '0.99': raising the published figure in PUBLISHED_RTP alone left the rule passing and
 * Step 10's own FLAG deciding the run (Conditional Pass, exit 2) instead of RTP FIGURE OVERSTATED, exit 5.
 */
const HELD_RTP = String(PUBLISHED_RTP);
if (!/^0\.\d+$/.test(HELD_RTP)) throw new Error(`PUBLISHED_RTP ${PUBLISHED_RTP} is not a plain decimal fraction`);

/**
 * RULING 1 (decided 11 November 2026, MANIFEST "Rulings") — WHICH RTP STATEMENT LIQD IS HELD TO.
 *
 * The live page (read 2026-10-01, evidence/rtp-page-labels-2026-10-01.json) makes two statements:
 *   - "99% RTP at every setting", with the stats panel RTP "99% (99.03% after rounding)";
 *   - "Multipliers are rounded to two decimals rather than cut, so the realised edge moves a little
 *     with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%."
 * LIQD is held to the flat 99% (RTP_CLAIM below): it PASSES on 300/300 settings, and the wallet field
 * in the reply meets it (Step 22: every wallet field is floor8(betAmountWallet × floor8(exact)), whose
 * RTP is 99.0000% to four decimals, Step 10). The second sentence is recorded as a DISCREPANCY, dated
 * as published on 1 Oct 2026, so it stays true if the page changes: on production the displayed
 * multiplier is cut, not rounded (Step 7), and the 0.64%–1.44% range matches neither rule (Step 10
 * prints the edge the 2-decimal multiplier would give cut and rounded). The range is kept as
 * RTP_CLAIM_PAGE_RANGE and Step 10 runs it through the same rule and prints the outcome, unscored.
 */
export const RTP_CLAIM: RtpClaim = {
  kind: 'flat',
  rtp: HELD_RTP,
  source: 'LIQD Mines: the game page liqd.com/originals/mines shows "Released: June 2026 | Edge: 1.00%", RTP "99% (99.03% after rounding)" and "99% RTP at every setting" (read 2026-10-01, evidence/rtp-page-labels-2026-10-01.json). The same page also states "the realised edge moves a little with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%" (RTP 98.56%-99.36%); ruling 1 (MANIFEST "Rulings") holds LIQD to the flat figure, which the wallet field in the reply meets, and records that sentence as a discrepancy, as published on 1 Oct 2026; the range, run through the same rule, is printed in Step 10 and not scored. Same figure as HOUSE_EDGE = 0.01, published RTP 99.0000 % (src/config.ts:10, :43; declaration gameModel.edge.claimed 0.01)',
};

/**
 * The page's other statement, as a range claim (edge 0.64%–1.44% → RTP 0.9856–0.9936). Computed and
 * printed by Step 10 as the discrepancy of ruling 1; never scored (RTP_CLAIM above is the held claim).
 */
export const RTP_CLAIM_PAGE_RANGE: RtpClaim = {
  kind: 'range',
  min: '0.9856',
  max: '0.9936',
  source: 'liqd.com/originals/mines, read 2026-10-01: "the realised edge moves a little with the exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal 1%" (evidence/rtp-page-labels-2026-10-01.json)',
};

/** The scored step that carries MINES-19 (src/profile-map.ts). */
export const RTP_CLAIM_STEP = 10;

export const RTP_CLAIM_TABLE = path.join(__dirname, '..', 'outputs', 'rtp-claim-table.json');
/** SHA-256 of the committed table — re-pin with the run that rewrote it (npm run rtp-claim:write). */
export const RTP_CLAIM_TABLE_SHA256 = 'cfd654a112dec6815da92ae700e5fbc47afe9756a335627c5701e23c08fb4211';

export function computeRtpClaim(claim: RtpClaim = RTP_CLAIM): RtpClaimResult {
  const acc = new RtpClaimAccumulator(claim);
  for (const m of MINE_COUNTS) {
    for (let k = 1; k <= GRID - m; k++) {
      const mult = minesMultiplierRational(m, k);
      if (!mult) throw new Error(`no multiplier at m=${m}, k=${k}`);
      acc.add(`mines=${m} k=${k}`, combinationBig(GRID - m, k) * mult.num, combinationBig(GRID, k) * mult.den);
    }
  }
  return acc.result();
}

export function rtpClaimTableText(r: RtpClaimResult): string {
  return rtpClaimTable(r, {
    package: 'liqd/mines', game: 'mines',
    settingSpace: 'mines 1–24 × cash-out after k = 1 … 25 − m reveals (300 cells)',
    rtpMethod: 'exact rational: C(25−m,k)/C(25,k) × the exact multiplier EDGE_NUM/EDGE_DEN·Π(25−i)/(25−m−i)',
  });
}

export function runRtpClaimGate(): RtpClaimGate {
  const r = computeRtpClaim();
  return rtpClaimGate(r, rtpClaimTableText(r), RTP_CLAIM_TABLE, RTP_CLAIM_TABLE_SHA256);
}

if (require.main === module) {
  const text = rtpClaimTableText(computeRtpClaim());
  fs.writeFileSync(RTP_CLAIM_TABLE, text);
  console.log(`wrote outputs/rtp-claim-table.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
