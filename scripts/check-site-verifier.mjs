#!/usr/bin/env node
/**
 * Compare a ProvablyFair.org site checkout's Mines verifier with the bytes this package pins.
 *
 *   node scripts/check-site-verifier.mjs <path-to-site>/src/components/VerifyBets/games/mines/derive.js
 *
 * Hashes the given derive.js and the library file it imports (../../lib/hmac-sha256.js, resolved
 * from the derive.js path), and compares both with src/pins.ts SITE_VERIFIER_PINS — the digests
 * Step 5 asserts on the vendored copies in verifier-parity/. It also re-hashes those vendored
 * copies. Exit 0 only if every file matches its pin; exit 1 on any mismatch or missing file, and
 * exit 2 on a usage error. Dependency-free: reads the pins out of src/pins.ts as text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/check-site-verifier.mjs <path-to-site>/src/components/VerifyBets/games/mines/derive.js');
  process.exit(2);
}
const pinsSrc = fs.readFileSync(path.join(root, 'src/pins.ts'), 'utf8');
const block = /SITE_VERIFIER_PINS[^=]*=\s*\[([\s\S]*?)\];/.exec(pinsSrc);
const pins = block
  ? [...block[1].matchAll(/file:\s*'([^']+)'[\s\S]*?sha256:\s*'([0-9a-f]{64})'/g)].map(m => ({ file: m[1], sha256: m[2] }))
  : [];
if (pins.length !== 2) {
  console.error(`[site-verifier] FAIL: could not read two SITE_VERIFIER_PINS entries from src/pins.ts (found ${pins.length})`);
  process.exit(1);
}
const deriveAbs = path.resolve(arg);
const siteRoot = path.resolve(path.dirname(deriveAbs), '../..'); // .../VerifyBets
const sha = p => (fs.existsSync(p) ? createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'ABSENT');
let bad = 0;
for (const pin of pins) {
  const live = pin.file === 'games/mines/derive.js' ? deriveAbs : path.join(siteRoot, pin.file);
  const vendored = path.join(root, 'verifier-parity', pin.file);
  for (const [label, p] of [['site', live], ['vendored', vendored]]) {
    const got = sha(p);
    const ok = got === pin.sha256;
    if (!ok) bad++;
    console.log(`[site-verifier] ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(8)} ${pin.file}  ${got}${ok ? '' : `  (pinned ${pin.sha256})`}  ${p}`);
  }
}
if (bad) {
  console.error(`[site-verifier] FAIL: ${bad} file(s) differ from src/pins.ts SITE_VERIFIER_PINS. If the site changed on purpose, re-vendor it into verifier-parity/, re-pin, and re-run npm run verify (Step 5 runs the vendored copy on every captured round).`);
  process.exit(1);
}
console.log('[site-verifier] site derive.js + lib/hmac-sha256.js match the pinned digests and the vendored copies.');
