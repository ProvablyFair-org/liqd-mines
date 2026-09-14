/**
 * Generated from the repository TypeScript sources.
 * Rebuild: npm run build; check reproducibility: npm run build:check.
 * Entry: tests/__standalone-entry.js; linked modules: 10.
 */
'use strict';

var __nodeTest = require('node:test');
function __mochaCtx() {
  return { timeout: function () {}, slow: function () {}, retries: function () {} };
}
function __wrap(fn) {
  if (typeof fn !== 'function') return fn;
  return function () { return fn.call(__mochaCtx()); };
}
function __bind(name) {
  var orig = __nodeTest[name];
  var bound = function (desc, fn) { return orig(desc, __wrap(fn)); };
  // carry .skip / .only / .todo through so a suite can still disable a case
  for (var k in orig) { if (typeof orig[k] === 'function') bound[k] = orig[k]; }
  bound.skip = orig.skip; bound.only = orig.only; bound.todo = orig.todo;
  return bound;
}
// Mocha-style hook callbacks receive the same context shim as test callbacks.
function __bindHook(name) {
  var orig = __nodeTest[name];
  return function (fn) { return orig(__wrap(fn)); };
}
globalThis.describe   = __bind('describe');
globalThis.it         = __bind('it');
globalThis.before     = __bindHook('before');
globalThis.after      = __bindHook('after');
globalThis.beforeEach = __bindHook('beforeEach');
globalThis.afterEach  = __bindHook('afterEach');



var __PF_ROOT__ = __dirname;
var __nodeRequire = require;
var __modules = {
  "src/config.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDGE_DEN = exports.EDGE_NUM = exports.EDGE_SCALE = exports.PUBLISHED_RTP = exports.MINE_COUNTS = exports.HOUSE_EDGE = exports.GRID = void 0;
exports.edgeRationalIsExact = edgeRationalIsExact;
exports.combination = combination;
exports.winProbability = winProbability;
exports.combinationBig = combinationBig;
exports.winProbabilityRational = winProbabilityRational;
exports.pairCoOccurProb = pairCoOccurProb;
exports.minesMultiplierExact = minesMultiplierExact;
exports.minesMultiplierRational = minesMultiplierRational;
exports.minesMultiplierDisplayCents = minesMultiplierDisplayCents;
exports.minesMultiplier = minesMultiplier;
exports.theoreticalRTP = theoreticalRTP;
exports.displayPayoutRTP = displayPayoutRTP;
exports.GRID = 25;
exports.HOUSE_EDGE = 0.01;
exports.MINE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1);
exports.PUBLISHED_RTP = 0.99;
exports.EDGE_SCALE = 100000000n;
exports.EDGE_NUM = BigInt(Math.round((1 - exports.HOUSE_EDGE) * 1e8));
exports.EDGE_DEN = exports.EDGE_SCALE;
function edgeRationalIsExact() {
    return Math.abs(Number(exports.EDGE_NUM) / Number(exports.EDGE_DEN) - (1 - exports.HOUSE_EDGE)) <= 1e-12;
}
function combination(n, k) {
    if (k < 0 || k > n)
        return 0;
    if (k === 0 || k === n)
        return 1;
    k = Math.min(k, n - k);
    let c = 1;
    for (let i = 0; i < k; i++)
        c = (c * (n - i)) / (i + 1);
    return c;
}
function winProbability(mineCount, tilesRevealed) {
    return combination(exports.GRID - mineCount, tilesRevealed) / combination(exports.GRID, tilesRevealed);
}
function combinationBig(n, k) {
    if (k < 0 || k > n)
        return 0n;
    if (k === 0 || k === n)
        return 1n;
    k = Math.min(k, n - k);
    let num = 1n, den = 1n;
    for (let i = 0; i < k; i++) {
        num *= BigInt(n - i);
        den *= BigInt(i + 1);
    }
    return num / den;
}
function winProbabilityRational(mineCount, tilesRevealed) {
    const den = combinationBig(exports.GRID, tilesRevealed);
    if (den === 0n)
        return null;
    return { num: combinationBig(exports.GRID - mineCount, tilesRevealed), den };
}
function pairCoOccurProb(mineCount) {
    if (mineCount < 2)
        return 0;
    return combination(exports.GRID - 2, mineCount - 2) / combination(exports.GRID, mineCount);
}
function minesMultiplierExact(mineCount, tilesRevealed) {
    let p = 1;
    for (let i = 0; i < tilesRevealed; i++)
        p *= (exports.GRID - i) / (exports.GRID - mineCount - i);
    return p * (1 - exports.HOUSE_EDGE);
}
function minesMultiplierRational(mineCount, tilesRevealed) {
    if (!Number.isInteger(mineCount) || !Number.isInteger(tilesRevealed))
        return null;
    if (mineCount < 1 || mineCount > exports.GRID - 1)
        return null;
    if (tilesRevealed < 0 || tilesRevealed > exports.GRID - mineCount)
        return null;
    let num = exports.EDGE_NUM, den = exports.EDGE_DEN;
    for (let i = 0; i < tilesRevealed; i++) {
        num *= BigInt(exports.GRID - i);
        den *= BigInt(exports.GRID - mineCount - i);
    }
    return { num, den };
}
function minesMultiplierDisplayCents(mineCount, tilesRevealed) {
    const r = minesMultiplierRational(mineCount, tilesRevealed);
    if (r === null)
        return null;
    return (100n * r.num) / r.den;
}
function minesMultiplier(mineCount, tilesRevealed) {
    const cents = minesMultiplierDisplayCents(mineCount, tilesRevealed);
    return cents === null ? NaN : Number(cents) / 100;
}
function theoreticalRTP(mineCount, tilesRevealed) {
    return winProbability(mineCount, tilesRevealed) * minesMultiplierExact(mineCount, tilesRevealed);
}
function displayPayoutRTP(mineCount, tilesRevealed) {
    const cents = minesMultiplierDisplayCents(mineCount, tilesRevealed);
    const p = winProbabilityRational(mineCount, tilesRevealed);
    if (cents === null || p === null || p.den === 0n)
        return NaN;
    const SCALE = 10n ** 18n;
    const num = p.num * cents * SCALE;
    const den = p.den * 100n;
    return Number(num / den) / 1e18;
}

  },
  "src/false-alarm.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXACT_CHECKPOINT_N = exports.ENFORCED_ROUNDS_PER_CONFIG = exports.CONVERGENCE_LADDER = exports.SE_SCREEN_Z = exports.CHERRY_PICK_ALPHA = exports.FALSE_ALARM_ALPHA = void 0;
exports.exactSeScreenRejection = exactSeScreenRejection;
exports.bernsteinSeScreenBound = bernsteinSeScreenBound;
exports.falseAlarmAccounting = falseAlarmAccounting;
const config_1 = require("./config");
const stats_1 = require("./stats");
exports.FALSE_ALARM_ALPHA = 0.01;
exports.CHERRY_PICK_ALPHA = 0.01;
exports.SE_SCREEN_Z = 5;
exports.CONVERGENCE_LADDER = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];
exports.ENFORCED_ROUNDS_PER_CONFIG = 1000000;
exports.EXACT_CHECKPOINT_N = 1000;
function exactSeScreenRejection(n, mineCount, z = exports.SE_SCREEN_Z) {
    const p = (config_1.GRID - mineCount) / config_1.GRID;
    const se = Math.sqrt((p * (1 - p)) / n);
    const threshold = z * se;
    let rejectAtOrBelow = -1;
    let rejectAtOrAbove = n + 1;
    for (let w = 0; w <= n; w++) {
        if (!(Math.abs(w / n - p) > threshold))
            continue;
        if (w / n < p)
            rejectAtOrBelow = w;
        else if (rejectAtOrAbove === n + 1)
            rejectAtOrAbove = w;
    }
    const a = BigInt(config_1.GRID - mineCount);
    const b = BigInt(mineCount);
    const N = BigInt(n);
    const DEN = BigInt(config_1.GRID) ** N;
    let C = 1n;
    let A = 1n;
    let B = b ** N;
    let cumulative = 0n;
    let lowTail = 0n;
    let belowHigh = 0n;
    for (let w = 0; w <= n; w++) {
        if (w > 0) {
            C = (C * BigInt(n - w + 1)) / BigInt(w);
            A = A * a;
            B = B / b;
        }
        cumulative += C * A * B;
        if (w === rejectAtOrBelow)
            lowTail = cumulative;
        if (w === rejectAtOrAbove - 1)
            belowHigh = cumulative;
        if (w >= rejectAtOrAbove - 1 && w >= rejectAtOrBelow)
            break;
    }
    if (rejectAtOrBelow < 0)
        lowTail = 0n;
    if (rejectAtOrAbove > n)
        belowHigh = DEN;
    const NUM = lowTail + (DEN - belowHigh);
    const SCALE = 10n ** 60n;
    const exact = Number((NUM * SCALE) / DEN) / 1e60;
    const nominal = (0, stats_1.normalTwoSidedP)(z);
    return {
        n,
        mineCount,
        winProbability: p,
        fiveSeThreshold: threshold,
        rejectAtOrBelow,
        rejectAtOrAbove,
        exactRejectionProbability: exact,
        nominalRejectionProbability: nominal,
        exactOverNominal: exact / nominal,
    };
}
function bernsteinSeScreenBound(n, mineCount, z = exports.SE_SCREEN_Z) {
    const p = (config_1.GRID - mineCount) / config_1.GRID;
    const sigma = Math.sqrt(n * p * (1 - p));
    const t = z * sigma;
    return Math.min(1, 2 * Math.exp(-((t * t) / 2) / (sigma * sigma + t / 3)));
}
function falseAlarmAccounting(roundsPerConfig = exports.ENFORCED_ROUNDS_PER_CONFIG) {
    const configs = config_1.MINE_COUNTS.length;
    const alpha = exports.FALSE_ALARM_ALPHA;
    const bonAlpha = alpha / configs;
    const jointConfigs = configs - 1;
    const checkpoints = exports.CONVERGENCE_LADDER.filter(n => n <= roundsPerConfig);
    const seScreenNominalEach = (0, stats_1.normalTwoSidedP)(exports.SE_SCREEN_Z);
    const bonferroniArms = [
        [1, 'firstDraw-upper', 'firstDrawPValue < α/24', configs],
        [2, 'firstDraw-lower', 'firstDrawPValue > 1 − α/24', configs],
        [3, 'pairwiseJoint-upper', 'jointPValue < α/24 (already Bonferroni-corrected across the 300 within-config pairs)', jointConfigs],
        [4, 'serialLag1-twoSided', '|r₁z| > the α/24 two-sided critical', configs],
        [5, 'serialRuns-upper', 'layoutRunsPValue < α/24', configs],
        [6, 'serialRuns-lower', 'layoutRunsPValue > 1 − α/24', configs],
    ].map(([arm, name, screen, tests]) => ({
        arm, name, screen, tests, nominalEach: bonAlpha, nominalTotal: tests * bonAlpha,
    }));
    const cherryPickArm = {
        arm: 7,
        name: 'cherryPickSurvival',
        screen: 'cherryPickSurvivalP < 0.01 (Step 17, one arm over the whole seed set)',
        tests: 1,
        nominalEach: exports.CHERRY_PICK_ALPHA,
        nominalTotal: exports.CHERRY_PICK_ALPHA,
    };
    const seScreenArm = {
        arm: 8,
        name: 'convergence-5SE',
        screen: `|wins/n − p| > ${exports.SE_SCREEN_Z}·√(p(1−p)/n) at each checkpoint of the ladder`,
        tests: configs * checkpoints.length,
        nominalEach: seScreenNominalEach,
        nominalTotal: configs * checkpoints.length * seScreenNominalEach,
    };
    const arms = [...bonferroniArms, cherryPickArm, seScreenArm];
    const bonferroniTests = bonferroniArms.reduce((s, a) => s + a.tests, 0);
    const bonferroniNominal = bonferroniArms.reduce((s, a) => s + a.nominalTotal, 0);
    const totalNominal = arms.reduce((s, a) => s + a.nominalTotal, 0);
    const perConfig = config_1.MINE_COUNTS.map(m => exactSeScreenRejection(exports.EXACT_CHECKPOINT_N, m));
    const exactSum = perConfig.reduce((s, r) => s + r.exactRejectionProbability, 0);
    const nominalSum = perConfig.length * seScreenNominalEach;
    const worst = perConfig.reduce((w, r) => (r.exactOverNominal >= w.exactOverNominal ? r : w), perConfig[0]);
    const arm8ValidUnionUpperBound = config_1.MINE_COUNTS.reduce((s, m) => s + checkpoints.reduce((t, n) => t + bernsteinSeScreenBound(n, m), 0), 0);
    return {
        status: 'NOMINAL ACCOUNTING under the stated approximations — NOT an upper bound and NOT a calibrated rate',
        alpha,
        bonferroniAlpha: bonAlpha,
        roundsPerConfig,
        convergenceCheckpoints: checkpoints,
        arms,
        bonferroniTests,
        bonferroniNominal,
        cherryPickNominal: cherryPickArm.nominalTotal,
        seScreenZ: exports.SE_SCREEN_Z,
        seScreenNominalEach,
        seScreenTests: seScreenArm.tests,
        seScreenNominal: seScreenArm.nominalTotal,
        totalNominal,
        totalNominalPercent: totalNominal * 100,
        notAnUpperBound: {
            what: 'the nominal normal-tail level of the 5·SE screen is BELOW its exact binomial rejection probability, so the nominal levels summed above are not upper bounds on the screens they describe',
            checkpointN: exports.EXACT_CHECKPOINT_N,
            method: 'exact integer arithmetic over C(n,w)·(25−m)^w·m^(n−w) / 25^n, rejection set replayed from the implemented floating-point predicate',
            exactSumAtCheckpoint: exactSum,
            nominalSumAtCheckpoint: nominalSum,
            exactOverNominalAtCheckpoint: exactSum / nominalSum,
            worstConfig: worst,
            perConfig,
        },
        validBounds: {
            method: "Bernstein's inequality for a sum of n i.i.d. Bernoulli(p) indicators, evaluated at the implemented 5·SE boundary",
            coversArms: [8],
            arm8UnionUpperBound: arm8ValidUnionUpperBound,
            arm8NominalForComparison: seScreenArm.nominalTotal,
            note: 'arms 1–7 (chi-square, pairwise-joint, serial lag-1, runs, cherry-pick survival) have no valid upper bound in this package, so the TOTAL above stays nominal',
            totalWithArm8BoundedValidly: bonferroniNominal + cherryPickArm.nominalTotal + arm8ValidUnionUpperBound,
        },
    };
}

  },
  "src/pins.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH = exports.LEGACY_BOOTSTRAP_ARTIFACT_SHA256 = exports.LEGACY_EARLY_BOOTSTRAP_P_DIGEST = exports.LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT = exports.EXPECTED_PHASE_BETS = exports.EXPECTED_EPOCH_SIZE = exports.EXPECTED_SEEDS = exports.EXPECTED_BETS = exports.DATASET_RELATIVE_PATH = exports.EXPECTED_DATASET_HASH = void 0;
exports.earlyBootstrapPDigest = earlyBootstrapPDigest;
const crypto_1 = require("crypto");
exports.EXPECTED_DATASET_HASH = 'c7c2e8a930549e11e3e564a962aea0ca2875b6eb94bc1f4347cc703bc410b222';
exports.DATASET_RELATIVE_PATH = 'data/mines-master-6900bets.json';
exports.EXPECTED_BETS = 6900;
exports.EXPECTED_SEEDS = 138;
exports.EXPECTED_EPOCH_SIZE = 50;
exports.EXPECTED_PHASE_BETS = { A: 4800, B: 1000, C: 200, D: 500, E: 400 };
exports.LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT = '2026-08-05T16:41:40.964Z';
exports.LEGACY_EARLY_BOOTSTRAP_P_DIGEST = '292d8d546f924cf4cc469bb01061e271c1892f4657f2f28754a2793dba08bc6d';
exports.LEGACY_BOOTSTRAP_ARTIFACT_SHA256 = 'bf1838490a7e9c173a04c06c1255a59e2bf17e114cca02e9d9b491c72fea0461';
exports.LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH = 'tests/fixtures/legacy-simulation-results.json';
function earlyBootstrapPDigest(rows) {
    const canon = [...rows]
        .sort((a, b) => (a?.epoch ?? -1) - (b?.epoch ?? -1))
        .map(r => `${r?.epoch}:${r?.earlyBootstrapP}`)
        .join('\n');
    return (0, crypto_1.createHash)('sha256').update(canon, 'utf8').digest('hex');
}

  },
  "src/rng.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_DERIVATION_VERSION = void 0;
exports.commitHash = commitHash;
exports.sha256Buffer = sha256Buffer;
exports.getProvablyFairHmacSalt = getProvablyFairHmacSalt;
exports.generateProvablyFairNumber = generateProvablyFairNumber;
exports.revealMines = revealMines;
exports.firstMineTile = firstMineTile;
exports.moduloRejectionCensus = moduloRejectionCensus;
exports.expectedModuloRejections = expectedModuloRejections;
exports.isMasterSeed = isMasterSeed;
exports.deriveSeedHex = deriveSeedHex;
exports.sameMines = sameMines;
const node_crypto_1 = require("node:crypto");
const config_1 = require("./config");
function commitHash(serverSeedHexString) {
    return (0, node_crypto_1.createHash)('sha256').update(serverSeedHexString, 'utf8').digest('hex');
}
function sha256Buffer(buf) {
    return (0, node_crypto_1.createHash)('sha256').update(buf).digest('hex');
}
function getProvablyFairHmacSalt(clientSeed, nonce, cursor) {
    return `${clientSeed}:${nonce}:${cursor}`;
}
function generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor, range) {
    const key = Buffer.from(serverSeed, 'hex');
    const digest = (0, node_crypto_1.createHmac)('sha256', key).update(getProvablyFairHmacSalt(clientSeed, nonce, cursor)).digest();
    const maxFair = Math.floor(4294967296 / range) * range;
    for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
        const chunk = digest.readUInt32BE(offset);
        if (chunk < maxFair)
            return chunk % range;
    }
    return generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor + 1000000, range);
}
function revealMines(serverSeed, clientSeed, nonce, mineCount) {
    const mines = Array.from({ length: config_1.GRID }, (_, i) => i + 1);
    for (let currentMine = 0; currentMine < mines.length; currentMine++) {
        const range = mines.length - currentMine;
        const randomMine = currentMine + generateProvablyFairNumber(serverSeed, clientSeed, nonce, currentMine, range);
        [mines[currentMine], mines[randomMine]] = [mines[randomMine], mines[currentMine]];
    }
    return mines.slice(0, mineCount);
}
function firstMineTile(serverSeed, clientSeed, nonce) {
    return 1 + generateProvablyFairNumber(serverSeed, clientSeed, nonce, 0, config_1.GRID);
}
function moduloRejectionCensus(serverSeed, clientSeed, nonce) {
    const key = Buffer.from(serverSeed, 'hex');
    let draws = 0, rejections = 0;
    for (let cursor = 0; cursor < config_1.GRID; cursor++) {
        const range = config_1.GRID - cursor;
        const maxFair = Math.floor(4294967296 / range) * range;
        const digest = (0, node_crypto_1.createHmac)('sha256', key).update(getProvablyFairHmacSalt(clientSeed, nonce, cursor)).digest();
        draws++;
        if (digest.readUInt32BE(0) >= maxFair)
            rejections++;
    }
    return { draws, rejections };
}
function expectedModuloRejections(rounds) {
    const TWO32 = 2 ** 32;
    let perRound = 0;
    for (let range = 1; range <= config_1.GRID; range++)
        perRound += (TWO32 % range) / TWO32;
    return perRound * rounds;
}
exports.SEED_DERIVATION_VERSION = 'mines-seed-derivation-v1';
function isMasterSeed(s) {
    return typeof s === 'string' && /^[0-9a-f]{32,128}$/.test(s) && s.length % 2 === 0;
}
function deriveSeedHex(masterSeedHex, domain, index, bytes = 16) {
    const key = Buffer.from(masterSeedHex, 'hex');
    const msg = `${exports.SEED_DERIVATION_VERSION}:${domain}:${index}`;
    return (0, node_crypto_1.createHmac)('sha256', key).update(msg, 'utf8').digest().subarray(0, bytes).toString('hex');
}
function sameMines(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}

  },
  "src/stats.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combination = combination;
exports.regularizedGamma = regularizedGamma;
exports.logGamma = logGamma;
exports.chiSquaredPValue = chiSquaredPValue;
exports.chiSquaredTest = chiSquaredTest;
exports.lag1Autocorrelation = lag1Autocorrelation;
exports.runsTest = runsTest;
exports.inverseCriticalZ = inverseCriticalZ;
exports.normalTwoSidedP = normalTwoSidedP;
function combination(n, k) {
    if (k < 0 || k > n)
        return 0;
    if (k === 0 || k === n)
        return 1;
    k = Math.min(k, n - k);
    let c = 1;
    for (let i = 0; i < k; i++) {
        c = (c * (n - i)) / (i + 1);
    }
    return c;
}
function regularizedGamma(a, x) {
    if (x < 0 || a <= 0)
        return NaN;
    if (x === 0)
        return 0;
    const gln = logGamma(a);
    if (x < a + 1) {
        let ap = a;
        let sum = 1 / a;
        let del = sum;
        for (let n = 0; n < 200; n++) {
            ap += 1;
            del *= x / ap;
            sum += del;
            if (Math.abs(del) < Math.abs(sum) * 1e-14)
                break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    else {
        let b = x + 1 - a;
        let c = 1 / 1e-300;
        let d = 1 / b;
        let h = d;
        for (let i = 1; i <= 200; i++) {
            const an = -i * (i - a);
            b += 2;
            d = an * d + b;
            if (Math.abs(d) < 1e-300)
                d = 1e-300;
            c = b + an / c;
            if (Math.abs(c) < 1e-300)
                c = 1e-300;
            d = 1 / d;
            const delta = d * c;
            h *= delta;
            if (Math.abs(delta - 1) < 1e-14)
                break;
        }
        return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
    }
}
function logGamma(x) {
    const c = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++)
        ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function chiSquaredPValue(chiSq, df) {
    return 1 - regularizedGamma(df / 2, chiSq / 2);
}
function chiSquaredTest(observed, expected) {
    if (observed.length !== expected.length)
        throw new Error('length mismatch');
    const obs = [...observed];
    const exp = [...expected];
    while (obs.length > 2 && exp[0] < 5) {
        obs[1] += obs[0];
        exp[1] += exp[0];
        obs.shift();
        exp.shift();
    }
    while (obs.length > 2 && exp[exp.length - 1] < 5) {
        const n = obs.length;
        obs[n - 2] += obs[n - 1];
        exp[n - 2] += exp[n - 1];
        obs.pop();
        exp.pop();
    }
    let chi2 = 0;
    for (let i = 0; i < obs.length; i++) {
        if (exp[i] > 0)
            chi2 += (obs[i] - exp[i]) ** 2 / exp[i];
    }
    const df = obs.length - 1;
    return { chi2, df, pValue: chiSquaredPValue(chi2, df) };
}
function lag1Autocorrelation(series) {
    const n = series.length;
    let mean = 0;
    for (let i = 0; i < n; i++)
        mean += series[i];
    mean /= n;
    let num = 0, den = 0;
    for (let i = 0; i < n - 1; i++)
        num += (series[i] - mean) * (series[i + 1] - mean);
    for (let i = 0; i < n; i++)
        den += (series[i] - mean) ** 2;
    return den === 0 ? 0 : num / den;
}
function runsTest(series) {
    const n = series.length;
    let n1 = 0, runs = 1;
    let prev = series[0];
    if (prev === 1)
        n1++;
    for (let i = 1; i < n; i++) {
        if (series[i] === 1)
            n1++;
        if (series[i] !== prev) {
            runs++;
            prev = series[i];
        }
    }
    const n2 = n - n1;
    const expected = (2 * n1 * n2) / n + 1;
    const varRuns = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
    const z = varRuns > 0 ? (runs - expected) / Math.sqrt(varRuns) : 0;
    const pValue = normalTwoSidedP(z);
    return { runs, expected, z, pValue };
}
function inverseCriticalZ(alpha) {
    const p = alpha / 2;
    const t = Math.sqrt(-2 * Math.log(p));
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}
function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}
function normalTwoSidedP(z) {
    return 2 * (1 - normalCDF(Math.abs(z)));
}
function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
        - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return Math.sign(x) * y;
}

  },
  "tests/__standalone-entry.js": function (module, exports, require, __filename, __dirname) {
require("./mines/qaRegressionTests.js");
require("./mines/rngTests.js");
  },
  "tests/mines/qaRegressionTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const config_1 = require("../../src/config");
const rng_1 = require("../../src/rng");
const simulation_1 = require("../steps/simulation");
const pins_1 = require("../../src/pins");
const false_alarm_1 = require("../../src/false-alarm");
const QA01_SERVER = 'f4661fd009f7f0da9193607ffcb4a18d';
const QA01_CLIENT = 'e944296a042a94bc2ab8dce48a3def1f';
const QA01_N = 1000000;
const QA01_M = 1;
describe('QA-01: the support screen accepts a genuine exact-mean million-round result', () => {
    let wins = 0;
    let winsAt1000 = 0;
    before(function () {
        this.timeout(600000);
        for (let nonce = 0; nonce < QA01_N; nonce++) {
            if ((0, rng_1.firstMineTile)(QA01_SERVER, QA01_CLIENT, nonce) !== 1)
                wins++;
            if (nonce === 999)
                winsAt1000 = wins;
        }
    });
    it('replays to exactly 960,000 wins — the fair expectation, to the win', () => {
        node_assert_1.strict.equal(wins, 960000);
        node_assert_1.strict.equal(wins, (QA01_N * (config_1.GRID - QA01_M)) / config_1.GRID);
        node_assert_1.strict.equal(winsAt1000, 968);
    });
    it('and therefore produces simRTP === theoreticalRTP exactly', () => {
        const mult1 = (0, config_1.theoreticalRTP)(QA01_M, 1) / ((config_1.GRID - QA01_M) / config_1.GRID);
        const simRTP = (wins / QA01_N) * mult1;
        node_assert_1.strict.equal(simRTP, (0, config_1.theoreticalRTP)(QA01_M, 1));
        node_assert_1.strict.equal(simRTP, 0.99);
    });
    it('POSITIVE CONTROL — the support screen returns NO fault and marks it a supported exact mean', () => {
        const mult1 = (0, config_1.theoreticalRTP)(QA01_M, 1) / ((config_1.GRID - QA01_M) / config_1.GRID);
        const row = {
            mineCount: QA01_M,
            simRTP: (wins / QA01_N) * mult1,
            theoreticalRTP: (0, config_1.theoreticalRTP)(QA01_M, 1),
            jointMaxAbsZ: null,
            convergence: [{ n: 1000, wins: winsAt1000 }, { n: QA01_N, wins }],
        };
        const v = (0, simulation_1.nullCentreSupport)(row, QA01_N);
        node_assert_1.strict.deepEqual(v.faults, [], `a genuine seed-reproducible result must not be called fabrication: ${v.faults.join('; ')}`);
        node_assert_1.strict.equal(v.supportedExactMean, true);
    });
    it('NEGATIVE CONTROL — the same equality with a FABRICATED count still fails, on the count', () => {
        const row = {
            mineCount: QA01_M,
            simRTP: (0, config_1.theoreticalRTP)(QA01_M, 1),
            theoreticalRTP: (0, config_1.theoreticalRTP)(QA01_M, 1),
            jointMaxAbsZ: null,
            convergence: [{ n: 1000, wins: winsAt1000 }, { n: QA01_N, wins: wins - 7 }],
        };
        const v = (0, simulation_1.nullCentreSupport)(row, QA01_N);
        node_assert_1.strict.equal(v.supportedExactMean, false);
        node_assert_1.strict.equal(v.faults.length, 1);
        node_assert_1.strict.match(v.faults[0], /claims exactly 960000 wins, but the row's own final checkpoint records 959993/);
    });
    it('NEGATIVE CONTROL — the equality with NO corroborating checkpoint fails', () => {
        const v = (0, simulation_1.nullCentreSupport)({
            mineCount: QA01_M, simRTP: 0.99, theoreticalRTP: 0.99, jointMaxAbsZ: null, convergence: [],
        }, QA01_N);
        node_assert_1.strict.equal(v.supportedExactMean, false);
        node_assert_1.strict.match(v.faults[0] ?? '', /no n=1000000 convergence checkpoint/);
    });
    it('jointMaxAbsZ === 0 is screened only where N·q is not an integer', () => {
        const bad = (0, simulation_1.nullCentreSupport)({ mineCount: 2, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 0 }, QA01_N);
        node_assert_1.strict.equal(bad.faults.length, 1);
        node_assert_1.strict.match(bad.faults[0], /not an integer — outside the support/);
        const ok = (0, simulation_1.nullCentreSupport)({ mineCount: 3, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 0 }, QA01_N);
        node_assert_1.strict.deepEqual(ok.faults, []);
    });
    it('an exactly-zero layoutR1 / layoutR1Z / layoutRunsZ is attainable and is NOT screened', () => {
        const v = (0, simulation_1.nullCentreSupport)({
            mineCount: 7, simRTP: 1, theoreticalRTP: 2, jointMaxAbsZ: 1.4,
            layoutR1: 0, layoutR1Z: 0, layoutRunsZ: 0,
        }, QA01_N);
        node_assert_1.strict.deepEqual(v.faults, []);
    });
});
describe('QA-03: display multiplier floors in exact integer arithmetic', () => {
    const independentCents = (m, k) => {
        let n = 99n, d = 100n;
        for (let i = 0; i < k; i++) {
            n *= BigInt(25 - i);
            d *= BigInt(25 - m - i);
        }
        return (100n * n) / d;
    };
    it('m=1, k=10 displays 1.65 — the float form returned 1.64', () => {
        node_assert_1.strict.equal((0, config_1.minesMultiplier)(1, 10), 1.65);
        node_assert_1.strict.equal((0, config_1.minesMultiplierDisplayCents)(1, 10), 165n);
        node_assert_1.strict.equal(Math.floor((0, config_1.minesMultiplierExact)(1, 10) * 100) / 100, 1.64);
    });
    it('its display-payout counterfactual RTP is exactly 0.99', () => {
        node_assert_1.strict.equal((0, config_1.displayPayoutRTP)(1, 10), 0.99);
        node_assert_1.strict.notEqual((0, config_1.winProbability)(1, 10) * (0, config_1.minesMultiplier)(1, 10), 0.99);
    });
    it('agrees with an independent rational sweep at all 300 legal cells', () => {
        let cells = 0;
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                cells++;
                node_assert_1.strict.equal((0, config_1.minesMultiplierDisplayCents)(m, k), independentCents(m, k), `cell m=${m}, k=${k}`);
            }
        }
        node_assert_1.strict.equal(cells, 300);
    });
    it('exactly 31 of the 300 cells moved, and every one moved UP by one cent', () => {
        const moved = [];
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                const old = Math.floor((0, config_1.minesMultiplierExact)(m, k) * 100) / 100;
                if (old !== (0, config_1.minesMultiplier)(m, k)) {
                    moved.push([m, k]);
                    node_assert_1.strict.equal(Number((0, config_1.minesMultiplierDisplayCents)(m, k)) - Math.round(old * 100), 1, `cell m=${m}, k=${k}`);
                }
            }
        }
        node_assert_1.strict.equal(moved.length, 31);
    });
    it('the floor never exceeds the exact multiplier (it is a floor, not a round)', () => {
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                const cents = Number((0, config_1.minesMultiplierDisplayCents)(m, k));
                const exact = (0, config_1.minesMultiplierExact)(m, k) * 100;
                node_assert_1.strict.ok(cents <= exact + 1e-6, `cell m=${m}, k=${k}: ${cents} > ${exact}`);
                node_assert_1.strict.ok(cents > exact - 1 - 1e-6, `cell m=${m}, k=${k}: floor is more than a cent low`);
            }
        }
    });
    it('is derived from HOUSE_EDGE — a different edge moves the grid', () => {
        node_assert_1.strict.equal(config_1.HOUSE_EDGE, 0.01);
        node_assert_1.strict.equal((0, config_1.minesMultiplierDisplayCents)(3, 1), 112n);
    });
    it('returns null / NaN outside the legal grid instead of a silent Infinity', () => {
        node_assert_1.strict.equal((0, config_1.minesMultiplierDisplayCents)(24, 2), null);
        node_assert_1.strict.ok(Number.isNaN((0, config_1.minesMultiplier)(24, 2)));
    });
});
describe('QA-12: modulo-bias rejection — the saved deterministic vector', () => {
    const SS = '1f1da0da5907129a0043f5ac8a12b5ee';
    const CS = '097bf01483879668f626781b35b297c2';
    const NONCE = 760455, CURSOR = 12, RANGE = 13, M = 5;
    it('the first chunk is 4294967288 and exceeds the maxFair threshold 4294967287', () => {
        const maxFair = Math.floor(4294967296 / RANGE) * RANGE;
        node_assert_1.strict.equal(maxFair, 4294967287);
        const digest = (0, node_crypto_1.createHmac)('sha256', Buffer.from(SS, 'hex'))
            .update((0, rng_1.getProvablyFairHmacSalt)(CS, NONCE, CURSOR)).digest();
        node_assert_1.strict.equal(digest.readUInt32BE(0), 4294967288);
        node_assert_1.strict.ok(digest.readUInt32BE(0) >= maxFair);
        node_assert_1.strict.equal(digest.readUInt32BE(4), 412214211);
    });
    it('the draw therefore yields 6 from the SECOND chunk', () => {
        node_assert_1.strict.equal((0, rng_1.generateProvablyFairNumber)(SS, CS, NONCE, CURSOR, RANGE), 6);
    });
    it('deleting the rejection would yield 1 — so the branch is load-bearing here', () => {
        node_assert_1.strict.equal(4294967288 % RANGE, 1);
        node_assert_1.strict.notEqual(4294967288 % RANGE, (0, rng_1.generateProvablyFairNumber)(SS, CS, NONCE, CURSOR, RANGE));
    });
    it('the census counts it: 1 rejection in this round\'s 25 draws', () => {
        node_assert_1.strict.deepEqual((0, rng_1.moduloRejectionCensus)(SS, CS, NONCE), { draws: 25, rejections: 1 });
    });
    it('but cursor 12 is past the first 5 tiles, so the m=5 LAYOUT is unchanged', () => {
        const noReject = (nonce, cursor, range) => (0, node_crypto_1.createHmac)('sha256', Buffer.from(SS, 'hex'))
            .update((0, rng_1.getProvablyFairHmacSalt)(CS, nonce, cursor)).digest().readUInt32BE(0) % range;
        const revealNoReject = (mineCount) => {
            const mines = Array.from({ length: config_1.GRID }, (_, i) => i + 1);
            for (let c = 0; c < mines.length; c++) {
                const j = c + noReject(NONCE, c, mines.length - c);
                [mines[c], mines[j]] = [mines[j], mines[c]];
            }
            return mines.slice(0, mineCount);
        };
        node_assert_1.strict.deepEqual((0, rng_1.revealMines)(SS, CS, NONCE, M), [24, 4, 25, 9, 16]);
        node_assert_1.strict.deepEqual(revealNoReject(M), (0, rng_1.revealMines)(SS, CS, NONCE, M));
        node_assert_1.strict.notDeepEqual(revealNoReject(config_1.GRID), (0, rng_1.revealMines)(SS, CS, NONCE, config_1.GRID));
    });
});
describe('QA-05: deterministic, versioned, domain-separated seed derivation', () => {
    const MASTER = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    it('is a pure function of (master, domain, index)', () => {
        node_assert_1.strict.equal((0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 0), (0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 0));
        node_assert_1.strict.match((0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 0), /^[0-9a-f]{32}$/);
    });
    it('separates domains, indices and master seeds', () => {
        const a = (0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 0);
        node_assert_1.strict.notEqual(a, (0, rng_1.deriveSeedHex)(MASTER, 'pass1-client:m=3', 0));
        node_assert_1.strict.notEqual(a, (0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=4', 0));
        node_assert_1.strict.notEqual(a, (0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 1));
        node_assert_1.strict.notEqual(a, (0, rng_1.deriveSeedHex)(MASTER.replace(/^00/, '01'), 'pass1-server:m=3', 0));
    });
    it('binds the version string, so a future expansion cannot masquerade as this one', () => {
        node_assert_1.strict.equal(rng_1.SEED_DERIVATION_VERSION, 'mines-seed-derivation-v1');
        const key = Buffer.from(MASTER, 'hex');
        const expected = (0, node_crypto_1.createHmac)('sha256', key)
            .update(`${rng_1.SEED_DERIVATION_VERSION}:pass1-server:m=3:0`, 'utf8')
            .digest().subarray(0, 16).toString('hex');
        node_assert_1.strict.equal((0, rng_1.deriveSeedHex)(MASTER, 'pass1-server:m=3', 0), expected);
    });
    it('rejects a malformed master seed', () => {
        node_assert_1.strict.equal((0, rng_1.isMasterSeed)(MASTER), true);
        node_assert_1.strict.equal((0, rng_1.isMasterSeed)('not-hex'), false);
        node_assert_1.strict.equal((0, rng_1.isMasterSeed)('abcd'), false);
        node_assert_1.strict.equal((0, rng_1.isMasterSeed)(undefined), false);
    });
});
describe('QA-05b: the legacy earlyBootstrapP pin (fixture — immutable by construction)', () => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'legacy-simulation-results.json');
    const fixtureBytes = fs.readFileSync(fixturePath);
    const legacy = JSON.parse(fixtureBytes.toString('utf-8'));
    const rows = legacy.pass2_casino_seeds.results;
    it('the fixture is the exact file that was reviewed — SHA-256 pinned in src/pins.ts', () => {
        node_assert_1.strict.equal((0, node_crypto_1.createHash)('sha256').update(fixtureBytes).digest('hex'), pins_1.LEGACY_BOOTSTRAP_ARTIFACT_SHA256);
        node_assert_1.strict.equal(path.relative(path.join(__dirname, '..', '..'), fixturePath).split(path.sep).join('/'), pins_1.LEGACY_BOOTSTRAP_FIXTURE_RELATIVE_PATH);
    });
    it('the fixture is the one the legacy exception covers', () => {
        node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)(rows), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
    });
    it('the fixture is the legacy one — it records no replay metadata at all', () => {
        node_assert_1.strict.equal(legacy.masterSeed, undefined);
        node_assert_1.strict.equal(legacy.seedDerivation, undefined);
        node_assert_1.strict.equal(legacy.pass2_casino_seeds.bootstrapSeedDerivation, undefined);
        node_assert_1.strict.equal(legacy.generatedAt, pins_1.LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT);
    });
    it('moves off the pin when ONE p moves to a neighbouring legal lattice point (forgery A27)', () => {
        const reps = legacy.pass2_casino_seeds.bootstrapReps;
        const forged = rows.map((r, i) => i !== 0 ? r : {
            ...r, earlyBootstrapP: (Math.round(r.earlyBootstrapP * (reps + 1)) + 1) / (reps + 1),
        });
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(forged), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
    });
    it('is order-insensitive, so a benign row reordering is not a fault (G-VALID)', () => {
        node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)([...rows].reverse()), (0, pins_1.earlyBootstrapPDigest)(rows));
        node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)([...rows].reverse()), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
    });
    it('cannot be satisfied by a truncated or blanked row set', () => {
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(rows.slice(0, rows.length - 1)), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(rows.map(() => ({}))), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST);
    });
});
describe('QA-05c: the live simulation artifact declares a supported replay format', () => {
    const sim = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'outputs', 'simulation-results.json'), 'utf-8'));
    const rows = sim.pass2_casino_seeds.results;
    const replayFields = [
        ['masterSeed', sim.masterSeed],
        ['seedDerivation', sim.seedDerivation],
        ['pass2_casino_seeds.bootstrapSeedDerivation', sim.pass2_casino_seeds.bootstrapSeedDerivation],
    ];
    const present = replayFields.filter(([, v]) => v !== undefined);
    it('is schema-2 (master-seeded, replayable) or schema-1 (the one pinned legacy artifact)', () => {
        if (present.length === 0) {
            node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)(rows), pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST, 'artifact carries no replay metadata and is not the pinned legacy artifact — stripping the metadata is not a way to have earlyBootstrapP taken on trust');
            node_assert_1.strict.equal(sim.generatedAt, pins_1.LEGACY_BOOTSTRAP_ARTIFACT_GENERATED_AT);
        }
        else {
            node_assert_1.strict.equal(present.length, replayFields.length, `replay metadata INCOMPLETE — carries ${present.map(([n]) => n).join(', ')}; all three are required together or none of them`);
            node_assert_1.strict.equal((0, rng_1.isMasterSeed)(sim.masterSeed), true, `masterSeed ${JSON.stringify(sim.masterSeed)} is not a usable master seed — the bootstrap null cannot be rebuilt from it, so the run is UNVERIFIABLE, not exempt`);
            node_assert_1.strict.equal(sim.seedDerivation, rng_1.SEED_DERIVATION_VERSION);
            node_assert_1.strict.equal(sim.pass2_casino_seeds.bootstrapSeedDerivation, rng_1.SEED_DERIVATION_VERSION);
        }
    });
    it('its earlyBootstrapP digest is order-insensitive — reordered rows digest to the ORIGINAL rows', () => {
        node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)([...rows].reverse()), (0, pins_1.earlyBootstrapPDigest)(rows));
        node_assert_1.strict.equal((0, pins_1.earlyBootstrapPDigest)([...rows].sort((a, b) => b.epoch - a.epoch)), (0, pins_1.earlyBootstrapPDigest)(rows));
    });
    it('its digest still separates truncation, blanking and a one-lattice-point nudge', () => {
        const own = (0, pins_1.earlyBootstrapPDigest)(rows);
        const reps = sim.pass2_casino_seeds.bootstrapReps;
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(rows.slice(0, rows.length - 1)), own);
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(rows.map(() => ({}))), own);
        const forged = rows.map((r, i) => i !== 0 ? r : {
            ...r, earlyBootstrapP: (Math.round(r.earlyBootstrapP * (reps + 1)) + 1) / (reps + 1),
        });
        node_assert_1.strict.notEqual((0, pins_1.earlyBootstrapPDigest)(forged), own);
    });
});
describe('QA-02c: the false-alarm sum is nominal — the exact binomial refutes the bound reading', () => {
    const N = 1000;
    const M = 24;
    const exactTail = (lo, hi) => {
        const a = BigInt(config_1.GRID - M), b = BigInt(M);
        let sum = 0n;
        for (let w = lo; w <= hi; w++) {
            let c = 1n;
            for (let i = 0; i < w; i++)
                c = (c * BigInt(N - i)) / BigInt(i + 1);
            sum += c * a ** BigInt(w) * b ** BigInt(N - w);
        }
        return sum;
    };
    it('reproduces the implemented rejection set: wins ≤ 9 or wins ≥ 71 at n=1,000, m=24', () => {
        const row = (0, false_alarm_1.exactSeScreenRejection)(N, M);
        node_assert_1.strict.equal(row.rejectAtOrBelow, 9);
        node_assert_1.strict.equal(row.rejectAtOrAbove, 71);
        node_assert_1.strict.equal(row.winProbability, 1 / 25);
    });
    it('re-derives the exact rejection probability by an independent summation', () => {
        const DEN = BigInt(config_1.GRID) ** BigInt(N);
        const NUM = exactTail(0, 9) + exactTail(71, N);
        const independent = Number((NUM * 10n ** 60n) / DEN) / 1e60;
        const module = (0, false_alarm_1.exactSeScreenRejection)(N, M).exactRejectionProbability;
        node_assert_1.strict.equal(Math.abs(independent - module) / module < 1e-12, true, `independent ${independent} vs module ${module}`);
        node_assert_1.strict.equal(independent.toExponential(14), '3.70252382090633e-6');
    });
    it('the exact probability EXCEEDS the nominal, so the nominal does not bound the screen', () => {
        const row = (0, false_alarm_1.exactSeScreenRejection)(N, M);
        node_assert_1.strict.equal(row.exactRejectionProbability > row.nominalRejectionProbability, true);
        node_assert_1.strict.equal(row.exactOverNominal.toFixed(2), '6.45');
    });
    it("Bernstein's bound IS a valid upper bound on that same screen, and it is much weaker", () => {
        const row = (0, false_alarm_1.exactSeScreenRejection)(N, M);
        const bound = (0, false_alarm_1.bernsteinSeScreenBound)(N, M);
        node_assert_1.strict.equal(bound > row.exactRejectionProbability, true);
        node_assert_1.strict.equal(bound > row.nominalRejectionProbability, true);
    });
    it('the published total is the sum of the enumerated arms, and it is labelled nominal', () => {
        const fa = (0, false_alarm_1.falseAlarmAccounting)();
        node_assert_1.strict.equal(fa.arms.length, 8);
        node_assert_1.strict.equal(Math.abs(fa.totalNominal - fa.arms.reduce((s, a) => s + a.nominalTotal, 0)) < 1e-18, true);
        node_assert_1.strict.equal(fa.totalNominal.toExponential(7), '6.9679801e-2');
        node_assert_1.strict.equal(/NOMINAL/.test(fa.status) && /NOT an upper bound/.test(fa.status), true);
    });
    it('the figures artifact and the verifier publish the SAME calculation', () => {
        const figPath = path.join(__dirname, '..', '..', 'outputs', 'audit-figures.json');
        if (!fs.existsSync(figPath))
            return;
        const emitted = JSON.parse(fs.readFileSync(figPath, 'utf-8')).falseAlarmAccounting;
        const derived = (0, false_alarm_1.falseAlarmAccounting)(emitted.roundsPerConfig);
        node_assert_1.strict.equal(JSON.stringify(emitted), JSON.stringify(derived));
    });
});

  },
  "tests/mines/rngTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const rng_1 = require("../../src/rng");
const config_1 = require("../../src/config");
const A_SERVER_SEED = '8b2fc7e909d2fff439692f648a9df0ba';
const A_CLIENT_SEED = 'audit59c2b0bf86aa';
const B_SERVER_SEED = '1973480c6bf1a4e3b62f7f8eb3f663d5';
const B_CLIENT_SEED = 'audite90633066c80';
describe('mines: real captured mine-layout reproduction', () => {
    it('bet GbqOuPvhQekqcARNtHZ3_ (serverSeed 8b2f…, nonce=25, mineCount=3) -> [6,20,7]', () => {
        const mines = (0, rng_1.revealMines)(A_SERVER_SEED, A_CLIENT_SEED, 25, 3);
        node_assert_1.strict.ok((0, rng_1.sameMines)(mines, [6, 20, 7]), `got ${JSON.stringify(mines)}`);
    });
    it('bet j2ICJ7NM_TrD_UMtv6Av0 (serverSeed 1973…, nonce=0, mineCount=24) -> full 24-tile draw order', () => {
        const mines = (0, rng_1.revealMines)(B_SERVER_SEED, B_CLIENT_SEED, 0, 24);
        node_assert_1.strict.ok((0, rng_1.sameMines)(mines, [23, 11, 2, 8, 20, 22, 16, 24, 12, 9, 5, 19, 1, 18, 15, 7, 21, 3, 6, 10, 17, 13, 25, 14]), `got ${JSON.stringify(mines)}`);
    });
});
describe('mines: firstMineTile is revealMines()[0] — the one-HMAC fast path Step 17 re-derives with', () => {
    it('agrees with revealMines()[0] for 200 nonce/mine-count pairs on vector A, cycling mine counts 1..24', () => {
        for (let nonce = 0; nonce < 200; nonce++) {
            const m = (nonce % 24) + 1;
            const full = (0, rng_1.revealMines)(A_SERVER_SEED, A_CLIENT_SEED, nonce, m);
            node_assert_1.strict.equal((0, rng_1.firstMineTile)(A_SERVER_SEED, A_CLIENT_SEED, nonce), full[0], `nonce ${nonce}, mineCount ${m}`);
        }
    });
    it('agrees with revealMines()[0] over 200 nonces on vector B', () => {
        for (let nonce = 0; nonce < 200; nonce++) {
            const full = (0, rng_1.revealMines)(B_SERVER_SEED, B_CLIENT_SEED, nonce, 24);
            node_assert_1.strict.equal((0, rng_1.firstMineTile)(B_SERVER_SEED, B_CLIENT_SEED, nonce), full[0], `nonce ${nonce}`);
        }
    });
});
describe('mines: commitment hash (SHA-256 of utf8 hex string)', () => {
    it('commitHash(8b2f…) -> 5d6c4f10… (SHA-256 of utf8 hex string)', () => {
        node_assert_1.strict.equal((0, rng_1.commitHash)(A_SERVER_SEED), '5d6c4f105f182f9798063a4ca29d2c4ad2c575449bc5742a9680ec31bd9d79a0');
    });
});
describe('mines: multiplier — exact payout vs floored display', () => {
    it('minesMultiplierExact(3, 1) === 1.125 (the amount credited)', () => {
        node_assert_1.strict.ok(Math.abs((0, config_1.minesMultiplierExact)(3, 1) - 1.125) < 1e-12);
    });
    it('minesMultiplier(3, 1) === 1.12 (floored display field, cosmetic)', () => {
        node_assert_1.strict.equal((0, config_1.minesMultiplier)(3, 1), 1.12);
    });
});

  },
  "tests/steps/context.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.step = step;
function step(num, name, status, detail) {
    const tag = status === 'PASS' ? '[PASS]' : status === 'FLAG' ? '[FLAG]' : '[FAIL]';
    console.log(`  ${tag} Step ${num} — ${name}`);
    if (status !== 'PASS')
        console.log(`         ${detail}`);
    return { step: num, name, status, detail };
}

  },
  "tests/steps/simulation.js": function (module, exports, require, __filename, __dirname) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.nullCentreSupport = nullCentreSupport;
exports.run = run;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const context_1 = require("./context");
const stats_1 = require("../../src/stats");
const config_1 = require("../../src/config");
const rng_1 = require("../../src/rng");
const pins_1 = require("../../src/pins");
const false_alarm_1 = require("../../src/false-alarm");
function binomialSurvival(k, n, p) {
    let cum = 0;
    for (let i = 0; i < k; i++)
        cum += (0, config_1.combination)(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    return 1 - cum;
}
const KP_ATTESTED = [
    'houseEdge',
    'pass1_fresh_seeds.configs',
    'pass1_fresh_seeds.roundsPerConfig',
    'pass1_fresh_seeds.totalRounds',
    'pass1_fresh_seeds.bonferroniAlpha',
    'pass1_fresh_seeds.bonferroniZCritical',
    'pass1_fresh_seeds.firstDrawChi2FailsAtAlpha01',
    'pass1_fresh_seeds.firstDrawChi2FailsBonferroni',
    'pass1_fresh_seeds.jointConfigsTested',
    'pass1_fresh_seeds.jointFailsAtAlpha01',
    'pass1_fresh_seeds.jointFailsBonferroni',
    'pass1_fresh_seeds.jointMaxAbsZAcrossConfigs',
    'pass1_fresh_seeds.layoutSerialFailsUncorrected',
    'pass1_fresh_seeds.layoutSerialFailsBonferroni',
    'pass1_fresh_seeds.meanSimulatedRTP',
    'pass1_fresh_seeds.meanTheoreticalRTP',
    'pass1_fresh_seeds.results[].mineCount',
    'pass1_fresh_seeds.results[].serverSeed',
    'pass1_fresh_seeds.results[].clientSeed',
    'pass1_fresh_seeds.results[].theoreticalRTP',
    'pass1_fresh_seeds.results[].convergence[].n',
    'pass1_fresh_seeds.results[].convergence[].wins',
    'pass2_casino_seeds.noncesPerSeed',
    'pass2_casino_seeds.earlyWindow[]',
    'pass2_casino_seeds.lateWindow[]',
    'pass2_casino_seeds.bootstrapMineCounts[]',
    'pass2_casino_seeds.seeds_tested',
    'pass2_casino_seeds.cherryPickFlags',
    'pass2_casino_seeds.expectedFlagsByChance',
    'pass2_casino_seeds.cherryPickSurvivalP',
    'pass2_casino_seeds.results[].epoch',
    'pass2_casino_seeds.results[].hashedServerSeed',
    'pass2_casino_seeds.results[].mineCount',
    'pass2_casino_seeds.results[].earlyChi2',
    'pass2_casino_seeds.results[].lateChi2',
    'pass2_casino_seeds.results[].latePValue',
    'pass2_casino_seeds.results[].cherryPickFlag',
];
const KP_BOUND = [
    'pass1_fresh_seeds.results[].firstDrawDf',
    'pass1_fresh_seeds.results[].jointPairs',
];
const KP_BOUNDED = [
    'pass1_fresh_seeds.results[].firstDrawChi2',
    'pass1_fresh_seeds.results[].firstDrawPValue',
    'pass1_fresh_seeds.results[].jointMaxAbsZ',
    'pass1_fresh_seeds.results[].jointPValue',
    'pass1_fresh_seeds.results[].layoutR1',
    'pass1_fresh_seeds.results[].layoutR1Z',
    'pass1_fresh_seeds.results[].layoutRunsZ',
    'pass1_fresh_seeds.results[].layoutRunsPValue',
    'pass1_fresh_seeds.results[].simRTP',
    'pass2_casino_seeds.bootstrapReps',
    'pass2_casino_seeds.results[].earlyBootstrapP',
];
const KP_OPTIONAL_ATTESTED = [
    'masterSeed',
    'seedDerivation',
    'pass2_casino_seeds.bootstrapSeedDerivation',
];
const KP_UNATTESTED = [
    'audit',
    'algorithm',
    'generatedAt',
    'pass1_fresh_seeds.description',
    'pass1_fresh_seeds.executionTimeMs',
    'pass1_fresh_seeds.results[].jointWorstPair',
    'pass2_casino_seeds.description',
    'pass2_casino_seeds.executionTimeMs',
];
function leafKeyPaths(node, prefix, out) {
    if (Array.isArray(node)) {
        if (node.length === 0)
            out.add(`${prefix}[]`);
        for (const v of node)
            leafKeyPaths(v, `${prefix}[]`, out);
        return;
    }
    if (node !== null && typeof node === 'object') {
        for (const k of Object.keys(node)) {
            leafKeyPaths(node[k], prefix ? `${prefix}.${k}` : k, out);
        }
        return;
    }
    out.add(prefix);
}
function nullCentreSupport(r, roundsPerConfig) {
    const faults = [];
    let supportedExactMean = false;
    const attainable = (x) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;
    if (r?.simRTP === r?.theoreticalRTP && Number.isFinite(r?.mineCount) && Number.isFinite(r?.simRTP)) {
        const w = (roundsPerConfig * (config_1.GRID - r.mineCount)) / config_1.GRID;
        const cp = (Array.isArray(r?.convergence) ? r.convergence : []).find((c) => c?.n === roundsPerConfig);
        if (!attainable(w)) {
            faults.push(`simRTP === theoreticalRTP but the win count it implies, N·p = ${w}, is not an integer — outside the support`);
        }
        else if (!cp || !Number.isFinite(cp.wins)) {
            faults.push(`simRTP === theoreticalRTP with no n=${roundsPerConfig} convergence checkpoint to corroborate the implied ${Math.round(w)} wins`);
        }
        else if (cp.wins !== Math.round(w)) {
            faults.push(`simRTP === theoreticalRTP claims exactly ${Math.round(w)} wins, but the row's own final checkpoint records ${cp.wins}`);
        }
        else {
            supportedExactMean = true;
        }
    }
    if (r?.jointMaxAbsZ === 0 && Number.isFinite(r?.mineCount)) {
        const nq = roundsPerConfig * (0, config_1.pairCoOccurProb)(r.mineCount);
        if (!attainable(nq)) {
            faults.push(`jointMaxAbsZ === 0 requires every one of the ${(config_1.GRID * (config_1.GRID - 1)) / 2} pair counts to equal N·q = ${nq.toFixed(4)}, which is not an integer — outside the support`);
        }
    }
    return { faults, supportedExactMean };
}
const MIN_ROUNDS_PER_CONFIG = 1000000;
const BIND_CHECKPOINT_N = 1000;
const CHERRY_EARLY_ALPHA = 0.05;
const CHERRY_LATE_ALPHA = 0.05;
const CHERRY_FLAG_RATE = CHERRY_EARLY_ALPHA * (1 - CHERRY_LATE_ALPHA);
function run(ctx) {
    const { outputsDir } = ctx;
    const simPath = path.join(outputsDir, 'simulation-results.json');
    if (!fs.existsSync(simPath)) {
        const s16 = (0, context_1.step)(16, 'Simulation — Pass 1 (First-Draw · Joint · Serial, FWER)', 'FLAG', 'simulation-results.json not found — supply the published artifact or run `npm run simulate` in a separate working copy to score this step');
        const s17 = (0, context_1.step)(17, 'Simulation — Pass 2 Cherry-Pick Test', 'FLAG', 'simulation-results.json not found — supply the published artifact or run `npm run simulate` in a separate working copy to score this step');
        return [s16, s17];
    }
    const simRaw = fs.readFileSync(simPath);
    const sim = JSON.parse(simRaw.toString('utf-8'));
    ctx.simArtifact = {
        file: 'outputs/simulation-results.json',
        sha256: crypto.createHash('sha256').update(simRaw).digest('hex'),
        generatedAt: typeof sim.generatedAt === 'string' ? sim.generatedAt : null,
    };
    const declared = new Set([...KP_ATTESTED, ...KP_BOUND, ...KP_BOUNDED, ...KP_OPTIONAL_ATTESTED, ...KP_UNATTESTED]);
    const present = new Set();
    leafKeyPaths(sim, '', present);
    const unclassified = [...present].filter(p => !declared.has(p)).sort();
    const mustExist = [...KP_ATTESTED, ...KP_BOUND];
    const missingPaths = mustExist.filter(p => !present.has(p)).sort();
    const inventoryOk = unclassified.length === 0 && missingPaths.length === 0;
    const countPresent = (paths) => paths.filter(p => present.has(p)).length;
    const bootstrapPPath = 'pass2_casino_seeds.results[].earlyBootstrapP';
    const inventoryNote = inventoryOk
        ? `key-path inventory: ${present.size}/${present.size} leaf paths classified (${countPresent(KP_ATTESTED)} attested, ${countPresent(KP_BOUND)} bound, ${countPresent(KP_BOUNDED.filter(p => p !== bootstrapPPath))} bounded-only, ${Number(present.has(bootstrapPPath))} bootstrap-p-value path with validation reported in Step 17, ${countPresent(KP_OPTIONAL_ATTESTED)} replay-input paths, ${countPresent(KP_UNATTESTED)} unattested)`
        : `key-path inventory FAILED: ${unclassified.length} unclassified (${unclassified.slice(0, 4).join(', ')}), ${missingPaths.length} missing (${missingPaths.slice(0, 4).join(', ')})`;
    const pass1 = sim.pass1_fresh_seeds ?? {};
    const results1 = Array.isArray(pass1.results) ? pass1.results : [];
    const CONFIGS = config_1.MINE_COUNTS.length;
    const configsDeclaredOk = pass1.configs === CONFIGS;
    const bonAlpha = 0.01 / CONFIGS;
    const bonZCrit = (0, stats_1.inverseCriticalZ)(bonAlpha);
    const JOINT_PAIRS = (config_1.GRID * (config_1.GRID - 1)) / 2;
    const jointPairCritZ = (0, stats_1.inverseCriticalZ)(bonAlpha / JOINT_PAIRS);
    const bonAlphaOk = Number.isFinite(pass1.bonferroniAlpha) && Math.abs(pass1.bonferroniAlpha - bonAlpha) < 1e-15;
    const bonZOk = Number.isFinite(pass1.bonferroniZCritical) && Math.abs(pass1.bonferroniZCritical - bonZCrit) < 1e-9;
    const roundsPerConfig = Number(pass1.roundsPerConfig);
    const roundsOk = Number.isFinite(roundsPerConfig) && roundsPerConfig >= MIN_ROUNDS_PER_CONFIG;
    const fa = (0, false_alarm_1.falseAlarmAccounting)(Number.isFinite(roundsPerConfig) && roundsPerConfig > 0 ? roundsPerConfig : false_alarm_1.ENFORCED_ROUNDS_PER_CONFIG);
    const totalRoundsOk = Number.isFinite(pass1.totalRounds) && pass1.totalRounds === CONFIGS * roundsPerConfig;
    const houseEdgeOk = Number.isFinite(sim.houseEdge) && Math.abs(sim.houseEdge - config_1.HOUSE_EDGE) < 1e-15;
    const rowCountOk = results1.length === CONFIGS;
    const mineCounts1 = results1.map(r => r?.mineCount);
    const mineCountSetOk = rowCountOk
        && new Set(mineCounts1).size === CONFIGS
        && config_1.MINE_COUNTS.every(m => mineCounts1.includes(m));
    const rows1Finite = results1.length > 0 && results1.every(r => Number.isFinite(r?.firstDrawChi2) &&
        Number.isFinite(r?.firstDrawPValue) &&
        Number.isFinite(r?.layoutR1Z) &&
        Number.isFinite(r?.layoutRunsZ) &&
        Number.isFinite(r?.layoutRunsPValue) &&
        Number.isFinite(r?.simRTP) &&
        Number.isFinite(r?.theoreticalRTP) &&
        r?.firstDrawDf === config_1.GRID - 1 &&
        (r?.mineCount === 1
            ? (r?.jointPValue === null && r?.jointMaxAbsZ === null && r?.jointPairs === null)
            : (Number.isFinite(r?.jointPValue) && Number.isFinite(r?.jointMaxAbsZ)
                && r?.jointPairs === (config_1.GRID * (config_1.GRID - 1)) / 2)));
    const firstDrawBon = results1.filter(r => r.firstDrawPValue < bonAlpha).length;
    const firstDrawUnc = results1.filter(r => r.firstDrawPValue < 0.01).length;
    const jointRows = results1.filter(r => r.jointPValue !== null && r.jointPValue !== undefined);
    const jointConfigs = jointRows.length;
    const jointBon = jointRows.filter(r => r.jointPValue < bonAlpha).length;
    const jointUnc = jointRows.filter(r => r.jointPValue < 0.01).length;
    const serialBon = results1.filter(r => Math.abs(r.layoutR1Z) > bonZCrit || r.layoutRunsPValue < bonAlpha).length;
    const serialUnc = results1.filter(r => Math.abs(r.layoutR1Z) > 1.96 || r.layoutRunsPValue < 0.01).length;
    const jointMaxAbsZ = results1.reduce((mx, r) => Math.max(mx, r.jointMaxAbsZ ?? 0), 0);
    const jointConfigsOk = jointConfigs === CONFIGS - 1 && pass1.jointConfigsTested === jointConfigs;
    let theoDev = 0, theoBad = 0;
    for (const r of results1) {
        if (!Number.isFinite(r?.theoreticalRTP) || !Number.isFinite(r?.mineCount)) {
            theoBad++;
            continue;
        }
        const dev = Math.abs(r.theoreticalRTP - (0, config_1.theoreticalRTP)(r.mineCount, 1));
        if (!(dev < 1e-12))
            theoBad++;
        if (dev > theoDev)
            theoDev = dev;
    }
    const theoOk = theoBad === 0 && results1.length === CONFIGS;
    let worstZ = 0, worstZm = 0, bandFails = 0;
    for (const r of results1) {
        if (!Number.isFinite(r?.simRTP) || !Number.isFinite(r?.mineCount)) {
            bandFails++;
            continue;
        }
        const m = r.mineCount;
        const p = (config_1.GRID - m) / config_1.GRID;
        const mult = (0, config_1.minesMultiplierExact)(m, 1);
        if (!Number.isFinite(mult) || !(p > 0 && p < 1)) {
            bandFails++;
            continue;
        }
        const se = mult * Math.sqrt((p * (1 - p)) / roundsPerConfig);
        const z = Math.abs(r.simRTP - (0, config_1.theoreticalRTP)(m, 1)) / se;
        if (!Number.isFinite(z) || z > 5)
            bandFails++;
        if (Number.isFinite(z) && z > worstZ) {
            worstZ = z;
            worstZm = m;
        }
    }
    const bandOk = bandFails === 0;
    const PV_TOL = 1e-12;
    let pvMismatches = 0, firstPvFault = '';
    for (const r of results1) {
        if (!Number.isFinite(r?.firstDrawChi2) || !Number.isFinite(r?.firstDrawPValue)) {
            pvMismatches++;
            continue;
        }
        const fdP = (0, stats_1.chiSquaredPValue)(r.firstDrawChi2, r.firstDrawDf);
        if (!(Math.abs(fdP - r.firstDrawPValue) < PV_TOL)) {
            pvMismatches++;
            if (!firstPvFault)
                firstPvFault = `m=${r.mineCount}: firstDrawChi2 ${r.firstDrawChi2} on df ${r.firstDrawDf} gives p=${fdP.toExponential(4)}, row stores ${r.firstDrawPValue}`;
        }
        if (r.jointMaxAbsZ !== null && r.jointMaxAbsZ !== undefined) {
            const jP = Math.min(1, r.jointPairs * (0, stats_1.chiSquaredPValue)(r.jointMaxAbsZ * r.jointMaxAbsZ, 1));
            if (!(Math.abs(jP - r.jointPValue) < PV_TOL)) {
                pvMismatches++;
                if (!firstPvFault)
                    firstPvFault = `m=${r.mineCount}: jointMaxAbsZ ${r.jointMaxAbsZ} over ${r.jointPairs} pairs gives p=${jP.toExponential(4)}, row stores ${r.jointPValue}`;
            }
        }
        const runsP = (0, stats_1.normalTwoSidedP)(r.layoutRunsZ);
        if (!(Math.abs(runsP - r.layoutRunsPValue) < PV_TOL)) {
            pvMismatches++;
            if (!firstPvFault)
                firstPvFault = `m=${r.mineCount}: layoutRunsZ ${r.layoutRunsZ} gives p=${runsP.toExponential(4)}, row stores ${r.layoutRunsPValue}`;
        }
        const r1z = r.layoutR1 * Math.sqrt(roundsPerConfig);
        if (!(Math.abs(r1z - r.layoutR1Z) <= 1e-9 * Math.max(1, Math.abs(r1z)))) {
            pvMismatches++;
            if (!firstPvFault)
                firstPvFault = `m=${r.mineCount}: layoutR1 ${r.layoutR1} × √${roundsPerConfig} = ${r1z}, row stores layoutR1Z ${r.layoutR1Z}`;
        }
    }
    const pvOk = pvMismatches === 0 && results1.length === CONFIGS;
    let rtpDeriveBad = 0, firstRtpFault = '', maxRtpDev = 0;
    for (const r of results1) {
        const cp = (Array.isArray(r?.convergence) ? r.convergence : []).find((c) => c?.n === roundsPerConfig);
        if (!cp || !Number.isFinite(cp.wins) || !Number.isFinite(r?.simRTP)) {
            rtpDeriveBad++;
            if (!firstRtpFault)
                firstRtpFault = `m=${r?.mineCount}: no n=${roundsPerConfig} convergence checkpoint to derive simRTP from`;
            continue;
        }
        const mult1 = (0, config_1.theoreticalRTP)(r.mineCount, 1) / ((config_1.GRID - r.mineCount) / config_1.GRID);
        const derived = (cp.wins / roundsPerConfig) * mult1;
        const dev = Math.abs(derived - r.simRTP);
        if (dev > maxRtpDev)
            maxRtpDev = dev;
        if (!(dev < 1e-12)) {
            rtpDeriveBad++;
            if (!firstRtpFault)
                firstRtpFault = `m=${r.mineCount}: ${cp.wins}/${roundsPerConfig} wins × ${mult1} = ${derived}, row stores simRTP ${r.simRTP}`;
        }
    }
    const rtpDeriveOk = rtpDeriveBad === 0 && results1.length === CONFIGS;
    const lowerBon = results1.filter(r => Number.isFinite(r?.firstDrawPValue) && r.firstDrawPValue > 1 - bonAlpha).length;
    const lowerUnc = results1.filter(r => Number.isFinite(r?.firstDrawPValue) && r.firstDrawPValue > 0.99).length;
    const runsLowerBon = results1.filter(r => Number.isFinite(r?.layoutRunsPValue) && r.layoutRunsPValue > 1 - bonAlpha).length;
    let degenerate = 0, firstDegenerate = '';
    let supportedEqualities = 0;
    for (const r of results1) {
        const { faults, supportedExactMean } = nullCentreSupport(r, roundsPerConfig);
        if (supportedExactMean)
            supportedEqualities++;
        if (faults.length > 0) {
            degenerate++;
            if (!firstDegenerate)
                firstDegenerate = `m=${r?.mineCount}: ${faults.join('; ')}`;
        }
    }
    const plausibilityOk = lowerBon === 0 && runsLowerBon === 0 && degenerate === 0;
    const meanSim = results1.reduce((s, r) => s + (r?.simRTP ?? NaN), 0) / (results1.length || 1);
    const meanTheo = results1.reduce((s, r) => s + (r?.theoreticalRTP ?? NaN), 0) / (results1.length || 1);
    const meansOk = Number.isFinite(pass1.meanSimulatedRTP) && Number.isFinite(pass1.meanTheoreticalRTP)
        && Math.abs(pass1.meanSimulatedRTP - meanSim) < 1e-12
        && Math.abs(pass1.meanTheoreticalRTP - meanTheo) < 1e-12;
    const convSamplesSeen = new Set();
    let convBad = 0, convChecked = 0, convFirstBad = '';
    for (const r of results1) {
        const conv = Array.isArray(r?.convergence) ? r.convergence : [];
        if (conv.length === 0) {
            convBad++;
            if (!convFirstBad)
                convFirstBad = `m=${r?.mineCount}: no convergence checkpoints`;
            continue;
        }
        const m = r?.mineCount;
        const p = (config_1.GRID - m) / config_1.GRID;
        let prevN = 0, prevWins = 0;
        for (const c of conv) {
            if (!Number.isFinite(c?.n) || !Number.isFinite(c?.wins)) {
                convBad++;
                break;
            }
            convSamplesSeen.add(c.n);
            if (c.n <= prevN || c.wins < prevWins || c.wins > c.n) {
                convBad++;
                if (!convFirstBad)
                    convFirstBad = `m=${m}: checkpoint (${c.n},${c.wins}) not monotone/bounded`;
                break;
            }
            const seHat = Math.sqrt((p * (1 - p)) / c.n);
            if (Math.abs(c.wins / c.n - p) > 5 * seHat) {
                convBad++;
                if (!convFirstBad)
                    convFirstBad = `m=${m}: win rate at n=${c.n} is ${(c.wins / c.n).toFixed(5)}, >5·SE from ${p}`;
                break;
            }
            prevN = c.n;
            prevWins = c.wins;
        }
        const cp = conv.find((c) => c?.n === BIND_CHECKPOINT_N);
        if (!cp || typeof r?.serverSeed !== 'string' || typeof r?.clientSeed !== 'string'
            || !/^[0-9a-f]{32}$/.test(r.serverSeed) || !/^[0-9a-f]{32}$/.test(r.clientSeed)) {
            convBad++;
            if (!convFirstBad)
                convFirstBad = `m=${m}: no n=${BIND_CHECKPOINT_N} checkpoint or malformed seeds to re-draw it from`;
            continue;
        }
        let wins = 0;
        for (let n = 0; n < BIND_CHECKPOINT_N; n++) {
            const mines = (0, rng_1.revealMines)(r.serverSeed, r.clientSeed, n, m);
            if (!mines.includes(1))
                wins++;
        }
        convChecked++;
        if (wins !== cp.wins) {
            convBad++;
            if (!convFirstBad)
                convFirstBad = `m=${m}: re-drawn n=${BIND_CHECKPOINT_N} wins ${wins} != stored ${cp.wins} (row not produced by these seeds)`;
        }
    }
    const EXPECTED_CONV_N = [1000, 5000, 10000, 50000, 100000, 500000, 1000000].filter(n => n <= roundsPerConfig);
    const convGridOk = EXPECTED_CONV_N.every(n => convSamplesSeen.has(n)) && convSamplesSeen.size === EXPECTED_CONV_N.length;
    const convOk = convBad === 0 && convChecked === CONFIGS && convGridOk;
    const pass1HasData = inventoryOk && configsDeclaredOk && bonAlphaOk && bonZOk && houseEdgeOk
        && roundsOk && totalRoundsOk
        && rowCountOk && mineCountSetOk && rows1Finite
        && pvOk && rtpDeriveOk && plausibilityOk
        && theoOk && bandOk && meansOk && convOk && jointConfigsOk
        && pass1.firstDrawChi2FailsBonferroni === firstDrawBon
        && pass1.firstDrawChi2FailsAtAlpha01 === firstDrawUnc
        && (pass1.jointFailsBonferroni ?? pass1.jointChi2FailsBonferroni) === jointBon
        && pass1.jointFailsAtAlpha01 === jointUnc
        && pass1.layoutSerialFailsBonferroni === serialBon
        && pass1.layoutSerialFailsUncorrected === serialUnc
        && Math.abs((pass1.jointMaxAbsZAcrossConfigs ?? NaN) - jointMaxAbsZ) < 1e-12;
    const pass1Ok = pass1HasData && firstDrawBon === 0 && jointBon === 0 && serialBon === 0;
    const s16Faults = [];
    if (!inventoryOk)
        s16Faults.push(inventoryNote);
    if (!configsDeclaredOk)
        s16Faults.push(`declared configs ${pass1.configs} != MINE_COUNTS.length ${CONFIGS}`);
    if (!roundsOk)
        s16Faults.push(`roundsPerConfig ${pass1.roundsPerConfig} below the ${MIN_ROUNDS_PER_CONFIG.toLocaleString()} floor`);
    if (!totalRoundsOk)
        s16Faults.push(`totalRounds ${pass1.totalRounds} != ${CONFIGS} × ${roundsPerConfig}`);
    if (!houseEdgeOk)
        s16Faults.push(`artifact houseEdge ${sim.houseEdge} != src/config.ts HOUSE_EDGE ${config_1.HOUSE_EDGE}`);
    if (!bonAlphaOk || !bonZOk)
        s16Faults.push('reported Bonferroni threshold(s) disagree with the derived α/24');
    if (!rowCountOk)
        s16Faults.push(`${results1.length} detail rows, expected ${CONFIGS}`);
    else if (!mineCountSetOk)
        s16Faults.push('detail rows are not one per mineCount 1..24 (duplicate or missing config)');
    if (!rows1Finite)
        s16Faults.push('non-finite / wrong-shaped statistic in at least one row');
    if (!theoOk)
        s16Faults.push(`${theoBad} rows whose theoreticalRTP != theoreticalRTP(m,1) recomputed from src/config.ts (max dev ${theoDev.toExponential(2)})`);
    if (!bandOk)
        s16Faults.push(`${bandFails} rows outside the per-config 5·SE band around ${((0, config_1.theoreticalRTP)(1, 1) * 100).toFixed(4)}%`);
    if (!meansOk)
        s16Faults.push('mean RTP scalars disagree with the mean of the detail rows');
    if (!convOk)
        s16Faults.push(`convergence bind: ${convBad} bad, ${convChecked}/${CONFIGS} re-drawn${convFirstBad ? ` (${convFirstBad})` : ''}${convGridOk ? '' : '; checkpoint grid does not match the derived ladder'}`);
    if (!jointConfigsOk)
        s16Faults.push(`jointConfigsTested ${pass1.jointConfigsTested} vs ${jointConfigs} rows with a pair test (expected ${CONFIGS - 1})`);
    if (!pvOk)
        s16Faults.push(`${pvMismatches} statistic/p-value pairs that do not reconcile — a stored p that does not follow from the statistic beside it${firstPvFault ? ` (${firstPvFault})` : ''}`);
    if (!rtpDeriveOk)
        s16Faults.push(`${rtpDeriveBad} rows whose simRTP does not equal (final convergence wins / N) × mult₁${firstRtpFault ? ` (${firstRtpFault})` : ''}`);
    if (lowerBon > 0)
        s16Faults.push(`${lowerBon}/${CONFIGS} first-draw p-values in the LOWER tail at Bonferroni (p > 1 − α/${CONFIGS}) — a χ² that far below its df is as improbable as one far above it`);
    if (runsLowerBon > 0)
        s16Faults.push(`${runsLowerBon}/${CONFIGS} runs p-values in the LOWER tail at Bonferroni`);
    if (degenerate > 0)
        s16Faults.push(`${degenerate}/${CONFIGS} rows carry a null-centre value that is either outside the support of the integer counts that produce it, or contradicted by the row's own convergence counts${firstDegenerate ? ` (${firstDegenerate})` : ''}`);
    const s16 = (0, context_1.step)(16, 'Simulation — Pass 1 (First-Draw · Joint · Serial, FWER)', pass1Ok ? 'PASS' : 'FAIL', `${CONFIGS} configurations × ${roundsPerConfig.toLocaleString()} rounds = ${(pass1.totalRounds ?? 0).toLocaleString()} rounds. `
        + `Approximate statistical thresholds use Bonferroni α/${CONFIGS}=${bonAlpha.toExponential(3)}. `
        + `First-drawn tile uniformity: ${firstDrawUnc}/${CONFIGS} unadjusted rejections, ${firstDrawBon}/${CONFIGS} adjusted. `
        + `Pairwise co-occurrence: ${jointUnc}/${jointConfigs} unadjusted rejections, ${jointBon}/${jointConfigs} adjusted; `
        + `max|z|=${jointMaxAbsZ.toFixed(2)}, per-pair critical=${jointPairCritZ.toFixed(2)} after adjustment across pairs and configurations. `
        + `First-drawn-tile serial checks: ${serialUnc}/${CONFIGS} unadjusted rejections, ${serialBon}/${CONFIGS} adjusted; lag-one |z| critical=${bonZCrit.toFixed(2)}. `
        + `Mean simulated RTP ${(meanSim * 100).toFixed(4)}%; reference ${(meanTheo * 100).toFixed(4)}%. `
        + `Artifact checks: ${inventoryNote}; ${pvMismatches} statistic/p-value mismatches; ${rtpDeriveBad} RTP/convergence mismatches; `
        + `${lowerBon} first-draw and ${runsLowerBon} runs lower-tail rejections; ${degenerate} unsupported or contradictory rows; ${supportedEqualities} supported exact-mean rows. `
        + `Convergence: ${convChecked}/${CONFIGS} initial ${BIND_CHECKPOINT_N.toLocaleString()}-round checkpoints recomputed, ${convBad} faults; `
        + `RTP deviation up to ${worstZ.toFixed(2)} modeled SE at m=${worstZm}. `
        + `FALSE-ALARM ACCOUNTING: ${fa.arms.length} scored rejection arms have total NOMINAL level ${fa.totalNominalPercent.toFixed(4)}%; this is NOT an upper bound or a calibrated combined rate. `
        + `At n=${fa.notAnUpperBound.checkpointN}, m=${fa.notAnUpperBound.worstConfig.mineCount}, the 5-SE screen rejects wins ≤ ${fa.notAnUpperBound.worstConfig.rejectAtOrBelow} or ≥ ${fa.notAnUpperBound.worstConfig.rejectAtOrAbove}; `
        + `its exact binomial rejection probability is ${fa.notAnUpperBound.worstConfig.exactRejectionProbability.toExponential(12)}, compared with nominal ${fa.notAnUpperBound.worstConfig.nominalRejectionProbability.toExponential(12)}. `
        + `The Bernstein union upper bound ${fa.validBounds.arm8UnionUpperBound.toExponential(4)} covers the convergence-screen family only. See outputs/audit-figures.json → falseAlarmAccounting for the individual arms. `
        + `Default verification recomputes the initial checkpoints and checks deeper summaries for consistency. Full Pass-1 statistics require npm run deep-replay, using the retained row seeds. `
        + `A self-consistent deep-summary forgery can pass ordinary verification; this coverage boundary is exercised by declared survivor S01. Serial statistics concern first-drawn tiles, not every form of layout dependence.`
        + (s16Faults.length > 0 ? ` FAULTS: ${s16Faults.join('; ')}` : ''));
    const pass2 = sim.pass2_casino_seeds ?? {};
    const results2 = Array.isArray(pass2.results) ? pass2.results : [];
    const revealedSeeds = ctx.seeds.filter(s => s.serverSeed);
    const revealedSeedCount = revealedSeeds.length;
    const seedByHash = new Map(revealedSeeds.map(s => [s.hashedServerSeed, s]));
    const mineCountByHash = new Map();
    for (const b of ctx.bets)
        if (!mineCountByHash.has(b.hashedServerSeed))
            mineCountByHash.set(b.hashedServerSeed, b.mineCount);
    const rowHashes = results2.map(r => r?.hashedServerSeed);
    const rowHashSet = new Set(rowHashes);
    const seedSetOk = results2.length === revealedSeedCount
        && rowHashSet.size === revealedSeedCount
        && [...seedByHash.keys()].every(h => rowHashSet.has(h));
    const noncesPerSeed = Number(pass2.noncesPerSeed);
    const early = Array.isArray(pass2.earlyWindow) ? pass2.earlyWindow : [];
    const late = Array.isArray(pass2.lateWindow) ? pass2.lateWindow : [];
    const earlyOk = early.length === 2 && early[0] === 0 && Number.isFinite(early[1]) && early[1] > 0;
    const earlyN = earlyOk ? early[1] + 1 : 0;
    const windowsOk = earlyOk && Number.isFinite(noncesPerSeed) && noncesPerSeed > earlyN
        && late.length === 2 && late[0] === earlyN && late[1] === noncesPerSeed - 1;
    const lateN = windowsOk ? noncesPerSeed - earlyN : 0;
    const reps = Number(pass2.bootstrapReps);
    const repsOk = Number.isFinite(reps) && reps >= 1000;
    const rows2Finite = results2.length > 0 && results2.every(r => Number.isFinite(r?.epoch) && typeof r?.hashedServerSeed === 'string'
        && Number.isFinite(r?.mineCount)
        && Number.isFinite(r?.earlyChi2) && Number.isFinite(r?.earlyBootstrapP)
        && Number.isFinite(r?.lateChi2) && Number.isFinite(r?.latePValue)
        && typeof r?.cherryPickFlag === 'boolean');
    let recomputeOk = windowsOk && rows2Finite && seedSetOk;
    let statMismatches = 0, epochMismatches = 0, mcMismatches = 0, flagMismatches = 0;
    let firstStatFault = '';
    let derivedFlags = 0;
    let bootPQuantBad = 0, bootPRangeBad = 0;
    if (recomputeOk) {
        for (const r of results2) {
            const seed = seedByHash.get(r.hashedServerSeed);
            if (!seed) {
                statMismatches++;
                continue;
            }
            if (r.epoch !== seed.epoch)
                epochMismatches++;
            const dsMineCount = mineCountByHash.get(r.hashedServerSeed);
            if (dsMineCount === undefined || r.mineCount !== dsMineCount)
                mcMismatches++;
            const ef = new Array(config_1.GRID).fill(0);
            const lf = new Array(config_1.GRID).fill(0);
            for (let n = 0; n < noncesPerSeed; n++) {
                const t = (0, rng_1.firstMineTile)(seed.serverSeed, seed.clientSeed, n);
                if (n < earlyN)
                    ef[t - 1]++;
                else
                    lf[t - 1]++;
            }
            const ec = (0, stats_1.chiSquaredTest)([...ef], new Array(config_1.GRID).fill(earlyN / config_1.GRID));
            const lr = (0, stats_1.chiSquaredTest)([...lf], new Array(config_1.GRID).fill(lateN / config_1.GRID));
            if (!(Math.abs(ec.chi2 - r.earlyChi2) < 1e-9)
                || !(Math.abs(lr.chi2 - r.lateChi2) < 1e-9)
                || !(Math.abs(lr.pValue - r.latePValue) < 1e-12)) {
                statMismatches++;
                if (!firstStatFault)
                    firstStatFault = `epoch ${r.epoch}: stored (earlyChi2 ${r.earlyChi2}, lateChi2 ${r.lateChi2}, lateP ${r.latePValue}) vs re-derived (${ec.chi2}, ${lr.chi2}, ${lr.pValue})`;
            }
            const kUnits = r.earlyBootstrapP * (reps + 1);
            if (Math.abs(kUnits - Math.round(kUnits)) > 1e-6)
                bootPQuantBad++;
            if (!(r.earlyBootstrapP >= 1 / (reps + 1) - 1e-12 && r.earlyBootstrapP <= 1 + 1e-12))
                bootPRangeBad++;
            const derived = r.earlyBootstrapP < CHERRY_EARLY_ALPHA && lr.pValue >= CHERRY_LATE_ALPHA;
            if (derived)
                derivedFlags++;
            if (derived !== r.cherryPickFlag)
                flagMismatches++;
        }
        recomputeOk = statMismatches === 0 && epochMismatches === 0 && mcMismatches === 0
            && flagMismatches === 0 && bootPQuantBad === 0 && bootPRangeBad === 0;
    }
    const bootMaster = sim.masterSeed;
    const bootVersionTop = sim.seedDerivation;
    const bootVersionPass2 = pass2.bootstrapSeedDerivation;
    const bootVersion = bootVersionTop ?? bootVersionPass2;
    const replayPathsPresent = [
        ['masterSeed', bootMaster],
        ['seedDerivation', bootVersionTop],
        ['pass2_casino_seeds.bootstrapSeedDerivation', bootVersionPass2],
    ].filter(([, v]) => v !== undefined);
    const claimsReplay = replayPathsPresent.length > 0;
    const replayMetaFaults = [];
    if (claimsReplay) {
        if (replayPathsPresent.length !== KP_OPTIONAL_ATTESTED.length) {
            const missing = KP_OPTIONAL_ATTESTED.filter(p => !replayPathsPresent.some(([n]) => n === p));
            replayMetaFaults.push(`replay metadata INCOMPLETE — the artifact carries ${replayPathsPresent.map(([n]) => n).join(', ')} but not ${missing.join(', ')}; all ${KP_OPTIONAL_ATTESTED.length} are required together or the artifact must carry none of them`);
        }
        if (!(0, rng_1.isMasterSeed)(bootMaster)) {
            replayMetaFaults.push(`masterSeed ${JSON.stringify(bootMaster)} is not a usable master seed (32–128 lowercase hex characters, even length) — the bootstrap null cannot be rebuilt from it, so the run is UNVERIFIABLE, not exempt`);
        }
        for (const [name, v] of [['seedDerivation', bootVersionTop], ['pass2_casino_seeds.bootstrapSeedDerivation', bootVersionPass2]]) {
            if (v !== undefined && v !== rng_1.SEED_DERIVATION_VERSION) {
                replayMetaFaults.push(`${name} ${JSON.stringify(v)} is not the derivation this build implements (${rng_1.SEED_DERIVATION_VERSION}) — this build cannot rebuild that artifact's null and must not score it as if no null were needed`);
            }
        }
    }
    const replayMetaOk = replayMetaFaults.length === 0;
    const bootReplayAvailable = claimsReplay && replayMetaOk
        && repsOk && rows2Finite && earlyOk;
    let bootReplayed = 0, bootPMismatches = 0, firstBootFault = '';
    if (bootReplayAvailable) {
        const nulls = new Map();
        for (const mc of new Set(results2.map(r => r.mineCount))) {
            const stats = new Float64Array(reps);
            for (let rep = 0; rep < reps; rep++) {
                const bs = (0, rng_1.deriveSeedHex)(bootMaster, `pass2-bootstrap-server:m=${mc}`, rep);
                const bc = (0, rng_1.deriveSeedHex)(bootMaster, `pass2-bootstrap-client:m=${mc}`, rep);
                const freq = new Array(config_1.GRID).fill(0);
                for (let n = 0; n < earlyN; n++)
                    freq[(0, rng_1.firstMineTile)(bs, bc, n) - 1]++;
                stats[rep] = (0, stats_1.chiSquaredTest)([...freq], new Array(config_1.GRID).fill(earlyN / config_1.GRID)).chi2;
            }
            stats.sort();
            nulls.set(mc, stats);
        }
        const bootP = (sorted, stat) => {
            let lo = 0, hi = sorted.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (sorted[mid] < stat)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            return (sorted.length - lo + 1) / (sorted.length + 1);
        };
        for (const r of results2) {
            const sorted = nulls.get(r.mineCount);
            if (!sorted) {
                bootPMismatches++;
                continue;
            }
            const p = bootP(sorted, r.earlyChi2);
            bootReplayed++;
            if (Math.abs(p - r.earlyBootstrapP) > 1e-12) {
                bootPMismatches++;
                if (!firstBootFault)
                    firstBootFault = `epoch ${r.epoch}: stored earlyBootstrapP ${r.earlyBootstrapP}, replayed ${p}`;
            }
        }
    }
    const legacyDigest = (0, pins_1.earlyBootstrapPDigest)(results2);
    const legacyPinOk = legacyDigest === pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST;
    const legacyExceptionOk = !claimsReplay && legacyPinOk;
    const bootReplayOk = claimsReplay
        ? (replayMetaOk && bootReplayAvailable && bootPMismatches === 0 && bootReplayed === results2.length)
        : legacyExceptionOk;
    let monoViolations = 0;
    if (rows2Finite) {
        const byM = new Map();
        for (const r of results2) {
            const arr = byM.get(r.mineCount) ?? [];
            arr.push(r);
            byM.set(r.mineCount, arr);
        }
        for (const [, rows] of byM) {
            const sorted = [...rows].sort((a, b) => a.earlyChi2 - b.earlyChi2);
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].earlyBootstrapP > sorted[i - 1].earlyBootstrapP + 1e-12)
                    monoViolations++;
            }
        }
    }
    const expectedBootMC = [...new Set(revealedSeeds.map(s => mineCountByHash.get(s.hashedServerSeed)))]
        .filter(v => v !== undefined).sort((a, b) => a - b);
    const bootMC = Array.isArray(pass2.bootstrapMineCounts) ? pass2.bootstrapMineCounts : [];
    const bootMCOk = bootMC.length === expectedBootMC.length
        && expectedBootMC.every((m, i) => bootMC[i] === m);
    const survival = binomialSurvival(derivedFlags, revealedSeedCount, CHERRY_FLAG_RATE);
    const expectedByChance = revealedSeedCount * CHERRY_FLAG_RATE;
    const scalarsOk = pass2.seeds_tested === revealedSeedCount
        && pass2.cherryPickFlags === derivedFlags
        && Number.isFinite(pass2.expectedFlagsByChance) && Math.abs(pass2.expectedFlagsByChance - expectedByChance) < 1e-9
        && Number.isFinite(pass2.cherryPickSurvivalP) && Math.abs(pass2.cherryPickSurvivalP - survival) < 1e-9;
    const pass2HasData = inventoryOk && seedSetOk && rows2Finite && windowsOk && repsOk
        && recomputeOk && monoViolations === 0 && bootMCOk && scalarsOk && bootReplayOk
        && revealedSeedCount === ctx.seeds.length
        && Number.isFinite(survival);
    const pass2Ok = pass2HasData && survival >= 0.01;
    const s17Faults = [];
    if (!inventoryOk)
        s17Faults.push(inventoryNote);
    if (!seedSetOk)
        s17Faults.push(`row seed set is not the ${revealedSeedCount} revealed dataset seeds (${results2.length} rows, ${rowHashSet.size} distinct hashes)`);
    if (!rows2Finite)
        s17Faults.push('non-finite / wrong-typed field in at least one seed row');
    if (replayMetaFaults.length > 0)
        s17Faults.push(`QA-05 replay metadata rejected — ${replayMetaFaults.join('; ')}`);
    if (!bootReplayOk && replayMetaFaults.length === 0) {
        if (claimsReplay) {
            s17Faults.push(bootReplayAvailable
                ? `deterministic bootstrap replay: ${bootPMismatches} of ${results2.length} rows whose earlyBootstrapP does not re-derive from the recorded masterSeed${firstBootFault ? ` (${firstBootFault})` : ''}`
                : `the artifact records valid QA-05 replay metadata but the replay could not be run against it (bootstrapReps / row finiteness / early-window declaration above), so earlyBootstrapP is unattested`);
        }
        else {
            s17Faults.push(`the artifact records NO QA-05 replay metadata, so its earlyBootstrapP cannot be re-derived, and it is not the one artifact the legacy exception covers: earlyBootstrapP digest ${legacyDigest} != pinned ${pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST} (src/pins.ts). Omitting masterSeed is not a way to have earlyBootstrapP taken on trust`);
        }
    }
    if (!windowsOk)
        s17Faults.push(`window declaration inconsistent: noncesPerSeed ${pass2.noncesPerSeed}, early ${JSON.stringify(pass2.earlyWindow)}, late ${JSON.stringify(pass2.lateWindow)}`);
    if (!repsOk)
        s17Faults.push(`bootstrapReps ${pass2.bootstrapReps} below the 1,000 floor`);
    if (statMismatches > 0)
        s17Faults.push(`${statMismatches} rows whose chi² statistics do not re-derive from the dataset's revealed serverSeed${firstStatFault ? ` (${firstStatFault})` : ''}`);
    if (epochMismatches > 0)
        s17Faults.push(`${epochMismatches} rows whose epoch does not match the seed record`);
    if (mcMismatches > 0)
        s17Faults.push(`${mcMismatches} rows whose mineCount does not match the epoch's bets in the dataset`);
    if (flagMismatches > 0)
        s17Faults.push(`${flagMismatches} rows whose stored cherryPickFlag != the flag derived from earlyBootstrapP<0.05 AND re-derived latePValue>=0.05`);
    if (bootPQuantBad > 0)
        s17Faults.push(`${bootPQuantBad} earlyBootstrapP values not of the form k/(reps+1)`);
    if (bootPRangeBad > 0)
        s17Faults.push(`${bootPRangeBad} earlyBootstrapP values outside [1/(reps+1), 1]`);
    if (monoViolations > 0)
        s17Faults.push(`${monoViolations} within-mineCount monotonicity violations (larger earlyChi2 with a larger bootstrap p)`);
    if (!bootMCOk)
        s17Faults.push('bootstrapMineCounts is not the sorted distinct mineCount set of the revealed epochs');
    if (!scalarsOk)
        s17Faults.push('summary scalars (seeds_tested / cherryPickFlags / expectedFlagsByChance / cherryPickSurvivalP) disagree with the recomputation');
    if (pass2HasData && survival < 0.01)
        s17Faults.push(`cherry-pick survival P=${survival.toExponential(3)} < 0.01`);
    const s17 = (0, context_1.step)(17, 'Simulation — Pass 2 Cherry-Pick Test', pass2Ok ? 'PASS' : 'FAIL', `${revealedSeedCount} revealed dataset seeds × ${(noncesPerSeed || 0).toLocaleString()} nonces; early window ${early[0] ?? '?'}..${early[1] ?? '?'}. `
        + `Recalculated early/late statistics and late p-values: ${statMismatches} mismatching rows; epoch and mine-count mismatches: ${epochMismatches}, ${mcMismatches}. `
        + `Flags derived from earlyBootstrapP < ${CHERRY_EARLY_ALPHA} and latePValue >= ${CHERRY_LATE_ALPHA}: ${derivedFlags}; `
        + `nominal expectation ${expectedByChance.toFixed(3)}, binomial survival ${survival.toFixed(8)}; ${flagMismatches} stored-flag mismatches. `
        + (bootReplayAvailable
            ? `Bootstrap replay: ${(reps || 0).toLocaleString()} replicates per mine count rebuilt from the recorded master seed under '${bootVersion}'; ${bootReplayed}/${results2.length} p-values checked, ${bootPMismatches} mismatches. `
            : claimsReplay
                ? `Bootstrap replay did not run because the supplied replay metadata or statistical inputs are invalid; the faults below identify the rejected fields. `
                : legacyExceptionOk
                    ? `Compatibility-fixture mode: early bootstrap values match the fixed reference digest ${pins_1.LEGACY_EARLY_BOOTSTRAP_P_DIGEST}. This fixture lacks generating inputs, so its p-values are pinned rather than replayed. Range, lattice, ordering and downstream arithmetic are checked (${monoViolations} ordering violations). `
                    : `Bootstrap replay unavailable: replay metadata is absent and the values do not match the supported compatibility fixture. `)
        + `Unsupported, partial or malformed replay metadata fails verification. This first-draw diagnostic does not prove unbiased seed selection. `
        + `Mitigation against selecting a server seed for a known client input requires a binding server commitment before learning an unpredictable client seed, with both inputs bound to the round. Player control alone does not establish those conditions.`
        + (s17Faults.length > 0 ? ` FAULTS: ${s17Faults.join('; ')}` : ''));
    return [s16, s17];
}

  },
};
var __cache = {};

function __flatten(from, spec) {
  var base = from ? from.split('/').slice(0, -1).join('/') : '';
  var parts = (base ? base + '/' + spec : spec).split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') { out.pop(); continue; }
    out.push(p);
  }
  return out.join('/');
}

function __resolve(from, spec) {
  var joined = __flatten(from, spec);
  var candidates = [joined, joined + '.js', joined + '.json', joined + '/index.js'];
  for (var c = 0; c < candidates.length; c++) {
    if (Object.prototype.hasOwnProperty.call(__modules, candidates[c])) return candidates[c];
  }
  return null;
}

function __require(from, spec) {
  if (!spec.startsWith('.')) return __nodeRequire(spec);
  var id = __resolve(from, spec);
  if (!id) {
    // Not TypeScript, so tsc never emitted it — a .mjs/.cjs/.json asset the package SHIPS, such as
    // a capture reference module. Load the real file off disk relative to the package root. The
    // bundle stays self-contained for compiled code without pretending the package has no other
    // files; if the asset is genuinely missing, the error names it rather than hiding it.
    var abs = __PF_ROOT__ + '/' + __flatten(from, spec);
    try { return __nodeRequire(abs); } catch (e) {
      throw new Error('standalone verifier: unresolved module "' + spec + '" from "' + from + '" (' + e.message + ')');
    }
  }
  if (__cache[id]) return __cache[id].exports;
  var module = { exports: {} };
  __cache[id] = module;
  var dir = id.split('/').slice(0, -1).join('/');
  __modules[id](
    module,
    module.exports,
    function (s) { return __require(id, s); },
    __PF_ROOT__ + '/' + id,
    dir ? __PF_ROOT__ + '/' + dir : __PF_ROOT__
  );
  return module.exports;
}

__require('', "./tests/__standalone-entry.js");
