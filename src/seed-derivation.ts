/**
 * The simulation's seed derivation — OUR audit tooling, not LIQD's and not part of the RNG.
 *
 * Moved here unchanged from src/rng.ts on 20 Oct 2026, when src/rng.ts was replaced by the module
 * rebuilt from docs/ALGORITHM.md. The three exports below are byte-identical in behaviour to the
 * ones the committed simulation (outputs/simulation-results.json, outputs/simulation-provenance.json)
 * was generated with, so the pinned simulation does not move; the derivation's version string is
 * unchanged for the same reason.
 */
import { createHmac } from 'node:crypto';

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
