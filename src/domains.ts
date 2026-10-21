/**
 * VALUE DOMAINS for every numeric leaf of every pinned JSON artifact (MINES-27).
 *
 * A pin proves an artifact is the committed one; it says nothing about whether the committed one
 * could be true. A negative count, a probability of 1.3 or a win count above its round count,
 * re-pinned by a forger, is exactly as "identical to its pin" as the real file. So Step 19 walks
 * every numeric leaf of every pinned JSON artifact and requires two things:
 *
 *   1. the leaf's path is DECLARED below — there is no silent fallback, so a numeric field added
 *      to an artifact without saying what it physically admits fails the step; and
 *   2. the value lies inside that domain.
 *
 * EVERY BOUND COMES FROM CODE (src/pins.ts, src/config.ts, src/false-alarm.ts), NEVER FROM THE
 * ARTIFACT BEING CHECKED. The domains encode PHYSICAL POSSIBILITY, not plausibility: nothing here
 * rejects a value for being surprising, round, extreme or equal to its own expectation (a z-score
 * is any finite number). Whether a value is RIGHT is the job of the step that re-derives it.
 *
 * Paths: array elements become `[*]`. Ported in shape from an earlier ProvablyFair.org package.
 */
import { EXPECTED_BETS, EXPECTED_SEEDS } from './pins';
import { GRID, MINE_COUNTS } from './config';
import { ENFORCED_ROUNDS_PER_CONFIG } from './false-alarm';

interface Domain { label: string; ok: (v: number) => boolean }
const D = (label: string, ok: (v: number) => boolean): Domain => ({ label, ok });

const FINITE = D('a finite number', v => Number.isFinite(v));
const NONNEG = D('a non-negative real', v => Number.isFinite(v) && v >= 0);
const POS = D('a strictly positive real', v => Number.isFinite(v) && v > 0);
const PROB = D('a probability in [0,1]', v => Number.isFinite(v) && v >= 0 && v <= 1);
const PROB_POS = D('a probability in (0,1]', v => Number.isFinite(v) && v > 0 && v <= 1);
const CORR = D('a correlation in [-1,1]', v => Number.isFinite(v) && v >= -1 && v <= 1);
const PCT = D('a percentage in [0,100]', v => Number.isFinite(v) && v >= 0 && v <= 100);
const PCT_ANY = D('a percentage ≥ 0', v => Number.isFinite(v) && v >= 0);
const intIn = (lo: number, hi: number, what: string): Domain =>
  D(`an integer in [${lo}, ${hi}] (${what})`, v => Number.isInteger(v) && v >= lo && v <= hi);
const INT = D('a non-negative integer', v => Number.isInteger(v) && v >= 0);
const exactly = (x: number, what: string): Domain => D(`exactly ${x} (${what})`, v => v === x);

const M_MAX = MINE_COUNTS[MINE_COUNTS.length - 1];
const CONFIGS = MINE_COUNTS.length;
const MINES = intIn(MINE_COUNTS[0], M_MAX, 'a legal mine count, src/config.ts MINE_COUNTS');
const DEPTH = intIn(1, GRID - 1, 'a legal reveal depth');
const BETS = intIn(0, EXPECTED_BETS, 'at most the declared population, src/pins.ts EXPECTED_BETS');
const SEEDS = intIn(0, EXPECTED_SEEDS, 'at most the declared seed epochs, src/pins.ts EXPECTED_SEEDS');
const EPOCH = intIn(0, EXPECTED_SEEDS - 1, 'an epoch index');
const ROUNDS = intIn(0, ENFORCED_ROUNDS_PER_CONFIG, 'at most the declared rounds per config');
const NONCE = intIn(0, ENFORCED_ROUNDS_PER_CONFIG - 1, 'a simulation nonce');
const CFG = intIn(0, CONFIGS, 'at most the configs');
const PAIRS = exactly((GRID * (GRID - 1)) / 2, 'tile pairs of a 25-tile board');
const MULT = D('a multiplier ≥ 1', v => Number.isFinite(v) && v >= 1);
const STAKE = D('a stake > 0', v => Number.isFinite(v) && v > 0);
const MONEY = D('a money amount ≥ 0', v => Number.isFinite(v) && v >= 0);
const SIGNED_MONEY = D('a signed money amount', v => Number.isFinite(v));

const SIMULATION: Record<string, Domain> = {
  'houseEdge': PROB,
  'pass1_fresh_seeds.configs': exactly(CONFIGS, 'src/config.ts MINE_COUNTS'),
  'pass1_fresh_seeds.roundsPerConfig': exactly(ENFORCED_ROUNDS_PER_CONFIG, 'src/false-alarm.ts'),
  'pass1_fresh_seeds.totalRounds': exactly(CONFIGS * ENFORCED_ROUNDS_PER_CONFIG, 'configs × rounds'),
  'pass1_fresh_seeds.bonferroniAlpha': PROB_POS,
  'pass1_fresh_seeds.bonferroniZCritical': POS,
  'pass1_fresh_seeds.firstDrawChi2FailsAtAlpha01': CFG,
  'pass1_fresh_seeds.firstDrawChi2FailsBonferroni': CFG,
  'pass1_fresh_seeds.jointConfigsTested': CFG,
  'pass1_fresh_seeds.jointFailsAtAlpha01': CFG,
  'pass1_fresh_seeds.jointFailsBonferroni': CFG,
  'pass1_fresh_seeds.jointMaxAbsZAcrossConfigs': NONNEG,
  'pass1_fresh_seeds.layoutSerialFailsUncorrected': CFG,
  'pass1_fresh_seeds.layoutSerialFailsBonferroni': CFG,
  'pass1_fresh_seeds.meanSimulatedRTP': NONNEG,
  'pass1_fresh_seeds.meanTheoreticalRTP': NONNEG,
  'pass1_fresh_seeds.results[*].mineCount': MINES,
  'pass1_fresh_seeds.results[*].firstDrawChi2': NONNEG,
  'pass1_fresh_seeds.results[*].firstDrawDf': exactly(GRID - 1, '25 cells − 1'),
  'pass1_fresh_seeds.results[*].firstDrawPValue': PROB,
  'pass1_fresh_seeds.results[*].convergence[*].n': intIn(1, ENFORCED_ROUNDS_PER_CONFIG, 'a checkpoint size'),
  'pass1_fresh_seeds.results[*].convergence[*].wins': ROUNDS,
  'pass1_fresh_seeds.results[*].layoutR1': CORR,
  'pass1_fresh_seeds.results[*].layoutR1Z': FINITE,
  'pass1_fresh_seeds.results[*].layoutRunsZ': FINITE,
  'pass1_fresh_seeds.results[*].layoutRunsPValue': PROB,
  'pass1_fresh_seeds.results[*].theoreticalRTP': NONNEG,
  'pass1_fresh_seeds.results[*].simRTP': NONNEG,
  'pass1_fresh_seeds.results[*].jointMaxAbsZ': NONNEG,
  'pass1_fresh_seeds.results[*].jointPValue': PROB,
  'pass1_fresh_seeds.results[*].jointPairs': PAIRS,
  'pass2_casino_seeds.noncesPerSeed': POS,
  'pass2_casino_seeds.earlyWindow[*]': INT,
  'pass2_casino_seeds.lateWindow[*]': INT,
  'pass2_casino_seeds.bootstrapReps': POS,
  'pass2_casino_seeds.bootstrapMineCounts[*]': MINES,
  'pass2_casino_seeds.seeds_tested': SEEDS,
  'pass2_casino_seeds.cherryPickFlags': SEEDS,
  'pass2_casino_seeds.expectedFlagsByChance': NONNEG,
  'pass2_casino_seeds.cherryPickSurvivalP': PROB,
  'pass2_casino_seeds.results[*].epoch': EPOCH,
  'pass2_casino_seeds.results[*].mineCount': MINES,
  'pass2_casino_seeds.results[*].earlyChi2': NONNEG,
  'pass2_casino_seeds.results[*].earlyBootstrapP': PROB_POS,
  'pass2_casino_seeds.results[*].lateChi2': NONNEG,
  'pass2_casino_seeds.results[*].latePValue': PROB,
};

const DEEP_REPLAY: Record<string, Domain> = {
  'roundsPerConfig': exactly(ENFORCED_ROUNDS_PER_CONFIG, 'src/false-alarm.ts'),
  'rowsInArtifact': CFG, 'rowsReplayed': CFG,
  'roundsReplayed': intIn(0, CONFIGS * ENFORCED_ROUNDS_PER_CONFIG, 'configs × rounds'),
  'perRow[*].mineCount': MINES, 'perRow[*].nonceRange[*]': NONCE, 'perRow[*].differences': INT,
};

const BOOTSTRAP_REPLAY: Record<string, Domain> = {
  'bootstrapStatisticsChecked': INT, 'bootstrapStatisticMismatches': INT,
  'bootstrapPValuesChecked': SEEDS, 'bootstrapPValueMismatches': SEEDS,
  'casinoChiSquareRowsChecked': SEEDS, 'casinoChiSquareMismatches': SEEDS,
  'latePMaxAbsoluteDifference': NONNEG, 'flagEpochs[*]': EPOCH, 'nominalBinomialSurvival': PROB,
  'results[*].epoch': EPOCH, 'results[*].mineCount': MINES, 'results[*].earlyBootstrapP': PROB_POS,
};

const PROVENANCE: Record<string, Domain> = {
  'pass1.configurations': exactly(CONFIGS, 'src/config.ts MINE_COUNTS'),
  'pass1.roundsPerConfiguration': exactly(ENFORCED_ROUNDS_PER_CONFIG, 'src/false-alarm.ts'),
  'pass2.bootstrapRepsPerMineCount': POS, 'pass2.mineCounts[*]': MINES,
  'pass2.earlyWindow[*]': INT, 'pass2.lateWindow[*]': INT, 'pass2.noncesPerSeed': POS,
  'pass2.derivedSeedBytes': intIn(1, 64, 'bytes'), 'pass2.replicateIndex[*]': INT, 'pass2.nullStatistics': INT,
};

const RESULTS: Record<string, Domain> = {
  'totalBets': exactly(EXPECTED_BETS, 'src/pins.ts EXPECTED_BETS'),
  'totalSeeds': exactly(EXPECTED_SEEDS, 'src/pins.ts EXPECTED_SEEDS'),
  // 22 scored steps since 2026-09-26 (Step 22, the v3 multi-reveal supplement).
  'steps[*].step': intIn(1, 22, 'a scored step number'),
  'summary.passed': intIn(0, 22, 'scored steps'), 'summary.flags': intIn(0, 22, 'scored steps'),
  'summary.operatorFlags': intIn(0, 22, 'scored steps'), 'summary.captureFlags': intIn(0, 22, 'scored steps'),
  'summary.hardFail': intIn(0, 22, 'scored steps'),
};

const FIGURES: Record<string, Domain> = {
  'houseEdge': PROB,
  'referenceGrid[*].mineCount': MINES, 'referenceGrid[*].tilesRevealed': DEPTH,
  'referenceGrid[*].winProbability': PROB_POS, 'referenceGrid[*].multiplierExact': MULT,
  'referenceGrid[*].multiplierDisplayed': MULT, 'referenceGrid[*].theoreticalRTP': NONNEG,
  'referenceGridSummary.cells': intIn(0, 300, 'the 300 legal (m,k) cells'),
  'referenceGridSummary.minTheoreticalRTP': NONNEG, 'referenceGridSummary.maxTheoreticalRTP': NONNEG,
  'referenceGridSummary.cellsOffTarget': intIn(0, 300, 'cells'), 'referenceGridSummary.nonFiniteCells': intIn(0, 300, 'cells'),
  'settlementFloor[*].stake': STAKE, 'settlementFloor[*].mineCount': MINES, 'settlementFloor[*].tilesRevealed': DEPTH,
  'settlementFloor[*].deficitOfTurnover': PROB, 'settlementFloor[*].settledRTP': NONNEG,
  'clientSeedControls.tested': BETS, 'clientSeedControls.emptySeedReproduces': BETS,
  'clientSeedControls.emptySeedReproducesPercent': PCT, 'clientSeedControls.wrongSeedReproduces': BETS,
  'clientSeedControls.wrongSeedReproducesPercent': PCT, 'clientSeedControls.changedUnderWrongSeed': BETS,
  'clientSeedControls.changedUnderWrongSeedPercent': PCT,
  'moduloBiasRejectionCensus.roundsScanned': BETS,
  'moduloBiasRejectionCensus.drawsScanned': intIn(0, EXPECTED_BETS * GRID, 'bets × 25 draws'),
  'moduloBiasRejectionCensus.rejectionsObserved': intIn(0, EXPECTED_BETS * GRID, 'draws'),
  'moduloBiasRejectionCensus.rejectionsExpected': NONNEG,
  'moduloBiasRejectionCensus.probabilityCaptureWitnessesBranch': PROB,
  'phaseDTimestampPatternEpochs.epochs': SEEDS, 'phaseDTimestampPatternEpochs.bets': BETS,
  'phaseDTimestampPatternEpochs.staked': MONEY, 'phaseDTimestampPatternEpochs.credited': MONEY,
  'phaseDTimestampPatternEpochs.netToPlayer': SIGNED_MONEY, 'phaseDTimestampPatternEpochs.nonFiniteMoneyRows': BETS,
  'clientSeedProvenance.epochs': SEEDS, 'clientSeedProvenance.auditFormatSeeds': SEEDS,
  'clientSeedProvenance.distinctAuditFormatSeeds': SEEDS, 'clientSeedProvenance.customPhaseDSeeds': SEEDS,
  'clientSeedProvenance.hexNibblesSampled': INT, 'clientSeedProvenance.hexNibbleChi2': NONNEG,
  'clientSeedProvenance.hexNibbleDf': exactly(15, '16 hex digits − 1'),
  'liveAggregate.bets': exactly(EXPECTED_BETS, 'src/pins.ts EXPECTED_BETS'), 'liveAggregate.wins': BETS,
  'liveAggregate.losses': BETS, 'liveAggregate.winRate': PROB, 'liveAggregate.wagered': MONEY,
  'liveAggregate.returned': MONEY, 'liveAggregate.liveRTP': NONNEG, 'liveAggregate.liveRTPPercent': PCT_ANY,
  'liveAggregate.nonFiniteBetAmounts': BETS, 'liveAggregate.nonFiniteWinAmounts': BETS,
  'flooredDisplayCounterfactual.worstMineCount': MINES, 'flooredDisplayCounterfactual.worstTilesRevealed': DEPTH,
  'flooredDisplayCounterfactual.worstEffectiveEdge': FINITE, 'flooredDisplayCounterfactual.worstEffectiveEdgePercent': FINITE,
  'flooredDisplayCounterfactual.worstLossOn010Stake': FINITE,
  'flooredDisplayCounterfactual.worstCellsTiedAtThisEdge[*].mineCount': MINES,
  'flooredDisplayCounterfactual.worstCellsTiedAtThisEdge[*].tilesRevealed': DEPTH,
  'flooredDisplayCounterfactual.cells[*].mineCount': MINES, 'flooredDisplayCounterfactual.cells[*].tilesRevealed': DEPTH,
  'flooredDisplayCounterfactual.cells[*].multiplierExact': MULT, 'flooredDisplayCounterfactual.cells[*].multiplierDisplayed': MULT,
  // Signed by construction: a floored display can sit ABOVE the exact multiplier by a float ulp.
  'flooredDisplayCounterfactual.cells[*].lossPerUnitStake': FINITE,
  'flooredDisplayCounterfactual.cells[*].effectiveEdgeIfDisplayPaid': FINITE,
  'flooredDisplayCounterfactual.cells[*].effectiveEdgeIfDisplayPaidPercent': FINITE,
  'flooredDisplayCounterfactual.cells[*].lossOn010Stake': FINITE,
  'falseAlarmAccounting.alpha': PROB, 'falseAlarmAccounting.bonferroniAlpha': PROB,
  'falseAlarmAccounting.roundsPerConfig': exactly(ENFORCED_ROUNDS_PER_CONFIG, 'src/false-alarm.ts'),
  'falseAlarmAccounting.convergenceCheckpoints[*]': intIn(1, ENFORCED_ROUNDS_PER_CONFIG, 'a checkpoint size'),
  'falseAlarmAccounting.arms[*].arm': intIn(1, 32, 'an arm number'), 'falseAlarmAccounting.arms[*].tests': INT,
  'falseAlarmAccounting.arms[*].nominalEach': PROB, 'falseAlarmAccounting.arms[*].nominalTotal': NONNEG,
  'falseAlarmAccounting.bonferroniTests': INT, 'falseAlarmAccounting.bonferroniNominal': NONNEG,
  'falseAlarmAccounting.cherryPickNominal': PROB, 'falseAlarmAccounting.seScreenZ': POS,
  'falseAlarmAccounting.seScreenNominalEach': PROB, 'falseAlarmAccounting.seScreenTests': INT,
  'falseAlarmAccounting.seScreenNominal': NONNEG, 'falseAlarmAccounting.totalNominal': NONNEG,
  'falseAlarmAccounting.totalNominalPercent': PCT_ANY,
  'falseAlarmAccounting.notAnUpperBound.checkpointN': intIn(1, ENFORCED_ROUNDS_PER_CONFIG, 'a checkpoint size'),
  'falseAlarmAccounting.notAnUpperBound.exactSumAtCheckpoint': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.nominalSumAtCheckpoint': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.exactOverNominalAtCheckpoint': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.n': intIn(1, ENFORCED_ROUNDS_PER_CONFIG, 'a checkpoint size'),
  'falseAlarmAccounting.notAnUpperBound.worstConfig.mineCount': MINES,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.winProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.fiveSeThreshold': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.rejectAtOrBelow': ROUNDS,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.rejectAtOrAbove': ROUNDS,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.exactRejectionProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.nominalRejectionProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.worstConfig.exactOverNominal': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].n': intIn(1, ENFORCED_ROUNDS_PER_CONFIG, 'a checkpoint size'),
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].mineCount': MINES,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].winProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].fiveSeThreshold': NONNEG,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].rejectAtOrBelow': ROUNDS,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].rejectAtOrAbove': ROUNDS,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].exactRejectionProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].nominalRejectionProbability': PROB,
  'falseAlarmAccounting.notAnUpperBound.perConfig[*].exactOverNominal': NONNEG,
  'falseAlarmAccounting.validBounds.coversArms[*]': intIn(1, 32, 'an arm number'),
  'falseAlarmAccounting.validBounds.arm8UnionUpperBound': NONNEG,
  'falseAlarmAccounting.validBounds.arm8NominalForComparison': NONNEG,
  'falseAlarmAccounting.validBounds.totalWithArm8BoundedValidly': NONNEG,
  'simulation.configs': exactly(CONFIGS, 'src/config.ts MINE_COUNTS'),
  'simulation.roundsPerConfig': exactly(ENFORCED_ROUNDS_PER_CONFIG, 'src/false-alarm.ts'),
  'simulation.meanSimulatedRTP': NONNEG, 'simulation.pooledSEPercentagePoints': NONNEG,
  'simulation.twoSEBandPercentagePoints': NONNEG, 'simulation.chartFinalRTPPercent': PCT_ANY,
  'simulation.chartFinalSEPercentagePoints': NONNEG, 'simulation.chartFinalBandLowerPercent': FINITE,
  'simulation.chartFinalBandUpperPercent': FINITE, 'simulation.meanZAgainstTheory': FINITE,
  'simulation.absMeanZAgainstTheory': NONNEG, 'simulation.perConfigZ[*].mineCount': MINES,
  'simulation.perConfigZ[*].z': FINITE, 'simulation.maxAbsPerConfigZ': NONNEG,
};

/** Domain table per pinned JSON artifact, keyed by its path relative to the package root. */
export const DOMAIN_TABLES: Readonly<Record<string, Record<string, Domain>>> = {
  'outputs/simulation-results.json': SIMULATION,
  'outputs/deep-replay-report.json': DEEP_REPLAY,
  'outputs/bootstrap-replay-report.json': BOOTSTRAP_REPLAY,
  'outputs/simulation-provenance.json': PROVENANCE,
  'outputs/verification-results.json': RESULTS,
  'outputs/audit-figures.json': FIGURES,
};

/**
 * Walk every numeric leaf of `value`. `undeclared` lists normalised paths with no domain (a FAIL);
 * `violations` lists values outside their domain (a FAIL).
 */
export function checkArtifactDomains(file: string, value: unknown): { checked: number; undeclared: string[]; violations: string[] } {
  const table = DOMAIN_TABLES[file];
  const undeclared = new Set<string>();
  const violations: string[] = [];
  let checked = 0;
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) { v.forEach(x => walk(x, `${p}[*]`)); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, p ? `${p}.${k}` : k); return; }
    if (typeof v !== 'number') return;
    checked++;
    const d = table?.[p];
    if (!d) { undeclared.add(p); return; }
    if (!d.ok(v)) violations.push(`${p} = ${v} is not ${d.label}`);
  };
  walk(value, '');
  if (!table) return { checked, undeclared: ['<no domain table for this artifact>'], violations };
  return { checked, undeclared: [...undeclared], violations };
}

/**
 * RUN METADATA — key names that are a property of a run (when, how long), never of the evidence.
 * A pinned artifact carrying one fails Step 19: run metadata is absent, not excluded.
 */
export const RUN_METADATA_KEY = /^(generatedAt|timestamp|createdAt|recordedAt|analysisRecordedAt|inputsRecordedAt|artifactGeneratedAt|executionTimeMs|elapsedMs|seconds|durationMs|runtimeMs)$/;

/** Every key path in `value` whose final key is run metadata. */
export function runMetadataPaths(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) { v.forEach(x => walk(x, `${p}[*]`)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const q = p ? `${p}.${k}` : k;
        if (RUN_METADATA_KEY.test(k)) out.push(q);
        walk(x, q);
      }
    }
  };
  walk(value, '');
  return [...new Set(out)];
}
