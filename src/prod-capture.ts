/**
 * The RAW production captures (liqd.com, 8–10 November 2026), read as recorded.
 *
 * data/mines-prod-full-6574bets.json is the scored dataset: one row per round in the package's Bet
 * shape, converted from these files in the private workshop. The Bet type has no field for the USDT
 * wallet amounts, the tiles each round PLANNED to open, the per-reveal replies or LIQD's own
 * verifier replies — they live here, in the captures the runner exported, vendored byte-identical
 * and pinned by SHA-256 (src/pins.ts PROD_CAPTURES). Step 22 binds the scored dataset to these files
 * row by row; Steps 3, 10, 14, 17, 18 and 21 read the rotations, the planned tiles and the wallet
 * amounts from them.
 *
 * Each file is one run of the runner, one JSON object per line, each with a type tag `t`:
 *   meta            the runner's plan, written before any round: every round's mine count, depth and
 *                   tile order (meta.plan[epoch].bets[i].tiles), the client-seed generators, the stakes
 *   option          an option given to start() (captures 2 and 3: the planned stake fiat, USD)
 *   pre             the active seed pair read before any bet (the pre-capture anchor)
 *   rotate          each seed rotation: the submitted client seed, the commitment it was submitted after (the capture's field `drawnAfter`), the reveal
 *   epoch           each epoch opening: its commitment, client seed, first nonce and phase
 *   intent          each round's spec (mine count, depth, planned tiles), journalled before its place-bet
 *   step            every request and reply: place-bet, open-tile, cash-out
 *   bet             the runner's record of each settled round (rec: placeRaw, settleRaw, steps, …)
 *   verify          LIQD's own verifier reply for each round, requested after the epoch was revealed
 *   stop, resume-check, recovered   capture 2 only: the one stop and its resume (src/pins.ts)
 *   bets-done, done, export-note
 *
 * The files are merged in the order of PROD_CAPTURES, which is the dataset's row order. Each
 * capture numbers its epochs from 0; `epoch` on the merged records is the DATASET's epoch number
 * (the capture's own number + the epochs of the captures before it, from src/pins.ts EPOCH_PLAN).
 *
 * Nothing here interprets a value. A pin mismatch or an unreadable line returns `problem` and an
 * empty capture, so every reader's coverage guard fails rather than scoring a partial file.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { PROD_CAPTURES, EPOCH_PLAN } from './pins';

export interface ProdEvent { t: string; at?: string; [k: string]: any }

/** One raw capture file, as read. */
export interface ProdCaptureFile {
  capture: number;
  file: string;
  sha256: string;
  lines: number;
  events: ProdEvent[];
  meta: any | null;
  pre: ProdEvent | null;
  /** Dataset epoch number of this capture's epoch 0. */
  epochOffset: number;
}

export interface ProdCapture {
  /** Null when every file was read, hashed to its pin and parsed line for line. */
  problem: string | null;
  /** The files, in PROD_CAPTURES order. */
  files: ProdCaptureFile[];
  /** Total lines over the files. */
  lines: number;
  /** Every rotation, with its capture index and — for a rotation that closes an epoch — that epoch's dataset number. */
  rotates: Array<ProdEvent & { capture: number }>;
  /** Every epoch event, with its capture index and dataset epoch number (`datasetEpoch`). */
  epochs: Array<ProdEvent & { capture: number; datasetEpoch: number }>;
  /** intent events by round key, with their capture and line index within it. */
  intents: Map<string, { ev: ProdEvent; capture: number; line: number }>;
  /** bet records (`rec` of each bet event) in dataset order, with capture, dataset epoch and line index. */
  bets: Array<{ rec: any; capture: number; epoch: number; line: number; at: string | undefined }>;
  /** step events by round key, in file order. */
  steps: Map<string, ProdEvent[]>;
  /** The line index (within its capture) of each round's first step event, by round key. */
  firstStepLine: Map<string, number>;
  /** LIQD verifier replies by bet id. */
  verify: Map<string, ProdEvent>;
  /** The planned tile order of every round, by bet id (the bet record's plannedTiles). */
  plannedTilesById: Map<string, number[]>;
}

const empty = (problem: string): ProdCapture => ({
  problem, files: [], lines: 0, rotates: [], epochs: [],
  intents: new Map(), bets: [], steps: new Map(), firstStepLine: new Map(), verify: new Map(), plannedTilesById: new Map(),
});

let cached: { root: string; cap: ProdCapture } | null = null;

/** Load (once per process) and pin-check the raw production captures under `repoRoot`. */
export function loadProdCapture(repoRoot: string): ProdCapture {
  if (cached && cached.root === repoRoot) return cached.cap;
  const cap: ProdCapture = { ...empty(''), problem: null };
  let problem: string | null = null;
  for (const pin of PROD_CAPTURES) {
    const p = path.join(repoRoot, pin.file);
    if (!existsSync(p)) { problem = `${pin.file} is absent`; break; }
    const raw = readFileSync(p);
    const sha256 = createHash('sha256').update(raw).digest('hex');
    if (sha256 !== pin.sha256) { problem = `${pin.file} hashes to ${sha256}, pinned ${pin.sha256}`; break; }
    const text = raw.toString('utf8').split('\n');
    if (text[text.length - 1] === '') text.pop();
    const events: ProdEvent[] = [];
    let bad = -1;
    text.forEach((l, i) => { try { events.push(JSON.parse(l)); } catch { if (bad < 0) bad = i + 1; } });
    if (bad >= 0) { problem = `${pin.file} line ${bad} is not JSON`; break; }
    const epochOffset = EPOCH_PLAN.findIndex(e => e.capture === pin.capture);
    const file: ProdCaptureFile = { capture: pin.capture, file: pin.file, sha256, lines: text.length, events, meta: null, pre: null, epochOffset };
    cap.files.push(file);
    cap.lines += text.length;
    events.forEach((ev, line) => {
      switch (ev.t) {
        case 'meta': file.meta = ev.meta ?? null; break;
        case 'pre': file.pre = ev; break;
        case 'rotate': cap.rotates.push({ ...ev, capture: pin.capture }); break;
        case 'epoch': cap.epochs.push({ ...ev, capture: pin.capture, datasetEpoch: epochOffset + Number(ev.epoch) }); break;
        case 'intent': cap.intents.set(String(ev.key), { ev, capture: pin.capture, line }); break;
        case 'step': {
          const key = String(ev.key);
          const a = cap.steps.get(key) ?? []; a.push(ev); cap.steps.set(key, a);
          if (!cap.firstStepLine.has(key)) cap.firstStepLine.set(key, line);
          break;
        }
        case 'bet': {
          cap.bets.push({ rec: ev.rec, capture: pin.capture, epoch: epochOffset + Number(ev.rec?.epoch), line, at: ev.at });
          const id = ev.rec?.settleRaw?.id ?? ev.rec?.betId;
          if (typeof id === 'string' && Array.isArray(ev.rec?.plannedTiles)) cap.plannedTilesById.set(id, ev.rec.plannedTiles);
          break;
        }
        case 'verify': if (typeof ev.betId === 'string') cap.verify.set(ev.betId, ev); break;
        default: break;
      }
    });
  }
  const out = problem ? empty(problem) : cap;
  cached = { root: repoRoot, cap: out };
  return out;
}

/** Integer 1e-`digits` units → a fixed decimal string (exact, no float). */
export function unitsToDecimal(u: bigint, digits: number): string {
  const neg = u < 0n, a = neg ? -u : u, scale = 10n ** BigInt(digits);
  return `${neg ? '-' : ''}${a / scale}.${String(a % scale).padStart(digits, '0')}`;
}

/** Exact decimal string or number → integer units at 10^scaleDigits, or null when not on that grid. */
export function decimalUnits(v: unknown, scaleDigits: number): bigint | null {
  const s = typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(scaleDigits + 4) : '') : typeof v === 'string' ? v.trim() : '';
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = (m[3] ?? '');
  const head = frac.slice(0, scaleDigits).padEnd(scaleDigits, '0');
  const tail = frac.slice(scaleDigits);
  if (/[1-9]/.test(tail)) return null;                    // a digit below the grid: not representable
  const u = BigInt(m[2]) * 10n ** BigInt(scaleDigits) + BigInt(head || '0');
  return m[1] === '-' ? -u : u;
}
