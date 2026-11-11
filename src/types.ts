// Types mirror the dataset schema of data/mines-prod-full-6574bets.json (converted from the three raw
// production captures). Field names match verbatim.

export interface Seed {
  epoch: number;                    // dataset epoch, 0 … 35 across the captures
  capture: number;                  // 1-based index of the raw capture the epoch was played in
  captureEpoch: number;             // the epoch's number inside that capture
  phase: string;                    // A | C | D (the runner's phase letter)
  phaseId: string;                  // A | A+ | C | D (A+ = the phase A top-up)
  at: string;
  clientSeed: string;
  hashedServerSeed: string;         // SHA-256(utf8(serverSeed)) commitment
  nextHashedServerSeed: string;     // pre-commitment for next epoch (chain link)
  serverSeed: string | null;        // revealed on rotation
  nonceStart: number;
  nonceEnd: number | null;
  commitVerified: boolean | null;   // capture-side flag (re-derived independently in verify)
  chainLinkOk: boolean | null;
}

export interface Bet {
  at: string;
  epoch: number;                    // dataset epoch, 0 … 35
  capture: number;                  // 1-based index of the raw capture
  captureEpoch: number;             // the epoch's number inside that capture
  phase: string;                    // A | C | D
  phaseId: string;                  // A | A+ | C | D
  id: string;
  mineCount: number;                // 1..24
  reveals: number;                  // tiles PLANNED for this bet (1 … 15) — NOT the
                                    // number opened. A bust carries fewer openTiles because the round
                                    // ended on a mine. Every payout check uses openTiles.length;
                                    // `reveals` is only ever a plan.
  openTiles: number[];              // 1-indexed tiles opened, in order
  mineTiles: number[];              // 1-indexed mine positions, draw order
  nonce: number;
  clientSeed: string;
  serverSeedId: string;
  hashedServerSeed: string;
  betAmount: number | string;       // a number on every row (0.1 or 10), in fiatCurrency
  fiatCurrency: string;             // the fiat LIQD booked the round in: CAD (capture 1) or USD (captures 2, 3)
  winningAmount: number;            // the booked fiat amount, floored to cents (Step 8)
  multiplier?: number;              // present on wins; absent/undefined on losses (pays 0)
  result: string;                   // won | lost
  autoFinish?: boolean;             // true on a round LIQD settled by itself in the open-tile reply (its last safe tile)
  currentGameSettings?: string;     // the served settings JSON, where the settling reply carries it
  // capture-side self-verification (informational; verify re-derives independently)
  localMines?: number[] | null;
  verified?: boolean | null;
}

export interface PhaseMeta { bets: number; amount: number; currency: string; captures: number[]; currencies?: string[]; amounts?: number[] }
export interface CaptureMeta {
  capture: number; file: string; sha256: string; bytes: number; lines: number;
  epochs: { first: number; last: number; count: number; sizes: number[] };
  bets: number; fiatCurrency: string; stakes: number[];
  startedAt: string | null; finishedAt: string | null;
  preCapture: Record<string, unknown> | null;
  [k: string]: unknown;
}
export interface Dataset {
  meta: {
    audit: string; platform: string; gameId: string; schema: string;
    houseEdge: number; plannedTotal: number;
    phases: Record<string, PhaseMeta>;
    phaseIds: Record<string, PhaseMeta>;
    startedAt: string | null; finishedAt: string | null;
    progress?: Record<string, unknown>;
    captures: CaptureMeta[];
  };
  seeds: Seed[];
  bets: Bet[];
}

export type Severity = 'HARD_FAIL' | 'FLAG' | 'INFO' | 'PASS';
export interface StepResult { step: number; name: string; status: 'PASS' | 'FLAG' | 'FAIL' | 'INFO'; detail: string; }
export interface InfoItem { label: string; detail: string; }
