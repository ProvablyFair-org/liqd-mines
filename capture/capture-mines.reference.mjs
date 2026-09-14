// ============================================================================
//  REFERENCE RECORD — NOT A RUNNABLE TOOL
//
//  This file documents how the audited dataset (data/mines-master-6900bets.json)
//  was produced. Authentication, session handling, and all credential material
//  have been REMOVED: the constants below are placeholders and the transport
//  layer is reduced to a stub. It is published so a reader can see the capture
//  methodology — the phase plan, the request/response shape, the seed-rotation
//  discipline, and the inline verification performed at capture time — not so
//  the capture can be replayed.
//
//  The dataset itself is the audited artifact; every computational claim in this
//  report is reproducible from it via `npm test`. Capture provenance (that these
//  are real rounds settled on the operator's system) is attested by the auditor,
//  not re-derivable from this repository. See scope-and-methodology.md
//  (Limitations) and evidence.md (E01 provenance note).
//
//  Verification helpers referenced here (minesFor / commitHash / sameMines /
//  minesMultiplierExact) are the same functions shipped in src/rng.ts and
//  src/config.ts, which the verifier uses.
// ============================================================================

// ── Capture plan (as executed: 6,900 bets, 50 per seed epoch, 138 epochs) ────
//   A  4,800  $0.10  all 24 mine-counts × 200         (full config grid)
//   B  1,000  $0.10  mineCount 24 deep sample          (highest single-tile variance)
//   C    200  $10    mineCount 3                       (stake independence, 100× base)
//   D    500  $0.10  all 24 mine-counts cycled,
//                    10 auditor-controlled client seeds (pfaudit-…)
//   E    400  $0.10  mineCount 3, 5 tiles opened       (multi-reveal payout path)
//
//   Each round is placed through the operator's atomic auto-bet endpoint, which
//   places the bet, opens the requested tiles in order, and settles in one call.
//   The settle response carries: mineTiles[], openTiles[], nonce, clientSeed,
//   serverSeedId, betAmount, winningAmount, multiplier, result.

const EPOCH = 50;                                        // bets per seed pair
const MINE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1);
const AMT_LOW = 0.10, AMT_STAKE = 10;

// ── Endpoints (paths as observed; host redacted) ─────────────────────────────
const BASE = '<REDACTED>/api/v1';
const EP = {
  active:  `${BASE}/fast-games/provably-fair/active`,    // GET  current commitment + client seed + nonce
  rotate:  `${BASE}/fast-games/provably-fair/rotate`,    // POST reveals the active server seed, activates the next
  autobet: `${BASE}/fast-games/mine-game/auto-bet`,      // POST place + open tiles + settle (atomic)
};

// ── Transport (REDACTED) ─────────────────────────────────────────────────────
// The live rig authenticated with an operator session credential supplied out of
// band, and implemented request timeouts, error classification (AUTH / TRANSIENT
// / API), and patient retry with backoff on transient failures. None of that is
// reproduced here.
async function http(/* method, url, body */) {
  throw new Error('REFERENCE RECORD — transport removed; this script does not run.');
}

// ── Seed lifecycle ───────────────────────────────────────────────────────────
// Commitments are read BEFORE any bet is placed. At the end of every 50-bet
// epoch the seed pair is rotated, which reveals the epoch's server seed and
// activates the pre-committed next seed. Two invariants are checked per epoch:
//   commit  : SHA-256(utf8(revealedServerSeed)) === the hash committed before play
//   chain   : the previously committed nextServerSeedHash === the new active hash
// The capture ends with a final rotation so that 100% of bets map to a revealed
// seed — no unverifiable bets ship.
//
// CLIENT-SEED GENERATION
// This reference specifies `audit` plus six CSPRNG bytes, drawn after recording the
// applicable server commitment, for 128 non-Phase-D epochs. Historical use of this
// generator and capture chronology are auditor-attested. The dataset's seed format
// and distinct values are consistent with the reference; they do not prove which
// generator produced those strings.
// All ten Phase-D epochs use timestamp-derived custom seeds to exercise input
// participation. That construction does not establish unpredictability.
// See AUDIT_CONTEXT.md#outcomes-and-client-seeds for the evidence and production plan.
import { randomBytes } from 'node:crypto';
const newAuditClientSeed = () => `audit${randomBytes(6).toString('hex')}`;   // e.g. audit74baf9a15795
const phaseDClientSeed   = (stamp, epoch) => `pfaudit-${stamp}-${epoch}`;    // Phase D only — timestamp-derived BY DESIGN, all 10 epochs

const getActive = async () => http('GET', EP.active);
const rotate    = async (clientSeed) => http('POST', EP.rotate, { clientSeed });
const autoBet   = (clientSeed, mineCount, tiles, amount) =>
  http('POST', EP.autobet, { betAmount: amount, currencyId: '<REDACTED>', clientSeed, mineCount, tiles });

// ── Inline verification performed at capture time ────────────────────────────
// Three independent checks per bet, so an integrity problem is caught during the
// run rather than after it. (2) is the payout-hardening rule: the credited amount
// is checked against the multiplier RECOMPUTED from the revealed seed — never
// against the operator's served `multiplier` display field, which on this
// platform is floored to 2 decimals and understates the amount actually paid.
function verifyEpoch(bets, hashedServerSeed, revealedServerSeed) {
  const commitOk = commitHash(revealedServerSeed) === hashedServerSeed;
  let bad = 0, creditBad = 0, balBad = 0, balChecked = 0;
  let prevBal = null;

  for (const b of bets) {
    // (1) mine layout recomputes from the revealed seed (order-sensitive)
    const local = minesFor(revealedServerSeed, b.clientSeed, b.nonce, b.mineCount);
    b.verified = sameMines(local, b.mineTiles);
    if (!b.verified) bad++;

    // (2) CREDITED amount == stake × EXACT recomputed multiplier (display field not trusted)
    const stake = Number(b.betAmount), win = Number(b.winningAmount || 0);
    const k = (b.openTiles ? b.openTiles.length : b.reveals) || 1;
    const expected = b.result === 'won' ? stake * minesMultiplierExact(b.mineCount, k) : 0;
    b.creditedOk = Math.abs(win - expected) < 1e-6;
    if (!b.creditedOk) creditBad++;

    // (3) wallet delta == winningAmount − betAmount, where the settle exposes a balance.
    //     This operator's settle response carried no balance field, so this check could
    //     not run. Wallet reconciliation is excluded in AUDIT_CONTEXT.md.
    if (b.balance != null) {
      if (prevBal != null) {
        const delta = Number(b.balance) - prevBal;
        b.balanceOk = Math.abs(delta - (win - stake)) < 1e-6;
        balChecked++;
        if (!b.balanceOk) balBad++;
      }
      prevBal = Number(b.balance);
    }
  }
  return { commitOk, bad, creditBad, balChecked, balBad };
}

// ── Round flow ───────────────────────────────────────────────────────────────
// Tiles opened are distinct positions in 1..25, advanced across rounds so the
// reveal positions are not fixed. Phase E opens 5 tiles per round; all other
// phases open 1.
async function playRound(clientSeed, mineCount, reveals, tileStart, amount) {
  const tiles = [];
  for (let r = 0; r < reveals; r++) tiles.push(((tileStart + r - 1) % 25) + 1);
  const settle = await autoBet(clientSeed, mineCount, tiles, amount);
  return { settle, opened: settle.openTiles || tiles };
}

// ── Dataset shape written ────────────────────────────────────────────────────
// {
//   meta:  { audit, platform, gameId, schema, houseEdge, currency, epochSize,
//            plannedTotal, phases{}, startedAt, finishedAt, preCapture{} },
//   seeds: [ { epoch, phase, clientSeed, hashedServerSeed, nextHashedServerSeed,
//              serverSeed, nonceStart, nonceEnd, commitVerified, chainLinkOk } ],
//   bets:  [ { at, epoch, phase, id, mineCount, reveals, openTiles, mineTiles,
//              nonce, clientSeed, serverSeedId, hashedServerSeed, betAmount,
//              winningAmount, multiplier, result, verified, currentGameSettings } ]
// (No `balance` field: this operator's settle response carries none — see R-CREDIT.)
// }
//
// The delivered dataset is hash-pinned; the verifier aborts on any single-byte
// change. See MANIFEST.md.

export { EPOCH, MINE_COUNTS, AMT_LOW, AMT_STAKE, EP, playRound, verifyEpoch };
