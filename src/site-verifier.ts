/**
 * Loader for the vendored ProvablyFair.org site verifier (MINES-24, player-verifier parity).
 *
 * The site's VerifyBets component ships `games/mines/derive.js` as an ES module that imports
 * `hmacSha256Hex` and `hexToBytes` from `../../lib/hmac-sha256` (no extension — a bundler
 * import). This package runs those exact bytes without a bundler and without npm install:
 *
 *   1. read each vendored file's bytes and hash them against src/pins.ts SITE_VERIFIER_PINS;
 *   2. strip ONLY the ES-module syntax — the `export ` keyword at the start of a declaration
 *      line, and derive.js's one import line, which must match IMPORT_LINE exactly — so any
 *      other change to the file's module surface is a load error rather than a silent rewrite;
 *   3. evaluate the result in a fresh node:vm context whose only injected names are the two
 *      imported functions (and TextEncoder, which derive.js reads for non-hex seeds).
 *
 * The digests are taken over the UNMODIFIED bytes, so the code that runs is the pinned code
 * minus module keywords. Nothing here compares layouts; Step 5 does that.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { createHash } from 'crypto';
import { SITE_VERIFIER_PINS, SITE_VERIFIER_DIR } from './pins';

export const IMPORT_LINE = "import { hmacSha256Hex, hexToBytes } from '../../lib/hmac-sha256';";

export interface SiteVerifier {
  deriveMines: (p: { clientSeed: string; serverSeed: string; nonce: number; mineCount: number }) => { minePositions: number[] };
  displayCents: (mineCount: number, reveals: number) => bigint;
}

export interface SiteVerifierLoad {
  files: Array<{ file: string; sha256: string; pinned: string; ok: boolean }>;
  hashesOk: boolean;
  verifier: SiteVerifier | null;
  error: string | null;
}

function stripExports(src: string, label: string): string {
  const out = src.replace(/^export (function|const|let|class) /gm, '$1 ');
  if (/^\s*export\b/m.test(out)) throw new Error(`${label}: an export form other than "export function/const" remains`);
  return out;
}

export function loadSiteVerifier(packageRoot: string): SiteVerifierLoad {
  const dir = path.join(packageRoot, SITE_VERIFIER_DIR);
  const bytes = new Map<string, Buffer>();
  const files = SITE_VERIFIER_PINS.map(p => {
    const fp = path.join(dir, p.file);
    const buf = fs.existsSync(fp) ? fs.readFileSync(fp) : null;
    if (buf) bytes.set(p.file, buf);
    const sha256 = buf ? createHash('sha256').update(buf).digest('hex') : 'ABSENT';
    return { file: p.file, sha256, pinned: p.sha256, ok: sha256 === p.sha256 };
  });
  const hashesOk = files.length > 0 && files.every(f => f.ok);
  if (!hashesOk) return { files, hashesOk, verifier: null, error: 'vendored bytes do not match the pinned digests' };
  try {
    let lib = stripExports(bytes.get('lib/hmac-sha256.js')!.toString('utf8'), 'lib/hmac-sha256.js');
    if (/^\s*import\b/m.test(lib)) throw new Error('lib/hmac-sha256.js: unexpected import');
    const libExports = vm.runInNewContext(`${lib}\n;({ hmacSha256Hex, hexToBytes });`, {}, { filename: 'lib/hmac-sha256.js' });
    let derive = bytes.get('games/mines/derive.js')!.toString('utf8');
    const lines = derive.split('\n');
    const imports = lines.filter(l => /^\s*import\b/.test(l));
    if (imports.length !== 1 || imports[0] !== IMPORT_LINE)
      throw new Error(`games/mines/derive.js: expected exactly one import line "${IMPORT_LINE}", found ${JSON.stringify(imports)}`);
    derive = stripExports(lines.filter(l => l !== IMPORT_LINE).join('\n'), 'games/mines/derive.js');
    const verifier = vm.runInNewContext(`${derive}\n;({ deriveMines, displayCents });`, {
      hmacSha256Hex: libExports.hmacSha256Hex, hexToBytes: libExports.hexToBytes, TextEncoder,
    }, { filename: 'games/mines/derive.js' }) as SiteVerifier;
    if (typeof verifier.deriveMines !== 'function' || typeof verifier.displayCents !== 'function')
      throw new Error('games/mines/derive.js: deriveMines/displayCents not defined');
    return { files, hashesOk, verifier, error: null };
  } catch (e) {
    return { files, hashesOk, verifier: null, error: (e as Error).message };
  }
}
