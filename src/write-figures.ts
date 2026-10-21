/**
 * Deliberate writer for outputs/audit-figures.json — run: `npm run figures`
 *
 * WHY THIS IS A SEPARATE COMMAND.
 *
 * A `tests/verify.ts` that wrote this artifact unconditionally at the end of every run would have
 * the verifier repair the very file Step 19 had just hard-failed. Editing a headline figure then
 * produces `[FAIL] Step 19 / NOT PROVABLY FAIR` on the first run and `[PASS] Step 19 /
 * PROVABLY FAIR — Full Pass` on the second, with the edit silently reverted and no trace left.
 * The same self-heal launders a fabricated simulation artifact into a Full Pass.
 *
 * `npm run verify` writes the file only when Step 19 passed. That leaves one honest gap:
 * a repo whose figure artifact is genuinely missing or genuinely stale needs a way to produce it.
 * This is that way, and it is deliberately NOT the verifier — regenerating the artifact of record
 * is a decision somebody makes and can be seen making in a shell history, not a side effect of
 * asking whether the audit passes.
 *
 * It writes and reports. It does not score anything, and it never claims a verdict.
 */

import * as fs from 'fs';
import * as path from 'path';

import { loadDataset } from './loader';
import { EXPECTED_DATASET_HASH } from './pins';
import { computeAuditFigures, AUDIT_FIGURES_FILE } from './figures';
import type { Bet, Seed } from './types';

const DATASET_PATH = path.join(__dirname, '../data/mines-master-6900bets.json');
const OUTPUTS_DIR = path.join(__dirname, '../outputs');
/**
 * Where the figures are WRITTEN. outputs/run/ by default: outputs/audit-figures.json is an
 * artifact of record, SHA-256 pinned in src/pins.ts ARTIFACT_PINS (MINES-27), so rebuilding it in
 * place is the deliberate `OUT_DIR=outputs npm run figures`, followed by a re-pin in the same diff.
 * The inputs (the pinned dataset and outputs/simulation-results.json) are always read from outputs/.
 */
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(__dirname, '..', process.env.OUT_DIR)
  : path.join(OUTPUTS_DIR, 'run');

// The SHA-256 pin is enforced here exactly as it is in the verifier: figures derived from an
// unpinned dataset would be a "producing artifact" for numbers nobody audited.
const ds = loadDataset(DATASET_PATH, EXPECTED_DATASET_HASH);
const bets: Bet[] = ds.bets;
const seeds: Seed[] = ds.seeds;

const seedMap = new Map<string, string>();
for (const s of seeds) if (s.serverSeed) seedMap.set(s.hashedServerSeed, s.serverSeed);

fs.mkdirSync(OUT_DIR, { recursive: true });

const target = path.join(OUT_DIR, AUDIT_FIGURES_FILE);
const existed = fs.existsSync(target);

const figures = computeAuditFigures({
  bets, seeds, seedMap,
  phaseD: bets.filter(b => b.phase === 'D'),
  outputsDir: OUTPUTS_DIR,
  datasetSha256: ds.sha256,
});
// No run metadata (MINES-27): the same inputs produce the same bytes.
fs.writeFileSync(target, JSON.stringify(figures, null, 2));

console.log(`\n  ${existed ? 'OVERWROTE' : 'created'} ${path.relative(path.join(__dirname, '..'), target)}`);
console.log(`  derived from ${bets.length} bets / ${seeds.length} seeds, dataset ${ds.sha256.slice(0, 16)}…`);
if (!fs.existsSync(path.join(OUTPUTS_DIR, 'simulation-results.json'))) {
  console.log('  NOTE: outputs/simulation-results.json is absent, so the `simulation` section is null.');
}
console.log('  This command asserts nothing. Run `npm run verify` to score the result.\n');

export {};
