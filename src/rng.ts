import { createHmac, createHash } from 'node:crypto';
// The board size has ONE definition — src/config.ts GRID. Until 2026-09-09 this module carried
// its own literal 25 in three places, so `GRID` and the shuffle were two independent constants
// describing the same board: mutating GRID to 26 left every layout recomputation unchanged and
// Step 5 still passed. That is the producer/verifier constant-split class (framework F10 /
// check-constants.sh) and it is closed by importing rather than re-typing.
import { GRID } from './config';

/** Commitment hash: hashedServerSeed = SHA-256( utf8_bytes( serverSeed_hex_string ) ). Stake convention. */
export function commitHash(serverSeedHexString: string): string {
  return createHash('sha256').update(serverSeedHexString, 'utf8').digest('hex');
}

/** Raw SHA-256 of a buffer — dataset integrity guard. */
export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function getProvablyFairHmacSalt(clientSeed: string, nonce: number, cursor: number): string {
  return `${clientSeed}:${nonce}:${cursor}`;
}

/** Bias-free uniform integer in [0, range). Matches the operator's fastGames helper. */
export function generateProvablyFairNumber(
  serverSeed: string, clientSeed: string, nonce: number, cursor: number, range: number,
): number {
  const key = Buffer.from(serverSeed, 'hex');
  const digest = createHmac('sha256', key).update(getProvablyFairHmacSalt(clientSeed, nonce, cursor)).digest();
  const maxFair = Math.floor(0x1_0000_0000 / range) * range;
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const chunk = digest.readUInt32BE(offset);
    if (chunk < maxFair) return chunk % range;
  }
  return generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor + 1_000_000, range);
}

/**
 * Mines placement — sequential Fisher-Yates over 25 tiles (1..25). cursor = currentMine
 * (0-indexed), range shrinks 25 → 1. The first `mineCount` are the mines, in draw order.
 * Validated against real captured mines bets.
 */
export function revealMines(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[] {
  const mines = Array.from({ length: GRID }, (_, i) => i + 1);
  for (let currentMine = 0; currentMine < mines.length; currentMine++) {
    const range = mines.length - currentMine;
    const randomMine = currentMine + generateProvablyFairNumber(serverSeed, clientSeed, nonce, currentMine, range);
    [mines[currentMine], mines[randomMine]] = [mines[randomMine], mines[currentMine]];
  }
  return mines.slice(0, mineCount);
}

/**
 * FIRST drawn mine tile only — the single value the Pass-2 cherry-pick statistic and the
 * Pass-1 serial statistic are computed from.
 *
 * This is not a shortcut with its own assumptions: it is `revealMines(...)[0]` by
 * construction. The shuffle starts from the identity array [1..25]; the first iteration
 * (currentMine = 0, range = 25) draws randomMine = generateProvablyFairNumber(..., 0, 25)
 * and swaps positions 0 and randomMine, so mines[0] === randomMine + 1 — one HMAC instead
 * of the 25 a full layout costs, and independent of mineCount. Equality with
 * revealMines(...)[0] is asserted in tests/mines/rngTests.ts, not merely reasoned about.
 *
 * It exists so tests/steps/simulation.ts can RE-DERIVE the simulation artifact's Pass-2
 * chi² statistics from the dataset's own revealed seeds inside a normal `npm run verify`
 * (~1.9 s for 138 seeds × 10,000 nonces) instead of trusting numbers the artifact supplies
 * about itself (G-BIND item 3).
 */
export function firstMineTile(serverSeed: string, clientSeed: string, nonce: number): number {
  return 1 + generateProvablyFairNumber(serverSeed, clientSeed, nonce, 0, GRID);
}

/**
 * MODULO-BIAS REJECTION CENSUS — how many times the `maxFair` branch was actually TAKEN while
 * drawing one round's shuffle, and how many draws were made.
 *
 * Why this exists (QA 2026-09-09, reviewer item P1). Five places in the report stated the
 * rejection branch as observed operator behaviour ("rejects any chunk at or above maxFair … so
 * every tile is exactly equally likely"). It is ASSUMED — read out of the client bundle, never
 * witnessed — and the capture cannot witness it, because the branch is only reached when a 4-byte
 * chunk lands in [maxFair, 2³²). The report already said "0 of 172,500 draws rejected", but no
 * step in this repo EMITTED that count: it was a number a person had computed. G-PRODUCING says a
 * cited number must come from a committed pipeline step, so it comes from here now.
 *
 * `rejections` counts DRAWS whose first chunk was rejected (the branch taken at least once), not
 * chunks. `draws` is GRID per round — the shuffle runs every position, ranges 25 down to 1.
 */
export function moduloRejectionCensus(
  serverSeed: string, clientSeed: string, nonce: number,
): { draws: number; rejections: number } {
  const key = Buffer.from(serverSeed, 'hex');
  let draws = 0, rejections = 0;
  for (let cursor = 0; cursor < GRID; cursor++) {
    const range = GRID - cursor;
    const maxFair = Math.floor(0x1_0000_0000 / range) * range;
    const digest = createHmac('sha256', key).update(getProvablyFairHmacSalt(clientSeed, nonce, cursor)).digest();
    draws++;
    if (digest.readUInt32BE(0) >= maxFair) rejections++;
  }
  return { draws, rejections };
}

/**
 * EXPECTED number of rejection events over `rounds` full 25-tile shuffles, under a uniform digest.
 * P(first chunk >= maxFair) = (2³² mod range)/2³², summed over the ranges 25..1 the shuffle uses.
 * Pure arithmetic from GRID — no data, no measurement — so the observed census above has a
 * theoretical number to be compared against rather than an assertion that zero is unsurprising.
 */
export function expectedModuloRejections(rounds: number): number {
  const TWO32 = 2 ** 32;
  let perRound = 0;
  for (let range = 1; range <= GRID; range++) perRound += (TWO32 % range) / TWO32;
  return perRound * rounds;
}

/**
 * Versioned, domain-separated seed derivation for reproducible simulations.
 *
 * seed_i = first 16 bytes of HMAC-SHA256(masterSeed, "<version>:<domain>:<index>").
 * The master seed is decoded from hex; the message is UTF-8. Distinct domain strings
 * separate Pass-1 server/client seeds and each mine count's Pass-2 bootstrap streams.
 * A full new simulation derives both passes from its master seed. The published Pass-1
 * rows instead retain their own replay seed pairs; the published master seed is scoped
 * to Pass 2 in outputs/simulation-provenance.json.
 */
export const SEED_DERIVATION_VERSION = 'mines-seed-derivation-v1';

/** True iff `s` is a syntactically usable master seed (>= 16 bytes of lowercase hex). */
export function isMasterSeed(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{32,128}$/.test(s) && s.length % 2 === 0;
}

export function deriveSeedHex(masterSeedHex: string, domain: string, index: number, bytes = 16): string {
  const key = Buffer.from(masterSeedHex, 'hex');
  const msg = `${SEED_DERIVATION_VERSION}:${domain}:${index}`;
  return createHmac('sha256', key).update(msg, 'utf8').digest().subarray(0, bytes).toString('hex');
}

/** Order-sensitive array equality (mine tiles are returned in draw order). */
export function sameMines(a: number[], b: number[]): boolean {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}
