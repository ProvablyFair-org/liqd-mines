/**
 * Steps 5–6: RNG Determinism (mine-layout recomputation)
 */

import type { StepResult } from './context';
import { step } from './context';
import type { VerifyContext } from './context';
import { EXPECTED_BETS } from '../../src/pins';
import * as path from 'path';
import { GRID, minesMultiplierDisplayCents } from '../../src/config';
import { loadSiteVerifier } from '../../src/site-verifier';
import { SITE_VERIFIER_DIR } from '../../src/pins';
import {
  revealMines, sameMines, generateProvablyFairNumber, moduloRejectionCensus,
  expectedModuloRejections,
} from '../../src/rng';
import { drawBias } from '../../src/bias';

/**
 * The draw design this package declares for the operator's shuffle: REJECTION sampling (maxFair =
 * the largest multiple of the range ≤ 2³², chunks at or above it discarded). For that design the
 * per-value bias is exactly zero, and Step 5 requires exactly zero.
 */
const DECLARED_DRAW = 'rejection' as const;

/**
 * A deterministic vector on which the rejection branch IS taken (it never is in the capture): the
 * committed Pass-1 mineCount-5 seed pair at nonce 760455, cursor 12, range 13. The first 4-byte
 * chunk 4294967288 is ≥ maxFair 4294967287 and is rejected; the second chunk 412214211 gives 6.
 * A draw with the branch deleted gives 1. Checked inside Step 5 so the bound it prints is a
 * property of the function that produced the layouts, not only of the helper that states it.
 */
const REJECTION_VECTOR = {
  serverSeed: '1f1da0da5907129a0043f5ac8a12b5ee', clientSeed: '097bf01483879668f626781b35b297c2',
  nonce: 760455, cursor: 12, range: 13, expected: 6,
};

/**
 * Wrong-seed collision model. Under a client seed other than the one used, the recomputed shuffle
 * is an independent uniform permutation, so the chance that it reproduces a recorded layout is
 *   ordered (draw order, what sameMines compares):   1 / P(25, m) = (25−m)! / 25!
 *   unordered (the mine SET):                         1 / C(25, m)
 * Summed over the tested bets these give the expected number of chance survivors E and its
 * variance Σ p(1−p). A survivor count above E + 5σ means the client seed is not doing what the
 * model says it does — the arbitrary "≥ 95% change" gate this replaced would have passed 344.
 */
function collisionModel(mineCounts: number[], ordered: boolean): { expected: number; sd: number; bound: number } {
  let e = 0, v = 0;
  for (const m of mineCounts) {
    let space = 1;
    if (ordered) { for (let i = 0; i < m; i++) space *= GRID - i; }
    else { let c = 1; for (let i = 0; i < m; i++) c = (c * (GRID - i)) / (i + 1); space = c; }
    const p = 1 / space;
    e += p; v += p * (1 - p);
  }
  const sd = Math.sqrt(v);
  return { expected: e, sd, bound: e + 5 * sd };
}
const sortedEq = (a: number[], b: number[]) => sameMines([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));

const WRONG_CLIENT = 'wrong-client-seed-test';

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap } = ctx;

  // ── Step 5: Mine-layout recomputation (all 6,900 bets) ────────────────────────
  let mismatches = 0, skipped = 0;
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) { skipped++; continue; }
    const mines = revealMines(ss, b.clientSeed, b.nonce, b.mineCount);
    if (!sameMines(mines, b.mineTiles)) mismatches++;
  }
  // Coverage guard: a delivered dataset reveals 100% of seeds, so every bet must recompute.
  // skipped > 0 (e.g. all server seeds nulled) is incomplete coverage → FAIL, never a pass
  // on `mismatches === 0` alone.
  // G-BIND: "6,900/6,900 recomputed" is the single most-quoted figure in this report, and
  // `bets.length` on both sides of it would make it true of whatever the file contained. The
  // denominator is EXPECTED_BETS from src/pins.ts.
  const s5PopulationOk = bets.length === EXPECTED_BETS;

  // ── Step 5, draw-bias arm (MINES-08) ─────────────────────────────────────────────────────
  // Each shuffle step draws over range 25, 24, …, 1. For every range: maxFair (the rejection
  // ceiling the draw uses), the probability a chunk is rejected, and the EXACT per-value bias
  // conditional on acceptance — all computed from src/rng.ts maxFairFor, the one definition the
  // draw reads. The declared design is rejection sampling, so every range must be exactly
  // unbiased (bias 0, which is within 2⁻³² a fortiori). Then the census: how many of the
  // population's draws actually took the rejection branch, against the number expected.
  const TWO_POW_M32 = 2 ** -32;
  const ranges = Array.from({ length: GRID }, (_, i) => GRID - i);
  const perRange = ranges.map(r => ({ range: r, ...drawBias(r) }));
  const biased = perRange.filter(r => !r.exact || r.bias > TWO_POW_M32);
  const worstBias = perRange.reduce((mx, r) => Math.max(mx, r.bias), 0);
  const vec = REJECTION_VECTOR;
  const vecGot = generateProvablyFairNumber(vec.serverSeed, vec.clientSeed, vec.nonce, vec.cursor, vec.range);
  const vecOk = vecGot === vec.expected;
  let censusDraws = 0, censusRejections = 0, censusRounds = 0;
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    const c = moduloRejectionCensus(ss, b.clientSeed, b.nonce);
    censusDraws += c.draws; censusRejections += c.rejections; censusRounds++;
  }
  const censusExpected = expectedModuloRejections(censusRounds);
  const censusOk = censusRounds === EXPECTED_BETS && censusDraws === EXPECTED_BETS * GRID;
  const biasOk = DECLARED_DRAW === 'rejection' && biased.length === 0 && vecOk && censusOk;
  const fmt = (r: typeof perRange[number]) => `${r.range}:${r.maxFair}`;
  const biasDetail = `Draw bias bound (declared design: ${DECLARED_DRAW} sampling, src/rng.ts maxFairFor): `
    + `maxFair per range [range:maxFair] ${perRange.map(fmt).join(' ')}; `
    + `${perRange.length - biased.length}/${perRange.length} ranges have maxFair a whole multiple of the range, so the per-value bias conditional on acceptance is exactly 0 (worst over all ranges ${worstBias === 0 ? '0' : worstBias.toExponential(3)}; bound 2^-32 = ${TWO_POW_M32.toExponential(3)})`
    + (biased.length ? ` — BIASED: ${biased.slice(0, 4).map(r => `range ${r.range} maxFair ${r.maxFair} bias ${r.bias.toExponential(3)}`).join('; ')}` : '')
    + `; per-draw rejection probability (2^32 − maxFair)/2^32 is at most ${Math.max(...perRange.map(r => r.rejectProbability)).toExponential(3)} (range 25). `
    + `Rejection census over this population: ${censusRejections} of ${censusDraws} draws (${censusRounds} rounds × ${GRID}) took the branch, against ${censusExpected.toExponential(3)} expected — the capture does not exercise it, so the branch is shown on a vector instead: nonce ${vec.nonce}, cursor ${vec.cursor}, range ${vec.range} rejects its first chunk and draws ${vecGot} (expected ${vec.expected}; deleting the branch gives 1) ${vecOk ? 'OK' : 'FAIL'}. `
    + `This bounds the AUDITOR'S draw; that the operator's server takes the same branch is ASSUMED (MANIFEST DL-3).`;
  // ── Step 5, player-verifier parity arm (MINES-24) ────────────────────────────────────────
  // The Mines verifier a player uses on the ProvablyFair.org site (VerifyBets games/mines/derive.js
  // + lib/hmac-sha256.js) is vendored byte-for-byte in verifier-parity/ and pinned by SHA-256 in
  // src/pins.ts SITE_VERIFIER_PINS. The vendored derive.js is run on EVERY captured round and its
  // draw-order minePositions must equal this package's revealMines — the same computeLayout the
  // population is scored by. A digest mismatch, a load error, a skipped round or one differing
  // layout FAILs the step. The display-multiplier cents it shows are compared at all 300 legal
  // cells and printed (informational: the credited value is Steps 7–8).
  const site = loadSiteVerifier(path.join(__dirname, '../..'));
  let siteChecked = 0, siteMismatch = 0, siteVsServed = 0;
  let siteCells = 0, siteCellMismatch = 0;
  const siteFirstBad: string[] = [];
  if (site.verifier) {
    for (const b of bets) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss) continue;
      const got = site.verifier.deriveMines({ clientSeed: b.clientSeed, serverSeed: ss, nonce: b.nonce, mineCount: b.mineCount }).minePositions;
      siteChecked++;
      if (!sameMines(got, revealMines(ss, b.clientSeed, b.nonce, b.mineCount))) {
        siteMismatch++;
        if (siteFirstBad.length < 3) siteFirstBad.push(`${b.id} site [${got.join(',')}]`);
      }
      if (!sameMines(got, b.mineTiles)) siteVsServed++;
    }
    for (let m = 1; m < GRID; m++) for (let k = 1; k <= GRID - m; k++) {
      siteCells++;
      if (site.verifier.displayCents(m, k) !== minesMultiplierDisplayCents(m, k)) siteCellMismatch++;
    }
  }
  const siteOk = site.hashesOk && site.verifier !== null && siteChecked === EXPECTED_BETS && siteMismatch === 0;
  const siteDetail = `Player-verifier parity (MINES-24): the ProvablyFair.org site verifier, vendored in ${SITE_VERIFIER_DIR}/, `
    + site.files.map(f => `${f.file} sha256 ${f.sha256.slice(0, 16)}… ${f.ok ? '= pin' : `≠ pin ${f.pinned.slice(0, 16)}…`}`).join('; ')
    + (site.error ? ` — LOAD FAIL: ${site.error}` : '')
    + `; its deriveMines was run on ${siteChecked}/${EXPECTED_BETS} captured rounds and matches src/rng.ts revealMines in draw order on ${siteChecked - siteMismatch} (${siteMismatch} mismatches${siteFirstBad.length ? `: ${siteFirstBad.join('; ')}` : ''}), and the served mineTiles on ${siteChecked - siteVsServed}; `
    + `its displayCents equals src/config.ts minesMultiplierDisplayCents at ${siteCells - siteCellMismatch}/${siteCells} legal cells (informational). `
    + `Not exercised by any captured round, on either side: the all-8-chunks-rejected retry (cursor + 1,000,000), and non-hex server seeds, where the site keys HMAC with UTF-8 bytes and this package with Buffer.from(hex). `
    + `The live site file is compared with the same pins by scripts/check-site-verifier.mjs.`;
  const s5 = step(5, 'Mine-Layout Recomputation',
    mismatches === 0 && skipped === 0 && s5PopulationOk && biasOk && siteOk ? 'PASS' : 'FAIL',
    `${bets.length - skipped}/${EXPECTED_BETS} bets recomputed against the pinned population (src/pins.ts EXPECTED_BETS, a code constant — not bets.length, which would make this figure true of any capture); revealMines(serverSeed, clientSeed, nonce, mineCount) == mineTiles (draw order); ${mismatches} mismatches; ${skipped} skipped (unrevealed seeds)`
      + (s5PopulationOk ? '' : `; POPULATION FAIL: ${bets.length} bets loaded, ${EXPECTED_BETS} pinned`)
      + `. ${biasDetail} ${siteDetail}`,
  );

  // ── Step 6: Client seed influence (whole-dataset controls) ────────────────────
  // Recompute EVERY bet's layout under (a) an empty client seed and (b) a fixed wrong client seed,
  // and count how many still reproduce the captured mineTiles — ordered (draw order, what Step 5
  // compares) and as a set. The survivor counts are gated at the rate the MODEL predicts: E + 5σ
  // of chance collisions, E = Σ 1/P(25,m) ordered and Σ 1/C(25,m) as a set over the tested bets'
  // own mine counts. 0% change is a hard fail by construction (every bet would survive).
  //
  // A–C GENERATOR, BOUND TO THE DATA. The capture's generator for phases A, B, C and E is
  // disclosed in capture/capture-mines.reference.mjs as `audit${randomBytes(6).toString('hex')}` —
  // Node's CSPRNG, drawn fresh per epoch. Every non-Phase-D epoch's client seed must be of that
  // form and all must be distinct; a counter or a timestamp seed there fails the step. The
  // predictable Phase D seeds are enumerated by Step 14 and carried as MANIFEST DL-13.
  let tested = 0, emptyReproduce = 0, wrongReproduce = 0, emptyMineCount1 = 0;
  let emptySet = 0, wrongSet = 0;
  const testedMineCounts: number[] = [];
  for (const b of bets) {
    const ss = seedMap.get(b.hashedServerSeed);
    if (!ss) continue;
    tested++;
    testedMineCounts.push(b.mineCount);
    const empty = revealMines(ss, '', b.nonce, b.mineCount);
    const wrong = revealMines(ss, WRONG_CLIENT, b.nonce, b.mineCount);
    if (sameMines(empty, b.mineTiles)) {
      emptyReproduce++;
      if (b.mineCount === 1) emptyMineCount1++;
    }
    if (sameMines(wrong, b.mineTiles)) wrongReproduce++;
    if (sortedEq(empty, b.mineTiles)) emptySet++;
    if (sortedEq(wrong, b.mineTiles)) wrongSet++;
  }
  const ordered = collisionModel(testedMineCounts, true);
  const unordered = collisionModel(testedMineCounts, false);
  const changed = tested - wrongReproduce;
  const pct = (n: number) => tested === 0 ? '0.00' : ((n / tested) * 100).toFixed(2);
  const withinModel = wrongReproduce <= ordered.bound && emptyReproduce <= ordered.bound
    && wrongSet <= unordered.bound && emptySet <= unordered.bound;
  // A–C generator binding.
  const nonDSeeds = [...new Set(bets.filter(b => b.phase !== 'D').map(b => `${b.epoch}\u0000${b.clientSeed}`))]
    .map(k => k.split('\u0000')[1]);
  const AUDIT_FORMAT = /^audit[0-9a-f]{12}$/;
  const badFormat = nonDSeeds.filter(c => !AUDIT_FORMAT.test(c));
  const distinctNonD = new Set(nonDSeeds).size;
  const generatorOk = nonDSeeds.length > 0 && badFormat.length === 0 && distinctNonD === nonDSeeds.length;
  // Coverage guard: every bet must have been controlled (tested === bets.length === EXPECTED_BETS).
  const s6 = step(6, 'Client Seed Influence',
    tested === bets.length && bets.length === EXPECTED_BETS && changed > 0 && withinModel && generatorOk ? 'PASS' : 'FAIL',
    `whole-dataset controls over ${tested}/${EXPECTED_BETS} bets (denominator pinned in src/pins.ts): `
      + `wrong clientSeed ('${WRONG_CLIENT}') reproduces ${wrongReproduce}/${tested} layouts in draw order (${pct(wrongReproduce)}%) and ${wrongSet} as a set; `
      + `empty clientSeed reproduces ${emptyReproduce}/${tested} in draw order (${pct(emptyReproduce)}%, ${emptyMineCount1} at mineCount 1) and ${emptySet} as a set; `
      + `${changed}/${tested} bets change under a wrong seed. `
      + `Model-predicted chance collisions over these bets' own mine counts: draw order E = Σ 1/P(25,m) = ${ordered.expected.toFixed(3)} (σ ${ordered.sd.toFixed(3)}, gate E+5σ = ${ordered.bound.toFixed(3)}); as a set E = Σ 1/C(25,m) = ${unordered.expected.toFixed(3)} (σ ${unordered.sd.toFixed(3)}, gate ${unordered.bound.toFixed(3)}) — all four survivor counts ${withinModel ? 'within' : 'ABOVE'} the model. `
      + `A–C generator (capture/capture-mines.reference.mjs, \`audit\${randomBytes(6).toString('hex')}\`, a CSPRNG): ${nonDSeeds.length - badFormat.length}/${nonDSeeds.length} non-Phase-D epoch client seeds match /^audit[0-9a-f]{12}$/, ${distinctNonD} distinct`
      + (badFormat.length ? ` — NOT OF THE DISCLOSED FORM: ${badFormat.slice(0, 3).join(', ')}` : '')
      + `. The Phase D seeds are predictable by construction and are enumerated by Step 14 (MANIFEST DL-13).`,
  );

  return [s5, s6];
}
