import type { Bet, Seed } from '../../src/types';

export interface StepResult {
  step: number;
  name: string;
  /**
   * INFO: an informational deviation (profile policy INFORMATIONAL — the live-sample fit,
   * 2026-09-29): reported, never counted as a flag, never affects the verdict.
   * OVERSTATED: the step carrying MINES-19 when the enforced RTP-CLAIM rule (1.2.0) finds the published figure
   * overstated — not a draw FAIL, not counted in hardFail; verdict RTP FIGURE OVERSTATED, exit 5.
   */
  status: 'PASS' | 'FLAG' | 'FAIL' | 'INFO' | 'OVERSTATED';
  detail: string;
  /**
   * Set only on a FLAG whose cause is the AUDITOR'S capture (a declared capture-retry nonce gap),
   * not the operator. A capture-origin FLAG is disclosed on every run and is verdict-neutral: the
   * verdict stays Full Pass and the exit status 0. Only an operator-origin FLAG downgrades to
   * Conditional Pass (policy decided 2026-09-17).
   */
  origin?: 'capture';
}

export interface InfoItem {
  label: string;
  detail: string;
}

export interface VerifyContext {
  bets: Bet[];
  seeds: Seed[];
  /** hashedServerSeed → revealed serverSeed (only for revealed epochs). */
  seedMap: Map<string, string>;
  /** hashedServerSeed → bets in that epoch. */
  byHash: Map<string, Bet[]>;
  /** Rounds by phase letter: A (5,950, of which 950 are the A+ top-up), C (124), D (500). */
  phaseA: Bet[];
  phaseC: Bet[];
  phaseD: Bet[];
  outputsDir: string;
  /** Recomputed SHA-256 of the loaded dataset file. */
  datasetSha256: string;
  /** The dataset hash pinned in verify.ts (the integrity anchor). */
  expectedDatasetHash: string;
  /** Declared phase config (bets/amount/reveals) — for stake/label parity steps. */
  meta: import('../../src/types').Dataset['meta'];
  /**
   * Populated by the simulation step when it reads outputs/simulation-results.json:
   * the ACTUAL sha256 of the scored artifact (the pin itself lives in src/pins.ts ARTIFACT_PINS
   * and is asserted by Step 19). Recorded under verification-results.json → artifactHashes.simulation. Null when the sim
   * artifact was absent (steps 16–17 FLAG).
   */
  simArtifact?: { file: string; sha256: string } | null;
  /** The raw production captures (src/prod-capture.ts), pinned; `problem` set when one did not load. */
  prodCapture: import('../../src/prod-capture').ProdCapture;
}

export function step(
  num: number,
  name: string,
  status: 'PASS' | 'FLAG' | 'FAIL' | 'INFO',
  detail: string,
  origin?: 'capture',
): StepResult {
  const tag = status === 'PASS' ? '[PASS]' : status === 'INFO' ? '[INFO]' : status === 'FLAG' ? (origin === 'capture' ? '[FLAG:capture]' : '[FLAG]') : '[FAIL]';
  console.log(`  ${tag} Step ${num} — ${name}`);
  if (status !== 'PASS') console.log(`         ${detail}`);
  const r: StepResult = { step: num, name, status, detail };
  if (status === 'FLAG' && origin === 'capture') r.origin = 'capture';
  return r;
}
