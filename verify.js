/**
 * Generated from the repository TypeScript sources.
 * Rebuild: npm run build; check reproducibility: npm run build:check.
 * Entry: tests/verify.js; linked modules: 20.
 */
'use strict';


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
  "src/diff.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenLeaves = flattenLeaves;
exports.fieldDiff = fieldDiff;
function flattenLeaves(value, prefix = '', out = new Map()) {
    if (value === null || typeof value !== 'object') {
        out.set(prefix, value);
        return out;
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            out.set(prefix, '<empty array>');
        value.forEach((v, i) => flattenLeaves(v, `${prefix}[${i}]`, out));
        return out;
    }
    const keys = Object.keys(value);
    if (keys.length === 0)
        out.set(prefix, '<empty object>');
    for (const k of keys)
        flattenLeaves(value[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
}
function fieldDiff(committed, thisRun, ignore = []) {
    const a = flattenLeaves(committed);
    const b = flattenLeaves(thisRun);
    const skip = new Set(ignore);
    const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
    const out = [];
    for (const p of paths) {
        if (skip.has(p))
            continue;
        const inA = a.has(p), inB = b.has(p);
        const va = inA ? a.get(p) : '<absent>';
        const vb = inB ? b.get(p) : '<absent>';
        if (!Object.is(va, vb))
            out.push({ path: p, committed: va, thisRun: vb });
    }
    return out;
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
  "src/figures.js": function (module, exports, require, __filename, __dirname) {
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
exports.AUDIT_FIGURES_FILE = void 0;
exports.computeAuditFigures = computeAuditFigures;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const rng_1 = require("./rng");
const false_alarm_1 = require("./false-alarm");
exports.AUDIT_FIGURES_FILE = 'audit-figures.json';
function computeAuditFigures(input) {
    const { bets, seeds, seedMap, phaseD, outputsDir, datasetSha256 } = input;
    const referenceGrid = [];
    for (const m of config_1.MINE_COUNTS) {
        for (let k = 1; k <= config_1.GRID - m; k++) {
            referenceGrid.push({
                mineCount: m,
                tilesRevealed: k,
                winProbability: (0, config_1.winProbability)(m, k),
                multiplierExact: (0, config_1.minesMultiplierExact)(m, k),
                multiplierDisplayed: (0, config_1.minesMultiplier)(m, k),
                theoreticalRTP: (0, config_1.theoreticalRTP)(m, k),
            });
        }
    }
    const stakesUsed = [...new Set(bets.map(b => Number(b.betAmount)))].filter(a => Number.isFinite(a) && a > 0).sort((a, b) => a - b);
    const settlementFloor = stakesUsed.map(stake => {
        const stakeUnits = BigInt(Math.round(stake * 1e8));
        let worst = { stake, mineCount: 0, tilesRevealed: 0, deficitOfTurnover: 0, settledRTP: config_1.PUBLISHED_RTP };
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                let num = config_1.EDGE_NUM, den = config_1.EDGE_DEN;
                for (let i = 0; i < k; i++) {
                    num *= BigInt(config_1.GRID - i);
                    den *= BigInt(config_1.GRID - m - i);
                }
                const exactUnits = stakeUnits * num;
                const fracUnits = Number(exactUnits - (exactUnits / den) * den) / Number(den);
                const deficit = (0, config_1.winProbability)(m, k) * (fracUnits / 1e8) / stake;
                if (Number.isFinite(deficit) && deficit > worst.deficitOfTurnover) {
                    worst = { stake, mineCount: m, tilesRevealed: k, deficitOfTurnover: deficit, settledRTP: config_1.PUBLISHED_RTP - deficit };
                }
            }
        }
        return worst;
    });
    const clientSeeds = seeds.map(s => s.clientSeed);
    const auditSeeds = clientSeeds.filter(c => /^audit[0-9a-f]{12}$/.test(c));
    const nibbleFreq = new Array(16).fill(0);
    for (const c of auditSeeds)
        for (const ch of c.slice(5))
            nibbleFreq[parseInt(ch, 16)]++;
    const nibbleN = auditSeeds.length * 12;
    const nibbleExp = nibbleN / 16;
    const nibbleChi2 = nibbleExp > 0 ? nibbleFreq.reduce((s, o) => s + ((o - nibbleExp) ** 2) / nibbleExp, 0) : 0;
    const nonFiniteBetAmounts = bets.filter(b => !Number.isFinite(Number(b.betAmount))).length;
    const nonFiniteWinAmounts = bets.filter(b => !Number.isFinite(Number(b.winningAmount))).length;
    const wagered = bets.reduce((s, b) => s + (Number.isFinite(Number(b.betAmount)) ? Number(b.betAmount) : 0), 0);
    const returned = bets.reduce((s, b) => s + (Number.isFinite(Number(b.winningAmount)) ? Number(b.winningAmount) : 0), 0);
    const wins = bets.filter(b => b.result === 'won').length;
    let simFigures = null;
    let simRoundsPerConfig = false_alarm_1.ENFORCED_ROUNDS_PER_CONFIG;
    const simPath = path.join(outputsDir, 'simulation-results.json');
    if (fs.existsSync(simPath)) {
        const sim = JSON.parse(fs.readFileSync(simPath, 'utf-8'));
        const rows = sim?.pass1_fresh_seeds?.results ?? [];
        const N = Number(sim?.pass1_fresh_seeds?.roundsPerConfig);
        if (Number.isFinite(N) && N > 0)
            simRoundsPerConfig = N;
        if (rows.length > 0 && Number.isFinite(N) && N > 0) {
            let sumVar = 0;
            const perConfigZ = rows.map(r => {
                const p = (config_1.GRID - r.mineCount) / config_1.GRID;
                const mult = (0, config_1.minesMultiplierExact)(r.mineCount, 1);
                sumVar += p * (1 - p) * mult * mult;
                return { mineCount: r.mineCount, z: (r.simRTP - (0, config_1.theoreticalRTP)(r.mineCount, 1)) / (mult * Math.sqrt((p * (1 - p)) / N)) };
            });
            const meanSim = rows.reduce((s, r) => s + r.simRTP, 0) / rows.length;
            const pooledSE = Math.sqrt(sumVar / (rows.length * rows.length * N));
            simFigures = {
                configs: rows.length,
                roundsPerConfig: N,
                meanSimulatedRTP: meanSim,
                pooledSEPercentagePoints: pooledSE * 100,
                twoSEBandPercentagePoints: 2 * pooledSE * 100,
                ...(() => {
                    let sumRTP = 0, sumVar = 0, k = 0;
                    for (const r of rows) {
                        const cp = (r.convergence ?? []).find((c) => c.n === N);
                        if (!cp)
                            continue;
                        const pHat = cp.wins / N;
                        const m1 = (0, config_1.theoreticalRTP)(r.mineCount, 1) / ((config_1.GRID - r.mineCount) / config_1.GRID);
                        sumRTP += pHat * m1;
                        sumVar += pHat * (1 - pHat) * m1 * m1;
                        k++;
                    }
                    if (k === 0)
                        return {};
                    const chartMean = sumRTP / k;
                    const chartSE = Math.sqrt(sumVar / (k * k * N));
                    return {
                        chartFinalRTPPercent: chartMean * 100,
                        chartFinalSEPercentagePoints: chartSE * 100,
                        chartFinalBandLowerPercent: (chartMean - 2 * chartSE) * 100,
                        chartFinalBandUpperPercent: (chartMean + 2 * chartSE) * 100,
                    };
                })(),
                meanZAgainstTheory: (meanSim - config_1.PUBLISHED_RTP) / pooledSE,
                absMeanZAgainstTheory: Math.abs((meanSim - config_1.PUBLISHED_RTP) / pooledSE),
                perConfigZ,
                maxAbsPerConfigZ: Math.max(...perConfigZ.map(x => Math.abs(x.z))),
            };
        }
    }
    return {
        datasetSha256,
        note: 'Derived scalars emitted so the report cites numbers a pipeline step produced, never numbers a person typed. NUMBER leaves only — no interpreted prose.',
        houseEdge: config_1.HOUSE_EDGE,
        referenceGrid,
        referenceGridSummary: {
            cells: referenceGrid.length,
            minTheoreticalRTP: Math.min(...referenceGrid.map(c => c.theoreticalRTP)),
            maxTheoreticalRTP: Math.max(...referenceGrid.map(c => c.theoreticalRTP)),
            cellsOffTarget: referenceGrid.filter(c => Math.abs(c.theoreticalRTP - config_1.PUBLISHED_RTP) > 1e-9).length,
            nonFiniteCells: referenceGrid.filter(c => !Number.isFinite(c.theoreticalRTP)).length,
        },
        settlementFloor,
        clientSeedControls: (() => {
            let tested = 0, emptyRepro = 0, wrongRepro = 0;
            for (const b of bets) {
                const ss = seedMap.get(b.hashedServerSeed);
                if (!ss)
                    continue;
                tested++;
                if ((0, rng_1.sameMines)((0, rng_1.revealMines)(ss, '', b.nonce, b.mineCount), b.mineTiles))
                    emptyRepro++;
                if ((0, rng_1.sameMines)((0, rng_1.revealMines)(ss, 'wrong-client-seed-test', b.nonce, b.mineCount), b.mineTiles))
                    wrongRepro++;
            }
            return {
                tested,
                emptySeedReproduces: emptyRepro,
                emptySeedReproducesPercent: (emptyRepro / tested) * 100,
                wrongSeedReproduces: wrongRepro,
                wrongSeedReproducesPercent: (wrongRepro / tested) * 100,
                changedUnderWrongSeed: tested - wrongRepro,
                changedUnderWrongSeedPercent: ((tested - wrongRepro) / tested) * 100,
            };
        })(),
        moduloBiasRejectionCensus: (() => {
            let draws = 0, rejections = 0, roundsScanned = 0;
            for (const b of bets) {
                const ss = seedMap.get(b.hashedServerSeed);
                if (!ss)
                    continue;
                const c = (0, rng_1.moduloRejectionCensus)(ss, b.clientSeed, b.nonce);
                draws += c.draws;
                rejections += c.rejections;
                roundsScanned++;
            }
            const expected = (0, rng_1.expectedModuloRejections)(roundsScanned);
            return {
                roundsScanned,
                drawsScanned: draws,
                rejectionsObserved: rejections,
                rejectionsExpected: expected,
                probabilityCaptureWitnessesBranch: 1 - Math.exp(-expected),
            };
        })(),
        phaseDTimestampPatternEpochs: (() => {
            const sub = phaseD.filter(b => b.epoch >= 120 && b.epoch <= 129);
            const fin = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
            const nonFinite = sub.filter(b => !Number.isFinite(Number(b.betAmount)) || !Number.isFinite(Number(b.winningAmount))).length;
            const staked = sub.reduce((s, b) => s + fin(b.betAmount), 0);
            const credited = sub.reduce((s, b) => s + fin(b.winningAmount), 0);
            return { epochs: new Set(sub.map(b => b.epoch)).size, bets: sub.length, staked, credited, netToPlayer: credited - staked, nonFiniteMoneyRows: nonFinite };
        })(),
        clientSeedProvenance: {
            epochs: clientSeeds.length,
            auditFormatSeeds: auditSeeds.length,
            distinctAuditFormatSeeds: new Set(auditSeeds).size,
            customPhaseDSeeds: clientSeeds.filter(c => /^pfaudit-/.test(c)).length,
            hexNibblesSampled: nibbleN,
            hexNibbleChi2: nibbleChi2,
            hexNibbleDf: 15,
        },
        liveAggregate: {
            bets: bets.length,
            wins,
            losses: bets.length - wins,
            winRate: wins / bets.length,
            wagered,
            returned,
            liveRTP: returned / wagered,
            liveRTPPercent: (returned / wagered) * 100,
            nonFiniteBetAmounts,
            nonFiniteWinAmounts,
        },
        flooredDisplayCounterfactual: (() => {
            const rows = [];
            let worst = { mineCount: 0, tilesRevealed: 0, edge: 0, lossPerDollar: 0 };
            for (const m of config_1.MINE_COUNTS) {
                for (let k = 1; k <= config_1.GRID - m; k++) {
                    const exact = (0, config_1.minesMultiplierExact)(m, k);
                    const disp = (0, config_1.minesMultiplier)(m, k);
                    if (!Number.isFinite(exact) || !Number.isFinite(disp))
                        continue;
                    const edge = 1 - (0, config_1.displayPayoutRTP)(m, k);
                    rows.push({ mineCount: m, tilesRevealed: k, multiplierExact: exact, multiplierDisplayed: disp, lossPerUnitStake: exact - disp, effectiveEdgeIfDisplayPaid: edge, effectiveEdgeIfDisplayPaidPercent: edge * 100 });
                    if (edge > worst.edge)
                        worst = { mineCount: m, tilesRevealed: k, edge, lossPerDollar: exact - disp };
                }
            }
            const at010 = rows.map(r => ({ ...r, lossOn010Stake: 0.10 * r.lossPerUnitStake }));
            const tied = rows.filter(r => Math.abs(r.effectiveEdgeIfDisplayPaid - worst.edge) < 1e-12)
                .map(r => ({ mineCount: r.mineCount, tilesRevealed: r.tilesRevealed }));
            return {
                worstMineCount: worst.mineCount,
                worstTilesRevealed: worst.tilesRevealed,
                worstEffectiveEdge: worst.edge,
                worstEffectiveEdgePercent: worst.edge * 100,
                worstLossOn010Stake: 0.10 * worst.lossPerDollar,
                worstCellsTiedAtThisEdge: tied,
                cells: at010,
            };
        })(),
        falseAlarmAccounting: (0, false_alarm_1.falseAlarmAccounting)(Number.isFinite(simRoundsPerConfig) && simRoundsPerConfig > 0 ? simRoundsPerConfig : false_alarm_1.ENFORCED_ROUNDS_PER_CONFIG),
        simulation: simFigures,
    };
}

  },
  "src/loader.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDataset = loadDataset;
exports.revealedSeedMap = revealedSeedMap;
exports.seedByEpoch = seedByEpoch;
exports.betsByEpoch = betsByEpoch;
exports.phaseBets = phaseBets;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
function loadDataset(path, expectedSha256) {
    if (!(0, node_fs_1.existsSync)(path)) {
        console.error(`ERROR: dataset not found at ${path}`);
        process.exit(1);
    }
    const raw = (0, node_fs_1.readFileSync)(path);
    const sha256 = (0, node_crypto_1.createHash)('sha256').update(raw).digest('hex');
    if (expectedSha256 && sha256 !== expectedSha256) {
        console.error(`ERROR: dataset SHA-256 mismatch`);
        console.error(`  expected: ${expectedSha256}`);
        console.error(`  actual:   ${sha256}`);
        process.exit(1);
    }
    const parsed = JSON.parse(raw.toString('utf8'));
    return { ...parsed, sha256, path };
}
function revealedSeedMap(seeds) {
    const m = new Map();
    for (const s of seeds)
        m.set(s.hashedServerSeed, s);
    return m;
}
function seedByEpoch(seeds) {
    const m = new Map();
    for (const s of seeds)
        m.set(s.epoch, s);
    return m;
}
function betsByEpoch(bets) {
    const m = new Map();
    for (const b of bets) {
        const a = m.get(b.epoch);
        if (a)
            a.push(b);
        else
            m.set(b.epoch, [b]);
    }
    return m;
}
function phaseBets(bets, phase) {
    return bets.filter((b) => b.phase === phase);
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
  "tests/steps/anti-circularity.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const config_1 = require("../../src/config");
function run(_ctx) {
    let maxSumDev = 0, worstM = 1;
    let maxProdDev = 0, worstMk = '';
    let mCovered = 0, mkCovered = 0;
    let nonFiniteRef = 0;
    let firstNonFinite = '';
    for (const m of config_1.MINE_COUNTS) {
        mCovered++;
        const pSafe = (0, config_1.winProbability)(m, 1);
        const pMine = m / config_1.GRID;
        const sumDev = Math.abs(pSafe + pMine - 1);
        if (!Number.isFinite(sumDev)) {
            nonFiniteRef++;
            if (!firstNonFinite)
                firstNonFinite = `winProbability(${m},1) → ${pSafe}`;
        }
        else if (sumDev > maxSumDev) {
            maxSumDev = sumDev;
            worstM = m;
        }
        for (let k = 1; k <= config_1.GRID - m; k++) {
            mkCovered++;
            const combForm = (0, config_1.combination)(config_1.GRID - m, k) / (0, config_1.combination)(config_1.GRID, k);
            let prodForm = 1;
            for (let i = 0; i < k; i++)
                prodForm *= (config_1.GRID - m - i) / (config_1.GRID - i);
            const dev = Math.abs(combForm - prodForm);
            if (!Number.isFinite(dev)) {
                nonFiniteRef++;
                if (!firstNonFinite)
                    firstNonFinite = `m=${m},k=${k}: comb ${combForm} vs prod ${prodForm}`;
                continue;
            }
            if (dev > maxProdDev) {
                maxProdDev = dev;
                worstMk = `m=${m},k=${k}`;
            }
        }
    }
    let countCases = 0, countMismatches = 0;
    let worstCount = '';
    for (const m of config_1.MINE_COUNTS) {
        const kMax = Math.min(5, config_1.GRID - m);
        for (let k = 1; k <= kMax; k++) {
            let total = 0, avoiding = 0;
            const idx = [];
            const walk = (start) => {
                if (idx.length === k) {
                    total++;
                    if (idx[0] >= m)
                        avoiding++;
                    return;
                }
                for (let t = start; t < config_1.GRID; t++) {
                    idx.push(t);
                    walk(t + 1);
                    idx.pop();
                }
            };
            walk(0);
            countCases++;
            if (total !== (0, config_1.combination)(config_1.GRID, k) || avoiding !== (0, config_1.combination)(config_1.GRID - m, k)) {
                countMismatches++;
                if (!worstCount)
                    worstCount = `m=${m},k=${k}: counted ${avoiding}/${total} vs C-form ${(0, config_1.combination)(config_1.GRID - m, k)}/${(0, config_1.combination)(config_1.GRID, k)}`;
            }
        }
    }
    const coverageOk = mCovered === config_1.MINE_COUNTS.length && mkCovered > 0 && countCases > 0;
    const ok = maxSumDev < 1e-12 && maxProdDev < 1e-9 && countMismatches === 0 && coverageOk
        && nonFiniteRef === 0;
    const s13 = (0, context_1.step)(13, 'Anti-Circularity (Combinatorial Win Probability)', ok ? 'PASS' : 'FAIL', `winProbability(m,k) = C(25-m,k)/C(25,k), pure combinatorics — no operator data (${mCovered}/${config_1.MINE_COUNTS.length} mineCounts, ${mkCovered} (m,k) pairs). `
        + `k=1 outcome space Σ (safe+mine) = 1.0 exactly (max dev ${maxSumDev.toExponential(3)}, m=${worstM}); `
        + `combinatorial form == product Π(25-m-i)/(25-i) over all reachable m,k (max dev ${maxProdDev.toExponential(3)}, ${worstMk}); `
        + `counting anchor: ${countCases} (m,k) cases enumerated subset-by-subset, integer equality with C(25,k) and C(25-m,k) — ${countMismatches} mismatches; `
        + `reference-formula integrity: ${nonFiniteRef} non-finite results${firstNonFinite ? ` (first: ${firstNonFinite})` : ''} — a NaN deviation satisfies every \`>\` comparison it appears in, so it is counted, not silently skipped`
        + (countMismatches > 0 ? ` (first: ${worstCount})` : '') + '.');
    return [s13];
}

  },
  "tests/steps/commitment.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const pins_1 = require("../../src/pins");
const rng_1 = require("../../src/rng");
function run(ctx) {
    const { seeds, byHash, bets, seedMap, meta } = ctx;
    let checked = 0, fails = 0;
    for (const s of seeds) {
        if (!s.serverSeed)
            continue;
        if ((0, rng_1.commitHash)(s.serverSeed) !== s.hashedServerSeed)
            fails++;
        checked++;
    }
    const s1PopulationOk = seeds.length === pins_1.EXPECTED_SEEDS;
    const s1 = (0, context_1.step)(1, 'Seed Hash Integrity', fails === 0 && checked === seeds.length && s1PopulationOk ? 'PASS' : 'FAIL', `${checked}/${seeds.length} revealed seeds checked against the pinned population of ${pins_1.EXPECTED_SEEDS} (src/pins.ts EXPECTED_SEEDS, a code constant — not the dataset's own count); SHA-256(utf8(serverSeed)) == hashedServerSeed; ${fails} mismatches`
        + (s1PopulationOk ? '' : `; POPULATION FAIL: ${seeds.length} seed records loaded, ${pins_1.EXPECTED_SEEDS} pinned`));
    const byEpoch = [...seeds].sort((a, b) => a.epoch - b.epoch);
    let promoChecked = 0, promoFails = 0;
    for (let i = 0; i + 1 < byEpoch.length; i++) {
        promoChecked++;
        if (byEpoch[i].nextHashedServerSeed !== byEpoch[i + 1].hashedServerSeed)
            promoFails++;
    }
    const expectedTransitions = seeds.length - 1;
    const pc = meta?.preCapture ?? null;
    const firstEpochHash = byEpoch.length > 0 ? byEpoch[0].hashedServerSeed : null;
    const preRevealOk = !!pc && typeof pc.revealedServerSeed === 'string'
        && (0, rng_1.commitHash)(pc.revealedServerSeed) === pc.hashedServerSeed;
    const preChainOk = !!pc && typeof pc.nextHashedServerSeed === 'string'
        && pc.nextHashedServerSeed === firstEpochHash;
    const preOk = preRevealOk && preChainOk;
    const s2 = (0, context_1.step)(2, 'Next-Seed Pre-Commitment Chain', promoFails === 0 && promoChecked === expectedTransitions && preOk ? 'PASS' : 'FAIL', (promoFails === 0
        ? `${promoChecked}/${expectedTransitions} transitions: nextHashedServerSeed == next epoch's hashedServerSeed (chain INTACT)`
        : `${promoChecked - promoFails}/${expectedTransitions} match; ${promoFails} mismatch`)
        + `; pre-capture link: reveal→commitment ${preRevealOk ? 'OK' : 'FAIL'}, chains into epoch 0 ${preChainOk ? 'OK' : 'FAIL'}`);
    const betsByEpoch = new Map();
    for (const b of bets) {
        const arr = betsByEpoch.get(b.epoch) ?? [];
        arr.push(b);
        betsByEpoch.set(b.epoch, arr);
    }
    let epochsMultipleHashes = 0;
    for (const [, epochBets] of betsByEpoch) {
        const hashes = new Set(epochBets.map(b => b.hashedServerSeed));
        if (hashes.size !== 1)
            epochsMultipleHashes++;
    }
    const s3CoverageOk = betsByEpoch.size === seeds.length && betsByEpoch.size === pins_1.EXPECTED_SEEDS;
    const s3 = (0, context_1.step)(3, 'Hash Consistency Within Epoch', epochsMultipleHashes === 0 && s3CoverageOk ? 'PASS' : 'FAIL', `${betsByEpoch.size}/${pins_1.EXPECTED_SEEDS} epochs (pinned in src/pins.ts, not counted from the dataset): all bets within each epoch share the same hashedServerSeed; ${epochsMultipleHashes} violations`);
    const hardFailures = [];
    const disclosedGaps = [];
    const boundFailures = [];
    let epochsChecked = 0;
    const seedRecordByHash = new Map(seeds.map(s => [s.hashedServerSeed, s]));
    for (const [hash, epochBets] of byHash) {
        const sorted = [...epochBets].sort((a, b) => a.nonce - b.nonce);
        const nonces = sorted.map(b => b.nonce);
        const epochNum = sorted[0].epoch;
        const phase = sorted[0].phase;
        const clientSeeds = new Set(sorted.map(b => b.clientSeed));
        if (clientSeeds.size !== 1) {
            hardFailures.push(`Epoch ${epochNum}: ${clientSeeds.size} distinct client seeds`);
        }
        const nonceSet = new Set(nonces);
        if (nonceSet.size !== sorted.length) {
            hardFailures.push(`Epoch ${epochNum}: ${sorted.length - nonceSet.size} duplicate nonce(s) (reuse)`);
        }
        const minNonce = Math.min(...nonces);
        const maxNonce = Math.max(...nonces);
        const rec = seedRecordByHash.get(hash);
        if (!rec) {
            hardFailures.push(`Epoch ${epochNum}: no seed record for hashedServerSeed ${hash.slice(0, 12)}…`);
        }
        else {
            if (minNonce !== rec.nonceStart) {
                boundFailures.push(`Epoch ${epochNum}: nonces start at ${minNonce}, declared nonceStart ${rec.nonceStart}`);
            }
            if (rec.nonceEnd === null || rec.nonceEnd === undefined) {
                boundFailures.push(`Epoch ${epochNum}: seed record declares no nonceEnd — the served window is unbounded and cannot be audited for completeness`);
            }
            else if (maxNonce !== rec.nonceEnd) {
                boundFailures.push(`Epoch ${epochNum}: highest recorded nonce ${maxNonce}, declared nonceEnd ${rec.nonceEnd}`);
            }
        }
        const missing = [];
        for (let n = minNonce; n <= maxNonce; n++)
            if (!nonceSet.has(n))
                missing.push(n);
        if (missing.length > 0) {
            const ss = seedMap.get(hash);
            let allVerify = ss !== undefined;
            if (ss) {
                for (const b of sorted) {
                    const mines = (0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount);
                    if (!(0, rng_1.sameMines)(mines, b.mineTiles)) {
                        allVerify = false;
                        break;
                    }
                }
            }
            if (allVerify) {
                disclosedGaps.push(`epoch ${epochNum} (Phase ${phase}, mineCount ${sorted[0].mineCount}), nonce ${missing.join(',')} orphaned; all recorded bets verify`);
            }
            else {
                hardFailures.push(`Epoch ${epochNum}: unverifiable nonce gap at ${missing.join(',')}`);
            }
        }
        epochsChecked++;
    }
    let s4detail;
    let s4status;
    if (epochsChecked !== seeds.length) {
        hardFailures.push(`coverage: audited ${epochsChecked}/${seeds.length} epochs`);
    }
    const allHard = [...hardFailures, ...boundFailures];
    const base = `${epochsChecked}/${seeds.length} epochs: single client seed each, nonces unique, and the recorded nonces fill the epoch's declared window [nonceStart, nonceEnd] exactly `
        + `(both bounds read from the epoch's seed record — nonceStart 0, nonceEnd 49 throughout this capture — not hard-coded and not inferred from the bets). `
        + `nonceStart/nonceEnd are the CAPTURE's own record of the window it served, not an operator-side counter: this establishes that the bet rows are complete against that record, not that no other nonce was ever served (selective orphaning — see AUDIT_CONTEXT.md#nonce-coverage).`;
    if (allHard.length > 0) {
        s4status = 'FAIL';
        s4detail = `${allHard.length} violations: ${allHard.slice(0, 3).join('; ')}`;
    }
    else if (disclosedGaps.length > 0) {
        s4status = 'FLAG';
        s4detail = `${epochsChecked}/${seeds.length} epochs audited; ${disclosedGaps.length} epoch(s) have an INTERIOR NONCE GAP: ${disclosedGaps.join('; ')}. `
            + `Every recorded bet in those epochs recomputes from the revealed seed, and the epoch's declared window bounds hold, so the gap is consistent with a capture retry — but a replay of the bets that are present cannot establish why a nonce is absent, so this is reported as a FLAG (Conditional Pass), not a pass with disclosure. `
            + `All other epochs: single client seed, nonces unique and filling [nonceStart, nonceEnd] exactly.`;
    }
    else {
        s4status = 'PASS';
        s4detail = `${base} No interior gaps in any epoch.`;
    }
    const s4 = (0, context_1.step)(4, 'Nonce Audit', s4status, s4detail);
    return [s1, s2, s3, s4];
}

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
  "tests/steps/dataset.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const pins_1 = require("../../src/pins");
const PHASES = ['A', 'B', 'C', 'D', 'E'];
function run(ctx) {
    const { bets, seeds } = ctx;
    const phases = new Set(bets.map(b => b.phase));
    const counts = {};
    for (const b of bets)
        counts[b.phase] = (counts[b.phase] ?? 0) + 1;
    const hasAll = PHASES.every(p => phases.has(p));
    const countsOk = PHASES.every(p => counts[p] === pins_1.EXPECTED_PHASE_BETS[p]);
    const planSum = PHASES.reduce((a, p) => a + pins_1.EXPECTED_PHASE_BETS[p], 0);
    const planSelfConsistent = planSum === pins_1.EXPECTED_BETS;
    const totalOk = bets.length === pins_1.EXPECTED_BETS;
    const summary = PHASES.map(p => `${p}=${counts[p] ?? 0}`).join(' ');
    const s11Faults = [];
    if (!hasAll)
        s11Faults.push(`missing phase label(s): ${PHASES.filter(p => !phases.has(p)).join(', ')}`);
    if (!countsOk)
        s11Faults.push(`phase count(s) off plan: ${PHASES.filter(p => counts[p] !== pins_1.EXPECTED_PHASE_BETS[p]).map(p => `${p}=${counts[p] ?? 0}≠${pins_1.EXPECTED_PHASE_BETS[p]}`).join(', ')}`);
    if (!totalOk)
        s11Faults.push(`POPULATION: ${bets.length} bets loaded, ${pins_1.EXPECTED_BETS} pinned in src/pins.ts EXPECTED_BETS — the audited population is not the file's to declare`);
    if (!planSelfConsistent)
        s11Faults.push(`pin table inconsistent: Σ EXPECTED_PHASE_BETS = ${planSum} != EXPECTED_BETS ${pins_1.EXPECTED_BETS}`);
    const s11 = (0, context_1.step)(11, 'Phase Labels', hasAll && countsOk && totalOk && planSelfConsistent ? 'PASS' : 'FAIL', `Phases present: ${[...phases].sort().join(', ')} (${summary}); plan A=${pins_1.EXPECTED_PHASE_BETS.A} B=${pins_1.EXPECTED_PHASE_BETS.B} C=${pins_1.EXPECTED_PHASE_BETS.C} D=${pins_1.EXPECTED_PHASE_BETS.D} E=${pins_1.EXPECTED_PHASE_BETS.E} (src/pins.ts EXPECTED_PHASE_BETS, Σ=${planSum}); `
        + `total ${bets.length}/${pins_1.EXPECTED_BETS} bets and ${seeds.length}/${pins_1.EXPECTED_SEEDS} seed records, both against CODE constants in src/pins.ts — not against meta.plannedTotal or any other field of the dataset being scored. `
        + `The published population and phase plan are fixed in source independently of the dataset header.`
        + (s11Faults.length ? `. FAULTS: ${s11Faults.join('; ')}` : ''));
    const epochSizes = new Map();
    for (const b of bets)
        epochSizes.set(b.epoch, (epochSizes.get(b.epoch) ?? 0) + 1);
    const sizes = [...epochSizes.values()];
    const minSize = sizes.length ? Math.min(...sizes) : 0;
    const maxSize = sizes.length ? Math.max(...sizes) : 0;
    const seedCountOk = seeds.length === pins_1.EXPECTED_SEEDS;
    const epochCountOk = epochSizes.size === pins_1.EXPECTED_SEEDS;
    const sizeOk = sizes.length > 0 && minSize === pins_1.EXPECTED_EPOCH_SIZE && maxSize === pins_1.EXPECTED_EPOCH_SIZE;
    const arithmeticOk = pins_1.EXPECTED_SEEDS * pins_1.EXPECTED_EPOCH_SIZE === pins_1.EXPECTED_BETS;
    const s12Faults = [];
    if (!seedCountOk)
        s12Faults.push(`POPULATION: ${seeds.length} seed records, ${pins_1.EXPECTED_SEEDS} pinned`);
    if (!epochCountOk)
        s12Faults.push(`POPULATION: ${epochSizes.size} distinct epochs in the bets, ${pins_1.EXPECTED_SEEDS} pinned`);
    if (!sizeOk)
        s12Faults.push(`epoch size min=${minSize} max=${maxSize}, ${pins_1.EXPECTED_EPOCH_SIZE} pinned`);
    if (!arithmeticOk)
        s12Faults.push(`pin arithmetic: ${pins_1.EXPECTED_SEEDS} × ${pins_1.EXPECTED_EPOCH_SIZE} != ${pins_1.EXPECTED_BETS}`);
    const s12 = (0, context_1.step)(12, 'Epoch Size', seedCountOk && epochCountOk && sizeOk && arithmeticOk ? 'PASS' : 'FAIL', `${epochSizes.size}/${pins_1.EXPECTED_SEEDS} epochs and ${seeds.length}/${pins_1.EXPECTED_SEEDS} seed records (src/pins.ts EXPECTED_SEEDS); `
        + `min=${minSize}, max=${maxSize} bets per epoch against EXPECTED_EPOCH_SIZE ${pins_1.EXPECTED_EPOCH_SIZE}; `
        + `${pins_1.EXPECTED_SEEDS} × ${pins_1.EXPECTED_EPOCH_SIZE} = ${pins_1.EXPECTED_SEEDS * pins_1.EXPECTED_EPOCH_SIZE} must equal EXPECTED_BETS ${pins_1.EXPECTED_BETS}. `
        + `The source constants fix the expected seed and bet population.`
        + (s12Faults.length ? `. FAULTS: ${s12Faults.join('; ')}` : ''));
    return [s11, s12];
}

  },
  "tests/steps/determinism.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const pins_1 = require("../../src/pins");
const rng_1 = require("../../src/rng");
const WRONG_CLIENT = 'wrong-client-seed-test';
function run(ctx) {
    const { bets, seedMap } = ctx;
    let mismatches = 0, skipped = 0;
    for (const b of bets) {
        const ss = seedMap.get(b.hashedServerSeed);
        if (!ss) {
            skipped++;
            continue;
        }
        const mines = (0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount);
        if (!(0, rng_1.sameMines)(mines, b.mineTiles))
            mismatches++;
    }
    const s5PopulationOk = bets.length === pins_1.EXPECTED_BETS;
    const s5 = (0, context_1.step)(5, 'Mine-Layout Recomputation', mismatches === 0 && skipped === 0 && s5PopulationOk ? 'PASS' : 'FAIL', `${bets.length - skipped}/${pins_1.EXPECTED_BETS} bets recomputed against the pinned population (src/pins.ts EXPECTED_BETS, a code constant — not bets.length, which would make this figure true of any capture); revealMines(serverSeed, clientSeed, nonce, mineCount) == mineTiles (draw order); ${mismatches} mismatches; ${skipped} skipped (unrevealed seeds)`
        + (s5PopulationOk ? '' : `; POPULATION FAIL: ${bets.length} bets loaded, ${pins_1.EXPECTED_BETS} pinned`));
    let tested = 0, emptyReproduce = 0, wrongReproduce = 0, emptyMineCount1 = 0;
    for (const b of bets) {
        const ss = seedMap.get(b.hashedServerSeed);
        if (!ss)
            continue;
        tested++;
        if ((0, rng_1.sameMines)((0, rng_1.revealMines)(ss, '', b.nonce, b.mineCount), b.mineTiles)) {
            emptyReproduce++;
            if (b.mineCount === 1)
                emptyMineCount1++;
        }
        if ((0, rng_1.sameMines)((0, rng_1.revealMines)(ss, WRONG_CLIENT, b.nonce, b.mineCount), b.mineTiles))
            wrongReproduce++;
    }
    const changed = tested - wrongReproduce;
    const pct = (n) => tested === 0 ? '0.00' : ((n / tested) * 100).toFixed(2);
    const s6 = (0, context_1.step)(6, 'Client Seed Influence', tested === bets.length && bets.length === pins_1.EXPECTED_BETS && changed / tested >= 0.95 ? 'PASS' : 'FAIL', `whole-dataset controls over ${tested}/${pins_1.EXPECTED_BETS} bets (denominator pinned in src/pins.ts): empty clientSeed reproduces ${emptyReproduce}/${tested} `
        + `(${pct(emptyReproduce)}%, ${emptyMineCount1} at mineCount 1 — single-tile chance collisions); `
        + `wrong clientSeed ('${WRONG_CLIENT}') reproduces ${wrongReproduce}/${tested} (${pct(wrongReproduce)}%); `
        + `${changed}/${tested} bets change under a wrong seed`);
    return [s5, s6];
}

  },
  "tests/steps/payouts.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const config_1 = require("../../src/config");
const pins_1 = require("../../src/pins");
function floor8CreditUnits(betAmount, mineCount, k) {
    if (k < 1 || k > config_1.GRID - mineCount)
        return null;
    const stakeUnits = BigInt(Math.round(betAmount * 1e8));
    let num = config_1.EDGE_NUM, den = config_1.EDGE_DEN;
    for (let i = 0; i < k; i++) {
        num *= BigInt(config_1.GRID - i);
        den *= BigInt(config_1.GRID - mineCount - i);
    }
    return (stakeUnits * num) / den;
}
function run(ctx) {
    const { bets, seeds, phaseA } = ctx;
    const expectedBets = pins_1.EXPECTED_BETS;
    const planConsistent = pins_1.EXPECTED_SEEDS * pins_1.EXPECTED_EPOCH_SIZE === pins_1.EXPECTED_BETS;
    let wonChecked = 0, wonErrors = 0, lostChecked = 0, lostErrors = 0, displayBelowPaid = 0;
    let s7NonFiniteRef = 0;
    for (const b of bets) {
        if (b.result === 'won') {
            wonChecked++;
            const display = (0, config_1.minesMultiplier)(b.mineCount, b.openTiles.length);
            const exact = (0, config_1.minesMultiplierExact)(b.mineCount, b.openTiles.length);
            if (!Number.isFinite(display) || !Number.isFinite(exact)) {
                s7NonFiniteRef++;
                continue;
            }
            if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(display - b.multiplier) > 1e-9)
                wonErrors++;
            if (b.multiplier !== undefined && b.multiplier + 1e-9 < exact)
                displayBelowPaid++;
        }
        else {
            lostChecked++;
            if ((b.multiplier ?? 0) !== 0 || Number(b.winningAmount) !== 0)
                lostErrors++;
        }
    }
    const s7Covered = wonChecked + lostChecked;
    const s7 = (0, context_1.step)(7, 'Displayed Multiplier Field (floored, cosmetic)', wonErrors === 0 && lostErrors === 0 && s7NonFiniteRef === 0 && s7Covered === expectedBets ? 'PASS' : 'FAIL', `${s7Covered}/${expectedBets} bets checked; ${wonChecked} wins: displayed multiplier == floor2(exact) at 1e-9 (${wonErrors} mismatches); `
        + `${displayBelowPaid} wins where the displayed field is below the exact reference multiplier; reported settlement amounts are checked separately in Step 8; `
        + `${lostChecked} losses: no payout — multiplier 0/absent and winningAmount == 0 (${lostErrors} violations); `
        + `reference-formula integrity: ${s7NonFiniteRef} wins where minesMultiplier/minesMultiplierExact returned a non-finite value (a NaN/Infinity in the auditor's own reference makes every comparison here vacuous — hard fail, not a mismatch)`);
    const S8_TOL = 2e-8;
    let payErrors = 0, paidExact = 0, paidFloored = 0, labelViolations = 0, s8Covered = 0;
    let maxResidual = 0, flooredBelowExact = 0, totalShortfall = 0, totalStaked = 0;
    let floor8Violations = 0, offGridCredits = 0, s8NonFiniteRef = 0;
    let nonFiniteStakes = 0, nonFiniteCredits = 0, firstNonFiniteMoney = '';
    let firstOffGrid = '';
    for (const b of bets) {
        s8Covered++;
        const stakeNum = Number(b.betAmount);
        const winAmtNum = Number(b.winningAmount);
        if (!Number.isFinite(stakeNum)) {
            nonFiniteStakes++;
            if (!firstNonFiniteMoney)
                firstNonFiniteMoney = `bet ${b.id}: betAmount ${JSON.stringify(b.betAmount)}`;
        }
        else {
            totalStaked += stakeNum;
        }
        if (!Number.isFinite(winAmtNum)) {
            nonFiniteCredits++;
            if (!firstNonFiniteMoney)
                firstNonFiniteMoney = `bet ${b.id}: winningAmount ${JSON.stringify(b.winningAmount)}`;
        }
        const winAmt = winAmtNum;
        const mineSet = new Set(b.mineTiles);
        const openedMine = b.openTiles.some((t) => mineSet.has(t));
        if (b.result === 'won') {
            if (openedMine)
                labelViolations++;
            const exact = (0, config_1.minesMultiplierExact)(b.mineCount, b.openTiles.length);
            const bet = Number(b.betAmount);
            if (!Number.isFinite(exact)) {
                s8NonFiniteRef++;
                continue;
            }
            const residual = bet * exact - winAmt;
            if (Number.isFinite(winAmt)) {
                const units = winAmt * 1e8;
                if (Math.abs(units - Math.round(units)) > 1e-6) {
                    offGridCredits++;
                    if (!firstOffGrid)
                        firstOffGrid = `bet ${b.id}: winningAmount ${b.winningAmount} is ${(units).toFixed(6)} units of 1e-8`;
                }
            }
            if (Number.isFinite(winAmt) && Number.isFinite(bet)) {
                const credUnits = floor8CreditUnits(bet, b.mineCount, b.openTiles.length);
                if (credUnits === null || BigInt(Math.round(winAmt * 1e8)) !== credUnits)
                    floor8Violations++;
            }
            if (!Number.isFinite(winAmt) || !Number.isFinite(bet)) {
                payErrors++;
            }
            else if (Math.abs(residual) > S8_TOL) {
                if (Math.abs(bet * (0, config_1.minesMultiplier)(b.mineCount, b.openTiles.length) - winAmt) <= 1e-6)
                    paidFloored++;
                else
                    payErrors++;
            }
            else {
                paidExact++;
                if (Math.abs(residual) > maxResidual)
                    maxResidual = Math.abs(residual);
                if (residual > 1e-12) {
                    flooredBelowExact++;
                    totalShortfall += residual;
                }
            }
        }
        else {
            if (!openedMine)
                labelViolations++;
            if (!Number.isFinite(winAmt) || winAmt !== 0)
                payErrors++;
        }
    }
    const s8FullCoverage = s8Covered === expectedBets;
    const moneyFinite = nonFiniteStakes === 0 && nonFiniteCredits === 0
        && Number.isFinite(totalStaked) && totalStaked > 0 && Number.isFinite(totalShortfall);
    const s8Hard = payErrors > 0 || labelViolations > 0 || floor8Violations > 0
        || offGridCredits > 0 || s8NonFiniteRef > 0 || !s8FullCoverage
        || !moneyFinite || !planConsistent;
    const s8 = (0, context_1.step)(8, 'Payout Math + Win-Condition (wins: betAmount × EXACT multiplier == winningAmount; losses: 0; label ⇔ mine opened)', !s8Hard && paidFloored === 0 ? 'PASS' : (s8Hard ? 'FAIL' : 'FLAG'), `${s8Covered}/${expectedBets} bets at 2e-8 (expected total pinned in src/pins.ts EXPECTED_BETS, a code constant — not seeds×50 read from the dataset${planConsistent ? '' : `; PLAN INCONSISTENT: ${pins_1.EXPECTED_SEEDS}×${pins_1.EXPECTED_EPOCH_SIZE} != ${pins_1.EXPECTED_BETS}`}) (credit floored at the 8th decimal): ${paidExact} wins matching the exact-multiplier settlement within the stated residual tolerance, `
        + `${paidFloored} wins matching only the displayed-multiplier payout candidate, ${payErrors} errors; `
        + `exact floor8 identity (winningAmount == floor8(stake × multExact) in BigInt rational arithmetic, 0 tolerance — rejects ±1e-8 over/under-credit): ${floor8Violations} violations; `
        + `on-grid check applied BEFORE any rounding (winningAmount × 1e8 must already be an integer — a ninth decimal cannot be held in a 1e-8 ledger and must not be rounded onto the grid by the identity above): ${offGridCredits} off-grid credits${firstOffGrid ? ` (first: ${firstOffGrid})` : ''}; `
        + `reference-formula integrity: ${s8NonFiniteRef} wins where minesMultiplierExact returned a non-finite value (hard fail — the auditor's reference is corrupt, not the operator's payout); `
        + `money-field integrity: ${nonFiniteStakes} bets whose betAmount is not a finite number, ${nonFiniteCredits} whose winningAmount is not${firstNonFiniteMoney ? ` (first: ${firstNonFiniteMoney})` : ''} — hard fail, because a NaN entering the turnover total makes every ratio computed from it vacuous rather than wrong; `
        + `credit-floor residuals: max ${maxResidual.toExponential(3)}, ${flooredBelowExact} wins below the unrounded value, `
        + `total shortfall $${totalShortfall.toExponential(3)} on $${Number.isFinite(totalStaked) ? totalStaked.toFixed(2) : 'NOT-FINITE'} staked (${moneyFinite ? (totalShortfall / totalStaked).toExponential(1) : 'n/a — turnover not finite'} of turnover); `
        + `win-condition consistency (won ⇔ no mine opened): ${labelViolations} label violations`);
    const PHASE_A_PER_MC = 200;
    const expectedPhaseA = config_1.MINE_COUNTS.length * PHASE_A_PER_MC;
    const perMineCount = new Map();
    for (const b of phaseA)
        perMineCount.set(b.mineCount, (perMineCount.get(b.mineCount) ?? 0) + 1);
    const missing = config_1.MINE_COUNTS.filter(m => !perMineCount.has(m));
    const wrongCount = config_1.MINE_COUNTS.filter(m => (perMineCount.get(m) ?? 0) !== PHASE_A_PER_MC);
    const s9CoverageOk = phaseA.length === expectedPhaseA;
    const s9 = (0, context_1.step)(9, 'Config Completeness (Phase A: 24 mineCounts × 200)', missing.length === 0 && wrongCount.length === 0 && s9CoverageOk ? 'PASS' : 'FLAG', `Phase A: ${perMineCount.size}/${config_1.MINE_COUNTS.length} mineCounts present, each with ${PHASE_A_PER_MC} bets (${phaseA.length}/${expectedPhaseA} total)`
        + (missing.length > 0 ? `; missing: ${missing.slice(0, 5).join(', ')}` : '')
        + (wrongCount.length > 0 ? `; wrong count: ${wrongCount.slice(0, 5).map(m => `${m}=${perMineCount.get(m)}`).join(', ')}` : ''));
    const rtpCases = [];
    for (const m of config_1.MINE_COUNTS)
        rtpCases.push([m, 1]);
    for (let k = 2; k <= 5; k++)
        rtpCases.push([3, k]);
    let minRTP = Infinity, maxRTP = -Infinity, sumRTP = 0;
    let caseNonFinite = 0;
    for (const [m, k] of rtpCases) {
        const rtp = (0, config_1.theoreticalRTP)(m, k);
        if (!Number.isFinite(rtp)) {
            caseNonFinite++;
            continue;
        }
        if (rtp < minRTP)
            minRTP = rtp;
        if (rtp > maxRTP)
            maxRTP = rtp;
        sumRTP += rtp;
    }
    const meanRTP = sumRTP / rtpCases.length;
    const flat99 = caseNonFinite === 0 && Number.isFinite(minRTP) && Number.isFinite(maxRTP)
        && minRTP >= config_1.PUBLISHED_RTP - 1e-9 && maxRTP <= config_1.PUBLISHED_RTP + 1e-9;
    const expectedCases = config_1.MINE_COUNTS.length + 4;
    const coverageOk = rtpCases.length === expectedCases;
    let allCells = 0, allCellsOff = 0, allCellsNonFinite = 0, allMin = Infinity, allMax = -Infinity;
    let firstNonFinite = '';
    for (const m of config_1.MINE_COUNTS) {
        for (let k = 1; k <= config_1.GRID - m; k++) {
            const rtp = (0, config_1.theoreticalRTP)(m, k);
            allCells++;
            if (!Number.isFinite(rtp)) {
                allCellsNonFinite++;
                if (!firstNonFinite)
                    firstNonFinite = `m=${m},k=${k} → ${rtp}`;
                continue;
            }
            if (rtp < allMin)
                allMin = rtp;
            if (rtp > allMax)
                allMax = rtp;
            if (Math.abs(rtp - config_1.PUBLISHED_RTP) > 1e-9)
                allCellsOff++;
        }
    }
    const EXPECTED_ALL_CELLS = 300;
    const allCellsOk = allCells === EXPECTED_ALL_CELLS && allCellsOff === 0 && allCellsNonFinite === 0;
    const betStakes = [...new Set(bets.map(b => Number(b.betAmount)))]
        .filter(a => Number.isFinite(a) && a > 0).sort((a, z) => a - z);
    const headerStakes = Object.values((ctx.meta?.phases ?? {}))
        .map(p => Number(p?.amount)).filter(a => Number.isFinite(a) && a > 0);
    const headerMinStake = headerStakes.length > 0 ? Math.min(...headerStakes) : 0;
    const minStake = betStakes.length > 0 ? betStakes[0] : 0;
    const stakeSourcesAgree = minStake > 0 && Math.abs(headerMinStake - minStake) < 1e-12;
    let floorDeficit = 0, floorWorst = '';
    if (minStake > 0) {
        const stakeUnits = BigInt(Math.round(minStake * 1e8));
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                let num = config_1.EDGE_NUM, den = config_1.EDGE_DEN;
                for (let i = 0; i < k; i++) {
                    num *= BigInt(config_1.GRID - i);
                    den *= BigInt(config_1.GRID - m - i);
                }
                const exactUnits = stakeUnits * num;
                const creditedUnits = exactUnits / den;
                const fracUnits = Number(exactUnits - creditedUnits * den) / Number(den);
                const deficit = (0, config_1.winProbability)(m, k) * (fracUnits / 1e8) / minStake;
                if (Number.isFinite(deficit) && deficit > floorDeficit) {
                    floorDeficit = deficit;
                    floorWorst = `m=${m},k=${k}`;
                }
            }
        }
    }
    const edgeRationalOk = (0, config_1.edgeRationalIsExact)();
    const referenceCorrupt = allCellsNonFinite > 0 || caseNonFinite > 0 || !edgeRationalOk;
    const stakeSourceFault = !stakeSourcesAgree;
    const edgePct = ((1 - meanRTP) * 100).toFixed(2);
    const isFlat = (maxRTP - minRTP) <= 1e-9;
    const rtpClause = flat99
        ? `a clean ${(meanRTP * 100).toFixed(4)}% for every (m,k) (closed-form edge exactly ${edgePct}%), because the exact multiplier makes the CLOSED FORM identically (1 − edge) — the settlement floor can reduce the return, quantified next. `
        : isFlat
            ? `a flat ${(meanRTP * 100).toFixed(4)}% for every (m,k) (effective edge ${edgePct}%) — uniform, but NOT the audited 99.0000% (1 − edge). `
            : `NOT flat: RTP varies across (m,k) — range ${(minRTP * 100).toFixed(4)}%–${(maxRTP * 100).toFixed(4)}%, mean ${(meanRTP * 100).toFixed(4)}% (effective edge ${edgePct}%); the closed-form (1 − edge) identity does not hold at 99.0000% under this config. `;
    const s10 = (0, context_1.step)(10, 'House Edge / RTP Audit (closed-form identity, per-config, anti-circular)', referenceCorrupt || stakeSourceFault ? 'FAIL' : (flat99 && coverageOk && allCellsOk ? 'PASS' : 'FLAG'), `Closed-form identity theoreticalRTP(m,k) = winProbability(m,k) × minesMultiplierExact(m,k) (winProbability = pure C(25-m,k)/C(25,k) combinatorics), checked for m=1..24 at k=1 and Phase-E depths (m=3, k=1..5) — ${rtpCases.length}/${expectedCases} cases: `
        + `RTP range ${(minRTP * 100).toFixed(4)}%–${(maxRTP * 100).toFixed(4)}%, mean ${(meanRTP * 100).toFixed(4)}% — ${rtpClause}`
        + `Full-grid reference sweep: all ${allCells}/${EXPECTED_ALL_CELLS} legal (m,k) cells (k=1..25−m) evaluate to 99.0000% within 1e-9 (${allCellsOff} off), range ${(allMin * 100).toFixed(4)}%–${(allMax * 100).toFixed(4)}% — this checks the reference formula at every reachable depth, NOT the operator (25/300 cells are live-witnessed via Step 8; 275 formula-only; additional settlement coverage is planned for production). `
        + `Settlement floor: the identity above is the THEORETICAL leg; the amount actually credited is floor8(stake × multExact), so settled RTP is at most (1 − edge), with equality when no fractional settlement unit is discarded. Worst case over all ${EXPECTED_ALL_CELLS} cells at the capture's smallest stake ($${minStake.toFixed(2)}, DERIVED from the ${betStakes.length} distinct betAmount values in the pinned bets — ${betStakes.map(s => `$${s.toFixed(2)}`).join(', ')} — not read from meta.phases; the header's own smallest amount is $${headerMinStake.toFixed(2)} and the two ${stakeSourcesAgree ? 'agree' : 'DISAGREE — hard fail: the dataset header describes stakes its bets do not contain'}): ${floorWorst || 'n/a'} loses ${floorDeficit.toExponential(3)} of turnover → settled RTP ${((1 - config_1.HOUSE_EDGE - floorDeficit) * 100).toFixed(7)}%, i.e. ${((1 - config_1.HOUSE_EDGE) * 100).toFixed(4)}% to four decimals. `
        + `Edge-rational integrity: EDGE_NUM/EDGE_DEN = ${Number(config_1.EDGE_NUM)}/${Number(config_1.EDGE_DEN)} ${edgeRationalOk ? 'exactly represents' : 'DOES NOT represent'} (1 − HOUSE_EDGE) = ${1 - config_1.HOUSE_EDGE} — the BigInt factor the floor8 credit identity in Step 8 divides by. A factor that only approximates the audited edge makes that identity measure a different edge, silently. `
        + `Reference-formula integrity: ${allCellsNonFinite + caseNonFinite} cells returned a non-finite value${firstNonFinite ? ` (first: ${firstNonFinite})` : ''} — a NaN/Infinity here is NOT an "off 99%" deviation (which FLAGs); it means the auditor's own reference is corrupt and every comparison built on it is vacuous, so it hard-FAILS. `
        + `This is the uncapped reference calculation; Step 8 independently checks the recorded winningAmount at captured winning configurations. The displayed multiplier field is still floored — cosmetic (Step 7).`);
    return [s7, s8, s9, s10];
}

  },
  "tests/steps/phase-d.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const rng_1 = require("../../src/rng");
function run(ctx) {
    const { phaseD, seedMap } = ctx;
    if (phaseD.length === 0) {
        return [(0, context_1.step)(14, 'Phase D — Client Seed Variation', 'FLAG', 'No Phase D bets in dataset (PROVISIONAL)')];
    }
    const clientSeeds = new Set(phaseD.map(b => b.clientSeed));
    const pfauditSeeds = [...clientSeeds].filter(cs => cs.startsWith('pfaudit-'));
    let tested = 0, matched = 0;
    for (const b of phaseD) {
        const ss = seedMap.get(b.hashedServerSeed);
        if (!ss)
            continue;
        tested++;
        const mines = (0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount);
        if ((0, rng_1.sameMines)(mines, b.mineTiles))
            matched++;
    }
    const s14CoverageOk = tested === phaseD.length;
    const s14 = (0, context_1.step)(14, 'Phase D — Client Seed Variation', clientSeeds.size >= 2 && matched === tested && s14CoverageOk ? 'PASS' : 'FLAG', `${phaseD.length} bets, ${clientSeeds.size} distinct client seeds `
        + `(${pfauditSeeds.length} pfaudit-*); mine-layout recomputation: ${matched}/${tested} match (${tested}/${phaseD.length} recomputed)`);
    return [s14];
}

  },
  "tests/steps/phase-e.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const rng_1 = require("../../src/rng");
const config_1 = require("../../src/config");
function run(ctx) {
    const { phaseE, seedMap } = ctx;
    if (phaseE.length === 0) {
        return [(0, context_1.step)(15, 'Phase E — Multi-Reveal Verification', 'FAIL', 'No Phase E (multi-reveal) bets found in dataset')];
    }
    const failures = [];
    let layoutChecked = 0, layoutFails = 0;
    let multChecked = 0, multFails = 0, nonFiniteRef = 0;
    const revealDepths = new Set();
    for (const b of phaseE) {
        if (b.mineCount !== 3)
            failures.push(`bet ${b.id}: mineCount ${b.mineCount} (expected 3)`);
        if (b.reveals !== 5)
            failures.push(`bet ${b.id}: reveals ${b.reveals} (expected 5)`);
        const ss = seedMap.get(b.hashedServerSeed);
        if (ss) {
            const mines = (0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount);
            layoutChecked++;
            if (!(0, rng_1.sameMines)(mines, b.mineTiles)) {
                layoutFails++;
                if (failures.length < 5)
                    failures.push(`bet ${b.id}: mineTiles recompute mismatch`);
            }
        }
        if (b.result === 'won') {
            revealDepths.add(b.openTiles.length);
            const expected = (0, config_1.minesMultiplier)(b.mineCount, b.openTiles.length);
            multChecked++;
            if (!Number.isFinite(expected)) {
                nonFiniteRef++;
                if (failures.length < 5)
                    failures.push(`bet ${b.id}: minesMultiplier(${b.mineCount},${b.openTiles.length}) returned ${expected} — reference formula corrupt`);
            }
            else if (b.multiplier === undefined || !Number.isFinite(b.multiplier) || Math.abs(expected - b.multiplier) > 1e-9) {
                multFails++;
                if (failures.length < 5) {
                    failures.push(`bet ${b.id}: multiplier ${b.multiplier} != minesMultiplier(3,${b.openTiles.length})=${expected}`);
                }
            }
        }
    }
    const s15CoverageOk = layoutChecked === phaseE.length;
    const pass = failures.length === 0 && layoutFails === 0 && multFails === 0
        && nonFiniteRef === 0 && s15CoverageOk;
    const depths = [...revealDepths].sort((a, b) => a - b).join(',');
    const won = phaseE.filter(b => b.result === 'won').length;
    const lostAtFifth = phaseE.filter(b => b.result !== 'won' && b.openTiles.length === 5).length;
    const lostEarlier = phaseE.filter(b => b.result !== 'won' && b.openTiles.length < 5).length;
    const s15 = (0, context_1.step)(15, 'Phase E — Multi-Reveal Verification', pass ? 'PASS' : 'FAIL', pass
        ? `${phaseE.length} multi-reveal bets: all mineCount 3 / reveals 5; ${layoutChecked}/${phaseE.length} mine layouts recomputed; `
            + `${multChecked}/${multChecked} winning multipliers == minesMultiplier(3, openTiles.length) at 1e-9 (reveal depths tested: ${depths}; ${nonFiniteRef} non-finite reference values — a NaN in the auditor's own formula hard-fails rather than scoring as agreement); `
            + `outcome split: ${won} cashed out at depth 5, ${lostAtFifth} hit a mine on the 5th reveal (${won + lostAtFifth} opened all five), ${lostEarlier} busted at depths 1–4`
        : `${failures.length || (s15CoverageOk ? 0 : 1)} issue(s): ${(s15CoverageOk ? failures.slice(0, 3) : [...failures.slice(0, 2), `coverage: ${layoutChecked}/${phaseE.length} layouts recomputed`]).join('; ')}`);
    return [s15];
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
  "tests/steps/standardization.js": function (module, exports, require, __filename, __dirname) {
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
exports.run = run;
const context_1 = require("./context");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const rng_1 = require("../../src/rng");
const figures_1 = require("../../src/figures");
function run(ctx) {
    const { bets, seedMap } = ctx;
    const out = [];
    {
        const c = ctx.phaseC;
        let chk = 0, bad = 0;
        for (const b of c) {
            const ss = seedMap.get(b.hashedServerSeed);
            if (!ss)
                continue;
            chk++;
            if (!(0, rng_1.sameMines)((0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles))
                bad++;
        }
        const stakes = [...new Set(bets.map((b) => Number(b.betAmount)))].sort((a, z) => a - z);
        const ok = chk === c.length && chk > 0 && bad === 0;
        out.push((0, context_1.step)(18, 'Bet-Size Invariance', ok ? 'PASS' : 'FAIL', `${chk}/${c.length} Phase C hands at $10.00 (mineCount 3) recompute their mine layout in draw order — ${bad} mismatch. ` +
            `the reference engine revealMines(serverSeed, clientSeed, nonce, mineCount) is wager-free by construction, and the served layouts at $10.00 match it exactly as the $0.10 hands do (stakes present: ${stakes.map((s) => `$${s}`).join(', ')}) — all sampled layouts agree with the same wager-free reference at both recorded stakes. This is sample layout parity; it does not establish universal backend independence from wager amount` +
            (chk === 0 ? '; COVERAGE FAIL: 0 Phase C hands recomputed' : '')));
    }
    {
        const pinOk = ctx.datasetSha256 === ctx.expectedDatasetHash;
        const figPath = path.join(ctx.outputsDir, figures_1.AUDIT_FIGURES_FILE);
        let figState = 'absent';
        let figDetail = '';
        if (fs.existsSync(figPath)) {
            try {
                const onDisk = JSON.parse(fs.readFileSync(figPath, 'utf-8'));
                delete onDisk.generatedAt;
                const derived = (0, figures_1.computeAuditFigures)({
                    bets: ctx.bets, seeds: ctx.seeds, seedMap: ctx.seedMap, phaseD: ctx.phaseD,
                    outputsDir: ctx.outputsDir, datasetSha256: ctx.datasetSha256,
                });
                if (!fs.existsSync(path.join(ctx.outputsDir, 'simulation-results.json'))) {
                    delete onDisk.simulation;
                    delete derived.simulation;
                    figDetail = ' (simulation section excluded — simulation-results.json is absent)';
                }
                if (JSON.stringify(onDisk) === JSON.stringify(derived)) {
                    figState = 'match';
                }
                else if (onDisk?.datasetSha256 !== ctx.datasetSha256) {
                    figState = 'stale';
                    figDetail = ` — derived from dataset ${String(onDisk?.datasetSha256 ?? '(none)').slice(0, 16)}…, loaded dataset is ${ctx.datasetSha256.slice(0, 16)}…; re-run \`npm run verify\``;
                }
                else {
                    figState = 'mismatch';
                    const keys = [...new Set([...Object.keys(onDisk), ...Object.keys(derived)])];
                    const bad = keys.filter(k => JSON.stringify(onDisk[k]) !== JSON.stringify(derived[k]));
                    figDetail = ` — differing section(s): ${bad.slice(0, 4).join(', ')}`;
                }
            }
            catch {
                figState = 'unparseable';
            }
        }
        const status = !pinOk || figState === 'mismatch' || figState === 'unparseable' || figState === 'absent'
            ? 'FAIL'
            : figState === 'stale' ? 'FLAG' : 'PASS';
        out.push((0, context_1.step)(19, 'Artifact Integrity (dataset pin + derived figures)', status, `SHA-256 of data/mines-master-6900bets.json = ${ctx.datasetSha256.slice(0, 16)}… ${pinOk ? 'matches' : '≠'} the pin ${ctx.expectedDatasetHash.slice(0, 16)}… (loader aborts on mismatch before any step runs); `
            + `outputs/${figures_1.AUDIT_FIGURES_FILE} re-derived from src/config.ts + the pinned dataset + the simulation artifact and compared field-for-field against the copy on disk (generatedAt excluded): ${figState}${figDetail}`
            + (figState === 'absent'
                ? ` — HARD FAIL: the derived-figure artifact is shipped with this repo and every quantitative claim in the report is quoted from it. Its absence is not a fresh clone, it is a missing artifact of record, and until 2026-09-09 deleting it scored [PASS] Step 19 with a 21/21 Full Pass — a guard whose evidence can be deleted is not a guard. Regenerate deliberately with \`npm run figures\`, then re-run.`
                : '')
            + ` Default verification preserves published figures and writes run results under outputs/run. Explicit report generation replaces published figures only if this step passes.`));
    }
    {
        let winChk = 0, winOpenedMine = 0;
        let lossChk = 0, lossBad = 0;
        const fails = [];
        for (const b of bets) {
            const mines = new Set(b.mineTiles);
            const ot = b.openTiles || [];
            if (b.result === 'won') {
                winChk++;
                if (ot.some((t) => mines.has(t))) {
                    winOpenedMine++;
                    if (fails.length < 4)
                        fails.push(`nonce ${b.nonce}: win opened a mine`);
                }
            }
            else if (b.result === 'lost') {
                lossChk++;
                const last = ot[ot.length - 1];
                const earlier = ot.slice(0, -1);
                if (!mines.has(last) || earlier.some((t) => mines.has(t))) {
                    lossBad++;
                    if (fails.length < 4)
                        fails.push(`nonce ${b.nonce}: loss did not bust on exactly the final tile`);
                }
            }
        }
        const ok = winChk > 0 && lossChk > 0 && winOpenedMine === 0 && lossBad === 0;
        out.push((0, context_1.step)(20, 'Reveal-Sequence Consistency', ok ? 'PASS' : 'FAIL', `${winChk} wins — ${winOpenedMine} opened a mine (must be 0); ${lossChk} losses — ${lossBad} did not bust on exactly the final opened tile with no earlier mine (must be 0)` +
            (fails.length ? `; e.g. ${fails.join('; ')}` : '') +
            (winChk === 0 || lossChk === 0 ? '; COVERAGE FAIL: wins or losses absent' : '')));
    }
    {
        const e = ctx.phaseE;
        const sets = new Set(e.map((b) => [...(b.openTiles || [])].sort((a, z) => a - z).join(',')));
        const firsts = new Set(e.map((b) => (b.openTiles || [])[0]).filter((t) => t !== undefined));
        let chk = 0, bad = 0;
        for (const b of e) {
            const ss = seedMap.get(b.hashedServerSeed);
            if (!ss)
                continue;
            chk++;
            if (!(0, rng_1.sameMines)((0, rng_1.revealMines)(ss, b.clientSeed, b.nonce, b.mineCount), b.mineTiles))
                bad++;
        }
        const ok = chk === e.length && chk > 0 && bad === 0 && sets.size > 1 && firsts.size >= 20;
        out.push((0, context_1.step)(21, 'Reveal-Position Independence', ok ? 'PASS' : 'FLAG', `${e.length} multi-reveal (Phase E) rounds span ${sets.size} distinct opened-tile sets and ${firsts.size}/25 board positions as a first pick; ` +
            `all ${chk}/${e.length} layouts still recompute (${bad} mismatch) regardless of which positions were opened — a layout-parity check over a swept first-pick window (first = ((nonce+1) mod 25)+1), not a statistical independence test` +
            (chk === 0 ? '; COVERAGE FAIL: 0 Phase E layouts recomputed' : '')));
    }
    return out;
}

  },
  "tests/steps/statistical.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const stats_1 = require("../../src/stats");
const config_1 = require("../../src/config");
function run(ctx) {
    const { bets } = ctx;
    const items = [];
    if (bets.length === 0) {
        items.push({ label: 'Live bets', detail: 'No bets in dataset (PROVISIONAL)' });
        return items;
    }
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
    const parseGs = (b) => {
        const raw = b.currentGameSettings;
        if (raw == null)
            return null;
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }
        return raw;
    };
    const settingsBets = bets.filter(b => parseGs(b) != null);
    const capVals = [...new Set(settingsBets.map(b => parseGs(b).maxOdds))];
    if (settingsBets.length > 0 && capVals.length === 1 && typeof capVals[0] === 'number') {
        const cap = capVals[0];
        let cappedCells = 0;
        const cappedMineCounts = new Set();
        let worst = { rtp: Infinity, m: 0, k: 0, mult: 0 };
        let nonFiniteRef = 0;
        for (const m of config_1.MINE_COUNTS) {
            for (let k = 1; k <= config_1.GRID - m; k++) {
                const mult = (0, config_1.minesMultiplierExact)(m, k);
                if (!Number.isFinite(mult)) {
                    nonFiniteRef++;
                    continue;
                }
                if (mult > cap) {
                    cappedCells++;
                    cappedMineCounts.add(m);
                    const rtp = (0, config_1.winProbability)(m, k) * cap;
                    if (rtp < worst.rtp)
                        worst = { rtp, m, k, mult };
                }
            }
        }
        items.push({
            label: 'maxOdds cap exposure (theoretical, from operator settings)',
            detail: `${settingsBets.length}/${bets.length} settles carry currentGameSettings (single value; maxOdds ${cap}). `
                + `${cappedCells} reachable (m,k) cells have exact multiplier > ${cap} across ${cappedMineCounts.size}/${config_1.MINE_COUNTS.length} mineCounts; `
                + `deepest examples: m=21,k=4 → ${(0, config_1.minesMultiplierExact)(21, 4).toFixed(1)}×, m=20,k=5 → ${(0, config_1.minesMultiplierExact)(20, 5).toFixed(1)}× (capped path RTP ${((0, config_1.winProbability)(20, 5) * cap * 100).toFixed(1)}%); `
                + `hypothetical lowest-RTP capped cell m=${worst.m},k=${worst.k}: exact ${worst.mult.toExponential(3)}× capped to ${cap}× → path RTP ${(worst.rtp * 100).toFixed(2)}%. `
                + `These returns assume payment capped at maxOdds; the enforcement mechanism was not observed. No recorded winning multiplier approaches the cap. See AUDIT_CONTEXT.md#payout-limits.`
                + (nonFiniteRef > 0 ? ` WARNING: ${nonFiniteRef}/300 cells returned a non-finite reference multiplier — this sweep is incomplete (Steps 10/15 hard-fail on the same condition).` : ''),
        });
    }
    const winSeq = bets.map(b => (b.result === 'won' ? 1 : 0));
    const r1 = (0, stats_1.lag1Autocorrelation)(winSeq);
    items.push({
        label: 'Lag-1 autocorr (win/loss)',
        detail: `r₁=${r1.toFixed(4)} — unconditional win/loss correlation in a capture grouped by game configuration. Different configuration win probabilities can contribute to this value. This calculation does not separate configuration effects from within-configuration dependence. Pass 1 evaluates serial statistics of the reference generator; it does not establish the cause of this captured correlation.`,
    });
    const wins = bets.filter(b => b.result === 'won').length;
    items.push({
        label: 'Live win rate',
        detail: `${wins}/${bets.length} = ${((wins / bets.length) * 100).toFixed(2)}% (mixed mineCounts/reveals — informational)`,
    });
    return items;
}

  },
  "tests/verify.js": function (module, exports, require, __filename, __dirname) {
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const loader_1 = require("../src/loader");
const pins_1 = require("../src/pins");
const figures_1 = require("../src/figures");
const diff_1 = require("../src/diff");
const commitment = __importStar(require("./steps/commitment"));
const determinism = __importStar(require("./steps/determinism"));
const payouts = __importStar(require("./steps/payouts"));
const dataset = __importStar(require("./steps/dataset"));
const antiCirc = __importStar(require("./steps/anti-circularity"));
const phaseD = __importStar(require("./steps/phase-d"));
const phaseE = __importStar(require("./steps/phase-e"));
const simulation = __importStar(require("./steps/simulation"));
const statistical = __importStar(require("./steps/statistical"));
const standardization = __importStar(require("./steps/standardization"));
const DATASET_PATH = path.join(__dirname, '../data/mines-master-6900bets.json');
const OUTPUTS_DIR = path.join(__dirname, '../outputs');
const RUN_DIR = path.join(OUTPUTS_DIR, 'run');
const EMIT = process.env.PF_EMIT === '1';
console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — VERIFICATION SUITE');
console.log('══════════════════════════════════════════════════════════');
console.log(EMIT
    ? '  MODE: REPORT GENERATION (PF_EMIT=1) — the committed artifacts WILL be rewritten'
    : '  MODE: verification — committed artifacts are read-only; results go to outputs/run/');
if (!fs.existsSync(DATASET_PATH)) {
    console.log('\n  [ERROR] Dataset not found at data/mines-master-6900bets.json');
    console.log('  Cannot run verification without the captured master dataset.');
    console.log('\n══════════════════════════════════════════════════════════\n');
    process.exit(1);
}
const ds = (0, loader_1.loadDataset)(DATASET_PATH, pins_1.EXPECTED_DATASET_HASH);
const bets = ds.bets;
const seeds = ds.seeds;
const seedMap = new Map();
for (const s of seeds) {
    if (s.serverSeed)
        seedMap.set(s.hashedServerSeed, s.serverSeed);
}
const byHash = new Map();
for (const b of bets) {
    const arr = byHash.get(b.hashedServerSeed) ?? [];
    arr.push(b);
    byHash.set(b.hashedServerSeed, arr);
}
const phaseABets = bets.filter(b => b.phase === 'A');
const phaseBBets = bets.filter(b => b.phase === 'B');
const phaseCBets = bets.filter(b => b.phase === 'C');
const phaseDBets = bets.filter(b => b.phase === 'D');
const phaseEBets = bets.filter(b => b.phase === 'E');
if (!fs.existsSync(OUTPUTS_DIR))
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
console.log(`  Dataset: ${bets.length} bets | Seeds: ${seeds.length} | SHA-256 verified`);
console.log(`  Phase A:${phaseABets.length} B:${phaseBBets.length} C:${phaseCBets.length} D:${phaseDBets.length} E:${phaseEBets.length}\n`);
const ctx = {
    bets, seeds, seedMap, byHash,
    phaseA: phaseABets, phaseB: phaseBBets, phaseC: phaseCBets, phaseD: phaseDBets, phaseE: phaseEBets,
    outputsDir: OUTPUTS_DIR,
    datasetSha256: ds.sha256,
    expectedDatasetHash: pins_1.EXPECTED_DATASET_HASH,
    meta: ds.meta,
    simArtifact: null,
};
const results = [
    ...commitment.run(ctx),
    ...determinism.run(ctx),
    ...payouts.run(ctx),
    ...dataset.run(ctx),
    ...antiCirc.run(ctx),
    ...phaseD.run(ctx),
    ...phaseE.run(ctx),
    ...simulation.run(ctx),
    ...standardization.run(ctx),
];
const infoItems = statistical.run(ctx);
const passed = results.filter(r => r.status === 'PASS').length;
const flags = results.filter(r => r.status === 'FLAG').length;
const hardFail = results.filter(r => r.status === 'FAIL').length;
const verdict = hardFail > 0
    ? 'NOT PROVABLY FAIR'
    : flags > 0
        ? 'PROVABLY FAIR — Conditional Pass'
        : 'PROVABLY FAIR — Full Pass';
if (infoItems.length > 0) {
    console.log('');
    console.log('  ┌── Informational Context (not scored) ──');
    for (const item of infoItems)
        console.log(`  │ ${item.label}: ${item.detail}`);
    console.log('  └──');
}
console.log('\n══════════════════════════════════════════════════════════');
console.log('  RESULTS SUMMARY');
console.log('══════════════════════════════════════════════════════════');
console.log(`  Passed:     ${passed}/${results.length}`);
console.log(`  Hard fails: ${hardFail}`);
console.log(`  Flags:      ${flags}`);
console.log(`\n  VERDICT: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');
const verificationBody = {
    generatedAt: new Date().toISOString(),
    totalBets: bets.length,
    totalSeeds: seeds.length,
    datasetSha256: ds.sha256,
    artifactHashes: {
        dataset: {
            file: 'data/mines-master-6900bets.json',
            expected: pins_1.EXPECTED_DATASET_HASH,
            actual: ds.sha256,
            match: ds.sha256 === pins_1.EXPECTED_DATASET_HASH,
            sha256: ds.sha256,
        },
        simulation: ctx.simArtifact,
    },
    steps: results,
    info: infoItems,
    summary: { passed, flags, hardFail, verdict },
};
const step19 = results.find(r => r.step === 19);
const figuresBody = {
    generatedAt: new Date().toISOString(),
    ...(0, figures_1.computeAuditFigures)({ bets, seeds, seedMap, phaseD: phaseDBets, outputsDir: OUTPUTS_DIR, datasetSha256: ds.sha256 }),
};
const VERIFICATION_FILE = 'verification-results.json';
const write = (dir, name, body) => fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2));
const readJsonOrNull = (p) => {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    catch {
        return null;
    }
};
if (EMIT) {
    write(OUTPUTS_DIR, VERIFICATION_FILE, verificationBody);
    console.log(`  REPORT GENERATION: rewrote outputs/${VERIFICATION_FILE}`);
    if (step19?.status === 'PASS') {
        write(OUTPUTS_DIR, figures_1.AUDIT_FIGURES_FILE, figuresBody);
        console.log(`  REPORT GENERATION: rewrote outputs/${figures_1.AUDIT_FIGURES_FILE}`);
    }
    else {
        console.log(`  NOT written: outputs/${figures_1.AUDIT_FIGURES_FILE} — Step 19 returned ${step19?.status ?? '(absent)'} (H-B).`);
        console.log('  The copy on disk is left untouched so the discrepancy stays visible.');
        console.log('  Regenerate deliberately with `npm run figures`, then re-run `npm run verify`.');
    }
    console.log('  Review the diff before publishing — these are artifacts of record.');
}
else {
    fs.mkdirSync(RUN_DIR, { recursive: true });
    write(RUN_DIR, VERIFICATION_FILE, verificationBody);
    write(RUN_DIR, figures_1.AUDIT_FIGURES_FILE, figuresBody);
    const committedVerification = readJsonOrNull(path.join(OUTPUTS_DIR, VERIFICATION_FILE));
    const committedFigures = readJsonOrNull(path.join(OUTPUTS_DIR, figures_1.AUDIT_FIGURES_FILE));
    const verificationDiff = (0, diff_1.fieldDiff)(committedVerification, verificationBody, ['generatedAt']);
    const figuresDiff = (0, diff_1.fieldDiff)(committedFigures, figuresBody, ['generatedAt']);
    write(RUN_DIR, 'diff.json', {
        generatedAt: verificationBody.generatedAt,
        runtime: process.versions.node,
        verdict,
        note: 'Field-level diff between the COMMITTED artifacts and THIS RUN. `generatedAt` is '
            + 'excluded because it differs by construction. A non-empty diff means this run disagrees '
            + 'with the committed evidence — investigate it; do not re-run until it goes away, and do '
            + 'not regenerate the committed artifact to make it go away.',
        committedReadable: {
            [`outputs/${VERIFICATION_FILE}`]: committedVerification !== null,
            [`outputs/${figures_1.AUDIT_FIGURES_FILE}`]: committedFigures !== null,
        },
        verificationResultsDiff: verificationDiff,
        auditFiguresDiff: figuresDiff,
    });
    console.log(`  Output (this run only): outputs/run/${VERIFICATION_FILE}, outputs/run/${figures_1.AUDIT_FIGURES_FILE}, outputs/run/diff.json`);
    console.log('  Committed artifacts NOT modified. Use `PF_EMIT=1 npm run verify` to propose replacements.');
    if (verificationDiff.length || figuresDiff.length) {
        console.log(`  ⚠ THIS RUN DISAGREES WITH THE COMMITTED EVIDENCE — ${verificationDiff.length} field(s) in ${VERIFICATION_FILE}, ${figuresDiff.length} in ${figures_1.AUDIT_FIGURES_FILE}. See outputs/run/diff.json.`);
    }
}
if (hardFail > 0)
    process.exit(1);

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

__require('', "./tests/verify.js");
