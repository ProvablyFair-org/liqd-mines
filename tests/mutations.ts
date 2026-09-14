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
 * prints "NOT PROVABLY FAIR" and the gate still reports CAUGHT. That is a real defect found in
 * a sibling LIQD repo in September 2026 (dice: the registry declared Step 7, Step 7 had been
 * rewritten to hardcode its constant, and the gate reported PASS for a guard that was pure
 * decoration). So: the named step must appear as [FAIL] or [FLAG] in the mutated run's output,
 * or the entry is a MISS even when the verdict flipped.
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
  expectStatus?: 'FAIL' | 'FLAG';
  guard?: string;
  survivor?: boolean;
  why?: string;
}

const RUNNER_SCRIPT: Record<string, string> = {
  verify: 'tests/verify.ts',
};

// TWO FILES, DELIBERATELY.
//   tests/mutations.json  — mutations that MUST break the named step. This is the file the
//                           framework's own checks (check-mutations.sh, gate-anchor.sh) read,
//                           and it is a must-fail registry: every entry in it is expected to be
//                           caught, so those scripts can assert exactly that without having to
//                           understand a per-entry exemption flag.
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
const manifest: Mutation[] = [...mustFail, ...declaredSurvivors];
const COPY = ['src', 'tests', 'data', 'outputs', 'tsconfig.json', 'package.json', '.mocharc.yml'];

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — MUTATION GATE (falsifiability)');
console.log('══════════════════════════════════════════════════════════');

let misses = 0;
let caught = 0;
let survivors = 0;

for (const mut of manifest) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mines-mut-'));
  let note = '';
  let ok = false;
  try {
    // 1. copy the repo (never the working tree — a throwaway temp copy)
    for (const item of COPY) {
      const src = path.join(repoRoot, item);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, item), { recursive: true });
    }
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

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

    // 3. run the declared runner inside the copy (a nonzero exit is expected — capture either way)
    let out = '';
    let rc = 0;
    const argv = mut.runner === 'mocha'
      ? ['node_modules/.bin/mocha']
      : ['-r', 'ts-node/register/transpile-only', RUNNER_SCRIPT[mut.runner] ?? 'tests/verify.ts'];
    try {
      out = execFileSync('node', argv, { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      rc = e.status ?? 1;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    // 4a. mocha runner: the assertion is a nonzero exit with at least one failing spec.
    if (mut.runner === 'mocha') {
      // The declared `expect` for a mocha entry is a literal marker that must appear in the
      // output (the framework's gate-anchor.sh asserts the same thing), not a verdict string —
      // mocha prints no VERDICT line.
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
        const re = new RegExp(`\\[(PASS|FLAG|FAIL)\\] Step ${mut.expectStep} `);
        stepSeen = (re.exec(out) ?? [])[1] ?? '(step line absent)';
        stepOk = stepSeen === (mut.expectStatus ?? 'FAIL');
      }
      ok = verdictOk && stepOk;
      note = `VERDICT: ${verdict} (expected ${mut.expect})`
        + (mut.expectStep !== undefined ? `; Step ${mut.expectStep}: ${stepSeen} (expected ${mut.expectStatus ?? 'FAIL'})` : '');
      if (verdictOk && !stepOk) {
        note += ' — DECLARED GUARD IS DECORATION: the verdict flipped through some OTHER step';
      }
    }

    if (mut.survivor) {
      // A declared survivor is expected NOT to be caught. Report either way; fail neither.
      survivors++;
      console.log(`  ${ok ? 'SURVIVOR-NOW-CAUGHT' : 'SURVIVOR (declared)'} ${mut.name}`);
      console.log(`         → ${note}`);
      console.log(`         → why: ${mut.why ?? '(no reason declared — that is a registry defect)'}`);
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

const scored = manifest.length - survivors;
console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${caught}/${scored} scored mutations caught by the step they NAME`
  + (survivors > 0 ? `; ${survivors} declared survivor(s) listed above` : ''));
console.log('══════════════════════════════════════════════════════════\n');

if (misses > 0) process.exit(1);
export {};
