/**
 * Informational items (NOT scored) — live-bet RTP + lag-1 win/loss autocorrelation.
 * Pass 1 separately evaluates the auditor's reference generator at 1M rounds/config.
 */

import type { InfoItem } from './context';
import type { VerifyContext } from './context';
import { lag1Autocorrelation } from '../../src/stats';
import { minesMultiplierExact, winProbability, MINE_COUNTS, GRID } from '../../src/config';

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
  // H-E (QA 2026-09-09) — the same unguarded-accumulator class as tests/steps/payouts.ts, in the
  // line that PRINTS the figure. One loss row carrying `betAmount: "not-a-number"` produced
  //     Live RTP: 0.0000% ($NaN wagered, $2657.61 returned over 6900 bets …)
  // and the run still exited as a pass. This item is not scored — Step 8 hard-fails on the same
  // condition — but the detail string is published prose, and printing `$NaN` as though it were a
  // measurement is worse than printing nothing. The non-finite rows are counted, excluded from
  // the totals, and NAMED in the line, so the figure never reads as a complete census when it is
  // not one.
  const finiteStakes = bets.filter(b => Number.isFinite(Number(b.betAmount)));
  const finiteCredits = bets.filter(b => Number.isFinite(Number(b.winningAmount)));
  const badStakes = bets.length - finiteStakes.length;
  const badCredits = bets.length - finiteCredits.length;
  const totalPayout = finiteCredits.reduce((s, b) => s + Number(b.winningAmount), 0);
  const totalWagered = finiteStakes.reduce((s, b) => s + Number(b.betAmount), 0);
  const liveRTP = totalWagered > 0 ? totalPayout / totalWagered : 0;
  items.push({
    label: 'Live RTP',
    detail: (badStakes + badCredits > 0
      ? `NOT COMPUTABLE — ${badStakes} bets carry a non-numeric betAmount and ${badCredits} a non-numeric winningAmount; they are excluded from the totals below, which therefore describe ${finiteStakes.length}/${bets.length} bets, not the capture. Step 8 hard-fails on this. `
      : '')
      + `${(liveRTP * 100).toFixed(4)}% ($${totalWagered.toFixed(2)} wagered, $${totalPayout.toFixed(2)} returned over ${badStakes + badCredits > 0 ? finiteStakes.length : bets.length} bets, mixed configs — informational, not authoritative)`,
  });

  // maxOdds cap exposure — THEORETICAL analysis derived from the operator's own
  // game-settings records in the dataset. IF maxOdds caps the paid multiplier,
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
        // P0-3, informational arm of the same class: `NaN > cap` is FALSE, so a corrupt
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
        + `These returns assume payment capped at maxOdds; the enforcement mechanism was not observed. No recorded winning multiplier approaches the cap. See AUDIT_CONTEXT.md#payout-limits.`
        + (nonFiniteRef > 0 ? ` WARNING: ${nonFiniteRef}/300 cells returned a non-finite reference multiplier — this sweep is incomplete (Steps 10/15 hard-fail on the same condition).` : ''),
    });
  }

  // Unconditional correlation mixes configuration win probabilities and any within-config
  // dependence. This calculation does not identify their separate contributions.
  const winSeq = bets.map(b => (b.result === 'won' ? 1 : 0));
  const r1 = lag1Autocorrelation(winSeq);
  items.push({
    label: 'Lag-1 autocorr (win/loss)',
    detail: `r₁=${r1.toFixed(4)} — unconditional win/loss correlation in a capture grouped by game configuration. Different configuration win probabilities can contribute to this value. This calculation does not separate configuration effects from within-configuration dependence. Pass 1 evaluates serial statistics of the reference generator; it does not establish the cause of this captured correlation.`,
  });

  // Win rate.
  const wins = bets.filter(b => b.result === 'won').length;
  items.push({
    label: 'Live win rate',
    detail: `${wins}/${bets.length} = ${((wins / bets.length) * 100).toFixed(2)}% (mixed mineCounts/reveals — informational)`,
  });

  return items;
}
