/**
 * Steps 18–21: Standardization-parity steps.
 *
 * Each property is derivable from the committed capture with no new data and is
 * recomputed here from the raw dataset (or the mine-layout engine), not read from an
 * operator summary field. They bring this audit to parity with the published Duel
 * Mines report without padding — each asserts a distinct property with a coverage
 * assertion so a pass over an empty set cannot occur.
 *
 *   18  Bet-Size Invariance            (Duel 10) — layout independent of wager (Phase C, $10)
 *   19  Artifact Integrity             (Duel 14) — the pinned dataset SHA-256, promoted to a
 *                                                   scored step, PLUS the derived-figure artifact
 *                                                   re-derived and compared to the copy on disk
 *   20  Reveal-Sequence Consistency    (Duel 21) — wins never open a mine; losses bust on the
 *                                                   final opened tile and no earlier one
 *   21  Reveal-Position Independence   (Duel 22) — opened positions vary freely and are
 *                                                   independent of the recomputed mine layout
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import * as fs from 'fs';
import * as path from 'path';
import { revealMines, sameMines } from '../../src/rng';
import { computeAuditFigures, AUDIT_FIGURES_FILE } from '../../src/figures';

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap } = ctx;
  const out: StepResult[] = [];

  // ── Step 18: Bet-Size Invariance ────────────────────────────────────────────
  // The reference engine revealMines(serverSeed, clientSeed, nonce, mineCount) is wager-free
  // by construction. Phase C's 200 hands at $10 (mineCount 3) recompute here in draw
  // order alongside the $0.10 hands scored in Step 5 — the served layout matches the wager-free
  // reference at both captured stakes. Deterministic; no distributional test at n=200.
  {
    const c = ctx.phaseC;
    let chk = 0, bad = 0;
    for (const b of c) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) continue;
      chk++;
      if (!sameMines(revealMines(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles)) bad++;
    }
    const stakes = [...new Set(bets.map((b) => Number(b.betAmount)))].sort((a, z) => a - z);
    const ok = chk === c.length && chk > 0 && bad === 0;
    out.push(step(18, 'Bet-Size Invariance', ok ? 'PASS' : 'FAIL',
      `${chk}/${c.length} Phase C hands at $10.00 (mineCount 3) recompute their mine layout in draw order — ${bad} mismatch. ` +
      `the reference engine revealMines(serverSeed, clientSeed, nonce, mineCount) is wager-free by construction, and the served layouts at $10.00 match it exactly as the $0.10 hands do (stakes present: ${stakes.map((s) => `$${s}`).join(', ')}) — all sampled layouts agree with the same wager-free reference at both recorded stakes. This is sample layout parity; it does not establish universal backend independence from wager amount` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase C hands recomputed' : '')));
  }

  // ── Step 19: Artifact Integrity (dataset pin + derived-figure artifact) ─────
  // Two arms, both about "is the file on disk the file this audit computed?".
  //
  // (a) The DATASET pin. The loader hard-guards it before anything runs; scoring it here
  //     promotes the integrity anchor to a visible numbered step (parity with Duel step 14).
  //
  // (b) The DERIVED-FIGURE ARTIFACT, outputs/audit-figures.json. Added 2026-09-09, and the
  //     reason it is scored at all is a defect found by the framework's own forged-artifact
  //     gate within minutes of the file being introduced: it was WRITTEN by tests/verify.ts and
  //     read by nothing, so hand-editing it left the suite printing 21/21 Full Pass. An artifact
  //     the report cites and no step has an opinion about is exactly the shape of every
  //     population-binding defect this repo spent a review round closing.
  //     Every field in it is a pure function of guarded inputs (src/config.ts, the pinned
  //     dataset, outputs/simulation-results.json), so it is RE-DERIVED here and compared to the
  //     copy on disk BEFORE this run overwrites it. `generatedAt` is excluded — it differs by
  //     construction on every run, and comparing it would make the check vacuous.
  //
  // ══════════════════════════════════════════════════════════════════════════════════════
  //  H-A / H-B (QA 2026-09-09) — WHY "ABSENT" IS NOW A FAILURE AND WHY verify NO LONGER HEALS
  // ══════════════════════════════════════════════════════════════════════════════════════
  // This step used to PASS on a missing file, on the reasoning that a fresh clone has not run
  // `verify` yet. Both halves of that were wrong.
  //
  //   H-A. `rm outputs/audit-figures.json && npm run verify` printed `[PASS] Step 19` and 21/21
  //        Full Pass. A guard whose evidence can be deleted is not a guard — deleting the file is
  //        strictly easier than editing it, so the "absent → PASS" arm was a bypass around the
  //        "edited → FAIL" arm sitting next to it. The delivered repo SHIPS this artifact
  //        (.gitignore un-ignores it explicitly); absent means somebody removed it.
  //
  //   H-B. tests/verify.ts rewrote the artifact unconditionally at the end of the SAME run that
  //        hard-failed this step. Measured: edit liveRTPPercent to 99.0 → run 1 `[FAIL] Step 19`,
  //        NOT PROVABLY FAIR; run 2, nothing else changed → `[PASS] Step 19`, Full Pass, value
  //        silently restored. The step was enforcing "the figure artifact cannot be edited without
  //        the NEXT verify hard-failing" — true only of the immediately next run, after which the
  //        evidence of tampering was gone. That also laundered a forged SIMULATION artifact: the
  //        H-D fabricated Pass 1 hard-failed Step 19 on run 1 and returned 21/21 Full Pass on run 2.
  //        verify.ts now writes this file ONLY when this step passed; regenerating it after a
  //        failure is a deliberate act — `npm run figures` — not a side effect of re-running.
  {
    const pinOk = ctx.datasetSha256 === ctx.expectedDatasetHash;

    //     FOUR outcomes, and the two middle ones matter:
    //       match           → PASS.
    //       absent          → FAIL (H-A). The artifact of record is shipped with the repo. Its
    //                         absence is either tampering or an incomplete build; either way the
    //                         run cannot assert that the report's figures match the code that
    //                         produced them, which is this step's entire job. Recover with
    //                         `npm run figures`, deliberately.
    //       STALE           → FLAG. The file records the datasetSha256 it was derived from. If
    //                         that is not the dataset currently loaded, the file is simply out of
    //                         date — regenerate it — and calling that "NOT PROVABLY FAIR" would
    //                         put a housekeeping problem in the same bucket as a broken
    //                         commitment. It is NOT silently ignored either: a stale figure file
    //                         is how a report ends up quoting numbers from a superseded capture.
    //       edited / broken → FAIL. Same dataset, different content: somebody changed a figure
    //                         the report cites. A forger who also rewrites datasetSha256 does not
    //                         escape — that field is part of the compared object, so it merely
    //                         moves the failure from "edited" to "stale", and a stale artifact
    //                         cannot be shipped past this step either.
    const figPath = path.join(ctx.outputsDir, AUDIT_FIGURES_FILE);
    let figState: 'absent' | 'match' | 'mismatch' | 'stale' | 'unparseable' = 'absent';
    let figDetail = '';
    if (fs.existsSync(figPath)) {
      try {
        const onDisk = JSON.parse(fs.readFileSync(figPath, 'utf-8'));
        delete onDisk.generatedAt;
        const derived: any = computeAuditFigures({
          bets: ctx.bets, seeds: ctx.seeds, seedMap: ctx.seedMap, phaseD: ctx.phaseD,
          outputsDir: ctx.outputsDir, datasetSha256: ctx.datasetSha256,
        });
        // The `simulation` section is derived from outputs/simulation-results.json, which is
        // regenerated by every `npm test` and is legitimately ABSENT in a fresh clone that has
        // only run `npm run verify`. When it is absent the derivation yields null, and comparing
        // null against the section a previous run wrote would report an edit where there is none.
        // Drop that section from BOTH sides in exactly that case — and only that case.
        if (!fs.existsSync(path.join(ctx.outputsDir, 'simulation-results.json'))) {
          delete (onDisk as any).simulation;
          delete derived.simulation;
          figDetail = ' (simulation section excluded — simulation-results.json is absent)';
        }
        if (JSON.stringify(onDisk) === JSON.stringify(derived)) {
          figState = 'match';
        } else if (onDisk?.datasetSha256 !== ctx.datasetSha256) {
          figState = 'stale';
          figDetail = ` — derived from dataset ${String(onDisk?.datasetSha256 ?? '(none)').slice(0, 16)}…, loaded dataset is ${ctx.datasetSha256.slice(0, 16)}…; re-run \`npm run verify\``;
        } else {
          figState = 'mismatch';
          const keys = [...new Set([...Object.keys(onDisk), ...Object.keys(derived)])];
          const bad = keys.filter(k => JSON.stringify((onDisk as any)[k]) !== JSON.stringify((derived as any)[k]));
          figDetail = ` — differing section(s): ${bad.slice(0, 4).join(', ')}`;
        }
      } catch {
        figState = 'unparseable';
      }
    }
    const status: 'PASS' | 'FLAG' | 'FAIL' =
      !pinOk || figState === 'mismatch' || figState === 'unparseable' || figState === 'absent'
        ? 'FAIL'
        : figState === 'stale' ? 'FLAG' : 'PASS';
    out.push(step(19, 'Artifact Integrity (dataset pin + derived figures)', status,
      `SHA-256 of data/mines-master-6900bets.json = ${ctx.datasetSha256.slice(0, 16)}… ${pinOk ? 'matches' : '≠'} the pin ${ctx.expectedDatasetHash.slice(0, 16)}… (loader aborts on mismatch before any step runs); `
      + `outputs/${AUDIT_FIGURES_FILE} re-derived from src/config.ts + the pinned dataset + the simulation artifact and compared field-for-field against the copy on disk (generatedAt excluded): ${figState}${figDetail}`
      + (figState === 'absent'
        ? ` — HARD FAIL: the derived-figure artifact is shipped with this repo and every quantitative claim in the report is quoted from it. Its absence is not a fresh clone, it is a missing artifact of record, and until 2026-09-09 deleting it scored [PASS] Step 19 with a 21/21 Full Pass — a guard whose evidence can be deleted is not a guard. Regenerate deliberately with \`npm run figures\`, then re-run.`
        : '')
      + ` Default verification preserves published figures and writes run results under outputs/run. Explicit report generation replaces published figures only if this step passes.`));
  }

  // ── Step 20: Reveal-Sequence Consistency ────────────────────────────────────
  // The final-state-capture equivalent of Duel's intermediate-state mine-set invariance:
  //   - a WIN never opens a mine (none of its opened tiles is a mine position), and
  //   - a LOSS busts on exactly the last opened tile, with no earlier opened tile a mine.
  {
    let winChk = 0, winOpenedMine = 0;
    let lossChk = 0, lossBad = 0;
    const fails: string[] = [];
    for (const b of bets) {
      const mines = new Set(b.mineTiles);
      const ot = b.openTiles || [];
      if (b.result === 'won') {
        winChk++;
        if (ot.some((t) => mines.has(t))) { winOpenedMine++; if (fails.length < 4) fails.push(`nonce ${b.nonce}: win opened a mine`); }
      } else if (b.result === 'lost') {
        lossChk++;
        const last = ot[ot.length - 1];
        const earlier = ot.slice(0, -1);
        if (!mines.has(last) || earlier.some((t) => mines.has(t))) {
          lossBad++;
          if (fails.length < 4) fails.push(`nonce ${b.nonce}: loss did not bust on exactly the final tile`);
        }
      }
    }
    const ok = winChk > 0 && lossChk > 0 && winOpenedMine === 0 && lossBad === 0;
    out.push(step(20, 'Reveal-Sequence Consistency', ok ? 'PASS' : 'FAIL',
      `${winChk} wins — ${winOpenedMine} opened a mine (must be 0); ${lossChk} losses — ${lossBad} did not bust on exactly the final opened tile with no earlier mine (must be 0)` +
      (fails.length ? `; e.g. ${fails.join('; ')}` : '') +
      (winChk === 0 || lossChk === 0 ? '; COVERAGE FAIL: wins or losses absent' : '')));
  }

  // ── Step 21: Reveal-Position Independence ───────────────────────────────────
  // The mine layout is fixed by the seed alone and does not depend on which tiles are opened.
  // This is a layout-parity check (same recomputation as Steps 5/15) over a SWEPT first-pick
  // window plus a distinct-set count — NOT a statistical independence test: the Phase E capture
  // sweeps the first pick consecutively (first = ((nonce+1) mod 25)+1, each start tile ~16×,
  // later picks truncated by busts), so the opened positions are systematic, not free choice.
  {
    const e = ctx.phaseE;
    const sets = new Set(e.map((b) => [...(b.openTiles || [])].sort((a, z) => a - z).join(',')));
    const firsts = new Set(e.map((b) => (b.openTiles || [])[0]).filter((t) => t !== undefined));
    let chk = 0, bad = 0;
    for (const b of e) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) continue;
      chk++;
      if (!sameMines(revealMines(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles)) bad++;
    }
    const ok = chk === e.length && chk > 0 && bad === 0 && sets.size > 1 && firsts.size >= 20;
    out.push(step(21, 'Reveal-Position Independence', ok ? 'PASS' : 'FLAG',
      `${e.length} multi-reveal (Phase E) rounds span ${sets.size} distinct opened-tile sets and ${firsts.size}/25 board positions as a first pick; ` +
      `all ${chk}/${e.length} layouts still recompute (${bad} mismatch) regardless of which positions were opened — a layout-parity check over a swept first-pick window (first = ((nonce+1) mod 25)+1), not a statistical independence test` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase E layouts recomputed' : '')));
  }

  return out;
}
