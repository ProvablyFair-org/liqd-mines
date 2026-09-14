// Types mirror the exact capture schema in data/mines-master-6900bets.json
// (liqd-mines-capture-v1). Field names match the dataset verbatim.

export interface Seed {
  epoch: number;
  phase: string;                    // A | B | C | D | E
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
  epoch: number;
  phase: string;                    // A | B | C | D | E
  id: string;
  mineCount: number;                // 1..24
  reveals: number;                  // tiles PLANNED for this bet (1, or 5 for Phase E) — NOT the
                                    // number opened. 146 Phase-E busts carry reveals=5 with fewer
                                    // openTiles because the round ended on a mine. Every payout
                                    // check uses openTiles.length; `reveals` is only ever a plan.
  openTiles: number[];              // 1-indexed tiles opened, in order
  mineTiles: number[];              // 1-indexed mine positions, draw order
  nonce: number;
  clientSeed: string;
  serverSeedId: string;
  hashedServerSeed: string;
  betAmount: number | string;       // number on wins, decimal string on losses — coerce with Number()
  winningAmount: number;
  multiplier?: number;              // present on wins; absent/undefined on losses (pays 0)
  result: string;                   // won | lost
  // capture-side self-verification (informational; verify re-derives independently)
  localMines?: number[] | null;
  verified?: boolean | null;
}

export interface Dataset {
  meta: {
    audit: string; platform: string; gameId: string; schema: string;
    houseEdge: number; currency: string; epochSize: number; plannedTotal: number;
    phases: Record<string, { bets: number; amount: number; reveals?: number }>;
    startedAt: string | null; finishedAt: string | null;
    progress?: Record<string, unknown>;
    preCapture?: Record<string, unknown> | null;
  };
  seeds: Seed[];
  bets: Bet[];
}

export type Severity = 'HARD_FAIL' | 'FLAG' | 'INFO' | 'PASS';
export interface StepResult { step: number; name: string; status: 'PASS' | 'FLAG' | 'FAIL'; detail: string; }
export interface InfoItem { label: string; detail: string; }
