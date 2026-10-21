/**
 * Mutation gate (falsifiability) — run: npm run mutations
 *
 * Reads the declared mutations in `tests/mutations.json`. Each entry names a source edit
 * (`find` → `replace` in `file`, optionally a second `find2` → `replace2` in the same file)
 * that SHOULD break the verdict, the `runner` that scores it, the exact `VERDICT:` line the
 * mutated run must print (`expect`), and — this is the part that matters — the SPECIFIC STEP
 * that must be the one to fire (`expectStep` + `expectStatus`).
 *
 * WHY THE STEP ASSERTION EXISTS. Matching only the global verdict string cannot tell a live
 * guard from a dead one. A mutation to the payout formula flips the verdict through four
 * different steps; if the step the registry NAMES has quietly stopped guarding, the run still
 * prints "NOT PROVABLY FAIR" and the gate still reports CAUGHT. That is not hypothetical: a
 * registry has been seen naming a step that had since been rewritten to hardcode its constant,
 * with the gate reporting PASS for a guard that was pure decoration. So: the named step must
 * appear as [FAIL] or [FLAG] in the mutated run's output, or the entry is a MISS even when the
 * verdict flipped.
 *
 * SURVIVORS ARE DECLARED, NOT HIDDEN. Mutations this suite does NOT catch live in
 * `tests/survivors.json`, each with a `why`, and this gate runs and prints them alongside the
 * must-fail registry. They do not fail the gate; a survivor that unexpectedly starts being
 * caught is reported too, because the registry is then out of date. Pretending a known survivor
 * is killed is worse than the survivor — and omitting it entirely is worse than both, because a
 * registry that quietly drops what it cannot catch reports a coverage it does not have.
 *
 * For each mutation this gate:
 *   1. copies `src/ tests/ data/ outputs/` (plus tsconfig/package/.mocharc) into a fresh temp
 *      dir and symlinks `node_modules` — the working tree is NEVER touched,
 *   2. applies the edit(s) to the copy,
 *   3. runs the declared runner (`tests/verify.ts` or mocha) inside the copy,
 *   4. asserts the VERDICT line and the named step's status.
 *
 * The dataset- and artifact-level battery (forged simulation rows, edited credits, orphaned
 * nonces, an un-repinned dataset) is NOT here: those are not source find/replace edits, and
 * they live in `tests/forgeries.ts` (`npm run forgeries`). They run through their named commands and through `npm run test:toolchain`.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'tests', 'mutations.json');

interface Mutation {
  name: string;
  file: string;
  find: string;
  replace: string;
  find2?: string;
  replace2?: string;
  runner: string;
  expect: string;
  /** The step whose status must change. Omitted only for the mocha runner. */
  expectStep?: number;
  expectStatus?: 'FAIL' | 'FLAG' | 'INFO' | 'PASS' | 'OVERSTATED';
  /**
   * RTP FIGURE OVERSTATED route (FIXPASS2 C3, 2026-10-14). `regen: true` does in the copy what an auditor
   * does after a change to the paytable or the published figure: re-writes outputs/rtp-claim-table.json
   * (src/rtp-settings.ts as main), re-pins RTP_CLAIM_TABLE_SHA256, re-emits the scored record
   * (PF_EMIT=1) and re-pins it in src/pins.ts ARTIFACT_PINS, so the judged run reproduces its own
   * committed artifacts and only the rule decides it. `expectExit` is then required exactly, besides the
   * VERDICT (`expect`) and the named step's LAST printed status (`expectStatus` OVERSTATED: the step first
   * prints its own marker, then `[RTP FIGURE OVERSTATED] Step N` when the rule re-scores it). Before
   * regenerating, the edited copy is run as it is (STALE layer): exit 1 and the step last printed [FAIL] are
   * required, because a committed table that no longer matches is a reproduction failure even under a miss.
   */
  regen?: boolean;
  expectExit?: number;
  /**
   * A literal the named step's printed detail must contain in the mutated run (QA 2026-10-02).
   * Needed when the named step ALREADY carries `expectStatus` on the unmutated tree — Step 10 FLAGs
   * at baseline since the supplement's settings were read — so a status match alone would be
   * vacuous. The gate runs the unmutated tree once and an entry whose marker is already present
   * there is a MISS: a marker the baseline prints proves nothing.
   */
  expectDetail?: string;
  guard?: string;
  survivor?: boolean;
  why?: string;
  /** Survivors only: the MANIFEST Declared Limitations row (DL-n) the survival is declared under. */
  limitation?: string;
}

const RUNNER_SCRIPT: Record<string, string> = {
  verify: 'tests/verify.ts',
};

// TWO FILES, DELIBERATELY.
//   tests/mutations.json  — mutations that MUST break the named step. This is the file an
//                           external harness reads, and it is a must-fail registry: every entry
//                           in it is expected to be caught, so such a harness can assert exactly
//                           that without having to understand a per-entry exemption flag.
//   tests/survivors.json  — mutations that are NOT caught, each carrying the reason. Keeping
//                           them in the must-fail file would either force a lie (declaring them
//                           caught) or force every reader of that file to special-case them.
//                           Keeping them nowhere would be worse: a registry that quietly omits
//                           what it cannot catch reports a coverage it does not have.
// Both are run here, and both are printed.
const survivorsPath = path.join(repoRoot, 'tests', 'survivors.json');
const mustFail: Mutation[] = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const declaredSurvivors: Mutation[] = fs.existsSync(survivorsPath)
  ? JSON.parse(fs.readFileSync(survivorsPath, 'utf-8')).map((m: Mutation) => ({ ...m, survivor: true }))
  : [];
const ALL: Mutation[] = [...mustFail, ...declaredSurvivors];
/**
 * `npm run mutations -- <name prefix> …` runs only the entries whose name starts with one of the
 * prefixes (e.g. M-C3 M04). A PARTIAL RUN, labelled as such in the summary; it never stands in for the
 * battery (added 2026-10-14: one mines verify takes minutes, the full battery hours).
 */
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const manifest: Mutation[] = ONLY.length ? ALL.filter(m => ONLY.some(o => m.name === o || m.name.startsWith(`${o} `))) : ALL;
const COPY = ['src', 'tests', 'data', 'outputs', 'verifier-parity', 'tsconfig.json', 'package.json', '.mocharc.yml', '.gitignore'];

// PER-RUN TIME LIMIT (QA 2026-10-02, A6). One verify run took 10–14 minutes on a 2-core machine,
// so a fixed 300 s cut-off scored a mutation whose named step HAD failed as a MISS. The limit is
// now PF_MUTATION_TIMEOUT_S (seconds, default 1200), and a run that hits it is reported as
// TIMED OUT — never as CAUGHT and never as an ordinary MISS. A timed-out entry is inconclusive, so
// it still fails the gate; re-run with a higher limit. PF_REPLAY_WORKERS (src/replay-pool.ts) caps
// the worker processes each verify run starts.
const TIMEOUT_S = (() => {
  const env = process.env.PF_MUTATION_TIMEOUT_S;
  if (env === undefined || env === '') return 1200;
  const n = Number(env);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`PF_MUTATION_TIMEOUT_S must be a positive number of seconds, got ${JSON.stringify(env)}`);
  return n;
})();

/** One fresh disposable copy of the package (the working tree is never touched). */
function freshCopy(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mines-mut-'));
  for (const item of COPY) {
    const src = path.join(repoRoot, item);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, item), { recursive: true });
  }
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  return tmp;
}

/** Run a runner in a copy. `timedOut` is true when the time limit stopped it. */
function runIn(tmp: string, runner: string, env: Record<string, string> = {}): { out: string; rc: number; timedOut: boolean } {
  const argv = runner === 'mocha'
    ? ['node_modules/.bin/mocha']
    : ['-r', 'ts-node/register/transpile-only', RUNNER_SCRIPT[runner] ?? 'tests/verify.ts'];
  try {
    const out = execFileSync('node', argv, { env: { ...process.env, ...env }, cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: TIMEOUT_S * 1000, maxBuffer: 64 * 1024 * 1024 });
    return { out, rc: 0, timedOut: false };
  } catch (e: any) {
    const timedOut = e?.code === 'ETIMEDOUT' || (e?.signal === 'SIGTERM' && e?.status === null);
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, rc: e.status ?? 1, timedOut };
  }
}

/** C3 `regen` in a copy: re-write and re-pin the rule table, re-emit and re-pin the scored record. Error or null. */
function regenerate(tmp: string): string | null {
  let w: string;
  try {
    w = execFileSync('node', ['-r', 'ts-node/register/transpile-only', 'src/rtp-settings.ts'], { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e: any) { return `rtp-claim:write exited ${e.status}`; }
  const h = /sha256 ([0-9a-f]{64})/.exec(w);
  if (!h) return 'rtp-claim:write printed no sha256';
  const rs = path.join(tmp, 'src/rtp-settings.ts');
  const src = fs.readFileSync(rs, 'utf-8');
  if (!/export const RTP_CLAIM_TABLE_SHA256 = '[0-9a-f]{64}'/.test(src)) return 'RTP_CLAIM_TABLE_SHA256 not found';
  fs.writeFileSync(rs, src.replace(/(export const RTP_CLAIM_TABLE_SHA256 = ')[0-9a-f]{64}(')/, `$1${h[1]}$2`));
  const e = runIn(tmp, 'verify', { PF_EMIT: '1' });
  if (e.timedOut || !/VERDICT:/.test(e.out)) return `PF_EMIT=1 verify exited ${e.rc}${e.timedOut ? ' (timed out)' : ''} without a VERDICT line`;
  // The two records a PF_EMIT run writes and src/pins.ts ARTIFACT_PINS pins: re-pinned to what it wrote.
  const pins = path.join(tmp, 'src/pins.ts');
  let p0 = fs.readFileSync(pins, 'utf-8');
  for (const rel of ['outputs/verification-results.json', 'outputs/audit-figures.json']) {
    const h2 = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(tmp, rel))).digest('hex');
    const re = new RegExp(`(file: '${rel.replace(/[./]/g, (c: string) => `\\${c}`)}', sha256: ')[0-9a-f]{64}(')`);
    if (!re.test(p0)) return `the ${rel} pin was not found in src/pins.ts`;
    p0 = p0.replace(re, `$1${h2}$2`);
  }
  fs.writeFileSync(pins, p0);
  return null;
}

/** The printed detail line of step `n` (verify prints it under every non-PASS step line). */
function stepDetail(out: string, n: number): string {
  const lines = out.split('\n');
  const i = lines.findIndex(l => new RegExp(`\\[(PASS|FLAG|FAIL|INFO)(?::capture)?\\] Step ${n} `).test(l));
  return i >= 0 && i + 1 < lines.length && !/\[(PASS|FLAG|FAIL|INFO)/.test(lines[i + 1]) ? lines[i + 1] : '';
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — MUTATION GATE (falsifiability)');
console.log('══════════════════════════════════════════════════════════');
console.log(`  per-run time limit ${TIMEOUT_S} s (PF_MUTATION_TIMEOUT_S); replay workers ${process.env.PF_REPLAY_WORKERS || 'one per CPU'} (PF_REPLAY_WORKERS)`);

let misses = 0;
let caught = 0;
let survivors = 0;
let timedOutCount = 0;

// BASELINE for expectDetail markers: the unmutated tree, run once.
let baselineOut: string | null = null;
if (manifest.some(m => m.expectDetail !== undefined)) {
  const tmp = freshCopy();
  try {
    const r = runIn(tmp, 'verify');
    if (r.timedOut) { console.log(`  BASELINE TIMED OUT after ${TIMEOUT_S} s — every expectDetail entry is inconclusive`); }
    else baselineOut = r.out;
    const v = (r.out.split('\n').find(l => l.includes('VERDICT:')) ?? '').replace(/^.*VERDICT:\s*/, '').trim();
    console.log(`  baseline (unmutated) run for expectDetail markers: VERDICT: ${v || '(none)'}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const mut of manifest) {
  const tmp = freshCopy();
  let note = '';
  let ok = false;
  try {

    // 2. apply the mutation to the copy
    const target = path.join(tmp, mut.file);
    if (!fs.existsSync(target)) {
      note = `file ${mut.file} not present (mutation could not be applied)`;
      misses++;
      console.log(`  MISS   ${mut.name} — ${note}`);
      continue;
    }
    let text = fs.readFileSync(target, 'utf-8');
    if (!text.includes(mut.find)) {
      note = `find string not present in ${mut.file} (mutation could not be applied)`;
      misses++;
      console.log(`  MISS   ${mut.name} — ${note}`);
      continue;
    }
    text = text.replace(mut.find, mut.replace);
    if (mut.find2 !== undefined) {
      if (!text.includes(mut.find2)) {
        note = `find2 string not present in ${mut.file}`;
        misses++;
        console.log(`  MISS   ${mut.name} — ${note}`);
        continue;
      }
      text = text.replace(mut.find2, mut.replace2 as string);
    }
    if (text === fs.readFileSync(target, 'utf-8')) {
      note = 'find === replace, nothing was mutated';
      misses++;
      console.log(`  MISS   ${mut.name} — ${note}`);
      continue;
    }
    fs.writeFileSync(target, text);
    // STALE layer (framework rule: a committed RTP table that no longer matches is a reproduction failure,
    // exit 1, even under a miss): the same edit WITHOUT regenerating must exit 1, the named step last
    // printed [FAIL]. Only then is the tree regenerated and the declared exit required.
    let staleNote = '';
    let staleOk = true;
    if (mut.regen) {
      const st = runIn(tmp, 'verify');
      const re = new RegExp(`\\[(PASS|FLAG|FAIL|INFO|RTP FIGURE OVERSTATED)(?::capture)?\\] Step ${mut.expectStep} `, 'g');
      const seen = [...st.out.matchAll(re)].map(x => x[1]);
      const last = seen[seen.length - 1] ?? '(step line absent)';
      staleOk = !st.timedOut && st.rc === 1 && last === 'FAIL';
      staleNote = `without regen: exit ${st.rc} (expected 1), Step ${mut.expectStep} last ${last} (expected FAIL); with regen: `;
      const err = regenerate(tmp);
      if (err) { misses++; console.log(`  MISS   ${mut.name} — regen failed: ${err}`); continue; }
    }

    // 3. run the declared runner inside the copy (a nonzero exit is expected — capture either way)
    const run = runIn(tmp, mut.runner);
    const out = run.out;
    const rc = run.rc;
    if (run.timedOut) {
      timedOutCount++;
      misses++;
      console.log(`  TIMED OUT ${mut.name}`);
      console.log(`         → stopped at the ${TIMEOUT_S} s limit before it finished — inconclusive, not a catch and not a miss; re-run with a higher PF_MUTATION_TIMEOUT_S`);
      continue;
    }

    // 4a. mocha runner: the assertion is a nonzero exit with at least one failing spec.
    if (mut.runner === 'mocha') {
      // The declared `expect` for a mocha entry is a literal marker that must appear in the
      // output, not a verdict string — mocha prints no VERDICT line.
      const failing = /(\d+) failing/.exec(out);
      ok = rc !== 0 && out.includes(mut.expect) && failing !== null && Number(failing[1]) > 0;
      note = ok ? `mocha exit ${rc}, ${failing?.[1]} failing spec(s), marker '${mut.expect}' present`
                : `mocha exit ${rc}, marker '${mut.expect}' ${out.includes(mut.expect) ? 'present' : 'ABSENT'}, ${failing?.[1] ?? 0} failing`;
    } else {
      // 4b. verify runner: BOTH the verdict and the NAMED step must match.
      const line = out.split('\n').find(l => l.includes('VERDICT:')) ?? '';
      const verdict = line.replace(/^.*VERDICT:\s*/, '').trim() || '(runner printed no VERDICT line)';
      const verdictOk = verdict === mut.expect;
      let stepOk = true;
      let stepSeen = '(not declared)';
      if (mut.expectStep !== undefined) {
        // `[FLAG:capture]` is a FLAG too (a capture-origin, verdict-neutral one).
        // An OVERSTATED entry reads the LAST status printed for the step: the RTP-CLAIM rule re-scores its
        // step after it ran and prints `[RTP FIGURE OVERSTATED] Step N` below the step's own marker. Every
        // other entry keeps reading the first marker, as before 2026-10-14.
        const re = new RegExp(`\\[(PASS|FLAG|FAIL|INFO|RTP FIGURE OVERSTATED)(?::capture)?\\] Step ${mut.expectStep} `, 'g');
        const all = [...out.matchAll(re)].map(x => x[1] === 'RTP FIGURE OVERSTATED' ? 'OVERSTATED' : x[1]);
        const pick = mut.expectStatus === 'OVERSTATED' ? all[all.length - 1] : all.find(x => x !== 'OVERSTATED');
        stepSeen = pick ?? '(step line absent)';
        stepOk = stepSeen === (mut.expectStatus ?? 'FAIL');
      }
      let detailNote = '';
      if (mut.expectDetail !== undefined && mut.expectStep !== undefined) {
        const seenDetail = stepDetail(out, mut.expectStep).includes(mut.expectDetail);
        const onBaseline = baselineOut === null ? null : stepDetail(baselineOut, mut.expectStep).includes(mut.expectDetail);
        const detailOk = seenDetail && onBaseline === false;
        detailNote = `; Step ${mut.expectStep} detail marker '${mut.expectDetail}': ${seenDetail ? 'present' : 'ABSENT'} in the mutated run, `
          + (onBaseline === null ? 'baseline unavailable (inconclusive)' : onBaseline ? 'ALSO present on the unmutated tree (proves nothing)' : 'absent on the unmutated tree');
        stepOk = stepOk && detailOk;
      }
      const exitOk = mut.expectExit === undefined || rc === mut.expectExit;
      ok = verdictOk && stepOk && exitOk && staleOk;
      if (mut.survivor) {
        // A declared survivor carries expect = the baseline verdict of record (Conditional Pass since
        // 2026-10-01: Step 22 FLAGged at baseline until 2026-10-03, Step 10 since 2026-10-02) and names the step that WOULD
        // fire if it were caught. `verdictOk && stepOk` can never hold for it (a FAILing step
        // flips the verdict), so testing that would make the staleness alarm below unreachable.
        // "Now caught" means: the verdict is no longer the baseline one, OR the named step fired.
        ok = !verdictOk || (mut.expectStep !== undefined && stepSeen === (mut.expectStatus ?? 'FAIL'));
      }
      note = `${staleNote}VERDICT: ${verdict} (expected ${mut.expect})`
        + (mut.expectExit !== undefined ? `; exit ${rc} (expected ${mut.expectExit})` : '')
        + (mut.expectStep !== undefined ? `; Step ${mut.expectStep}: ${stepSeen} (expected ${mut.expectStatus ?? 'FAIL'})` : '')
        + detailNote;
      if (verdictOk && !stepOk && !mut.survivor) {
        note += ' — DECLARED GUARD IS DECORATION: the verdict flipped through some OTHER step';
      }
    }

    if (mut.survivor) {
      // A declared survivor is expected NOT to be caught. Report either way; fail neither.
      survivors++;
      // A survivor that is now caught means the registry is out of date — the declared limitation
      // it is tied to may have closed, or a guard moved. That fails the gate until it is re-filed.
      if (ok) misses++;
      console.log(`  ${ok ? 'SURVIVOR-NOW-CAUGHT (registry out of date — move it to mutations.json)' : 'SURVIVOR (declared)'} ${mut.name}`);
      console.log(`         → ${note}`);
      console.log(`         → why: ${mut.why ?? '(no reason declared — that is a registry defect)'}`);
      console.log(`         → limitation: ${mut.limitation ?? '(no declared limitation ID — that is a registry defect)'}`);
    } else if (ok) {
      caught++;
      console.log(`  CAUGHT ${mut.name}`);
      console.log(`         → ${note}`);
    } else {
      misses++;
      console.log(`  MISS   ${mut.name}`);
      console.log(`         → ${note}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const scored = ONLY.length ? manifest.filter(m => !m.survivor).length : mustFail.length;
if (ONLY.length) console.log(`\n  PARTIAL RUN (${ONLY.join(', ')}): ${manifest.length} of ${ALL.length} registered entries — this is not the battery result`);
console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${caught}/${scored} scored mutations caught by the step they NAME`
  + (survivors > 0 ? `; ${survivors} declared survivor(s) listed above` : '')
  + (timedOutCount > 0 ? `; ${timedOutCount} TIMED OUT at ${TIMEOUT_S} s (inconclusive — re-run with a higher PF_MUTATION_TIMEOUT_S)` : ''));
console.log('══════════════════════════════════════════════════════════\n');

if (misses > 0) process.exit(1);
export {};
