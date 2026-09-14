/**
 * QA-ROUND-4 REGRESSION TESTS (2026-09-10)
 *
 * One spec per closed defect, each carrying the counterexample that closed it, so the class stays
 * closed. A registry that only records a defect in prose gets the defect back.
 *
 * QA-01  the exact-zero / exact-equality screen rejected a GENUINE million-round result
 * QA-03  float multiply-then-floor understated 31 of the 300 reference display multipliers
 * QA-12  the modulo-bias rejection branch, exercised by a real deterministic vector
 */

import { strict as assert } from 'node:assert';
import { createHash, createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  GRID, MINE_COUNTS, HOUSE_EDGE,
  minesMultiplier, minesMultiplierExact, minesMultiplierDisplayCents,
  winProbability, displayPayoutRTP, theoreticalRTP,
} from '../../src/config';
import {
  revealMines, firstMineTile, generateProvablyFairNumber, getProvablyFairHmacSalt,
  moduloRejectionCensus, deriveSeedHex, isMasterSeed, SEED_DERIVATION_VERSION,
} from '../../src/rng';
import { nullCentreSupport } from '../steps/simulation';
import {
  earlyBootstrapPDigest, LEGACY_EARLY_BOOTSTRAP_P_DIGEST,
  LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT,
  LEGACY_BOOTSTRAP_ARTIFACT_SHA256, LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH,
} from '../../src/pins';
import {
  falseAlarmAccounting, exactSeScreenRejection, bernsteinSeScreenBound,
} from '../../src/false-alarm';

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-01 — A VALID EXACT-MEAN RESULT IS NOT FABRICATION
// ══════════════════════════════════════════════════════════════════════════════════════
// The reviewer's counterexample, replayed here rather than quoted. At m=1 the only mine IS the
// first drawn tile, so the k=1 win condition (tile 1 safe) is exactly `firstMineTile !== 1`, and
// `firstMineTile === revealMines(...)[0]` is asserted in rngTests.ts — so 1,000,000 one-HMAC
// draws reproduce the full-shuffle result at 1/25 of the cost.
const QA01_SERVER = 'f4661fd009f7f0da9193607ffcb4a18d';
const QA01_CLIENT = 'e944296a042a94bc2ab8dce48a3def1f';
const QA01_N = 1_000_000;
const QA01_M = 1;

describe('QA-01: the support screen accepts a genuine exact-mean million-round result', () => {
  let wins = 0;
  let winsAt1000 = 0;

  before(function () {
    this.timeout(600_000);
    for (let nonce = 0; nonce < QA01_N; nonce++) {
      if (firstMineTile(QA01_SERVER, QA01_CLIENT, nonce) !== 1) wins++;
      if (nonce === 999) winsAt1000 = wins;
    }
  });

  it('replays to exactly 960,000 wins — the fair expectation, to the win', () => {
    assert.equal(wins, 960_000);
    assert.equal(wins, (QA01_N * (GRID - QA01_M)) / GRID);
    assert.equal(winsAt1000, 968);
  });

  it('and therefore produces simRTP === theoreticalRTP exactly', () => {
    const mult1 = theoreticalRTP(QA01_M, 1) / ((GRID - QA01_M) / GRID);
    const simRTP = (wins / QA01_N) * mult1;
    assert.equal(simRTP, theoreticalRTP(QA01_M, 1));
    assert.equal(simRTP, 0.99);
  });

  it('POSITIVE CONTROL — the support screen returns NO fault and marks it a supported exact mean', () => {
    const mult1 = theoreticalRTP(QA01_M, 1) / ((GRID - QA01_M) / GRID);
    const row = {
      mineCount: QA01_M,
      simRTP: (wins / QA01_N) * mult1,
      theoreticalRTP: theoreticalRTP(QA01_M, 1),
      jointMaxAbsZ: null,
      convergence: [{ n: 1_000, wins: winsAt1000 }, { n: QA01_N, wins }],
    };
    const v = nullCentreSupport(row, QA01_N);
    assert.deepEqual(v.faults, [], `a genuine seed-reproducible result must not be called fabrication: ${v.faults.join('; ')}`);
    assert.equal(v.supportedExactMean, true);
  });

  it('NEGATIVE CONTROL — the same equality with a FABRICATED count still fails, on the count', () => {
    const row = {
      mineCount: QA01_M,
      simRTP: theoreticalRTP(QA01_M, 1),
      theoreticalRTP: theoreticalRTP(QA01_M, 1),
      jointMaxAbsZ: null,
      // the row CLAIMS a zero deviation while its own final checkpoint records something else
      convergence: [{ n: 1_000, wins: winsAt1000 }, { n: QA01_N, wins: wins - 7 }],
    };
    const v = nullCentreSupport(row, QA01_N);
    assert.equal(v.supportedExactMean, false);
    assert.equal(v.faults.length, 1);
    assert.match(v.faults[0], /claims exactly 960000 wins, but the row's own final checkpoint records 959993/);
  });

  it('NEGATIVE CONTROL — the equality with NO corroborating checkpoint fails', () => {
    const v = nullCentreSupport({
      mineCount: QA01_M, simRTP: 0.99, theoreticalRTP: 0.99, jointMaxAbsZ: null, convergence: [],
    }, QA01_N);
    assert.equal(v.supportedExactMean, false);
    assert.match(v.faults[0] ?? '', /no n=1000000 convergence checkpoint/);
  });

  it('jointMaxAbsZ === 0 is screened only where N·q is not an integer', () => {
    // m=2: N·q = 1e6 · C(23,0)/C(25,2) = 1e6/300 = 3,333.33… — max|z| = 0 is UNREACHABLE.
    const bad = nullCentreSupport({ mineCount: 2, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 0 }, QA01_N);
    assert.equal(bad.faults.length, 1);
    assert.match(bad.faults[0], /not an integer — outside the support/);
    // m=3: N·q = 1e6 · C(23,1)/C(25,3) = 1e6 · 23/2300 = 10,000 — attainable, so NOT a fault.
    const ok = nullCentreSupport({ mineCount: 3, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 0 }, QA01_N);
    assert.deepEqual(ok.faults, []);
  });

  it('an exactly-zero layoutR1 / layoutR1Z / layoutRunsZ is attainable and is NOT screened', () => {
    const v = nullCentreSupport({
      mineCount: 7, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 1.4,
      layoutR1: 0, layoutR1Z: 0, layoutRunsZ: 0,
    }, QA01_N);
    assert.deepEqual(v.faults, []);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-03 — THE REFERENCE DISPLAY GRID IS AN INTEGER FLOOR, NOT A FLOAT FLOOR
// ══════════════════════════════════════════════════════════════════════════════════════
describe('QA-03: display multiplier floors in exact integer arithmetic', () => {
  /** Independently written rational floor — 99/100 spelled out, not imported from src/config. */
  const independentCents = (m: number, k: number): bigint => {
    let n = 99n, d = 100n;
    for (let i = 0; i < k; i++) { n *= BigInt(25 - i); d *= BigInt(25 - m - i); }
    return (100n * n) / d;
  };

  it('m=1, k=10 displays 1.65 — the float form returned 1.64', () => {
    assert.equal(minesMultiplier(1, 10), 1.65);
    assert.equal(minesMultiplierDisplayCents(1, 10), 165n);
    // the exact multiplier really is 33/20; the old code floored 164.99999999999997
    assert.equal(Math.floor(minesMultiplierExact(1, 10) * 100) / 100, 1.64);
  });

  it('its display-payout counterfactual RTP is exactly 0.99', () => {
    assert.equal(displayPayoutRTP(1, 10), 0.99);
    // the float form: winProbability(1,10) * 1.65 = 0.9899999999999999
    assert.notEqual(winProbability(1, 10) * minesMultiplier(1, 10), 0.99);
  });

  it('agrees with an independent rational sweep at all 300 legal cells', () => {
    let cells = 0;
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        cells++;
        assert.equal(minesMultiplierDisplayCents(m, k), independentCents(m, k), `cell m=${m}, k=${k}`);
      }
    }
    assert.equal(cells, 300);
  });

  it('exactly 31 of the 300 cells moved, and every one moved UP by one cent', () => {
    const moved: Array<[number, number]> = [];
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        const old = Math.floor(minesMultiplierExact(m, k) * 100) / 100;
        if (old !== minesMultiplier(m, k)) {
          moved.push([m, k]);
          assert.equal(Number(minesMultiplierDisplayCents(m, k)) - Math.round(old * 100), 1, `cell m=${m}, k=${k}`);
        }
      }
    }
    assert.equal(moved.length, 31);
  });

  it('the floor never exceeds the exact multiplier (it is a floor, not a round)', () => {
    for (const m of MINE_COUNTS) {
      for (let k = 1; k <= GRID - m; k++) {
        const cents = Number(minesMultiplierDisplayCents(m, k));
        const exact = minesMultiplierExact(m, k) * 100;
        assert.ok(cents <= exact + 1e-6, `cell m=${m}, k=${k}: ${cents} > ${exact}`);
        assert.ok(cents > exact - 1 - 1e-6, `cell m=${m}, k=${k}: floor is more than a cent low`);
      }
    }
  });

  it('is derived from HOUSE_EDGE — a different edge moves the grid', () => {
    // Guards against the "constant re-typed as 99n/100n" class: if this function had its own
    // literal edge, the assertion below would hold no matter what HOUSE_EDGE said.
    assert.equal(HOUSE_EDGE, 0.01);
    assert.equal(minesMultiplierDisplayCents(3, 1), 112n);   // floor(100 · 0.99 · 25/22)
  });

  it('returns null / NaN outside the legal grid instead of a silent Infinity', () => {
    assert.equal(minesMultiplierDisplayCents(24, 2), null);
    assert.ok(Number.isNaN(minesMultiplier(24, 2)));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-12 — THE MODULO-BIAS REJECTION BRANCH, EXERCISED
// ══════════════════════════════════════════════════════════════════════════════════════
// The report says the branch is ASSUMED and unexercised by the CAPTURE (0 rejections in 172,500
// draws, expectation 2.024e-4). That remains true of the capture. It is NOT true of the Pass-1
// simulation, and the reviewer supplied the vector: this seed pair is the committed Pass-1 m=5
// row, and at nonce 760455 / cursor 12 the first 4-byte chunk lands in [maxFair, 2³²) and IS
// rejected. Zero observed rejections in a capture is not impossibility, and this is the test that
// makes the branch a measured code path rather than a claim.
describe('QA-12: modulo-bias rejection — the saved deterministic vector', () => {
  const SS = '1f1da0da5907129a0043f5ac8a12b5ee';
  const CS = '097bf01483879668f626781b35b297c2';
  const NONCE = 760455, CURSOR = 12, RANGE = 13, M = 5;

  it('the first chunk is 4294967288 and exceeds the maxFair threshold 4294967287', () => {
    const maxFair = Math.floor(0x1_0000_0000 / RANGE) * RANGE;
    assert.equal(maxFair, 4294967287);
    const digest = createHmac('sha256', Buffer.from(SS, 'hex'))
      .update(getProvablyFairHmacSalt(CS, NONCE, CURSOR)).digest();
    assert.equal(digest.readUInt32BE(0), 4294967288);
    assert.ok(digest.readUInt32BE(0) >= maxFair);
    assert.equal(digest.readUInt32BE(4), 412214211);
  });

  it('the draw therefore yields 6 from the SECOND chunk', () => {
    assert.equal(generateProvablyFairNumber(SS, CS, NONCE, CURSOR, RANGE), 6);
  });

  it('deleting the rejection would yield 1 — so the branch is load-bearing here', () => {
    // The M12 survivor's edit, spelled out: maxFair = 2^32, i.e. accept the first chunk always.
    assert.equal(4294967288 % RANGE, 1);
    assert.notEqual(4294967288 % RANGE, generateProvablyFairNumber(SS, CS, NONCE, CURSOR, RANGE));
  });

  it('the census counts it: 1 rejection in this round\'s 25 draws', () => {
    assert.deepEqual(moduloRejectionCensus(SS, CS, NONCE), { draws: 25, rejections: 1 });
  });

  it('but cursor 12 is past the first 5 tiles, so the m=5 LAYOUT is unchanged', () => {
    // This is the distinction the M12 explanation was getting wrong in the other direction:
    // the branch WAS taken, and the mine layout still does not move, because the affected swap
    // is outside the prefix the layout reads. The full 25-tile permutation DOES move.
    const noReject = (nonce: number, cursor: number, range: number) =>
      createHmac('sha256', Buffer.from(SS, 'hex'))
        .update(getProvablyFairHmacSalt(CS, nonce, cursor)).digest().readUInt32BE(0) % range;
    const revealNoReject = (mineCount: number) => {
      const mines = Array.from({ length: GRID }, (_, i) => i + 1);
      for (let c = 0; c < mines.length; c++) {
        const j = c + noReject(NONCE, c, mines.length - c);
        [mines[c], mines[j]] = [mines[j], mines[c]];
      }
      return mines.slice(0, mineCount);
    };
    assert.deepEqual(revealMines(SS, CS, NONCE, M), [24, 4, 25, 9, 16]);
    assert.deepEqual(revealNoReject(M), revealMines(SS, CS, NONCE, M));
    assert.notDeepEqual(revealNoReject(GRID), revealMines(SS, CS, NONCE, GRID));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-05 — THE DETERMINISTIC SEED DERIVATION IS VERSIONED AND DOMAIN-SEPARATED
// ══════════════════════════════════════════════════════════════════════════════════════
describe('QA-05: deterministic, versioned, domain-separated seed derivation', () => {
  const MASTER = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

  it('is a pure function of (master, domain, index)', () => {
    assert.equal(deriveSeedHex(MASTER, 'pass1-server:m=3', 0), deriveSeedHex(MASTER, 'pass1-server:m=3', 0));
    assert.match(deriveSeedHex(MASTER, 'pass1-server:m=3', 0), /^[0-9a-f]{32}$/);
  });

  it('separates domains, indices and master seeds', () => {
    const a = deriveSeedHex(MASTER, 'pass1-server:m=3', 0);
    assert.notEqual(a, deriveSeedHex(MASTER, 'pass1-client:m=3', 0));
    assert.notEqual(a, deriveSeedHex(MASTER, 'pass1-server:m=4', 0));
    assert.notEqual(a, deriveSeedHex(MASTER, 'pass1-server:m=3', 1));
    assert.notEqual(a, deriveSeedHex(MASTER.replace(/^00/, '01'), 'pass1-server:m=3', 0));
  });

  it('binds the version string, so a future expansion cannot masquerade as this one', () => {
    assert.equal(SEED_DERIVATION_VERSION, 'mines-seed-derivation-v1');
    const key = Buffer.from(MASTER, 'hex');
    const expected = createHmac('sha256', key)
      .update(`${SEED_DERIVATION_VERSION}:pass1-server:m=3:0`, 'utf8')
      .digest().subarray(0, 16).toString('hex');
    assert.equal(deriveSeedHex(MASTER, 'pass1-server:m=3', 0), expected);
  });

  it('rejects a malformed master seed', () => {
    assert.equal(isMasterSeed(MASTER), true);
    assert.equal(isMasterSeed('not-hex'), false);
    assert.equal(isMasterSeed('abcd'), false);            // too short
    assert.equal(isMasterSeed(undefined), false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-05b — THE LEGACY BOOTSTRAP EXCEPTION IS ONE PINNED ARTIFACT, NOT "ANY FILE WITHOUT
//           METADATA"
// ══════════════════════════════════════════════════════════════════════════════════════
// Round-5 finding, EXECUTED by the reviewer on 2026-09-11: a forged earlyBootstrapP correctly
// failed Step 17, but setting `seedDerivation` to an unknown string, or `masterSeed` to
// `not-hex`, restored 21/21 PROVABLY FAIR — Full Pass, exit 0. Invalid metadata DISABLED the
// check instead of failing it, and deleting the metadata altogether bought the same leniency.
//
// The step-level rule is exercised end-to-end by forgeries A27–A30. What is pinned HERE is the
// other half: that the digest identifying the one legacy artifact actually tracks the values it
// claims to.
//
// ──────────────────────────────────────────────────────────────────────────────────────
// ROUND-5, 2026-09-11 — THE ASSERTION WAS IN THE WRONG PLACE.
// ──────────────────────────────────────────────────────────────────────────────────────
// The first build of this block read the MUTABLE `outputs/simulation-results.json` and demanded
// the historical digest, the absence of replay metadata and the historical timestamp. The
// producer deliberately writes a master seed, a derivation version, a fresh timestamp and newly
// drawn bootstrap values, so re-running the documented pipeline made the unit suite reject the
// package's own output. The reviewer EXECUTED it at reduced counts (ROUNDS_PER_CONFIG=1000,
// PASS2_NONCES=1000, BOOTSTRAP_REPS=1000): simulate exit 0, then `npm test` → 32 passing,
// 3 failing, exit 3, the fresh vector digesting to 4991688f6d269182da3a7b9318e955d450cc39c…
//
// The fix is NOT to drop the pin. It is to give it a subject that no pipeline step writes: the
// reviewed artifact is copied byte-for-byte to tests/fixtures/legacy-simulation-results.json
// and the historical assertions are made there, under its own SHA-256. What is asserted about
// the LIVE artifact is the rule Step 17 actually implements — it must be schema-2 (all three
// replay fields, usable) or schema-1 (none of them, and then it must BE the pinned artifact).
describe('QA-05b: the legacy earlyBootstrapP pin (fixture — immutable by construction)', () => {
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'legacy-simulation-results.json');
  const fixtureBytes = fs.readFileSync(fixturePath);
  const legacy = JSON.parse(fixtureBytes.toString('utf-8'));
  const rows = legacy.pass2_casino_seeds.results as any[];

  it('the fixture is the exact file that was reviewed — SHA-256 pinned in src/pins.ts', () => {
    assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'), LEGACY_BOOTSTRAP_ARTIFACT_SHA256);
    assert.equal(
      path.relative(path.join(__dirname, '..', '..'), fixturePath).split(path.sep).join('/'),
      LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH,
    );
  });

  it('the fixture is the one the legacy exception covers', () => {
    assert.equal(earlyBootstrapPDigest(rows), LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
  });

  it('the fixture is the legacy one — it records no replay metadata at all', () => {
    assert.equal(legacy.masterSeed, undefined);
    assert.equal(legacy.seedDerivation, undefined);
    assert.equal(legacy.pass2_casino_seeds.bootstrapSeedDerivation, undefined);
    assert.equal(legacy.generatedAt, LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT);
  });

  it('moves off the pin when ONE p moves to a neighbouring legal lattice point (forgery A27)', () => {
    const reps = legacy.pass2_casino_seeds.bootstrapReps;
    const forged = rows.map((r, i) => i !== 0 ? r : {
      ...r, earlyBootstrapP: (Math.round(r.earlyBootstrapP * (reps + 1)) + 1) / (reps + 1),
    });
    assert.notEqual(earlyBootstrapPDigest(forged), LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
  });

  it('is order-insensitive, so a benign row reordering is not a fault (G-VALID)', () => {
    assert.equal(earlyBootstrapPDigest([...rows].reverse()), earlyBootstrapPDigest(rows));
    assert.equal(earlyBootstrapPDigest([...rows].reverse()), LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
  });

  it('cannot be satisfied by a truncated or blanked row set', () => {
    assert.notEqual(earlyBootstrapPDigest(rows.slice(0, rows.length - 1)), LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
    assert.notEqual(earlyBootstrapPDigest(rows.map(() => ({}))), LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-05c — THE LIVE ARTIFACT MUST BE ONE OF THE TWO SUPPORTED SHAPES (G-VALID)
// ══════════════════════════════════════════════════════════════════════════════════════
// What is asserted about `outputs/simulation-results.json` is the rule, not the history. The
// rule is the one tests/steps/simulation.ts Step 17 implements, restated here so a rebuild is
// checked by `npx mocha` as well as by `npm run verify`:
//
//   schema-2 — `masterSeed`, `seedDerivation` and `pass2_casino_seeds.bootstrapSeedDerivation`
//              all present, the master seed usable, both versions the one this build derives
//              under. Every artifact the current src/simulate.ts writes is this shape, and it
//              takes the replay path.
//   schema-1 — none of the three present, and the earlyBootstrapP vector digests to the pin.
//              Exactly one artifact in the world satisfies this: the 2026-08-05 capture-era run.
//
// Anything else — partial metadata, an unusable master seed, an unknown derivation version, or
// a metadata-stripped file that is not the pinned one — is neither, and fails.
describe('QA-05c: the live simulation artifact declares a supported replay format', () => {
  const sim = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'outputs', 'simulation-results.json'), 'utf-8'),
  );
  const rows = sim.pass2_casino_seeds.results as any[];
  const replayFields: [string, unknown][] = [
    ['masterSeed', sim.masterSeed],
    ['seedDerivation', sim.seedDerivation],
    ['pass2_casino_seeds.bootstrapSeedDerivation', sim.pass2_casino_seeds.bootstrapSeedDerivation],
  ];
  const present = replayFields.filter(([, v]) => v !== undefined);

  it('is schema-2 (master-seeded, replayable) or schema-1 (the one pinned legacy artifact)', () => {
    if (present.length === 0) {
      // schema-1: the legacy exception, and it is an exception for ONE file.
      assert.equal(earlyBootstrapPDigest(rows), LEGACY_EARLY_BOOTSTRAP_P_DIGEST,
        'artifact carries no replay metadata and is not the pinned legacy artifact — stripping the metadata is not a way to have earlyBootstrapP taken on trust');
      assert.equal(sim.generatedAt, LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT);
    } else {
      // schema-2: all three, or nothing. Partial metadata is a fault, not a lenient path.
      assert.equal(present.length, replayFields.length,
        `replay metadata INCOMPLETE — carries ${present.map(([n]) => n).join(', ')}; all three are required together or none of them`);
      assert.equal(isMasterSeed(sim.masterSeed), true,
        `masterSeed ${JSON.stringify(sim.masterSeed)} is not a usable master seed — the bootstrap null cannot be rebuilt from it, so the run is UNVERIFIABLE, not exempt`);
      assert.equal(sim.seedDerivation, SEED_DERIVATION_VERSION);
      assert.equal(sim.pass2_casino_seeds.bootstrapSeedDerivation, SEED_DERIVATION_VERSION);
    }
  });

  it('its earlyBootstrapP digest is order-insensitive — reordered rows digest to the ORIGINAL rows', () => {
    // Compared against the artifact's OWN digest, not against a historical constant: a benign
    // row reordering must not be a fault whatever the artifact is (G-VALID).
    assert.equal(earlyBootstrapPDigest([...rows].reverse()), earlyBootstrapPDigest(rows));
    assert.equal(earlyBootstrapPDigest([...rows].sort((a, b) => b.epoch - a.epoch)), earlyBootstrapPDigest(rows));
  });

  it('its digest still separates truncation, blanking and a one-lattice-point nudge', () => {
    const own = earlyBootstrapPDigest(rows);
    const reps = sim.pass2_casino_seeds.bootstrapReps;
    assert.notEqual(earlyBootstrapPDigest(rows.slice(0, rows.length - 1)), own);
    assert.notEqual(earlyBootstrapPDigest(rows.map(() => ({}))), own);
    const forged = rows.map((r, i) => i !== 0 ? r : {
      ...r, earlyBootstrapP: (Math.round(r.earlyBootstrapP * (reps + 1)) + 1) / (reps + 1),
    });
    assert.notEqual(earlyBootstrapPDigest(forged), own);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
//  QA-02c — THE FALSE-ALARM SUM IS NOMINAL, AND THE COUNTEREXAMPLE IS RE-DERIVED HERE
// ══════════════════════════════════════════════════════════════════════════════════════
// Round-5 finding, EXECUTED by the reviewer on 2026-09-11, in two halves.
//
// (a) The verifier still EMITTED the withdrawn five-arm "≤ 5%" Step-16 sentence into
//     outputs/verification-results.json while src/figures.ts computed eight arms totalling
//     6.9679801e-2. The report and its own executable source disagreed. Both now read
//     src/false-alarm.ts, so there is one calculation and nothing to drift.
//
// (b) The replacement was still an unsupported guarantee — "at most ≈7%", "the true rate is
//     lower" — which treats a NORMAL APPROXIMATION as an upper bound on a DISCRETE binomial
//     tail. It is not one. At the n=1,000 convergence checkpoint with m=24 the count is
//     Binomial(1000, 1/25) under ideal play and the implemented 5·SE rule rejects when X ≤ 9 or
//     X ≥ 71; the exact probability is ~6.45× the normal-tail nominal.
//
// The counterexample must not be taken on trust from the module that publishes it, so it is
// RE-DERIVED here by a different decomposition: term-by-term BigInt sums of both tails, against
// the module's cumulative-recurrence-plus-complement. Two independent routes, same number.
describe('QA-02c: the false-alarm sum is nominal — the exact binomial refutes the bound reading', () => {
  const N = 1000;
  const M = 24;

  // Independent exact tails: C(n,w)·(25−m)^w·m^(n−w) / 25^n, each term built from scratch.
  const exactTail = (lo: number, hi: number): bigint => {
    const a = BigInt(GRID - M), b = BigInt(M);
    let sum = 0n;
    for (let w = lo; w <= hi; w++) {
      let c = 1n;
      for (let i = 0; i < w; i++) c = (c * BigInt(N - i)) / BigInt(i + 1);
      sum += c * a ** BigInt(w) * b ** BigInt(N - w);
    }
    return sum;
  };

  it('reproduces the implemented rejection set: wins ≤ 9 or wins ≥ 71 at n=1,000, m=24', () => {
    const row = exactSeScreenRejection(N, M);
    assert.equal(row.rejectAtOrBelow, 9);
    assert.equal(row.rejectAtOrAbove, 71);
    assert.equal(row.winProbability, 1 / 25);
  });

  it('re-derives the exact rejection probability by an independent summation', () => {
    const DEN = BigInt(GRID) ** BigInt(N);
    const NUM = exactTail(0, 9) + exactTail(71, N);
    const independent = Number((NUM * 10n ** 60n) / DEN) / 1e60;
    const module = exactSeScreenRejection(N, M).exactRejectionProbability;
    assert.equal(Math.abs(independent - module) / module < 1e-12, true,
      `independent ${independent} vs module ${module}`);
    // The reviewer's executed figure, 3.70252382090633e-6.
    assert.equal(independent.toExponential(14), '3.70252382090633e-6');
  });

  it('the exact probability EXCEEDS the nominal, so the nominal does not bound the screen', () => {
    const row = exactSeScreenRejection(N, M);
    assert.equal(row.exactRejectionProbability > row.nominalRejectionProbability, true);
    assert.equal(row.exactOverNominal.toFixed(2), '6.45');
  });

  it("Bernstein's bound IS a valid upper bound on that same screen, and it is much weaker", () => {
    const row = exactSeScreenRejection(N, M);
    const bound = bernsteinSeScreenBound(N, M);
    assert.equal(bound > row.exactRejectionProbability, true);
    assert.equal(bound > row.nominalRejectionProbability, true);
  });

  it('the published total is the sum of the enumerated arms, and it is labelled nominal', () => {
    const fa = falseAlarmAccounting();
    assert.equal(fa.arms.length, 8);
    assert.equal(Math.abs(fa.totalNominal - fa.arms.reduce((s, a) => s + a.nominalTotal, 0)) < 1e-18, true);
    assert.equal(fa.totalNominal.toExponential(7), '6.9679801e-2');
    assert.equal(/NOMINAL/.test(fa.status) && /NOT an upper bound/.test(fa.status), true);
  });

  it('the figures artifact and the verifier publish the SAME calculation', () => {
    const figPath = path.join(__dirname, '..', '..', 'outputs', 'audit-figures.json');
    if (!fs.existsSync(figPath)) return;              // fresh clone: nothing emitted yet
    const emitted = JSON.parse(fs.readFileSync(figPath, 'utf-8')).falseAlarmAccounting;
    const derived = falseAlarmAccounting(emitted.roundsPerConfig);
    assert.equal(JSON.stringify(emitted), JSON.stringify(derived));
  });
});
