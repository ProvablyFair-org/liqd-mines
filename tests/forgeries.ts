/**
 * Forged-evidence battery (falsifiability, part 2) — run: npm run forgeries
 *
 * `npm run mutations` breaks the AUDITOR'S CODE and checks the suite notices. This file breaks
 * the AUDITOR'S EVIDENCE — the captured dataset, the simulation artifact and the derived-figure
 * artifact — and checks the same thing. They are different failure classes and neither substitutes for the other:
 * simulation artifacts built by hand can score "PROVABLY FAIR — Full Pass" against a verifier
 * whose every source mutation is caught, unless the evidence is bound to its source. Sound code
 * does not make the evidence binding sound.
 *
 * Every entry below is a counterexample that was executed against this repo, recorded here so
 * that a closed class stays closed. That is the point of a registry: not to prove the current build is sound,
 * but to stop the NEXT build from rediscovering a defect this one already paid for.
 *
 * MECHANICS. Each entry mutates a fresh throwaway copy of the repo (`src tests data outputs` +
 * config, `node_modules` symlinked). The working tree is never touched. Dataset mutations
 * additionally RE-PIN `src/pins.ts` to the mutated file's SHA-256, because otherwise every one
 * of them would abort in the loader and prove nothing about the steps below it — the loader
 * abort itself is entry D16, tested on its own terms. Each entry declares the verdict the
 * mutated run must print and the step that must change status; a run that flips the verdict
 * through some OTHER step is a MISS, because the guard that was supposed to fire did not.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const COPY = ['src', 'tests', 'data', 'outputs', 'verifier-parity', 'tsconfig.json', 'package.json', '.mocharc.yml', '.gitignore'];
const DATASET_REL = 'data/mines-prod-full-6574bets.json';
/** The raw captures, in src/pins.ts PROD_CAPTURES order. A `raw` forgery edits RAW_RELS[(f.raw ?? 1) − 1]. */
const RAW_RELS = [
  'data/liqd-mines-prod-capture-2026-11-09T04-45-17-843Z.ndjson',
  'data/liqd-mines-prod-capture-2026-11-10T06-06-19-772Z.ndjson',
  'data/liqd-mines-prod-capture-2026-11-10T10-27-49-259Z.ndjson',
];
const SIM_REL = 'outputs/simulation-results.json';
const FIG_REL = 'outputs/audit-figures.json';

type Target = 'dataset' | 'artifact' | 'figures' | 'raw' | 'none';
interface Forgery {
  id: string;
  name: string;
  origin: string;
  target: Target;
  /** For target 'raw': which capture (1-based, default 1). */
  raw?: number;
  /** Mutates the parsed JSON in place (or returns a replacement). `root` is the temp repo. */
  mutate: (doc: any, root: string) => any | void;
  /** Verdict line the mutated run must print. `null` = the run must abort with no verdict. */
  expect: string | null;
  /** The step that must change status (omitted when the run aborts before scoring). */
  step?: number;
  status?: 'FAIL' | 'FLAG';
  /**
   * How many consecutive `verify` runs to make; the LAST one is the one scored. Default 1.
   *
   * `runs: 2` exists for the self-heal class (A19). tests/verify.ts used to rewrite
   * outputs/audit-figures.json unconditionally at the end of the same run that hard-failed
   * Step 19, so a single-run battery would have called that forgery REJECTED while the tampering
   * silently disappeared and every run after the first read clean. Asserting on the SECOND run is
   * what makes the guard's persistence testable at all: the question is never "did it fail once",
   * it is "is the finding still there tomorrow".
   */
  runs?: number;
  /**
   * Artifact and figure forgeries RE-PIN every file in src/pins.ts ARTIFACT_PINS after mutating
   * (default true), for the same reason dataset forgeries re-pin the dataset: since 2026-09-24 every
   * artifact of record is SHA-256 pinned (MINES-27), and without the re-pin every artifact forgery
   * would be rejected by the pin alone — a rejection for the wrong reason that says nothing about
   * the step that re-derives the content. `repin: false` is the entry that tests the pin itself.
   */
  repin?: boolean;
}

/** Re-pin every ARTIFACT_PINS entry in a temp copy to the bytes now on disk there. */
function repinArtifacts(root: string): void {
  const pinsPath = path.join(root, 'src', 'pins.ts');
  let text = fs.readFileSync(pinsPath, 'utf-8');
  text = text.replace(/\{ file: '([^']+)', sha256: '[0-9a-f]{64}' \}/g, (m, file) => {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) return m;
    return `{ file: '${file}', sha256: '${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}' }`;
  });
  fs.writeFileSync(pinsPath, text);
}

/** Deep clone helper for the duplicate-row forgeries. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const FORGERIES: Forgery[] = [
  // ── Dataset: money ──────────────────────────────────────────────────────────
  // Production books each win's amount in cents of the stake's fiat (Step 8: floor2(stake × exact));
  // the money forgeries below work on that grid.
  {
    id: 'D01', name: 'one win over-recorded by 3 cents', origin: 'dataset battery (re-gridded to cents 2026-11-09)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won'); b.winningAmount = Math.round((b.winningAmount + 0.03) * 100) / 100; },
  },
  {
    id: 'D02', name: 'EVERY win under-recorded by exactly one cent (a uniform shift)', origin: 'dataset battery (escaped an earlier version; re-gridded to cents 2026-11-09)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { for (const b of d.bets) if (b.result === 'won') b.winningAmount = Math.round((b.winningAmount - 0.01) * 100) / 100; },
  },
  {
    id: 'D03', name: 'one win over-recorded by one cent (0.10 -> 0.11)', origin: 'dataset battery (escaped an earlier version; re-gridded to cents 2026-11-09)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won' && x.winningAmount === 0.1); b.winningAmount = 0.11; },
  },
  {
    id: 'D04', name: 'one amount OFF the cent grid (0.10 -> 0.101, a third decimal)', origin: 'the floor identity rounds it back ON to the grid before comparing',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won' && x.winningAmount === 0.1); b.winningAmount = 0.101; },
  },
  {
    id: 'D05', name: 'one recorded amount ROUNDED to the nearest cent instead of floored (a win whose exact amount has ≥ half a cent to discard)', origin: 'in-house 2026-11-09 — the production rule is a floor; a round would over-record by one cent',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: (d, root) => {
      const { minesMultiplierExact } = require(path.join(root, 'src', 'config'));
      const b = d.bets.find((x: any) => x.result === 'won' && ((Number(x.betAmount) * 100 * minesMultiplierExact(x.mineCount, x.openTiles.length)) % 1) > 0.6);
      if (!b) throw new Error('no win with a discarded fraction above 0.6 cent — this forgery no longer applies');
      b.winningAmount = Math.round(Number(b.betAmount) * 100 * minesMultiplierExact(b.mineCount, b.openTiles.length)) / 100;
    },
  },
  {
    id: 'D06', name: 'a LOSS recorded 0.01', origin: 'dataset battery (re-gridded to cents 2026-11-09)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result !== 'won'); b.winningAmount = 0.01; },
  },
  {
    id: 'D07', name: 'a loss relabelled "won" (payout math left consistent with the label)', origin: 'win condition: a loss relabelled as a win with payout math consistent with the label',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result !== 'won'); b.result = 'won'; },
  },
  {
    id: 'D08', name: 'displayed multiplier +0.01', origin: 'display: the displayed multiplier moved by one cent',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 7, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won'); b.multiplier = Math.round((b.multiplier + 0.01) * 100) / 100; },
  },
  // ── Dataset: layout and commitment ──────────────────────────────────────────
  {
    id: 'D09', name: 'one mineTiles entry changed', origin: 'layout: one mine tile changed',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 5, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.mineTiles.length > 1); b.mineTiles[1] = b.mineTiles[1] === 25 ? 24 : b.mineTiles[1] + 1; },
  },
  {
    id: 'D10', name: 'one revealed serverSeed nibble changed', origin: 'commitment: one revealed server-seed nibble changed',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 1, status: 'FAIL',
    mutate: d => { const s = d.seeds[0]; s.serverSeed = (s.serverSeed[0] === 'a' ? 'b' : 'a') + s.serverSeed.slice(1); },
  },
  {
    id: 'D11', name: 'meta.captures[0].preCapture.nextHashedServerSeed zeroed (the pre-capture chain anchor of capture 1)', origin: 'dataset battery (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 2, status: 'FAIL',
    mutate: d => { d.meta.captures[0].preCapture.nextHashedServerSeed = '0'.repeat(64); },
  },
  // ── Dataset: the nonce window ───────────────────────────────────────────────
  {
    id: 'D12', name: 'duplicate nonce (epoch 0 nonce 199 replaced by a copy of nonce 0)', origin: 'dataset battery (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: d => {
      const b0 = d.bets.find((x: any) => x.epoch === 0 && x.nonce === 0);
      const i = d.bets.findIndex((x: any) => x.epoch === 0 && x.nonce === 199);
      d.bets[i] = clone(b0); d.bets[i].id = `${b0.id}_dup`;
    },
  },
  {
    id: 'D13', name: 'epoch 0 nonces shifted to 1..200 (internally contiguous, wrong window)', origin: 'dataset battery (escaped an earlier version)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: (d, root) => {
      // Layouts are genuinely re-derived for the shifted nonces, so Step 5 stays clean and the
      // ONLY thing that can catch this is the window assertion in Step 4.
      const { revealMines } = require(path.join(root, 'src', 'rng'));
      const s0 = d.seeds.find((s: any) => s.epoch === 0);
      for (const b of d.bets.filter((x: any) => x.epoch === 0)) {
        b.nonce += 1;
        b.mineTiles = revealMines(s0.serverSeed, b.clientSeed, b.nonce, b.mineCount);
        b.localMines = b.mineTiles.slice();
      }
    },
  },
  {
    id: 'D14', name: 'epoch 0 truncated: the bet at nonce 199 deleted, declared window still 0..199', origin: 'in-house, nonceEnd was never checked at all',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: d => { d.bets = d.bets.filter((x: any) => !(x.epoch === 0 && x.nonce === 199)); },
  },
  {
    id: 'D15', name: 'nonce gap with the window moved to match (nonce 199 orphaned, 200 genuinely re-derived)', origin: 'executed counter-example',
    // Until 2026-09-23 this was a FLAG (Conditional Pass): the window was read from the seed
    // record, which the forger had moved to match. The window is now DECLARED in src/pins.ts
    // (NONCE_BASE, EPOCH_PLAN) and gaps are counted against a declared number (0), so
    // the moved record, the out-of-window nonce 50 and the undeclared gap each hard-fail Step 4.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FAIL',
    mutate: (d, root) => {
      const { revealMines } = require(path.join(root, 'src', 'rng'));
      const s0 = d.seeds.find((s: any) => s.epoch === 0);
      const b = d.bets.find((x: any) => x.epoch === 0 && x.nonce === 199);
      b.nonce = 200;
      b.mineTiles = revealMines(s0.serverSeed, b.clientSeed, 200, b.mineCount);
      b.localMines = b.mineTiles.slice();
      s0.nonceEnd = 200;
    },
  },
  {
    id: 'D21', name: 'DECLARED capture-retry gap (epoch 0 nonce 25 removed, EXPECTED_CAPTURE_RETRY_GAPS = 1)', origin: 'in-house 2026-09-23 — the capture-origin branch of Step 4 must be reachable',
    // The capture-origin FLAG is only reachable when the declaration and the data agree on a
    // non-zero gap count. The row removal also breaks the pinned population (Steps 5, 11, 12 …),
    // so the verdict is NOT PROVABLY FAIR through those steps — what this entry asserts is that
    // Step 4 itself classifies the declared gap as [FLAG:capture], not as a FAIL and not as a PASS.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 4, status: 'FLAG',
    mutate: (d, root) => {
      d.bets = d.bets.filter((x: any) => !(x.epoch === 0 && x.nonce === 25));
      const pins = path.join(root, 'src', 'pins.ts');
      fs.writeFileSync(pins, fs.readFileSync(pins, 'utf-8')
        .replace('export const EXPECTED_CAPTURE_RETRY_GAPS = 0;', 'export const EXPECTED_CAPTURE_RETRY_GAPS = 1;'));
    },
  },
  // ── Dataset: reveal sequence and board structure (MINES-10) ─────────────────
  {
    id: 'D22', name: 'a winning depth-5 round rewritten to open its first tile five times ([t,t,t,t,t], reveals 5)', origin: 'profile note rules.boardStructure (2026-09-23)',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 20, status: 'FAIL',
    mutate: d => {
      const b = d.bets.find((x: any) => x.result === 'won' && x.reveals === 5);
      const t = b.openTiles[0];
      b.openTiles = [t, t, t, t, t]; b.reveals = 5;
    },
  },
  {
    id: 'D23', name: 'a depth-5 win truncated to 4 opened tiles with multiplier and recorded amount made consistent for depth 4 (recorded depth still 5)', origin: 'in-house 2026-09-23 — MINES-10 "opened count equals the recorded depth"',
    // Steps 7, 8 and 15 all price the win at openTiles.length, so a wallet field rewritten for depth 4
    // satisfies every payout check. Only the opened-count-vs-recorded-depth assertion in Step 20
    // sees that the round recorded as played to 5 was cashed out at 4.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 20, status: 'FAIL',
    mutate: (d, root) => {
      const { minesMultiplier, minesMultiplierRational } = require(path.join(root, 'src', 'config'));
      const b = d.bets.find((x: any) => x.reveals === 5 && x.result === 'won');
      b.openTiles = b.openTiles.slice(0, 4);
      const r = minesMultiplierRational(b.mineCount, 4);
      const cents = (BigInt(Math.round(Number(b.betAmount) * 100)) * r.num) / r.den;
      b.winningAmount = Number(cents) / 100;
      b.multiplier = minesMultiplier(b.mineCount, 4);
    },
  },
  // ── Dataset: since 2026-10-02 ─────────────────
  {
    id: 'D24', name: 'recorded order — epoch 10\'s seed record (the commitment for epoch 11) moved to 1 ms after epoch 11\'s first bet',
    origin: '"moving them made nothing fail": no step read the timestamps behind "commitment before bet"',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 2, status: 'FAIL',
    mutate: d => {
      const s10 = d.seeds.find((x: any) => x.epoch === 10);
      const first11 = Math.min(...d.bets.filter((x: any) => x.epoch === 11).map((x: any) => Date.parse(x.at)));
      s10.at = new Date(first11 + 1).toISOString();
    },
  },
  {
    id: 'D25', name: 'operator seed reference — one epoch-5 bet given epoch 6\'s serverSeedId',
    origin: '"swapping one made nothing fail": no step read serverSeedId, the one seed reference LIQD serves per bet',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 3, status: 'FAIL',
    mutate: d => {
      const other = d.bets.find((x: any) => x.epoch === 6).serverSeedId;
      d.bets.find((x: any) => x.epoch === 5).serverSeedId = other;
    },
  },
  {
    id: 'D26', name: 'ONE win recorded exactly one cent below floor2(stake × exact) (0.10 -> 0.09) — the short-amount class, on the scored dataset',
    origin: 'a short amount against the declared rule FAILs the scored dataset (MINES-11 HARD_FAIL); re-gridded to the production cent rule 2026-11-09',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'won' && x.winningAmount === 0.1); b.winningAmount = 0.09; },
  },
  // ── The raw production capture (Step 22) ────────────────────────────────────
  // The edited raw capture is re-pinned after each edit (its sha256 in src/pins.ts PROD_CAPTURES), so the step that
  // re-derives the content, not the pin, must reject it.
  {
    id: 'R01', name: 'raw capture — one win\'s USDT wallet field lowered one 1e-8 unit below LIQD\'s own rule',
    origin: 'in-house 2026-11-09 — the wallet field exists only in the raw capture',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const ev = evs.find(e => e.t === 'bet' && e.rec?.settleRaw?.result === 'won');
      const u = BigInt(String(ev.rec.settleRaw.winningAmountWallet).replace('.', '')) - 1n;
      const t = u.toString().padStart(9, '0');
      ev.rec.settleRaw.winningAmountWallet = `${t.slice(0, -8)}.${t.slice(-8)}`;
    },
  },
  {
    id: 'R02', name: 'raw capture — one open-tile reply\'s mine flag flipped (safe reported as a mine)',
    origin: 'in-house 2026-11-09 — the per-reveal replies exist only in the raw capture',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => { const ev = evs.find(e => e.t === 'step' && e.name === 'open-tile' && e.reply?.mineTile === false); ev.reply.mineTile = true; },
  },
  {
    id: 'R03', name: 'raw capture — a round\'s intent (its planned tiles) moved after its first request',
    origin: 'in-house 2026-11-09 — the plan must be written before the round is played',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const i = evs.findIndex(e => e.t === 'intent');
      const [it] = evs.splice(i, 1);
      const j = evs.findIndex(e => e.t === 'step' && e.key === it.key);
      evs.splice(j + 1, 0, it);
    },
  },
  {
    id: 'R04', name: 'raw capture edited and its pin NOT updated',
    origin: 'in-house 2026-11-09 — the raw capture is an exhibit of record',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL', repin: false,
    mutate: (evs: any[]) => { const ev = evs.find(e => e.t === 'verify'); ev.status = 500; },
  },
  {
    id: 'R05', name: 'raw capture 2 — a round LIQD settled by itself stripped of its autoFinish flag (in the open-tile reply and in the bet record)',
    origin: 'in-house 2026-11-10 — a round settled without a cash-out must be one the capture shows LIQD settling',
    target: 'raw', raw: 2, expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const bet = evs.find(e => e.t === 'bet' && e.rec?.settleRaw?.autoFinish === true);
      delete bet.rec.settleRaw.autoFinish;
      for (const st of bet.rec.steps ?? []) delete st.autoFinish;
      for (const e of evs) if (e.t === 'step' && e.key === bet.rec.key && e.reply?.autoFinish === true) delete e.reply.autoFinish;
    },
  },
  {
    id: 'R06', name: 'raw capture 2 — one win\'s USDT wallet field lowered to its booked fiat figure (the cent floor applied to the wallet)',
    origin: 'in-house 2026-11-10 — the wallet field carries the unrounded amount; a wallet field at the booked figure is below the rule',
    target: 'raw', raw: 2, expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const ev = evs.find(e => e.t === 'bet' && e.rec?.settleRaw?.result === 'won' && Number(e.rec.settleRaw.winningAmountWallet) > Number(e.rec.settleRaw.winningAmount));
      ev.rec.settleRaw.winningAmountWallet = Number(ev.rec.settleRaw.winningAmount).toFixed(8);
    },
  },
  // ── Raw capture: LIQD's clock, ledger debits, verifier inputs (11 November 2026) ──
  {
    id: 'R07', name: 'raw capture 1 — the rotation that sent epoch 1\'s client seed dated (LIQD Date header) one hour before the reply that published its commitment',
    origin: 'in-house 2026-11-11 — on LIQD\'s own clock a commitment must be published before the client seed is sent; the runner\'s clock (`at`) is left as recorded, so only Step 2\'s LIQD-clock arm can see it',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 2, status: 'FAIL',
    mutate: (evs: any[]) => {
      const ep1 = evs.find(e => e.t === 'epoch' && e.epoch === 1);
      const rot = evs.find(e => e.t === 'rotate' && e.raw?.activeServerSeedHash === ep1.hashedServerSeed && e.raw?.clientSeed === ep1.clientSeed);
      const pub = evs.find(e => (e.t === 'pre' || e.t === 'rotate') && e.raw?.nextServerSeedHash === ep1.hashedServerSeed);
      rot.http.date = new Date(Date.parse(pub.http.date) - 3_600_000).toUTCString();
    },
  },
  {
    id: 'R08', name: 'raw capture 1 — one loss reply\'s ledger debit amount set to the round\'s USDT stake (instead of the 0.1 CAD stake)',
    origin: 'in-house 2026-11-11 — the ledger debits are bound to the data as LIQD sent them; the dataset has no field for them, so only Step 22 (k) can see it',
    target: 'raw', expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const ev = evs.find(e => e.t === 'step' && e.name === 'open-tile' && e.reply?.betTransaction);
      const place = evs.find(e => e.t === 'step' && e.name === 'place-bet' && e.key === ev.key);
      ev.reply.betTransaction.amount = Number(place.reply.betAmountWallet);
    },
  },
  {
    id: 'R09', name: 'raw capture 2 — a ledger debit added to a cash-out reply (a win carrying a stake debit record)',
    origin: 'in-house 2026-11-11 — the declared debits are one per loss and per self-settled round; a record on any other reply is not the declaration',
    target: 'raw', raw: 2, expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const src = evs.find(e => e.t === 'step' && e.name === 'open-tile' && e.reply?.betTransaction);
      const ev = evs.find(e => e.t === 'step' && e.name === 'cash-out' && e.reply);
      ev.reply.betTransaction = { ...src.reply.betTransaction, betId: ev.reply.id };
    },
  },
  {
    id: 'R10', name: 'raw capture 3 — one verifier request also carries the round\'s bet id',
    origin: 'in-house 2026-11-11 — the provenance argument rests on the verifier being sent only seeds, nonce and mine count; a request that names the round would let it look the round up',
    target: 'raw', raw: 3, expect: 'NOT PROVABLY FAIR', step: 22, status: 'FAIL',
    mutate: (evs: any[]) => {
      const ev = evs.find(e => e.t === 'verify');
      ev.request.body = JSON.stringify({ ...JSON.parse(ev.request.body), betId: ev.betId });
    },
  },
  // ── Dataset: phases, fiat and player-set seeds (10 November 2026) ───────────
  {
    id: 'D27', name: 'a phase D round given an "audit" client seed (no longer its epoch\'s player-set seed)',
    origin: 'in-house 2026-11-10 — Phase D is the player-set-seed phase; every round of it must be drawn with its seed',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 14, status: 'FLAG',
    mutate: d => { const b = d.bets.find((x: any) => x.phaseId === 'D'); b.clientSeed = 'audit000000000000'; },
  },
  {
    id: 'D28', name: 'a capture 1 round relabelled as booked in USD (fiatCurrency CAD -> USD)',
    origin: 'in-house 2026-11-10 — amounts are checked in the fiat LIQD booked them in, never relabelled',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.capture === 1); b.fiatCurrency = 'USD'; },
  },
  {
    id: 'D29', name: 'a top-up round relabelled phase id A (A+ -> A)',
    origin: 'in-house 2026-11-10 — every row carries the phase tags the plan gives its epoch',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 11, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.phaseId === 'A+'); b.phaseId = 'A'; },
  },
  {
    id: 'D30', name: 'a phase C win booked at the displayed multiplier (10.00 × 1.12 = 11.20 instead of 11.25)',
    origin: 'in-house 2026-11-10 — at the elevated stake the displayed and the exact multiplier give different cents',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.phaseId === 'C' && x.result === 'won'); b.winningAmount = 11.2; },
  },
  // ── Simulation artifact: Pass 1 ─────────────────────────────────────────────
  {
    id: 'A01', name: 'summary-only artifact — every detail row deleted from both passes', origin: 'simulation artifact: every detail row deleted from both passes, summary scalars kept',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results = []; s.pass2_casino_seeds.results = []; },
  },
  {
    id: 'A02', name: 'one Pass-1 row\'s firstDrawPValue set to 0 (summary scalars left clean)', origin: 'simulation artifact: one row\'s p-value set to 0 while the summary scalars stay clean',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[3].firstDrawPValue = 0; },
  },
  {
    id: 'A03', name: 'configs: 1 with a single real-shaped row and a self-consistent header', origin: 'simulation artifact: a one-config artifact with a self-consistent header; scored Full Pass before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const p1 = s.pass1_fresh_seeds; const r = p1.results[0];
      p1.configs = 1; p1.totalRounds = p1.roundsPerConfig; p1.results = [r];
      p1.jointConfigsTested = 0; p1.jointFailsAtAlpha01 = 0; p1.jointFailsBonferroni = 0;
      p1.jointMaxAbsZAcrossConfigs = 0; p1.bonferroniAlpha = 0.01;
      p1.meanSimulatedRTP = r.simRTP; p1.meanTheoreticalRTP = r.theoreticalRTP;
    },
  },
  {
    id: 'A04', name: '24 copies of the m=1 row (row COUNT preserved, identity destroyed)', origin: 'simulation artifact: row count kept, row identity destroyed; scored Full Pass before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const p1 = s.pass1_fresh_seeds; const r = p1.results[0];
      p1.results = Array.from({ length: 24 }, () => clone(r));
      p1.jointConfigsTested = 0; p1.jointFailsAtAlpha01 = 0; p1.jointFailsBonferroni = 0;
      p1.jointMaxAbsZAcrossConfigs = 0;
      p1.meanSimulatedRTP = r.simRTP; p1.meanTheoreticalRTP = r.theoreticalRTP;
    },
  },
  {
    id: 'A05', name: 'self-consistent nonsense — every simRTP AND theoreticalRTP set to 0.5', origin: 'simulation artifact: simRTP and theoreticalRTP forged to agree with each other; scored Full Pass before 2026-09-09, when the band compared two artifact fields to each other',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      for (const r of s.pass1_fresh_seeds.results) { r.simRTP = 0.5; r.theoreticalRTP = 0.5; }
      s.pass1_fresh_seeds.meanSimulatedRTP = 0.5; s.pass1_fresh_seeds.meanTheoreticalRTP = 0.5;
    },
  },
  {
    id: 'A06', name: 'one Pass-1 row re-seeded (statistics kept, serverSeed/clientSeed replaced)', origin: 'in-house — tests the convergence re-draw specifically',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[7].serverSeed = 'f'.repeat(32); },
  },
  {
    id: 'A07', name: 'roundsPerConfig lowered to 1,000 (every statistical band widens with it)', origin: 'G-BIND item 1 — a threshold sized by an artifact-supplied n is forger-controlled',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const p1 = s.pass1_fresh_seeds; p1.roundsPerConfig = 1000; p1.totalRounds = 24000; },
  },
  // ── Simulation artifact: Pass 2 ─────────────────────────────────────────────
  {
    id: 'A08', name: '36 empty {} seed rows (0 flags, survival 1)', origin: 'executed counter-example — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.pass2_casino_seeds.results = Array.from({ length: s.pass2_casino_seeds.results.length }, () => ({}));
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A09', name: '36 copies of one unflagged epoch row', origin: 'executed counter-example — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const r = s.pass2_casino_seeds.results.find((x: any) => !x.cherryPickFlag);
      s.pass2_casino_seeds.results = Array.from({ length: s.pass2_casino_seeds.results.length }, () => clone(r));
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A10', name: 'every row earlyBootstrapP=1e-10, latePValue=0.5, cherryPickFlag=false (the stated criterion makes all 36 flags)', origin: 'executed counter-example — scored FULL PASS before 2026-09-09',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      for (const r of s.pass2_casino_seeds.results) { r.earlyBootstrapP = 1e-10; r.latePValue = 0.5; r.cherryPickFlag = false; }
      s.pass2_casino_seeds.cherryPickFlags = 0; s.pass2_casino_seeds.cherryPickSurvivalP = 1;
    },
  },
  {
    id: 'A11', name: 'one flagged row\'s stored cherryPickFlag flipped to false (scalars adjusted to match)', origin: 'G-BIND item 4 — the stored boolean must equal the DERIVED one',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const p2 = s.pass2_casino_seeds;
      const r = p2.results.find((x: any) => x.cherryPickFlag);
      if (!r) throw new Error('no flagged row to unflag — this forgery no longer applies');
      r.cherryPickFlag = false; p2.cherryPickFlags -= 1;
    },
  },
  {
    id: 'A12', name: 'one Pass-2 row\'s epoch and hash swapped for another epoch\'s', origin: 'G-BIND item 2 — row identity against the dataset anchor',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => { s.pass2_casino_seeds.results[5].hashedServerSeed = s.pass2_casino_seeds.results[6].hashedServerSeed; },
  },
  // ── Simulation artifact: structure ──────────────────────────────────────────
  {
    id: 'A13', name: 'an undeclared field added to every Pass-1 row', origin: 'G-BIND item 0 — the key-path inventory is the only guard that fails closed on a forgery class nobody has thought of',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { for (const r of s.pass1_fresh_seeds.results) r.qualityScore = 1; },
  },
  {
    id: 'A14', name: 'artifact houseEdge set to 0.005 (half the audited edge)', origin: 'in-house — the artifact must agree with src/config.ts, not narrate its own constants',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.houseEdge = 0.005; },
  },
  {
    id: 'A15', name: 'simulation artifact absent entirely', origin: 'framework — a MISSING input is an incomplete run, not a fairness breach',
    // Until 2026-09-24 this was the one entry whose correct answer was NOT a hard fail: a fresh
    // clone that had not run `npm run simulate` yet was to FLAG (Conditional Pass). Since MINES-27
    // (2026-09-24) outputs/simulation-results.json is an ARTIFACT OF RECORD: shipped, un-ignored by
    // name and SHA-256 pinned in src/pins.ts ARTIFACT_PINS, so a clone always carries it and
    // "absent" means removed — the same reasoning as A18 for audit-figures.json. Step 19 arm (c)
    // FAILs an absent pinned artifact. Step 16 still FLAGs (its input is missing, not forged), which
    // this runner does not assert, since it checks one step. Re-measured 2026-09-29 at 33e10e6 and
    // after: VERDICT NOT PROVABLY FAIR, Step 16 FLAG, Step 17 FLAG, Step 19 FAIL. The registry had
    // not been re-run since that change, so it still declared the old expectation.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (_s, root) => { fs.rmSync(path.join(root, SIM_REL)); return null; },
  },
  // ── The derived-figure artifact (outputs/audit-figures.json) ────────────────
  // This file gives the report's prose figures a producing step. WRITTEN by tests/verify.ts and
  // read by nothing, it is an unbound emission: editing it leaves the suite printing 21/21 Full
  // Pass. Step 19 re-derives it and compares. Both cases are kept here because a write-only
  // artifact that the report cites is a defect shape, not a one-off.
  {
    id: 'A16', name: 'a headline figure edited in audit-figures.json (live RTP moved to 99.0%)', origin: 'in-house 2026-09-09, via the framework gate-forgery battery',
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (j: any) => { j.liveAggregate.liveRTPPercent = 99.0; },
  },
  {
    id: 'A17', name: 'audit-figures.json reference grid emptied (300 cells -> 0)', origin: 'in-house 2026-09-09, via the framework gate-forgery battery (F1 empty population)',
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (j: any) => { j.referenceGrid = []; },
  },
  // ══════════════════════════════════════════════════════════════════════════
  //  HARNESS DEFECTS. Every entry below targets the verification harness, not the dataset
  //  numbers, and every one was EXECUTED against this repo before the guard that now stops it.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'A18', name: 'outputs/audit-figures.json DELETED (the guard\'s own evidence removed)',
    origin: 'measured `[PASS] Step 19`, 21/21 Full Pass',
    // Step 19 treated an absent figure artifact as "a fresh clone has not run verify yet" and
    // PASSED. Deleting a file is strictly easier than editing it, so the absent arm was a bypass
    // around the edited arm beside it. The delivered repo ships this artifact (.gitignore
    // un-ignores it by name); absent means removed.
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (_j: any, root: string) => { fs.rmSync(path.join(root, FIG_REL)); return null; },
  },
  {
    id: 'A19', name: 'a headline figure edited, then verify run TWICE (the self-heal)',
    origin: 'run 1 FAIL, run 2 PASS with nothing else changed',
    // tests/verify.ts rewrote audit-figures.json unconditionally at the end of the same run that
    // hard-failed Step 19, so the enforcement lasted exactly one run and then erased the evidence.
    // This entry runs the verifier TWICE (see runForgery's `runs` handling) and asserts the SECOND
    // run still fails — the first run failing was never the problem.
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL', runs: 2,
    mutate: (j: any) => { j.liveAggregate.liveRTPPercent = 99.0; },
  },
  {
    id: 'A20', name: 'firstDrawChi2 set to 500 with its p-value left at 0.7787',
    origin: 'measured `[PASS] Step 16`, 21/21 Full Pass',
    // A χ² of 500 on 24 df has p ≈ 1e-89. The statistic and the p-value were two independent
    // numbers and nothing checked they described the same event; every FWER count is computed
    // from the p, so the statistic beside it could say anything.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[0].firstDrawChi2 = 500; },
  },
  {
    id: 'A21', name: 'jointPValue left clean while jointMaxAbsZ is moved to 9.99',
    origin: 'the same class on the pairwise-joint leg',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const r = s.pass1_fresh_seeds.results.find((x: any) => x.jointMaxAbsZ !== null); r.jointMaxAbsZ = 9.99; },
  },
  {
    id: 'A22', name: 'layoutRunsPValue left clean while layoutRunsZ is moved',
    origin: 'the same class on the runs leg',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { s.pass1_fresh_seeds.results[2].layoutRunsZ = 4.5; },
  },
  {
    id: 'A23', name: 'a FABRICATED Pass 1 forged to the exact centre of every band',
    origin: 'measured 21/21 PROVABLY FAIR — Full Pass',
    // simRTP = theoreticalRTP, firstDrawChi2 = 24, firstDrawPValue = 0.5, layoutR1/R1Z/RunsZ = 0,
    // jointMaxAbsZ = 0, jointPValue = 1, summary scalars recomputed. Every threshold in Step 16
    // was one-sided — "is this too extreme?" — so a value at the dead centre of the null passed
    // all of them. Perfection is evidence of fabrication, not of fairness. Four guards now fire:
    // p-value reconciliation, the simRTP↔convergence identity, the lower-tail screen, and the
    // exact-zero screen.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const P = s.pass1_fresh_seeds;
      for (const r of P.results) {
        r.simRTP = r.theoreticalRTP;
        r.firstDrawChi2 = 24; r.firstDrawPValue = 0.5;
        r.layoutR1 = 0; r.layoutR1Z = 0; r.layoutRunsZ = 0; r.layoutRunsPValue = 1;
        if (r.jointMaxAbsZ !== null) { r.jointMaxAbsZ = 0; r.jointPValue = 1; }
      }
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
      P.meanTheoreticalRTP = P.results.reduce((a: number, r: any) => a + r.theoreticalRTP, 0) / P.results.length;
      P.firstDrawChi2FailsBonferroni = 0; P.firstDrawChi2FailsAtAlpha01 = 0;
      P.jointFailsBonferroni = 0; P.jointFailsAtAlpha01 = 0;
      P.layoutSerialFailsBonferroni = 0; P.layoutSerialFailsUncorrected = 0;
      P.jointMaxAbsZAcrossConfigs = 0;
    },
  },
  {
    id: 'A24', name: 'one simRTP moved off its own final convergence checkpoint (still inside 5·SE)',
    origin: 'the free cross-check the band could never provide',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => { const r = s.pass1_fresh_seeds.results[11]; r.simRTP = r.theoreticalRTP + 1e-5; s.pass1_fresh_seeds.meanSimulatedRTP = s.pass1_fresh_seeds.results.reduce((a: number, x: any) => a + x.simRTP, 0) / s.pass1_fresh_seeds.results.length; },
  },
  {
    id: 'D17', name: 'one LOSS row\'s betAmount replaced with "not-a-number" (NaN turnover)',
    origin: 'measured `$NaN wagered` printed, Conditional Pass 20/21, exit 0',
    // `totalStaked += Number(b.betAmount)` with no finiteness test. Every comparison a NaN reaches
    // is false, so an unguarded money accumulator does not merely print badly — it deletes the
    // arithmetic that was the check.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 8, status: 'FAIL',
    mutate: d => { const b = d.bets.find((x: any) => x.result === 'lost'); b.betAmount = 'not-a-number'; },
  },
  {
    id: 'D18', name: 'meta.phases[*].amount set to 1000 (the settlement floor read from an unvalidated header)',
    origin: 'measured Step 10 PASS printing "$1000.00, read from meta.phases"',
    // The settled-RTP deficit scales with 1/stake, and the sentence it produces is quoted in four
    // chapters. The stake now comes from the bets; the header is compared against them.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 10, status: 'FAIL',
    mutate: d => { for (const k of Object.keys(d.meta.phases)) if (d.meta.phases[k].amount !== undefined) d.meta.phases[k].amount = 1000; },
  },
  {
    id: 'D19', name: 'a whole trailing epoch dropped, header made consistent, seed row removed',
    origin: 'measured Conditional Pass, exit 0',
    // The audited population was whatever the file said it was: every count came from inside the
    // file being scored. src/pins.ts now carries EXPECTED_BETS / EXPECTED_SEEDS /
    // EPOCH_PLAN and Steps 11/12 assert against them. A row COUNT is not an identity.
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 11, status: 'FAIL',
    mutate: d => {
      const last = Math.max(...d.bets.map((b: any) => b.epoch));
      d.bets = d.bets.filter((b: any) => b.epoch !== last);
      d.seeds = d.seeds.filter((s: any) => s.epoch !== last);
      const dropped = 6574 - d.bets.length;
      const walk = (o: any) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (o[k] === 6574) o[k] = 6574 - dropped; else if (o[k] === 36) o[k] = 35; else if (o[k] && typeof o[k] === 'object') walk(o[k]); } };
      walk(d.meta);
      delete d.meta.phases.C; delete d.meta.phaseIds.C; d.meta.captures.pop();
    },
  },
  {
    id: 'D20', name: '20% of the bets dropped from the tail with every header count made to agree',
    origin: 'framework gate-population D1',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 11, status: 'FAIL',
    mutate: d => { d.bets = d.bets.slice(0, Math.floor(d.bets.length * 0.8)); },
  },
  // ══════════════════════════════════════════════════════════════════════════
  //  THE EXACT-MEAN ARM. Screening for values that AGREE with theory rejects a genuine,
  //  seed-reproducible million-round result, so the arm screens instead for values outside the
  //  SUPPORT of the counts that produce them, or contradicted by the row's own counts. These two
  //  entries are its negative controls — the fabricated cases must still be rejected, and for
  //  the right reason.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'A25', name: 'every simRTP forced to equal its theoreticalRTP, convergence counts left GENUINE',
    origin: 'the negative control for the rewritten support screen',
    // The old blanket rule rejected this because the values were equal. The new rule rejects it
    // because the equality claims exactly N·p wins while each row's own final checkpoint records
    // something else — a mismatch with the regenerated draws, not a verdict on the value.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const P = s.pass1_fresh_seeds;
      for (const r of P.results) r.simRTP = r.theoreticalRTP;
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
    },
  },
  {
    id: 'A26', name: 'the n=1,000 convergence counts replaced by their fair expectations (fabricated counts)',
    origin: '"negative controls with fabricated counts must still fail"',
    // Straight count fabrication with no attempt at consistency: the n=1,000 checkpoint is the one
    // the verifier re-draws from the row's own seeds, so this fails at the intended evidence check
    // rather than on a plausibility heuristic.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const GRID_ = 25;
      for (const r of s.pass1_fresh_seeds.results) {
        const cp = r.convergence.find((c: any) => c.n === 1000);
        if (cp) cp.wins = Math.round((1000 * (GRID_ - r.mineCount)) / GRID_);
      }
    },
  },
  // ── The pin itself ──────────────────────────────────────────────────────────
  {
    id: 'D16', name: 'dataset edited and the pin NOT updated', origin: 'dataset pin: the dataset edited without updating its SHA-256 pin; the loader must abort before any step',
    // No re-pin (see runForgery): the loader must exit(1) before a single step is scored, so
    // there is no VERDICT line at all.
    target: 'dataset', expect: null,
    mutate: d => { d.bets[0].winningAmount = 999; },
  },
  {
    id: 'A27', name: 'one earlyBootstrapP moved to a NEIGHBOURING LEGAL lattice point',
    origin: 'promoted from declared survivor to must-fail by on 2026-09-11',
    // A one-increment edit stays on the legal bootstrap lattice. Step 17 must detect it
    // by deterministic replay; range and ordering checks alone do not establish parity.
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      const p2 = s.pass2_casino_seeds;
      const r = p2.results[0];
      const k = Math.round(r.earlyBootstrapP * (p2.bootstrapReps + 1));
      r.earlyBootstrapP = (k + 1) / (p2.bootstrapReps + 1);
    },
  },
  // ── Switching the bootstrap replay OFF by corrupting its own metadata ───────────────────
  // All three were EXECUTED against this repo, and all three scored 21/21 PROVABLY FAIR — Full
  // Pass, exit 0, while the same artifact with VALID metadata printed [FAIL] Step 17, 20/21,
  // exit 1: the p-values do not replay, and the only thing standing between that fact and the
  // verdict was whether the metadata parsed. Invalid metadata FAILS instead of disabling the
  // check.
  {
    id: 'A28', name: 'seedDerivation set to an unknown version string',
    origin: 'executed 2026-09-11 — restored 21/21 Full Pass on an artifact whose p-values do not replay',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
      s.seedDerivation = 'mines-seed-derivation-v99-unknown';
      s.pass2_casino_seeds.bootstrapSeedDerivation = 'mines-seed-derivation-v99-unknown';
    },
  },
  {
    id: 'A29', name: 'masterSeed set to `not-hex`',
    origin: 'executed 2026-09-11 — restored 21/21 Full Pass on an artifact whose p-values do not replay',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = 'not-hex';
      s.seedDerivation = 'mines-seed-derivation-v1';
      s.pass2_casino_seeds.bootstrapSeedDerivation = 'mines-seed-derivation-v1';
    },
  },
  {
    id: 'A30', name: 'replay metadata claimed only PARTIALLY (masterSeed, no derivation version)',
    origin: 'in-house, EXECUTED 2026-09-11 — same class as A28/A29, found while closing them',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: s => {
      s.masterSeed = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
      delete s.seedDerivation;
      delete s.pass2_casino_seeds.bootstrapSeedDerivation;
    },
  },
  {
    id: 'A31', name: 'a FULLY self-consistent deep Pass 1 — the n=1,000 checkpoint left genuine, every deeper statistic rebuilt to agree with itself (was declared survivor S01)',
    origin: 'in-house 2026-09-09, probing the residual left by an earlier defect; a declared survivor until 2026-09-24, when Step 16 began replaying every Pass-1 round in verify (MINES-20)',
    // The honest limit of Step 16, measured rather than assumed. Everything the verifier can
    // recompute inside a run — the n=1,000 convergence bind, each p-value against its own
    // statistic, simRTP against the final checkpoint, monotonicity, the 5·SE bands, the
    // plausibility floor — is satisfied by construction here, because this forgery satisfies them
    // deliberately. What it moves is the ONE thing a verify run cannot re-derive without
    // replaying 24,000,000 rounds: the deep statistics and the final convergence checkpoint.
    //
    // Measured: 21/21 PROVABLY FAIR — Full Pass (after `npm run figures`, which a forger would
    // run to make the derived-figure artifact agree with the forged simulation).
    //
    // ── WHERE THE REPLAY INPUTS ACTUALLY ARE ────────────────────────────────────────────
    // Not in a master seed. Every Pass-1 row records the serverSeed and clientSeed it was drawn
    // with, and the nonce range is 0 .. roundsPerConfig−1 by construction — those ARE the replay
    // inputs, and the package has always had them. A master seed would only regenerate the
    // SELECTION of the 24 seed pairs.
    //
    // So the check exists: `npm run deep-replay` (src/deep-replay.ts) re-runs all 24 ×
    // 1,000,000 rounds from each row's own stored seeds and compares every deep statistic and
    // every convergence count. This forgery moves the deep statistics and the FINAL convergence
    // checkpoint, so deep replay rejects it at a defined check — the stored values this mutate()
    // writes do not survive regeneration — while `npm run verify`, which re-draws only the
    // n=1,000 checkpoint, still does not reject it.
    //
    // The committed artifact's own replay report (outputs/deep-replay-report.json) records the
    // clean side of that comparison: 24 of 24 rows, 24,000,000 rounds, 0 differences,
    // SCOPE FULL, DEEP REPLAY PASS.
    // Until 2026-09-24 this entry SURVIVED the verify runner (declared) and did not survive deep
    // replay. Since then Step 16 runs the same replay inside every verify, so it is a must-fail
    // entry: the forged deep statistics and the moved final checkpoint differ from the replay.
    // The runner re-pins the artifacts after mutate(), so only the replay can reject it.
    //
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: (s, root) => {
      const { chiSquaredPValue, normalTwoSidedP } = require(path.join(root, 'src', 'stats'));
      const { GRID, theoreticalRTP } = require(path.join(root, 'src', 'config'));
      const P = s.pass1_fresh_seeds; const N = P.roundsPerConfig;
      for (const r of P.results) {
        const p = (GRID - r.mineCount) / GRID;
        const mult = theoreticalRTP(r.mineCount, 1) / p;
        const targetWins = Math.round(N * p) + 1;          // one win off fair — never exactly 0·SE
        r.convergence[r.convergence.length - 1].wins = targetWins;
        r.simRTP = (targetWins / N) * mult;
        r.firstDrawChi2 = 23.337; r.firstDrawPValue = chiSquaredPValue(23.337, r.firstDrawDf);
        if (r.jointMaxAbsZ !== null) { r.jointMaxAbsZ = 0.5; r.jointPValue = Math.min(1, r.jointPairs * chiSquaredPValue(0.25, 1)); }
        r.layoutR1 = 1e-7; r.layoutR1Z = 1e-7 * Math.sqrt(N);
        r.layoutRunsZ = 0.01; r.layoutRunsPValue = normalTwoSidedP(0.01);
      }
      P.meanSimulatedRTP = P.results.reduce((a: number, r: any) => a + r.simRTP, 0) / P.results.length;
      P.meanTheoreticalRTP = P.results.reduce((a: number, r: any) => a + r.theoreticalRTP, 0) / P.results.length;
      P.firstDrawChi2FailsBonferroni = 0; P.firstDrawChi2FailsAtAlpha01 = 0;
      P.jointFailsBonferroni = 0; P.jointFailsAtAlpha01 = 0;
      P.layoutSerialFailsBonferroni = 0; P.layoutSerialFailsUncorrected = 0;
      P.jointMaxAbsZAcrossConfigs = Math.max(...P.results.map((r: any) => r.jointMaxAbsZ ?? 0));
      // Write the forged simulation artifact HERE (returning it would write it after this
      // function returns, and the regeneration below has to read the forged file, not the real
      // one). Then regenerate the derived-figure artifact exactly as a forger would: without that
      // step this entry would look "caught" by a pin that one command defeats — a rejection for
      // the wrong reason, which measures nothing.
      fs.writeFileSync(path.join(root, SIM_REL), JSON.stringify(s, null, 2));
      execFileSync('npm', ['run', 'figures'], { cwd: root, stdio: 'ignore', env: { ...process.env, OUT_DIR: 'outputs' } });
      return null;
    },
  },
  {
    id: 'A32', name: 'MINES-20 census — one MIDDLE convergence count (n=50,000) moved by one win, artifact re-pinned',
    origin: 'in-house 2026-09-24 — the replay probe: monotone, bounded and inside 5·SE, so only regeneration can see it',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 16, status: 'FAIL',
    mutate: s => {
      const r = s.pass1_fresh_seeds.results.find((x: any) => x.mineCount === 12);
      const c = r.convergence.find((x: any) => x.n === 50_000);
      c.wins += 1;
    },
  },
  {
    id: 'A33', name: 'MINES-27 run metadata — generatedAt put back into simulation-results.json, artifact re-pinned',
    origin: 'in-house 2026-09-24 — run metadata must be absent, not excluded',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: s => ({ generatedAt: '2026-09-24T00:00:00.000Z', ...s }),
  },
  {
    id: 'A34', name: 'MINES-27 value domain — deep-replay-report perRow[0].differences = -1, every artifact re-pinned',
    origin: 'in-house 2026-09-24 — a re-pinned impossible value is caught by its declared domain alone',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (_s, root) => {
      const p = path.join(root, 'outputs', 'deep-replay-report.json');
      const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
      d.perRow[0].differences = -1;
      fs.writeFileSync(p, JSON.stringify(d, null, 2));
      return null;
    },
  },
  {
    id: 'A35', name: 'MINES-27 pin — one byte of rtp-convergence.html changed and NOT re-pinned',
    origin: 'in-house 2026-09-24 — the pin arm itself',
    target: 'artifact', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL', repin: false,
    mutate: (_s, root) => {
      const p = path.join(root, 'outputs', 'rtp-convergence.html');
      fs.writeFileSync(p, fs.readFileSync(p, 'utf-8').replace('Theoretical 99.0000%', 'Theoretical 99.0001%'));
      return null;
    },
  },
  {
    id: 'A36', name: 'MINES-21 binding — one multi-reveal win\'s opened tiles reversed (no longer the plan the capture requested), dataset re-pinned',
    origin: 'in-house 2026-09-24 — the served-config test must refuse a config it cannot rebuild',
    target: 'dataset', expect: 'NOT PROVABLY FAIR', step: 17, status: 'FAIL',
    mutate: d => {
      const b = d.bets.find((x: any) => x.reveals >= 2 && x.result === 'won');
      b.openTiles = [...b.openTiles].reverse();
    },
  },
  {
    id: 'A37', name: 'audit-figures.json falseAlarmAccounting.totalNominal moved 2e-12 relative (just beyond the reproduction bound), every artifact re-pinned',
    origin: 'in-house 2026-09-28 — Step 19 compares the re-derived figures at 1e-14 abs + 1e-12 rel, not bit equality (libm drift, measured on Linux); a value beyond the bound must still fail',
    target: 'figures', expect: 'NOT PROVABLY FAIR', step: 19, status: 'FAIL',
    mutate: (j: any) => { j.falseAlarmAccounting.totalNominal *= 1 + 2e-12; },
  },
];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *  DECLARED SURVIVORS — forgeries this suite does NOT catch, run and printed anyway.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * A registry that quietly drops what it cannot catch reports a coverage it does not have.
 * These are executed on every `npm run forgeries` and must still SURVIVE; if one starts being
 * caught, that is reported too, because the registry is then out of date and the honest thing
 * is to promote it into FORGERIES above.
 *
 * `tests/survivors.json` is the equivalent list for SOURCE mutations. These are evidence
 * forgeries, so they live here.
 *
 * EMPTY SINCE 2026-09-24. The one declared survivor, S01 (a fully self-consistent deep Pass 1), is
 * now A31 above: Step 16 replays all 24 × 1,000,000 Pass-1 rounds inside every verify (MINES-20),
 * so the residual it named — a residual of `npm run verify`, closed until then only by the separate
 * `npm run deep-replay` — no longer exists.
 */
const SURVIVORS: Forgery[] = [
];

// ── Runner ────────────────────────────────────────────────────────────────────

function runForgery(f: Forgery): { ok: boolean; note: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mines-forge-'));
  try {
    for (const item of COPY) {
      const src = path.join(repoRoot, item);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, item), { recursive: true });
    }
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

    if (f.target !== 'none') {
      const rel = f.target === 'dataset' ? DATASET_REL : f.target === 'figures' ? FIG_REL : f.target === 'raw' ? RAW_RELS[(f.raw ?? 1) - 1] : SIM_REL;
      const file = path.join(tmp, rel);
      if (f.target === 'raw') {
        // One JSON object per line, written back compact, one per line, with the trailing newline.
        const before = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const evs = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l !== '').map(l => JSON.parse(l));
        f.mutate(evs, tmp);
        fs.writeFileSync(file, evs.map(e => JSON.stringify(e)).join('\n') + '\n');
        if (f.repin !== false) {
          const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
          const pins = path.join(tmp, 'src', 'pins.ts');
          // The capture's pin is the one place its original sha256 appears in src/pins.ts.
          fs.writeFileSync(pins, fs.readFileSync(pins, 'utf-8').split(`sha256: '${before}'`).join(`sha256: '${sha}'`));
        }
      } else {
      const doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const out = f.mutate(doc, tmp);
      if (out !== null && fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(out === undefined ? doc : out, null, 2));
      }
      }
      // Dataset edits re-pin, EXCEPT D16 whose whole point is that the pin is stale.
      if (f.target === 'dataset' && f.expect !== null) {
        const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const pins = path.join(tmp, 'src', 'pins.ts');
        fs.writeFileSync(pins, fs.readFileSync(pins, 'utf-8').replace(/'[0-9a-f]{64}'/, `'${sha}'`));
      }
      // Artifact and figure edits re-pin every artifact of record, EXCEPT the entry that tests
      // the pin itself (repin: false).
      if ((f.target === 'artifact' || f.target === 'figures') && f.repin !== false) repinArtifacts(tmp);
    }

    let out = '';
    let rc = 0;
    // The LAST run is the one scored (see Forgery.runs). Everything earlier is there to let a
    // self-healing verifier do its healing, so the assertion lands on the state a second reader
    // would actually see.
    for (let attempt = 0; attempt < (f.runs ?? 1); attempt++) {
      rc = 0;
      try {
        out = execFileSync('node', ['-r', 'ts-node/register/transpile-only', 'tests/verify.ts'],
          { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e: any) {
        rc = e.status ?? 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
    }

    const line = out.split('\n').find(l => l.includes('VERDICT:')) ?? '';
    const verdict = line ? line.replace(/^.*VERDICT:\s*/, '').trim() : null;

    if (f.expect === null) {
      const aborted = verdict === null && rc !== 0 && /SHA-256 mismatch/.test(out);
      return {
        ok: aborted,
        note: aborted
          ? `loader aborted before any step was scored (exit ${rc}, SHA-256 mismatch)`
          : `expected a loader abort with no VERDICT; got exit ${rc}, verdict ${verdict ?? '(none)'}`,
      };
    }

    const verdictOk = verdict === f.expect;
    let stepOk = true;
    let seen = '(not declared)';
    if (f.step !== undefined) {
      seen = (new RegExp(`\\[(PASS|FLAG|FAIL)(?::capture)?\\] Step ${f.step} `).exec(out) ?? [])[1] ?? '(step line absent)';
      stepOk = seen === f.status;
    }
    return {
      ok: verdictOk && stepOk,
      note: `VERDICT: ${verdict ?? '(none)'} (expected ${f.expect})`
        + ((f.runs ?? 1) > 1 ? ` [scored on verify run ${f.runs} of ${f.runs}]` : '')
        + (f.step !== undefined ? `; Step ${f.step}: ${seen} (expected ${f.status})` : '')
        + (verdictOk && !stepOk ? ' — the verdict flipped through some OTHER step; the named guard did not fire' : ''),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD MINES — FORGED-EVIDENCE BATTERY (dataset + artifact)');
console.log('══════════════════════════════════════════════════════════');

/**
 * `npm run forgeries -- <id> …` runs only the named entries (e.g. D01 R03). A PARTIAL RUN, labelled
 * as such in the summary; it never stands in for the battery (added 2026-11-09, as for mutations).
 */
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const SELECTED = ONLY.length ? FORGERIES.filter(f => ONLY.includes(f.id)) : FORGERIES;
if (ONLY.length) console.log(`  PARTIAL RUN (${ONLY.join(' ')}): ${SELECTED.length} of ${FORGERIES.length} registered entries — this is not the battery result`);

let rejected = 0;
let survived = 0;
for (const f of SELECTED) {
  const { ok, note } = runForgery(f);
  if (ok) rejected++; else survived++;
  console.log(`  ${ok ? 'REJECTED' : 'SURVIVED'} ${f.id} ${f.name}`);
  console.log(`           → ${note}`);
  if (!ok) console.log(`           → origin: ${f.origin}`);
}

// Declared survivors: run for real, printed, and NOT counted as failures. A survivor that has
// started being caught is reported so the registry can be corrected — pretending a known
// survivor is killed is worse than the survivor.
let stale = 0;
if (SURVIVORS.length > 0 && !ONLY.length) {
  console.log('\n  ── declared survivors (executed; expected to survive) ──');
  for (const f of SURVIVORS) {
    // `ok` means "the run matched the DECLARED expectation", and for a survivor the declared
    // expectation IS a clean pass. ok === true therefore means it still survives, as documented.
    const { ok, note } = runForgery(f);
    if (!ok) stale++;
    console.log(`  ${ok ? 'SURVIVED as declared' : 'NO LONGER SURVIVES (registry out of date)'} ${f.id} ${f.name}`);
    console.log(`           → ${note}`);
    console.log(`           → origin: ${f.origin}`);
  }
}

console.log('\n──────────────────────────────────────────────────────────');
console.log(`  ${rejected}/${SELECTED.length} forged-evidence cases rejected · ${survived} SURVIVED`
  + (SURVIVORS.length > 0 ? ` · ${SURVIVORS.length} declared survivor(s) run and listed above` : ''));
if (stale > 0) console.log(`  ${stale} declared survivor(s) no longer produce the verdict they declare — promote them into FORGERIES.`);
console.log('══════════════════════════════════════════════════════════\n');

if (survived > 0) process.exit(1);
export {};
