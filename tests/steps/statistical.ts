/**
 * Informational items (NOT scored) — live-bet RTP + lag-1 win/loss autocorrelation.
 * Pass 1 separately evaluates the auditor's reference generator at 1M rounds/config.
 */

import type { InfoItem } from './context';
import type { VerifyContext } from './context';
import { lag1Autocorrelation } from '../../src/stats';
import { minesMultiplierExact, winProbability, MINE_COUNTS, GRID } from '../../src/config';
import { PROD_WALLET_CURRENCY } from '../../src/pins';
import { decimalUnits } from '../../src/prod-capture';

export function run(ctx: VerifyContext): InfoItem[] {
  const { bets } = ctx;
  const items: InfoItem[] = [];

  if (bets.length === 0) {
    items.push({ label: 'Live bets', detail: 'No bets in dataset (PROVISIONAL)' });
    return items;
  }

  // Live RTP (informational). betAmount is mixed-typed (number on wins, decimal
  // string on losses) — coerce with Number(). winningAmount is always a number.
  //
  // UNGUARDED-ACCUMULATOR CLASS — the same one tests/steps/payouts.ts guards, here in the
  // line that PRINTS the figure. One loss row carrying `betAmount: "not-a-number"` produces
  //     Live RTP: 0.0000% ($NaN wagered, $2657.61 returned over 6900 bets …)
  // and the run still exits as a pass. This item is not scored — Step 8 hard-fails on the same
  // condition — but the detail string is published prose, and printing `$NaN` as though it were a
  // measurement is worse than printing nothing. The non-finite rows are counted, excluded from
  // the totals, and NAMED in the line, so the figure never reads as a complete census when it is
  // not one.
  const finiteStakes = bets.filter(b => Number.isFinite(Number(b.betAmount)));
  const finiteWins = bets.filter(b => Number.isFinite(Number(b.winningAmount)));
  const badStakes = bets.length - finiteStakes.length;
  const badWins = bets.length - finiteWins.length;
  // Booked amounts are totalled per fiat and never across them (CAD in capture 1, USD in captures 2 and 3).
  const perFiat = new Map<string, { n: number; wagered: number; paid: number }>();
  for (const b of bets) {
    const f = perFiat.get(b.fiatCurrency) ?? { n: 0, wagered: 0, paid: 0 };
    f.n++;
    if (Number.isFinite(Number(b.betAmount))) f.wagered += Number(b.betAmount);
    if (Number.isFinite(Number(b.winningAmount))) f.paid += Number(b.winningAmount);
    perFiat.set(b.fiatCurrency, f);
  }
  items.push({
    label: 'Live RTP (booked fiat)',
    detail: (badStakes + badWins > 0
      ? `NOT COMPUTABLE — ${badStakes} bets carry a non-numeric betAmount and ${badWins} a non-numeric winningAmount; they are excluded from the totals below. Step 8 hard-fails on this. `
      : '')
      + [...perFiat].sort(([a], [z]) => a.localeCompare(z)).map(([f, x]) => `${f}: ${x.wagered > 0 ? (x.paid / x.wagered * 100).toFixed(4) : 'n/a'}% (${x.wagered.toFixed(2)} wagered, ${x.paid.toFixed(2)} booked as won over ${x.n} rounds)`).join('; ')
      + ` — the BOOKED amounts, mixed settings, per fiat and not summed across currencies; a win's booked amount is floored to the cent, which at a 0.10 stake drops up to a tenth of the stake (Step 8), so these figures are below the wallet fields of the same replies (next line). Informational, a variance illustration only`,
  });

  {
    let staked = 0n, paid = 0n, read = 0;
    for (const { rec } of ctx.prodCapture.bets) {
      const st = decimalUnits(rec?.placeRaw?.betAmountWallet, 8);
      const w = rec?.settleRaw?.winningAmountWallet;
      const pd = w === undefined || w === null ? 0n : decimalUnits(w, 8);
      if (st === null || pd === null) continue;
      staked += st; paid += pd; read++;
    }
    items.push({
      label: 'Live RTP (wallet)',
      detail: ctx.prodCapture.problem
        ? `NOT COMPUTABLE — raw capture not loaded: ${ctx.prodCapture.problem}`
        : `${staked > 0n ? (Number(paid) / Number(staked) * 100).toFixed(4) : 'n/a'}% by the ${PROD_WALLET_CURRENCY} wallet fields of the replies (${(Number(staked) / 1e8).toFixed(8)} ${PROD_WALLET_CURRENCY} staked, ${(Number(paid) / 1e8).toFixed(8)} ${PROD_WALLET_CURRENCY} paid, ${read}/${ctx.prodCapture.bets.length} rounds read from the raw captures) — reply fields, no balances captured; variance illustration only`,
    });
  }

  // maxOdds cap exposure — THEORETICAL analysis derived from the operator's own
  // game-settings records in the dataset. IF maxOdds caps the settled multiplier,
  // a cell above it would return winProbability × cap before settlement rounding.
  // The capture does not establish that this is how the setting is enforced. This emits the report's cap figures so
  // they have a producing artifact.
  // The field is recorded on settle responses as a JSON *string* — parse it.
  const parseGs = (b: unknown): { maxOdds?: unknown } | null => {
    const raw = (b as { currentGameSettings?: unknown }).currentGameSettings;
    if (raw == null) return null;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
    return raw as { maxOdds?: unknown };
  };
  const settingsBets = bets.filter(b => parseGs(b) != null);
  const capVals = [...new Set(settingsBets.map(b => parseGs(b)!.maxOdds))];
  if (settingsBets.length > 0 && capVals.length === 1 && typeof capVals[0] === 'number') {
    const cap = capVals[0] as number;
    let cappedCells = 0;
    const cappedMineCounts = new Set<number>();
    let worst = { rtp: Infinity, m: 0, k: 0, mult: 0 };
    let nonFiniteRef = 0;
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        const mult = minesMultiplierExact(m, k);
        // Non-finite reference, informational arm of the same class: `NaN > cap` is FALSE, so a corrupt
        // reference would silently under-report the cap exposure rather than showing nothing.
        // This item is NOT scored (Steps 10/15 hard-fail on the same condition), but the count
        // is printed so the figure is never quoted as if the sweep were complete.
        if (!Number.isFinite(mult)) { nonFiniteRef++; continue; }
        if (mult > cap) {
          cappedCells++;
          cappedMineCounts.add(m);
          const rtp = winProbability(m, k) * cap;
          if (rtp < worst.rtp) worst = { rtp, m, k, mult };
        }
      }
    }
    items.push({
      label: 'maxOdds cap exposure (theoretical, from operator settings)',
      detail: `${settingsBets.length}/${bets.length} settles carry currentGameSettings (single value; maxOdds ${cap}). `
        + `${cappedCells} reachable (m,k) cells have exact multiplier > ${cap} across ${cappedMineCounts.size}/${MINE_COUNTS.length} mineCounts; `
        + `deepest examples: m=21,k=4 → ${minesMultiplierExact(21, 4).toFixed(1)}×, m=20,k=5 → ${minesMultiplierExact(20, 5).toFixed(1)}× (capped path RTP ${(winProbability(20, 5) * cap * 100).toFixed(1)}%); `
        + `hypothetical lowest-RTP capped cell m=${worst.m},k=${worst.k}: exact ${worst.mult.toExponential(3)}× capped to ${cap}× → path RTP ${(worst.rtp * 100).toFixed(2)}%. `
        + `These returns assume payment capped at maxOdds; the enforcement mechanism was not observed. No recorded winning multiplier approaches the cap. `
        + `See MANIFEST.md#payouts-and-rtp.`
        + (nonFiniteRef > 0 ? ` WARNING: ${nonFiniteRef}/300 cells returned a non-finite reference multiplier — this sweep is incomplete (Steps 10/15 hard-fail on the same condition).` : ''),
    });
  }

  // Unconditional correlation mixes configuration win probabilities and any within-config
  // dependence. This calculation does not identify their separate contributions.
  const winSeq = bets.map(b => (b.result === 'won' ? 1 : 0));
  const r1 = lag1Autocorrelation(winSeq);
  items.push({
    label: 'Lag-1 autocorr (win/loss)',
    detail: `r₁=${r1.toFixed(4)} — unconditional win/loss correlation over rounds in capture order, which cycle through the game configurations. Different configuration win probabilities can contribute to this value. This calculation does not separate configuration effects from within-configuration dependence. Pass 1 evaluates serial statistics of the reference generator; it does not establish the cause of this captured correlation.`,
  });

  // Win rate.
  const wins = bets.filter(b => b.result === 'won').length;
  items.push({
    label: 'Live win rate',
    detail: `${wins}/${bets.length} = ${((wins / bets.length) * 100).toFixed(2)}% (mixed mineCounts/reveals — informational)`,
  });

  return items;
}
