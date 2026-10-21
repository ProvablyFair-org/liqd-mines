# Module interface the audit package expects (written by the auditor, not from the casino)

Write `rng.ts` (TypeScript, strict, Node `crypto` only, no dependencies) exporting exactly these names.
Semantics come from ALGORITHM.md; this file only fixes names, types and the package's own conventions.
Tiles are numbered 1..25 as the spec numbers them. Where the spec leaves plain mod vs rejection open, implement what the spec says to implement.

```ts
export const GRID: number;     // 25
// The commitment the casino publishes for a server seed, lowercase hex (per the spec).
export function commitHash(serverSeedHexString: string): string;
// SHA-256 of a byte buffer, lowercase hex.
export function sha256Buffer(buf: Buffer): string;
// The HMAC message for (clientSeed, nonce, cursor), exactly as the spec builds it.
export function getProvablyFairHmacSalt(clientSeed: string, nonce: number, cursor: number): string;
// Exclusive upper end of the accepted 32-bit window for a draw over `range` outcomes.
export function maxFairFor(range: number): number;
// One accepted draw in [0, range) for (seeds, nonce, cursor) per the spec. Throw if none accepted.
export function generateProvablyFairNumber(serverSeed: string, clientSeed: string, nonce: number, cursor: number, range: number): number;
// The mine tiles (1..25) IN DRAW ORDER (the order the spec's shuffle yields them, = the order the casino records).
// The shuffle runs over every position (ranges 25 down to 1) regardless of mineCount.
export function revealMines(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[];
// The first drawn mine tile only (= revealMines(...)[0] for any mineCount >= 1), computed with the single first draw.
export function firstMineTile(serverSeed: string, clientSeed: string, nonce: number): number;
// Census over one round's full shuffle: draws = 25, rejections = number of DRAWS whose first chunk was rejected.
export function moduloRejectionCensus(serverSeed: string, clientSeed: string, nonce: number): { draws: number; rejections: number };
// Expected number of draws with a rejected first chunk over `rounds` rounds under the spec's rule (exact arithmetic over ranges 25..1).
export function expectedModuloRejections(rounds: number): number;
// Same tiles in the same order.
export function sameMines(a: number[], b: number[]): boolean;
```
Payout is NOT part of this module; implement only the above.
