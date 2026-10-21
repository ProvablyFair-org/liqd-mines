/**
 * Steps 18–21: Standardization-parity steps.
 *
 * Each property is derivable from the committed capture with no new data and is
 * recomputed here from the raw dataset (or the mine-layout engine), not read from an
 * operator summary field. Each asserts a distinct property with a coverage
 * assertion so a pass over an empty set cannot occur.
 *
 *   18  Bet-Size Invariance            — layout independent of wager (Phase C, $10)
 *   19  Artifact Integrity             — the pinned dataset SHA-256, promoted to a
 *                                                   scored step, PLUS the derived-figure artifact
 *                                                   re-derived and compared to the copy on disk
 *   20  Reveal-Sequence Consistency    — wins never open a mine; losses bust on the
 *                                                   final opened tile and no earlier one
 *   21  Reveal-Position Independence   — opened positions vary freely and are
 *                                                   independent of the recomputed mine layout
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import * as fs from 'fs';
import * as path from 'path';
import { revealMines, sameMines } from '../../src/rng';
import { computeAuditFigures, AUDIT_FIGURES_FILE } from '../../src/figures';
import { GRID } from '../../src/config';
import { EXPECTED_BETS, ARTIFACT_PINS } from '../../src/pins';
import { checkArtifactDomains, runMetadataPaths, DOMAIN_TABLES } from '../../src/domains';
import { createHash } from 'crypto';
import { fieldDiff, beyondTolerance } from '../../src/diff';

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
  //     promotes the integrity anchor to a visible numbered step.
  //
  // (b) The DERIVED-FIGURE ARTIFACT, outputs/audit-figures.json. The reason it is scored at all
  //     is a defect a forged-artifact battery found within minutes of the file being introduced:
  //     WRITTEN by tests/verify.ts and read by nothing, so hand-editing it left the suite
  //     printing 21/21 Full Pass. An artifact the report cites and no step has an opinion about
  //     is exactly the shape of every population-binding defect this repo has had to close.
  //     Every field in it is a pure function of guarded inputs (src/config.ts, the pinned
  //     dataset, outputs/simulation-results.json), so it is RE-DERIVED here and compared to the
  //     copy on disk BEFORE this run overwrites it. Nothing is excluded: the artifact carries no run
  //     metadata (absent, not excluded), so a re-introduced timestamp is a mismatch.
  //
  // ══════════════════════════════════════════════════════════════════════════════════════
  //  WHY "ABSENT" IS A FAILURE, AND WHY verify DOES NOT HEAL
  // ══════════════════════════════════════════════════════════════════════════════════════
  // PASSING on a missing file, on the reasoning that a fresh clone has not run `verify` yet, is
  // wrong in both halves.
  //
  //   ABSENT. `rm outputs/audit-figures.json && npm run verify` printed `[PASS] Step 19` and 21/21
  //        Full Pass. A guard whose evidence can be deleted is not a guard — deleting the file is
  //        strictly easier than editing it, so an "absent → PASS" arm is a bypass around the
  //        "edited → FAIL" arm sitting next to it. The delivered repo SHIPS this artifact
  //        (.gitignore un-ignores it explicitly); absent means somebody removed it.
  //
  //   HEALING. A verify.ts that rewrote the artifact unconditionally at the end of the SAME run
  //        that hard-failed this step launders the edit. Measured: edit liveRTPPercent to 99.0 →
  //        run 1 `[FAIL] Step 19`, NOT PROVABLY FAIR; run 2, nothing else changed →
  //        `[PASS] Step 19`, Full Pass, value silently restored. That enforces only "the figure
  //        artifact cannot be edited without the NEXT verify hard-failing" — true of the
  //        immediately next run alone, after which the evidence of tampering is gone. It also
  //        launders a forged SIMULATION artifact: a fabricated Pass 1 hard-failed Step 19 on
  //        run 1 and returned 21/21 Full Pass on run 2.
  //        verify.ts writes this file ONLY when this step passed; regenerating it after a
  //        failure is a deliberate act — `npm run figures` — not a side effect of re-running.
  {
    const pinOk = ctx.datasetSha256 === ctx.expectedDatasetHash;
    // (c) Artifacts of record the report quotes that no step re-derives (src/pins.ts
    //     ARTIFACT_PINS): SHA-256 of the committed bytes must equal the pin. Missing = FAIL.
    const repoRoot = path.resolve(ctx.outputsDir, '..');
    const artifactResults = ARTIFACT_PINS.map(({ file, sha256 }) => {
      const p = path.join(repoRoot, file);
      if (!fs.existsSync(p)) return { file, state: 'absent' as const };
      const got = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      return { file, state: got === sha256 ? 'match' as const : 'mismatch' as const };
    });
    const artifactsOk = artifactResults.every(r => r.state === 'match');

    // (d) MINES-27 — the rest of "artifacts of record", over EVERY pinned file:
    //   • un-ignored BY NAME in .gitignore (`!outputs/<name>`), so a clone carries it;
    //   • NO RUN METADATA — no key named like a timestamp or a timing anywhere in a pinned JSON
    //     artifact (src/domains.ts RUN_METADATA_KEY). Absent, not excluded;
    //   • every numeric leaf of every pinned JSON artifact has a DECLARED value domain and lies in
    //     it (src/domains.ts). A re-pinned forgery of an impossible value fails here even though
    //     its pin matches.
    // The coverage is bound: every pinned JSON file must have a domain table, and every domain
    // table must name a pinned file.
    const gitignoreLines = (() => {
      try { return fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8').split('\n').map(l => l.trim()); } catch { return [] as string[]; }
    })();
    const notUnignored = ARTIFACT_PINS.map(a => a.file).filter(f => !gitignoreLines.includes(`!${f}`));
    const metadataFound: string[] = [];
    const undeclaredLeaves: string[] = [];
    const domainViolations: string[] = [];
    let domainLeaves = 0;
    const jsonPinned = ARTIFACT_PINS.map(a => a.file).filter(f => f.endsWith('.json'));
    const tableCoverageBad = jsonPinned.filter(f => !DOMAIN_TABLES[f]).concat(Object.keys(DOMAIN_TABLES).filter(f => !jsonPinned.includes(f)));
    for (const f of jsonPinned) {
      const p = path.join(repoRoot, f);
      if (!fs.existsSync(p)) continue;                       // already a FAIL above (absent)
      let doc: unknown;
      try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { domainViolations.push(`${f}: unparseable`); continue; }
      for (const k of runMetadataPaths(doc)) metadataFound.push(`${f}:${k}`);
      const d = checkArtifactDomains(f, doc);
      domainLeaves += d.checked;
      for (const u of d.undeclared) undeclaredLeaves.push(`${f}:${u}`);
      for (const v of d.violations) domainViolations.push(`${f}:${v}`);
    }
    const recordOk = notUnignored.length === 0 && metadataFound.length === 0 && undeclaredLeaves.length === 0
      && domainViolations.length === 0 && tableCoverageBad.length === 0;

    //     FOUR outcomes, and the two middle ones matter:
    //       match           → PASS.
    //       absent          → FAIL. The artifact of record is shipped with the repo. Its
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
        // Field for field at the reproduction bound (src/diff.ts: two distinct integers never agree,
        // non-numeric leaves must be identical, a float within 1e-14 abs + 1e-12 rel is the same
        // result) — not bit equality. Several figures go through Math.exp (the false-alarm
        // accounting, probabilityCaptureWitnessesBranch), and libm is not guaranteed bit-identical
        // across platforms; 1-ulp drift on Linux was measured for exactly this class (2026-09-28). The copy on disk is still byte-pinned by arm (c) below. Forgery A37
        // (a figure moved just beyond the bound, every artifact re-pinned) still FAILs this step.
        const figBeyond = beyondTolerance(fieldDiff(onDisk, derived));
        if (figBeyond.length === 0) {
          figState = 'match';
        } else if (onDisk?.datasetSha256 !== ctx.datasetSha256) {
          figState = 'stale';
          figDetail = ` — derived from dataset ${String(onDisk?.datasetSha256 ?? '(none)').slice(0, 16)}…, loaded dataset is ${ctx.datasetSha256.slice(0, 16)}…; re-run \`npm run verify\``;
        } else {
          figState = 'mismatch';
          const bad = [...new Set(figBeyond.map(d => d.path.split(/[.[]/)[0]))];
          figDetail = ` — differing section(s): ${bad.slice(0, 4).join(', ')}`;
        }
      } catch {
        figState = 'unparseable';
      }
    }
    const status: 'PASS' | 'FLAG' | 'FAIL' =
      !pinOk || !artifactsOk || !recordOk || figState === 'mismatch' || figState === 'unparseable' || figState === 'absent'
        ? 'FAIL'
        : figState === 'stale' ? 'FLAG' : 'PASS';
    out.push(step(19, 'Artifact Integrity (dataset pin + derived figures)', status,
      `SHA-256 of data/mines-master-6900bets.json = ${ctx.datasetSha256.slice(0, 16)}… ${pinOk ? 'matches' : '≠'} the pin ${ctx.expectedDatasetHash.slice(0, 16)}… (loader aborts on mismatch before any step runs); `
      + `outputs/${AUDIT_FIGURES_FILE} re-derived from src/config.ts + the pinned dataset + the simulation artifact and compared field-for-field against the copy on disk: ${figState}${figDetail}`
      + (figState === 'absent'
        ? ` — HARD FAIL: the derived-figure artifact is shipped with this repo and every quantitative claim in the report is quoted from it. Its absence is not a fresh clone, it is a missing artifact of record, and until 2026-09-09 deleting it scored [PASS] Step 19 with a 21/21 Full Pass — a guard whose evidence can be deleted is not a guard. Regenerate deliberately with \`npm run figures\`, then re-run.`
        : '')
      + `; pinned artifacts of record (src/pins.ts ARTIFACT_PINS): ${artifactResults.filter(r => r.state === 'match').length}/${ARTIFACT_PINS.length} match (${artifactResults.map(r => `${r.file} ${r.state}`).join(', ')})`
      + `; un-ignored by name in .gitignore: ${ARTIFACT_PINS.length - notUnignored.length}/${ARTIFACT_PINS.length}${notUnignored.length ? ` — NOT: ${notUnignored.join(', ')}` : ''}`
      + `; run-metadata keys in pinned JSON artifacts: ${metadataFound.length}${metadataFound.length ? ` (${metadataFound.slice(0, 4).join(', ')})` : ''}`
      + `; value domains (src/domains.ts): ${domainLeaves.toLocaleString()} numeric leaves across ${jsonPinned.length} pinned JSON artifacts, ${undeclaredLeaves.length} undeclared${undeclaredLeaves.length ? ` (${undeclaredLeaves.slice(0, 3).join(', ')})` : ''}, ${domainViolations.length} outside their domain${domainViolations.length ? ` (${domainViolations.slice(0, 3).join('; ')})` : ''}${tableCoverageBad.length ? `; domain-table coverage mismatch: ${tableCoverageBad.join(', ')}` : ''}.`
      + ` Default verification preserves published figures and writes run results under outputs/run. Explicit report generation replaces published figures only if this step passes.`));
  }

  // ── Step 20: Reveal-Sequence Consistency ────────────────────────────────────
  // Asserted from the RECOMPUTED layout, never from the served one or from the operator's
  // outcome label: for every round the mine set is revealMines(serverSeed, clientSeed, nonce, m).
  //   - a WIN opens no mine, and its opened count EQUALS the recorded depth (`reveals`, the depth
  //     the round was played to) — a win cashed out short of, or past, its recorded depth is a
  //     different round from the one recorded;
  //   - a LOSS busts on EXACTLY the last opened tile, with no earlier opened tile a mine, and
  //     never opens more tiles than its recorded depth;
  //   - every opened tile is a legal board index (1..GRID), none repeated — a forged win with
  //     openTiles [2,2,2,2,2] would otherwise score as a depth-5 win;
  //   - the served mine list itself has mineCount distinct legal indices.
  {
    let winChk = 0, winOpenedMine = 0, winDepthBad = 0;
    let lossChk = 0, lossBad = 0, lossDepthBad = 0;
    let boardBad = 0, unrecomputed = 0, otherLabel = 0;
    const fails: string[] = [];
    const note = (s: string) => { if (fails.length < 4) fails.push(s); };
    for (const b of bets) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) { unrecomputed++; note(`nonce ${b.nonce}: seed unrevealed, layout not recomputable`); continue; }
      const mines = new Set(revealMines(ss, b.clientSeed, b.nonce, b.mineCount));
      const ot = b.openTiles || [];
      const served = b.mineTiles || [];
      const legal = (t: number) => Number.isInteger(t) && t >= 1 && t <= GRID;
      if (!ot.every(legal) || new Set(ot).size !== ot.length
        || !served.every(legal) || new Set(served).size !== served.length || served.length !== b.mineCount) {
        boardBad++; note(`nonce ${b.nonce}: board structure (opened ${JSON.stringify(ot)}, served mines ${served.length}/${b.mineCount})`);
      }
      if (b.result === 'won') {
        winChk++;
        if (ot.some((t) => mines.has(t))) { winOpenedMine++; note(`nonce ${b.nonce}: win opened a mine`); }
        if (ot.length !== b.reveals) { winDepthBad++; note(`nonce ${b.nonce}: win opened ${ot.length}, recorded depth ${b.reveals}`); }
      } else if (b.result === 'lost') {
        lossChk++;
        const last = ot[ot.length - 1];
        const earlier = ot.slice(0, -1);
        if (ot.length === 0 || !mines.has(last) || earlier.some((t) => mines.has(t))) {
          lossBad++; note(`nonce ${b.nonce}: loss did not bust on exactly the final tile`);
        }
        if (ot.length < 1 || ot.length > b.reveals) { lossDepthBad++; note(`nonce ${b.nonce}: loss opened ${ot.length}, recorded depth ${b.reveals}`); }
      } else {
        otherLabel++; note(`nonce ${b.nonce}: result label ${JSON.stringify(b.result)}`);
      }
    }
    const ok = winChk > 0 && lossChk > 0 && winChk + lossChk === EXPECTED_BETS
      && winOpenedMine === 0 && lossBad === 0 && winDepthBad === 0 && lossDepthBad === 0
      && boardBad === 0 && unrecomputed === 0 && otherLabel === 0;
    out.push(step(20, 'Reveal-Sequence Consistency', ok ? 'PASS' : 'FAIL',
      `${winChk + lossChk}/${EXPECTED_BETS} rounds judged against the RECOMPUTED layout (revealMines from the revealed seed — not the served mineTiles, not the result label): `
      + `${winChk} wins — ${winOpenedMine} opened a mine, ${winDepthBad} whose opened count differs from the recorded depth (both must be 0); `
      + `${lossChk} losses — ${lossBad} did not bust on exactly the final opened tile with no earlier mine, ${lossDepthBad} opened more tiles than the recorded depth or none (both must be 0); `
      + `board structure (opened tiles legal 1..${GRID} and unrepeated, served mine list = mineCount distinct legal indices): ${boardBad} violations; ${unrecomputed} rounds not recomputable; ${otherLabel} rounds with a label other than won/lost` +
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
    const ok = chk === e.length && chk > 0 && bad === 0 && sets.size > 1 && firsts.size === GRID;
    out.push(step(21, 'Reveal-Position Independence', ok ? 'PASS' : 'FLAG',
      `${e.length} multi-reveal (Phase E) rounds span ${sets.size} distinct opened-tile sets and ${firsts.size}/${GRID} board positions as a first pick (all ${GRID} required); ` +
      `all ${chk}/${e.length} layouts still recompute (${bad} mismatch) regardless of which positions were opened — a layout-parity check over a swept first-pick window (first = ((nonce+1) mod 25)+1), not a statistical independence test` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase E layouts recomputed' : '')));
  }

  return out;
}
