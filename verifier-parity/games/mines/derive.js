import { hmacSha256Hex, hexToBytes } from '../../lib/hmac-sha256';

/**
 * Mines RNG — port of LIQD's HMAC-SHA256 + Fisher-Yates shuffle algorithm.
 *
 * Source of truth (audit repo):
 *   https://github.com/ProvablyFair-org/liqd-mines/blob/main/src/rng.ts
 *
 * Algorithm (sequential / upward Fisher-Yates — NOT the downward variant
 * some other operators use):
 *
 *   tiles = [1, 2, ..., 25]                      // 1-indexed tile values
 *   for currentMine from 0 to 24:
 *     range   = 25 - currentMine
 *     maxFair = floor(2^32 / range) * range      // rejection ceiling (2^32 base)
 *     cursor  = currentMine                      // cursor == loop index
 *     loop:
 *       hash = HMAC-SHA256(hexBytes(serverSeed), `${clientSeed}:${nonce}:${cursor}`)
 *       scan up to eight 4-byte big-endian chunks of hash:
 *         if chunk < maxFair → j = currentMine + (chunk % range);
 *                              swap tiles[currentMine] ↔ tiles[j]; break
 *       if all 8 chunks rejected → cursor += 1_000_000 and retry
 *                                  (a ~1-in-10^67 event; never observed)
 *   minePositions = tiles[0..mineCount-1]        // 1-indexed, in DRAW ORDER
 *
 * Draw order matters: LIQD records `mineTiles` in the order the shuffle drew
 * them, and the audit verifies the array with an ordered comparison — so this
 * verifier reports them the same way, unsorted.
 *
 * Multiplier formula (no paytable; pure combinatorics):
 *
 *   exact   = C(25, k) / C(25 - m, k) × 0.99     ← what LIQD actually credits
 *   display = floor(exact × 100) / 100           ← what the on-screen field shows
 *             (computed in exact integer arithmetic — flooring the float product
 *              understates a handful of deep cells by 0.01)
 *
 * Convention note: LIQD credits the EXACT value to the balance at full
 * precision; the `multiplier` field in the bet record / UI is the same value
 * floored to 2 decimals — cosmetic, and it can only understate the credit.
 * (The pre-remediation build credited the floored value — raised as finding
 * F1 during this audit and fixed by LIQD before this dataset was captured;
 * see the Mines report S4.2 and Section 5.)
 * This verifier reports the exact credited figure.
 *
 * Verified against all 6,900 captured mines bets in the audit dataset:
 *   - mine layouts (ordered): 6,900 / 6,900
 *   - credited multipliers (over 3,104 winning bets, 2e-8): 3,104 / 3,104
 */

const GRID_SIZE = 25;
const TWO_32 = 0x100000000;
const HOUSE_EDGE_FACTOR = 0.99;

/**
 * Derive a single Mines bet outcome.
 *
 * Note: Mines doesn't take "picks" the way Keno does — the user's gameplay
 * (which tiles they click, when they cash out) isn't part of the seed
 * derivation. The verifier proves the mine layout is what the casino said
 * it was; how the user played that layout is independent.
 *
 * @param {Object} p
 * @param {string} p.clientSeed
 * @param {string} p.serverSeed
 * @param {number} p.nonce
 * @param {number} p.mineCount     1..24
 *
 * @returns {{
 *   minePositions: number[],       // 1-indexed tile values, in draw order
 *   safePositions: number[],       // the other 25 - mineCount tiles, ascending
 *   mineCount: number,
 *   firstHmac: string,
 *   cashoutCurve: Array<{reveals: number, multiplier: number, display: number}>
 *                                  // For each k = 1..(25 - mineCount): the
 *                                  // EXACT credited multiplier if the user
 *                                  // revealed k safe tiles and cashed out,
 *                                  // plus the floor2 value the UI displays.
 * }}
 */
export function deriveMines({ clientSeed, serverSeed, nonce, mineCount }) {
  const key = seedKey(serverSeed);
  const tiles = Array.from({ length: GRID_SIZE }, (_, i) => i + 1);
  let firstHmac = '';

  for (let currentMine = 0; currentMine < GRID_SIZE; currentMine++) {
    const range = GRID_SIZE - currentMine;
    const maxFair = Math.floor(TWO_32 / range) * range;
    let cursor = currentMine;

    while (true) {
      const message = `${clientSeed}:${nonce}:${cursor}`;
      const hmac = hmacSha256Hex(key, message);
      if (currentMine === 0 && firstHmac === '') firstHmac = hmac;

      let found = false;
      for (let off = 0; off + 8 <= hmac.length; off += 8) {
        const value = parseInt(hmac.substring(off, off + 8), 16);
        if (value < maxFair) {
          const j = currentMine + (value % range);
          [tiles[currentMine], tiles[j]] = [tiles[j], tiles[currentMine]];
          found = true;
          break;
        }
      }
      if (found) break;
      cursor += 1000000; // all 8 chunks rejected — fresh HMAC far away
    }
  }

  const minePositions = tiles.slice(0, mineCount); // draw order — do NOT sort
  const mineSet = new Set(minePositions);
  const safePositions = [];
  for (let t = 1; t <= GRID_SIZE; t++) {
    if (!mineSet.has(t)) safePositions.push(t);
  }

  // Cashout curve — exact + displayed multiplier for each possible reveal count
  const maxReveals = GRID_SIZE - mineCount;
  const cashoutCurve = [];
  for (let k = 1; k <= maxReveals; k++) {
    const exact = cashoutMultiplier(mineCount, k);
    cashoutCurve.push({
      reveals: k,
      multiplier: exact,
      display: displayMultiplier(mineCount, k),
    });
  }

  return {
    minePositions,
    safePositions,
    mineCount,
    firstHmac,
    cashoutCurve,
  };
}

/**
 * Exact credited multiplier for `reveals` safe-tile reveals at a given mine count.
 *
 *   raw    = C(25, reveals) / C(25 - mines, reveals)
 *   exact  = raw × 0.99                     ← credited to the balance
 *
 * Returns 0 if `reveals` exceeds the maximum possible safe count.
 */
export function cashoutMultiplier(mineCount, reveals) {
  if (reveals < 1) return 0;
  const safeTiles = GRID_SIZE - mineCount;
  if (reveals > safeTiles) return 0;
  return (combination(GRID_SIZE, reveals) / combination(safeTiles, reveals)) * HOUSE_EDGE_FACTOR;
}

/**
 * The floored 2-decimal value LIQD's UI shows for a given (mineCount, reveals).
 * Cosmetic only — the balance receives the exact figure.
 *
 * floor(100 × exact) is taken in exact integer arithmetic (BigInt), mirroring
 * src/config.ts minesMultiplierDisplayCents(): the exact multiplier is the rational
 * 99/100 × Π (25−i)/(25−m−i), and flooring its float evaluation understates a few
 * deep cells by one cent.
 */
export function displayMultiplier(mineCount, reveals) {
  return Number(displayCents(mineCount, reveals)) / 100;
}

export function displayCents(mineCount, reveals) {
  if (reveals < 1 || reveals > GRID_SIZE - mineCount) return 0n;
  let num = 99n, den = 100n;
  for (let i = 0; i < reveals; i++) {
    num *= BigInt(GRID_SIZE - i);
    den *= BigInt(GRID_SIZE - mineCount - i);
  }
  return (100n * num) / den;
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function seedKey(serverSeed) {
  if (isHex(serverSeed)) return hexToBytes(serverSeed);
  return utf8Bytes(serverSeed);
}

function isHex(s) {
  return typeof s === 'string' && s.length > 0 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s);
}

function utf8Bytes(s) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}

export const MINES_GRID_SIZE = GRID_SIZE;
export const MINES_MIN = 1;
export const MINES_MAX = 24;
