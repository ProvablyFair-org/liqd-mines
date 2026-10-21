/**
 * PROVENANCE (header added on integration, 20 Oct 2026; everything below this comment is the
 * clean-room module byte for byte).
 *
 * This module was REBUILT FROM A WRITTEN SPECIFICATION, not ported from LIQD's code:
 *   spec      docs/ALGORITHM.md, a copy of games/liqd-mines/ALGORITHM.md in the ProvablyFair.org
 *             audit framework (SHA-256 3576d1ea…baf2231). Written from LIQD's public pages and screens
 *             (evidence E10-E14, E21, rtp-page-labels-2026-10-01.json), the standard provably-fair
 *             construction and the 8,900 live rounds in data/, without opening LIQD's code, its client
 *             bundle or any port of it (its §8 lists every file read).
 *   rebuild   written by an implementer who read ONLY that spec and a module-interface file (export
 *             names and types), and never opened LIQD's code, its client bundle, or this package's
 *             earlier src/rng.ts.
 *   self-test tests/mines/rngSpecTests.ts (the spec's vectors V1-V6 and properties).
 *
 * LIQD's code is NOT the source of this module. It is run as a SECOND CHECK: the validation vectors
 * from the byte-level RNG specification LIQD supplied privately (tests/mines/rngTests.ts; the Mines
 * vector is LIQD's verify-endpoint result as that specification records it). The ProvablyFair.org
 * site verifier is a third check (Step 5, vendored in verifier-parity/). The audit's draw-bias bound
 * is src/bias.ts, built on this module's maxFairFor; the simulation's seed derivation is
 * src/seed-derivation.ts. Neither is part of the RNG.
 *
 * Three-way agreement measured on integration (20 Oct 2026, every round in data/: 8,900 rounds in
 * three captures, seeds paired to rounds by hashing, 178/178 commitments): this module vs the live
 * rounds, mineTiles in recorded order 8,900/8,900 and commitments 178/178 seed records; vs LIQD's
 * code, the validation vectors 3/3, and LIQD's mine-placement code as given in its private
 * specification (run outside this package, not quoted) 8,900/8,900; vs the ProvablyFair.org site
 * verifier (vendored, hash-pinned) 8,900/8,900. Step 5 of `npm run verify` re-measures the first and
 * the third on the 6,900 audited rounds on every run.
 *
 * Where this module and LIQD's code differ on inputs no captured round reaches: when all eight
 * chunks of a digest are rejected (spec O1, continuation unspecified; probability below 1e-66 per
 * draw) this module throws, LIQD's code redraws at cursor + 1,000,000; and this module throws on a
 * mine count outside 1..24, a server seed that is not even-length hex, and a nonce or cursor that is
 * not a non-negative safe integer, where LIQD's code returns a value. No captured round is affected.
 */
// LIQD Mines layout derivation, written from ALGORITHM.md alone (clean room).
// Section references (§) point into that spec.

import { createHash, createHmac } from 'crypto';

/** Number of tiles on the board, numbered 1..25 (§1.1). */
export const GRID: number = 25;

/** 2^32, the size of the space a 4-byte chunk can take (§2 step 2). */
const TWO_POW_32 = 4294967296;

/** Bytes per chunk and chunks per HMAC-SHA256 digest (§2 step 2: offsets 0, 4, ..., 28). */
const CHUNK_BYTES = 4;
const CHUNKS_PER_DIGEST = 8;

function assertNonNegativeInt(name: string, v: number): void {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, got ${v}`);
  }
}

function assertRange(range: number): void {
  if (!Number.isSafeInteger(range) || range < 1 || range > TWO_POW_32) {
    throw new RangeError(`range must be an integer in 1..2^32, got ${range}`);
  }
}

/**
 * Decode the server seed to the HMAC key. §2 step 1: the key is the hex-decoded
 * bytes of the seed (16 bytes for the 32-character seeds of §1.1). Buffer.from
 * silently drops bad hex, so the string is checked first.
 */
function serverSeedKey(serverSeed: string): Buffer {
  if (serverSeed.length === 0 || serverSeed.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(serverSeed)) {
    throw new TypeError('serverSeed must be a non-empty, even-length hex string');
  }
  return Buffer.from(serverSeed, 'hex');
}

/** SHA-256 of a byte buffer, lowercase hex. */
export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * §1.2: the published commitment is SHA-256 over the seed's characters as
 * UTF-8 text (the ASCII string itself), not over the bytes the hex encodes.
 * Output is lowercase hex.
 */
export function commitHash(serverSeedHexString: string): string {
  return sha256Buffer(Buffer.from(serverSeedHexString, 'utf8'));
}

/**
 * §2 step 1: the HMAC message is clientSeed, ':', nonce in plain base 10,
 * ':', cursor in plain base 10.
 */
export function getProvablyFairHmacSalt(clientSeed: string, nonce: number, cursor: number): string {
  assertNonNegativeInt('nonce', nonce);
  assertNonNegativeInt('cursor', cursor);
  return `${clientSeed}:${nonce.toString(10)}:${cursor.toString(10)}`;
}

/**
 * §2 step 2: LIMIT = floor(2^32 / r) * r. A chunk value v is accepted iff v < LIMIT.
 */
export function maxFairFor(range: number): number {
  assertRange(range);
  return Math.floor(TWO_POW_32 / range) * range;
}

/** §2 step 1: the digest for one draw, keyed by the decoded server seed. */
function drawDigest(serverSeed: string, clientSeed: string, nonce: number, cursor: number): Buffer {
  const msg = getProvablyFairHmacSalt(clientSeed, nonce, cursor);
  return createHmac('sha256', serverSeedKey(serverSeed)).update(Buffer.from(msg, 'utf8')).digest();
}

/**
 * Walk the eight big-endian 32-bit chunks of one draw's digest (§2 step 2).
 * Returns the accepted value mod range and whether the first chunk was rejected.
 */
function drawDetail(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
  range: number,
): { value: number; firstRejected: boolean } {
  const limit = maxFairFor(range);
  const digest = drawDigest(serverSeed, clientSeed, nonce, cursor);
  for (let c = 0; c < CHUNKS_PER_DIGEST; c++) {
    const v = digest.readUInt32BE(c * CHUNK_BYTES);
    if (v < limit) {
      return { value: v % range, firstRejected: c !== 0 };
    }
  }
  // §2 step 2 / O1: the spec gives no rule for all eight chunks rejected; the
  // interface asks for a throw.
  throw new Error(
    `no accepted chunk in digest for nonce ${nonce}, cursor ${cursor}, range ${range}`,
  );
}

/**
 * One draw in [0, range): HMAC per §2 step 1 with cursor as the draw index,
 * then the rejection loop of §2 step 2.
 */
export function generateProvablyFairNumber(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
  range: number,
): number {
  return drawDetail(serverSeed, clientSeed, nonce, cursor, range).value;
}

/**
 * §2 step 3: forward Fisher-Yates over [1..25]. Step i draws an offset in
 * [0, 25 - i) with cursor i and swaps a[i] with a[i + offset]. Per the
 * interface the shuffle runs all 25 steps (ranges 25 down to 1); §2 step 3
 * notes the extra steps cannot change a[0..m-1]. Mines are a[0..m-1] in that
 * order, which is the order the casino records.
 */
export function revealMines(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[] {
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > GRID - 1) {
    throw new RangeError(`mineCount must be an integer in 1..${GRID - 1}, got ${mineCount}`);
  }
  const a: number[] = [];
  for (let t = 1; t <= GRID; t++) a.push(t);
  for (let i = 0; i < GRID; i++) {
    const r = GRID - i;
    const j = i + generateProvablyFairNumber(serverSeed, clientSeed, nonce, i, r);
    const tmp = a[i] as number;
    a[i] = a[j] as number;
    a[j] = tmp;
  }
  return a.slice(0, mineCount);
}

/**
 * The first mine placed (§2 step 3, i = 0): one draw over 25 with cursor 0;
 * the tile is the value at position offset in [1..25], i.e. 1 + offset.
 */
export function firstMineTile(serverSeed: string, clientSeed: string, nonce: number): number {
  return 1 + generateProvablyFairNumber(serverSeed, clientSeed, nonce, 0, GRID);
}

/**
 * Over the full 25-step shuffle (ranges 25..1, cursors 0..24), count how many
 * draws had their first chunk rejected by the §2 step 2 limit (O1).
 */
export function moduloRejectionCensus(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): { draws: number; rejections: number } {
  let rejections = 0;
  for (let i = 0; i < GRID; i++) {
    if (drawDetail(serverSeed, clientSeed, nonce, i, GRID - i).firstRejected) rejections++;
  }
  return { draws: GRID, rejections };
}

/**
 * Expected count of draws whose first chunk is rejected, over `rounds` full
 * shuffles. For range r a chunk is rejected with probability (2^32 mod r) / 2^32
 * (§2 step 2). The numerator sum is an exact small integer; multiplying by an
 * integer round count and dividing by a power of two is exact in a double while
 * rounds * sum stays below 2^53.
 */
export function expectedModuloRejections(rounds: number): number {
  if (!Number.isFinite(rounds) || rounds < 0) {
    throw new RangeError(`rounds must be a finite non-negative number, got ${rounds}`);
  }
  const big32 = 1n << 32n;
  let sum = 0n;
  for (let r = GRID; r >= 1; r--) sum += big32 % BigInt(r);
  return (rounds * Number(sum)) / TWO_POW_32;
}

/** Same tiles in the same order (§2 step 3: order is part of the result). */
export function sameMines(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
