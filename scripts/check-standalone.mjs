#!/usr/bin/env node
/** Detect stale compiled code without requiring the development dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => {
  console.error(`[standalone] FAIL: ${message}`);
  console.error('After an intentional source edit, run npm ci --include=dev and npm run build.');
  process.exit(1);
};
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = dir + '/' + entry.name;
    return entry.isDirectory() ? walk(rel) : [rel];
  }).sort();
}
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'standalone-manifest.json'), 'utf8'));
  if (manifest.format !== 1 || !manifest.inputs || !manifest.outputs) fail('Invalid build manifest.');
  const sourcePaths = ['src', 'tests'].flatMap(walk).filter(p => p.endsWith('.ts')).sort();
  const expectedInputs = [...sourcePaths, 'tsconfig.json', '.mocharc.yml', 'package-lock.json',
    'scripts/build-standalone.mjs', 'scripts/check-standalone.mjs', 'scripts/standalone-runtime.cjs'].sort();
  if (JSON.stringify(Object.keys(manifest.inputs).sort()) !== JSON.stringify(expectedInputs)) {
    fail('Source inventory differs from the bundled build.');
  }
  if (JSON.stringify(manifest.unitEntries) !== JSON.stringify(sourcePaths.filter(p => p.endsWith('Tests.ts')))) {
    fail('Unit-test inventory differs from the bundled build.');
  }
  if (JSON.stringify(Object.keys(manifest.outputs).sort()) !== JSON.stringify(['test.js', 'verify.js'])) {
    fail('Bundled entry-point inventory is incomplete.');
  }
  for (const files of [manifest.inputs, manifest.outputs]) {
    for (const [name, expected] of Object.entries(files)) {
      const actual = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
      if (actual !== expected) fail(`${name} differs from the bundled build.`);
    }
  }
  console.log('[standalone] Source inventory, unit-test inventory and both compiled entry points match the build manifest.');

  // RELEASE-GATE PARITY (MINES-28). The numbers the report states about the suite must be the
  // suite's own: the audit ID in MANIFEST.md is the one the run emits, the unit-spec count the
  // MANIFEST and README quote is the one the zero-install runner enforces, and the scored-step
  // count they quote is the number of steps in the committed scored record.
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const pins = read('src/pins.ts');
  const auditId = (/export const AUDIT_ID = '([^']+)'/.exec(pins) ?? [])[1];
  const unitCount = Number((/export const EXPECTED_UNIT_TESTS = (\d+);/.exec(pins) ?? [])[1]);
  if (!auditId) fail('src/pins.ts declares no AUDIT_ID.');
  if (!Number.isInteger(unitCount)) fail('src/pins.ts declares no EXPECTED_UNIT_TESTS.');
  const manifestMd = read('MANIFEST.md');
  const readme = read('README.md');
  if (!manifestMd.includes(`**Audit ID:** \`${auditId}\``)) fail(`MANIFEST.md does not carry the audit ID ${auditId} declared in src/pins.ts.`);
  const record = JSON.parse(read('outputs/verification-results.json'));
  if (record.auditId !== auditId) fail(`outputs/verification-results.json carries audit ID ${record.auditId}, src/pins.ts declares ${auditId}.`);
  const scored = Array.isArray(record.steps) ? record.steps.length : NaN;
  const quotedUnits = [...manifestMd.matchAll(/\*\*(\d+) passing\*\*/g), ...readme.matchAll(/Run the (\d+) unit tests/g)].map(m => Number(m[1]));
  if (quotedUnits.length === 0 || quotedUnits.some(n => n !== unitCount)) fail(`unit-spec count quoted in MANIFEST.md/README.md (${quotedUnits.join(', ') || 'none'}) != EXPECTED_UNIT_TESTS ${unitCount}.`);
  const quotedSteps = [...manifestMd.matchAll(/\*\*Scored steps:\*\* (\d+)/g), ...manifestMd.matchAll(/\((\d+)\/(\d+) scored steps/g), ...readme.matchAll(/(?:All|\d+ of) (\d+) scored checks passed/g)]
    .flatMap(m => m.slice(1).map(Number));
  if (quotedSteps.length === 0 || quotedSteps.some(n => n !== scored)) fail(`scored-step count quoted in MANIFEST.md/README.md (${quotedSteps.join(', ') || 'none'}) != ${scored} steps in outputs/verification-results.json.`);
  console.log(`[standalone] Audit ID ${auditId}, ${unitCount} unit specs and ${scored} scored steps: MANIFEST.md, README.md and outputs/verification-results.json agree with src/pins.ts.`);

  // EVERY SHIPPED CHAPTER, NOT TWO FILES (QA 2026-10-02, A12). Until this date the parity check above
  // read only MANIFEST.md and README.md, and stale counts survived in the other chapters (21 checks
  // where there are 22, 45 unit tests where there are 48, 59 forgeries where there were 60). Every
  // *.md at the package root is now scanned for the phrasings below, which state a CURRENT count;
  // each match must equal the number read from the thing it counts. Dated history keeps other
  // phrasings ("21/21 Full Pass" on a named date) and is not matched.
  const forgeriesTs = read('tests/forgeries.ts');
  const fStart = forgeriesTs.indexOf('const FORGERIES'), fEnd = forgeriesTs.indexOf('const SURVIVORS');
  const forgeryCount = fStart >= 0 && fEnd > fStart ? [...forgeriesTs.slice(fStart, fEnd).matchAll(/^\s+id: '([A-Z]\d+)'/gm)].length : NaN;
  const mutationCount = JSON.parse(read('tests/mutations.json')).length;
  const dlIds = [...manifestMd.matchAll(/\*\*DL-(\d+)\*\*/g)].map(m => Number(m[1]));
  const dlCount = dlIds.length ? Math.max(...dlIds) : NaN;
  const WORDS = { thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18 };
  const facts = [
    { what: 'unit specs', expected: unitCount, from: 'src/pins.ts EXPECTED_UNIT_TESTS',
      res: [/\b(\d+) (?:bundled |source )?unit (?:tests|specs)\b/gi, /\*\*(\d+) passing\*\*/g, /\*\*(\d+) passed\*\*/g] },
    { what: 'scored steps', expected: scored, from: 'outputs/verification-results.json steps',
      res: [/\b(\d+) scored (?:verification )?(?:steps|checks)\b/gi, /\b(?:All|\d+ of) (\d+) scored (?:verification )?(?:steps|checks)\b/gi, /\b(\d+)-step (?:verification|dataset verification|result)\b/gi, /\b(\d+)-check verdict\b/gi, /\bthe (\d+) scored steps\b/gi] },
    { what: 'declared source mutations', expected: mutationCount, from: 'tests/mutations.json',
      res: [/\b(\d+) declared source mutations\b/g, /\b(\d+) must-fail source mutations\b/g, /`tests\/mutations\.json` \((\d+)/g, /\| `tests\/mutations\.json` \| (\d+) \|/g, /each of the (\d+) falsifiability mutations/g] },
    { what: 'forged-evidence cases', expected: forgeryCount, from: 'tests/forgeries.ts FORGERIES',
      res: [/\b(\d+) forged datasets\b/g, /`tests\/forgeries\.ts` \((\d+)/g, /\| `tests\/forgeries\.ts`, `FORGERIES` \| (\d+) \|/g, /\b(\d+)-entry forgery battery\b/g, /\b(\d+) hand-built datasets\b/g] },
    { what: 'declared limitations', expected: dlCount, from: 'MANIFEST.md DL rows',
      res: [/\b(\w+) residuals are declared\b/gi] },
  ];
  if (!Number.isInteger(forgeryCount)) fail('tests/forgeries.ts: could not count the FORGERIES entries.');
  if (!Number.isInteger(dlCount)) fail('MANIFEST.md: no **DL-n** rows found.');
  const mismatches = [];
  const mdFiles = fs.readdirSync(root).filter(f => f.endsWith('.md')).sort();
  for (const f of mdFiles) {
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      for (const fact of facts) {
        for (const re of fact.res) {
          for (const m of line.matchAll(re)) {
            const raw = m[1];
            const n = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw.toLowerCase()];
            if (n === undefined) continue;
            if (n !== fact.expected) mismatches.push(`${f}:${i + 1}: "${m[0]}" — ${fact.what} is ${fact.expected} (${fact.from})`);
          }
        }
      }
    });
  }
  if (mismatches.length) fail(`${mismatches.length} stale count(s) in the shipped chapters:\n  ${mismatches.join('\n  ')}`);
  console.log(`[standalone] ${mdFiles.length} chapters scanned: ${unitCount} unit specs, ${scored} scored steps, ${mutationCount} declared source mutations, ${forgeryCount} forgeries and ${dlCount} declared limitations quoted consistently.`);
} catch (error) {
  fail(error.message);
}
