# LIQD Mines: clean-room algorithm specification

Copy of the framework spec (SHA-256 726280545ae7fb9dc6f7d9fb14c15cf05156526cac49cabfeb4e7ac18a9fd4f5, revision of 21 Oct 2026); local workspace paths and tool names replaced by neutral wording, nothing else changed. src/rng.ts cites SHA-256 3576d1ea84586182afb8715450b340c6a86f0d50be705c6273eef602ebaf2231, the first revision, from which it was rebuilt; the 21 Oct revision only closes O5 (tile numbering on the grid: §1.1, §6, §8 and the PAGE source list) and changes no step the module implements.

Written 20 Oct 2026 for the ProvablyFair.org audit of LIQD Mines (LIQD Originals,
`qa.liqd.com` / `liqd.com`, game id `fast-games-13`).

This document is the only input an implementer needs to rebuild LIQD Mines'
mine layout and settlement. It was written without opening any LIQD source code,
any LIQD JS bundle, any port of it, any audit-package code, or any capture of
LIQD's Verify tab (§8 lists every file and URL opened, and what was deliberately
not opened). Every step names where it came from:

- **PAGE**: LIQD's own screens and pages, quoted from the evidence images in
  `repositories/liqd/mines/evidence/` (E10–E14, E21; E22 added 21 Oct 2026 for O5) and from
  `evidence/rtp-page-labels-2026-10-01.json` (verbatim text of
  `https://liqd.com/originals/mines`, read logged out on 1 Oct 2026).
- **STANDARD**: the standard provably-fair construction (SHA-256 commitment to a
  server seed; HMAC-SHA256 keyed by the server seed over
  `clientSeed:nonce:cursor`; 4 bytes to an unsigned integer; Fisher–Yates
  shuffle; rejection sampling against modulo bias; multiplier = (1 − edge) /
  P(win)).
- **DATA**: fixed by testing standard candidates against every one of the
  **8,900** live rounds in `repositories/liqd/mines/data/`:
  - `mines-master-6900bets.json` (6,900 rounds, 30 Jul 2026, phases A–E,
    schema `liqd-mines-capture-v1`),
  - `liqd-mines-capture-v3-2026-09-26T16-46-41-121Z.json` (1,000 multi-reveal
    rounds, 26 Sep 2026, phase E),
  - `liqd-mines-capture-v3-2026-10-03T11-58-54-479Z.json` (1,000 multi-reveal
    rounds, 3 Oct 2026, phase E).

  The data chose; LIQD's code did not.

No public page found states the algorithm. LIQD's pages name the inputs (Verify
panel fields) and the economics (edge, rounding statement); everything in §2 and
the settlement arithmetic in §3 were settled by DATA.

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | **32 lowercase hex characters** (16 bytes); secret until the pair is rotated | PAGE: "Active Server Seed (Hashed)", "Next Server Seed", "Rotate Seed Pair" (E12, E13); revealed "Server Seed" `dbf64972d6475b73158a43172a0fc33d` (E21). DATA: all 181 revealed seeds are 32 hex characters |
| `clientSeed` | text string | PAGE: "Active Client Seed" / "Next Client Seed" with a CHANGE button (E12, E13; default shown as 32 hex characters, e.g. `967a24170b415997c3b37449ba3494c8`). DATA: 17-character audit seeds (`audit` + 12 hex) on 7,400 rounds, 25-character player-set seeds on 500 (phase D) |
| `nonce` | integer ≥ 0; 0 on the first round after a rotation, +1 per round | PAGE: "Total bets made with pair: 0" on a fresh pair (E12, E13); "Nonce" field of the Verify panel (E11, E21). DATA: every one of the 178 epochs carries nonces exactly 0…49 |
| `mines` (m) | integer 1…24 | PAGE: "Number of mines" slider, gems 22 / mines 3 (E10, E14); "You decide how many are mines, 1 to 24" (mines page, 1 Oct). DATA: all 24 values captured |
| `amount` | stake, decimal (8 decimals in the UI: "1.00000000", E14) | DATA: `betAmount` 0.1 and 10 |
| opened tiles | ordered list of distinct tiles chosen by the player | DATA: `openTiles` (and `openOrder` / `steps[]` in the v3 captures) |

The board has 25 tiles (PAGE: 5 × 5 grid, E10, E14; "Twenty-five tiles"). In
every record tiles are numbered **1…25** (DATA: min 1, max 25 over all opened
and mine tiles). Tile 1 is the top-left cell and tiles run across rows, left
to right: tile t is in row ⌈t/5⌉, column ((t − 1) mod 5) + 1 (PAGE: E22, the
finished board of the E21 round; O5, closed 21 Oct 2026).

The Verify panel asks for exactly four values for Mines: "Client Seed", "Server
Seed", "Nonce", "Mines" (E11, E21). The layout depends on those four only.

### 1.2 Commitment

PAGE shows a hashed active server seed and the hash of the next server seed
before it is used (E12/E13: "Active Server Seed (Hashed)" and "Next Server
Seed", both 64 hex characters). No page read says which hash or which bytes.

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

i.e. hash the **32 ASCII characters** of the seed, **not** the 16 bytes they
encode. (Note that the HMAC key in §2 is the decoded 16 bytes: the two steps
use different forms of the same seed.)

- SOURCE: STANDARD (SHA-256, hex output) + DATA (byte form).
- Candidates: SHA-256 over the ASCII string → **178 / 178** distinct round
  commitments resolve, covering **8,900 / 8,900** rounds; over the hex-decoded
  16 bytes → **0 / 178**.
- Pairing seeds to rounds: **by hashing.** Build `{commitment(seed): seed}` over
  every revealed seed in the files (epoch `serverSeed`, `rotateRaw.revealedServerSeed`,
  `meta.preCapture.revealedServerSeed`; 181 distinct) and look up each round's
  `hashedServerSeed`. In these files the epoch record's own seed also hashes to
  its own `hashedServerSeed` (178 / 178), but the lookup must not rely on that.
- Forward commitment: the `nextHashedServerSeed` shown before each rotation
  equals the active hash after it on **175 / 175** rotations, and each file's
  `preCapture.nextHashedServerSeed` equals epoch 0's active hash (3 / 3).

---

## 2. Mine layout derivation

### Step 1: one HMAC per draw (cursor = draw index)

```
key        = hex_decode(serverSeed)                                    # 16 bytes
digest(i)  = HMAC-SHA256(key, UTF-8(clientSeed + ":" + dec(nonce) + ":" + dec(i)))
```

`dec(x)` is plain base 10, no padding, no sign (`0`, `2`, `38`). Draw `i`
(i = 0, 1, …, m − 1) uses its own digest with cursor `i`. Example message:
`auditddad46097947:0:0`.

- SOURCE: STANDARD (HMAC-SHA256, server seed as key, `client:nonce:cursor` as
  message) + DATA for key form, separator and cursor.
- DATA: see the sweep in "How the candidates were settled" below. Nearest
  neighbours on all 8,900 rounds (as a set / in served order): ASCII key
  74 / 23; cursor `i+1` 69 / 30; cursor `24−i` 91 / 31; message `c:n-i` 92 / 27.

### Step 2: bytes to an offset in [0, r)

```
draw(i, r):
    LIMIT = floor(2^32 / r) * r
    for off in 0, 4, 8, …, 28:
        v = digest(i)[off .. off+3] read as unsigned 32-bit BIG-ENDIAN
        if v < LIMIT: return v mod r
    # all 8 chunks rejected: see O1
```

- SOURCE: DATA for "first 4 bytes, big-endian, mod r"; STANDARD for the
  rejection loop. `2^32 mod r ≠ 0` for 20 of the 24 ranges 2…25 (all but 2, 4,
  8, 16); a chunk is rejected with probability ≤ 4.9 × 10⁻⁹ per draw.
  **0 rejected chunks in 103,610 draws** (Σ m over 8,900 rounds), so the data
  cannot tell rejection from plain `v mod r`: both give 8,900 / 8,900 (O1).

### Step 3: forward Fisher–Yates over tiles 1…25, mines = the first m

```
a = [1, 2, 3, …, 25]
for i in 0 … m−1:
    r = 25 − i                 # 25, 24, …, 26 − m
    j = i + draw(i, r)         # i ≤ j ≤ 24
    swap a[i], a[j]
mines = a[0 .. m−1]            # IN THIS ORDER: a[i] is the i-th mine placed
```

- SOURCE: STANDARD (Fisher–Yates, forward form) + DATA for direction, which end
  holds the mines, the 1-based tile values and the order.
- The served `mineTiles` list equals `mines` **in order** (not sorted) on
  **8,900 / 8,900** rounds. Compare as an ordered list; the order is part of
  what is reproduced.
- Draws beyond `m` (a full 24-step shuffle) would not change `a[0..m−1]`;
  whether LIQD performs them is unobservable and irrelevant to the layout.
- The layout depends only on (serverSeed, clientSeed, nonce, m), not on the
  stake or on the tiles the player opens.

### How the candidates were settled

1. **Sweep on 300 random rounds** (`sweep.py`): key (ASCII string, hex-decoded
   bytes) × hash (HMAC-SHA256, HMAC-SHA512) × message (`c:n:k`, `c:n-k`,
   `c-n-k`, `n:c:k`, `c:n` then `c:n:k`) × stream (one digest per draw with
   cursor = draw index; one continuous stream `k = 0, 1, …` consumed 4 bytes at a
   time) × unit (Stake-style float from 4 bytes, u32 big-endian mod r, u32
   little-endian mod r) × selection (pick-from-remaining list "splice", backward
   Fisher–Yates first m, backward last m, forward Fisher–Yates first m,
   draw-until-m-distinct) = **600 combinations**. Exactly one scored 300 / 300
   (as a set and in order): hex key, HMAC-SHA256, `c:n:k`, per-draw digest, u32
   BE, forward Fisher–Yates. Next best: the same with `c:n` for k = 0 (99 / 300
   as a set, 9 in order), splice (45 / 300).
2. **Full dataset** (`spec_check.py`, output in §7): the spec and its
   neighbours on all 8,900 rounds.

---

## 3. Win condition and payout

### 3.1 Win condition

Let `opened = [p₁, …, p_k]` be the tiles opened, in order, distinct, in 1…25.

```
loss ⇔ some pₜ ∈ mines; the round ends on that tile (it is the last one opened)
win  ⇔ no pₜ ∈ mines; the player cashed out after k ≥ 1 safe tiles
```

- SOURCE: PAGE for the game shape ("Then you open tiles until you cash out, or
  you don't", mines page 1 Oct; E14 shows gems, bombs and a cash-out tile) +
  DATA for the rule: `result` agrees on **8,900 / 8,900**; every loss ends on
  exactly the first mine opened, **4,999 / 4,999**; in the v3 captures
  `steps[].mineTile` equals `tile ∈ mines` on **6,732 / 6,732** steps; win depth
  equals the planned reveal count on **3,901 / 3,901** wins.

### 3.2 Fair and edged multiplier

```
fair(m, k) = ∏_{t=0}^{k−1} (25 − t) / (25 − m − t) = C(25, k) / C(25 − m, k)
edged(m,k) = 0.99 × fair(m, k)
```

- SOURCE: STANDARD (1 / P(survive k reveals)) + PAGE for the edge ("Edge:
  1.00%", "House Edge 1%", "99% RTP at every setting", mines page 1 Oct; bet
  record `currentGameSettings` `"houseEdge":1` on 3,844 master rounds) + DATA
  (payout below matches only with 0.99).
- Page check: "1.03x on the safest first pick" = edged(1,1) = 1.03125 shown cut
  to 2 dp; "5,148,297x if you ever clear a 12-mine board" = edged(12,13) =
  0.99 × 5,200,300 = 5,148,297 exactly.

### 3.3 Displayed multiplier (`multiplier` field)

```
multiplier = floor( edged(m, k) , 2 decimals )          # cut, not rounded
```

- DATA: on all 8,900 rounds, floor-2dp of the exact edged value matches
  **3,872 / 3,901** wins; round-half-up-2dp matches **1,389**. The 29 misses are
  explained in §3.5. E14 shows the same: 3 mines, 1 tile, "1.12x" while the
  edged value is 1.125.
- **This contradicts the mines page**, which says: "Multipliers are rounded to
  two decimals rather than cut, so the realised edge moves a little with the
  exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal
  1%." On the captured data the multiplier field is cut, and the payout (§3.4)
  does not use the 2-decimal multiplier at all (O2).
- On a loss the field is absent (master, 3,796) or null (v3, 1,203).

### 3.4 Payout (`winningAmount`)

```
win : winningAmount = floor( amount × edged(m, k) , 8 decimals )
loss: winningAmount = 0
```

computed **exactly** (rational or decimal arithmetic), floor toward zero at
8 decimals.

- DATA (per file, wins):

  | File | wins | exact floor8 | exact floor2 multiplier | IEEE-double variant (§3.5) |
  |---|---|---|---|---|
  | master, 30 Jul | 3,104 | **3,104** | **3,104** | 3,104 / 3,104 |
  | v3, 26 Sep | 404 | 354 | 375 | **404 / 404** |
  | v3, 3 Oct | 393 | **393** | **393** | 354 / 370 |

  Losses pay 0 on **4,999 / 4,999**. Other candidates on all 3,901 wins:
  floor8(amount × served 2-dp multiplier) **465**; half-up8 of the exact
  product 2,852; ceiling 2,004.
- SOURCE: STANDARD (stake × multiplier) + DATA (which multiplier, floor,
  8 decimals). The framework profile's MINES-11 reference names "floor8" for
  LIQD; the data settled it independently.

### 3.5 Arithmetic changed between 26 Sep and 3 Oct 2026

On the 26 Sep capture the server evidently computed in IEEE-754 doubles. Two
cells show it: (m = 1, k = 10), exact edged 1.65, served multiplier **1.64** and
payout **0.16499999** on 29 / 29 wins; (m = 1, k = 15), exact 2.475, payout
**0.24749999** on 21 / 21 wins. On 3 Oct the same cells serve 1.65 / 0.165
(23 / 23) and 2.47 / 0.2475 (16 / 16). The master capture hits neither cell.

The 26 Sep behaviour is reproduced (404 / 404 wins, multiplier and payout) by:

```
x = 1.0
for t in 0 … k−1:  x = x * ((25 − t) / (25 − m − t))     # quotient first, each in double
M = x * 0.99                                               # in double
multiplier = floor(M × 100) / 100 ;  winningAmount = floor(amount × M × 1e8) / 1e8
```

Of 126 double-precision combinations tried (7 ways to form `fair`: product of
quotients, multiply-then-divide, comb ratio, inverse of a probability product
(two forms), inverse of a comb-ratio probability, integer numerator /
denominator; × 6 ways to apply the edge; × 3 floors), the 18 that score
404 / 404 all use the product of quotients above; the edge form and the
floor form are not separated by the data. **Spec for an audit of current
behaviour: §3.4 exact arithmetic.** An implementer reproducing the 26 Sep file
must use this double form (O3).

### 3.6 Limits

`currentGameSettings` on 3,844 master rounds: `{"minOdds":1.01,"maxOdds":10000,
"houseEdge":1,"minBet":0.1,"maxBet":5000}`. No captured win exceeds 10000 or
falls below 1.01 (edged ≤ 10000: 3,901 / 3,901; ≥ 1.01: 3,901 / 3,901). The
mines page advertises a 5,148,297x ceiling, above `maxOdds`; how a cell above
10000 is paid is unwitnessed (O4).

### 3.7 Fields an implementation must not read

`mineTiles`, `localMines`, `verified`, `commitVerified`, `chainLinkOk`,
`result`, `multiplier`, `winningAmount`, `steps[].mineTile` are claims (the
operator's, or a capture script's), to be checked. The derivation reads only
`serverSeed`, `clientSeed`, `nonce`, `mineCount`, `betAmount`, the opened tiles
in order, and the edge 0.01.

---

## 4. Source per step (summary)

| Step | Source | Evidence |
|---|---|---|
| Inputs: client seed, server seed, nonce, mines | PAGE | E11, E21 Verify fields; E12/E13 seed panel |
| Commitment SHA-256, hex output | STANDARD + PAGE | E12/E13 show 64-hex hashed seed |
| Hash input = 32 ASCII characters | DATA | 178/178 (hex-decoded 0/178) |
| Forward chain next hash → active hash | PAGE + DATA | E12/E13 "Next Server Seed"; 175/175 + 3/3 pre-capture |
| HMAC-SHA256, key = hex-decoded 16 bytes | STANDARD + DATA | 8,900/8,900 (ASCII key 74) |
| Message `clientSeed:nonce:i`, one digest per draw, i from 0 | STANDARD + DATA | 1 of 600 combinations on 300; 8,900/8,900 |
| First 4 bytes, u32 big-endian, mod r | DATA | 8,900/8,900 (LE, float ≤ 12/300) |
| Rejection ≥ floor(2³²/r)·r, next chunk | STANDARD | 0 rejections in 103,610 draws; O1 |
| Forward Fisher–Yates of 1…25, mines = a[0..m−1] in order | STANDARD + DATA | 8,900/8,900 in served order |
| Win ⇔ no opened mine; bust on first mine | PAGE + DATA | 8,900/8,900; 6,732/6,732 steps |
| edged = 0.99 × C(25,k)/C(25−m,k) | STANDARD + PAGE + DATA | "Edge: 1.00%"; 3,901 wins via §3.4/3.5 |
| `multiplier` = floor 2 dp of edged | DATA (contradicts PAGE) | 3,872/3,901 exact; 29 = §3.5 |
| Payout = floor8(amount × edged), exact | DATA | master 3,104/3,104; 3 Oct 393/393 |
| 26 Sep payout in IEEE doubles | DATA | 404/404 (exact 354) |

---

## 5. Test vectors (from the dataset)

Seed found by hashing. "offsets" lists `draw(i, 25 − i)` for i = 0 … m − 1;
draw i swaps `a[i]` with `a[i + offset]`. Edge 0.01 throughout.

**V1: round `CoDG1Ttnxal3dRlqqYozn`** (master, phase A, m = 1, win)
```
serverSeed  d1148d001c0ce343dcd526a17ab07de0
commitment  7ec1c4082572c9024863cfd98d32626586094f8308bd73b90965d10bed5796e3
clientSeed  auditddad46097947   nonce 0   mines 1   amount 0.1
HMAC(c:n:0) d6a9b79cade413b0e5bba6627d488435fb546b080db3ba334a1c2da737b404e9   u32 3601446812 → offset 12
mines [13]                    served mineTiles [13]
opened [2] → win, k = 1       edged 33/32 = 1.03125
multiplier 1.03 (served 1.03)   winningAmount 0.103125 (served 0.103125)
```

**V2: round `yFteHHqALXv-FQDvbizCd`** (master, phase B, m = 24, win)
```
serverSeed  72209686500593d7ff971a3848ff17b2
commitment  88244482041d4da91e1121ef8c106fc2a01affca138458535578e1301361f152
clientSeed  audit36a14db8902c   nonce 4   mines 24   amount 0.1
HMAC(c:n:0) db7b9d15550ee2dd28f85bcd0744f49be501e13413af528298f95ddc3a849c96   u32 3682311445 → offset 20
offsets 20 9 11 12 17 12 6 3 2 1 3 13 9 9 9 1 0 6 3 0 1 3 0 1
mines (draw order) 21 11 14 16 22 18 13 2 8 9 3 25 5 23 24 17 4 15 7 20 19 12 10 1   (= served, same order)
opened [6] → win, k = 1       edged 99/4 = 24.75
multiplier 24.75   winningAmount 2.475   (served 24.75 / 2.475)
```

**V3: round `zV2W_lviablGhLozxmRdo`** (master, phase C, m = 3, stake 10)
```
serverSeed  aa25dc6c599ec12f86008226ed60cb11
commitment  66c283a045f5fa95fe2f4a8102d8f59877c067aef045be210e9d59596b1bbd22
clientSeed  audit7a476e8c79bf   nonce 0   mines 3   amount 10
HMAC(c:n:0) 70229348792baf639954ef3402f529e4c413f27aa8feaa58029353ba8d142f55   u32 1881314120 → offset 20
offsets 20 16 11
mines [21, 18, 14]            served [21, 18, 14]
opened [2] → win, k = 1       edged 9/8 = 1.125
multiplier 1.12 (cut; served 1.12)   winningAmount 11.25 (served 11.25)
```

**V4: round `nAHjdueZxwIfjnCCs-J3c`** (v3 3 Oct, phase E, m = 12, five tiles)
```
serverSeed  cf5c6ca7bb3a767e9d9821c01a0c48cf
commitment  df6cbf4cfe28cc8f2903c910b5bf134b6faca3690bdc850d4ecba0bf2b36f08d
clientSeed  auditc956a502047c   nonce 39   mines 12   amount 0.1
HMAC(c:n:0) ce7c610ded9d82fcb73b1abc2d91cf1a12a4545bc8c92d20bb24bc933d36274b   u32 3464257805 → offset 5
offsets 5 0 18 16 7 1 2 9 9 5 3 9
mines [6, 2, 21, 20, 12, 7, 9, 17, 18, 15, 14, 3]   (= served, same order)
opened [5, 4, 25, 19, 23] → all safe → win, k = 5
fair 1610/39   edged 5313/130 = 40.869230769…
multiplier 40.86 (served 40.86)   winningAmount floor8(0.4086923076…) = 4.08692307 (served 4.08692307)
```

**V5: round `qA99nXR17am2VS8TFGs2L`** (v3 3 Oct, phase E, m = 12, bust on the third tile)
```
serverSeed  58e66c2fe517062b6e8a80cfe57024fc
commitment  d5eec12147e265db7b3d971670e9327145e1b8bd24421dcabfdfadbd2fcb8aca
clientSeed  audit1ef7fc9bc054   nonce 38   mines 12   amount 0.10000000
HMAC(c:n:0) c9740228cfc293d33c3c9981d5a9d9730c7992928fae62352f6b343fb5491aa1   u32 3379823144 → offset 19
offsets 19 8 16 18 19 19 8 2 5 14 1 8
mines [20, 10, 19, 22, 24, 25, 15, 2, 14, 5, 12, 1]   (= served, same order)
opened 11 (safe), 23 (safe), 2 (mine) → loss
multiplier null   winningAmount 0
```

**V6: the arithmetic change (§3.5)**, same cell (m = 1, k = 10, amount 0.1), edged exactly 1.65:
```
26 Sep  round UndR3BTtnZGQYkuK40JJP  seed ba11c95fa563fc543b853e7d6b7aa4db  client audit9c27195c9cc2  nonce 2
        mines [4]; opened 5 14 3 18 1 2 24 15 8 25 → win
        served multiplier 1.64, winningAmount 0.16499999   (double form: x*0.99 = 1.6499999999999997)
3 Oct   round ANzaCMtkIHnSR1dl62YcB  seed 58e66c2fe517062b6e8a80cfe57024fc  client audit1ef7fc9bc054  nonce 2
        mines [8]; opened 23 17 16 9 12 13 6 18 4 7 → win
        served multiplier 1.65, winningAmount 0.165        (exact form, §3.4)
```

---

## 6. Open points the public sources do not settle

- **O1: rejection.** 0 rejected chunks in 103,610 draws (expected < 5.1 × 10⁻⁴
  rejections: ≤ 4.9 × 10⁻⁹ per draw), so rejection vs plain `v mod r` is unwitnessed. Plain mod biases
  each offset by at most r/2³² (≤ 5.8 × 10⁻⁹), above the profile MINES-08 floor
  of 2⁻³² for the 20 non-power-of-two ranges; which form LIQD uses therefore
  matters for MINES-08. To settle: search a revealed seed for a nonce whose
  first chunk is ≥ LIMIT and compare the operator's result; or LIQD's written
  rules.
- **O2: page vs data on rounding.** The mines page (1 Oct) says multipliers are
  "rounded to two decimals rather than cut" and the realised edge varies
  "between 0.64% and 1.44%". On all three captures (30 Jul, 26 Sep, 3 Oct) the
  2-dp multiplier is cut (floor) and the payout uses the unrounded edged value
  floored at 8 decimals, which gives 1 % edge (less sub-1e-8 dust) on every
  setting. The page describes something the captured settlement does not do.
- **O3: arithmetic changed between 26 Sep and 3 Oct.** §3.5. Two cells pay
  1e-8 less than exact on 26 Sep (house side, 50 rounds) and the multiplier
  field reads 1.64 for 1.65. The edge-application and floor forms of the double
  version are not separated by the data.
- **O4: maxOdds cap.** `maxOdds` 10000 in the bet records vs the page's
  5,148,297x ceiling. No captured cell reaches 10000; behaviour above it is
  unwitnessed.
- **O5: tile numbering on the grid. Closed 21 Oct 2026.** Records use 1…25,
  and no LIQD page read states which grid cell is tile 1. E22
  (`evidence/E22-e21-round-finished-board.png`) is the finished board of the
  E21 round (client `pfins955ca8a286aac3b6`, nonce 0, mines 3, whose revealed
  seed `dbf64972d6475b73158a43172a0fc33d` gives mines [12, 1, 25] under this
  spec). It shows three mines: row 1 column 1, row 3 column 2, row 5 column 5.
  Of the eight numberings that start at a corner and run along rows or along
  columns, only one puts tiles 1, 12 and 25 on those cells: tile 1 top-left,
  across rows (down columns from top-left would put tile 12 at row 2 column 3).
  Tile t is in row ⌈t/5⌉, column ((t − 1) mod 5) + 1. This closure was added
  after the first revision of this spec (SHA-256 3576d1ea…baf2231), outside
  the clean-room pass; its only source is E22, and it changes no step of
  §2–§5 (the layout is computed as tile numbers 1…25, with no grid geometry).
- **O6: no written algorithm.** No LIQD page read states HMAC, the key form
  (and the asymmetry: ASCII for the commitment, decoded bytes for the key), the
  cursor, or the shuffle. Live pages could not be re-read on 20 Oct: plain GET
  returned 403 (Cloudflare) and the headless browser failed to load (§8).
- **O7: higher stakes / tiers.** Only stakes 0.1 and 10 were captured, edge
  0.01 on all; `maxBet` 5000. No tiering evidence either way.
- **O8: client-seed encoding beyond ASCII.** UTF-8 assumed; all captured seeds
  are ASCII.

---

## 7. Reproduction of this spec

Throwaway scripts in the session scratchpad (`liqd-mines-spec/`: `load.py`,
`sweep.py`, `spec_check.py`, `payout_check.py`, `mism.py`, `dbl.py`,
`perfile.py`, `misc.py`, `vectors.py`), run on every round, 20 Oct 2026.

`python3 -I spec_check.py`:
```
revealed seeds 181 distinct bet commitments 178
commitment SHA256(ascii 32-char seed) resolves 178 / 178 commitments, 8900 / 8900 bets
commitment SHA256(hex-decoded 16 bytes) resolves 0 / 178
spec (hex key, c:n:i, u32BE, rejection, forward FY, first m): as set 8900/8900, in served order 8900/8900
same, plain v mod r: as set 8900/8900, in served order 8900/8900
ascii key: as set 74/8900, in served order 23/8900
cursor i+1: as set 69/8900, in served order 30/8900
cursor 24-i: as set 91/8900, in served order 31/8900
message c:n-i: as set 92/8900, in served order 27/8900
rejection census (spec variant counted first): {}
```

`python3 -I payout_check.py` (selected lines):
```
outcome match: 8900
wins: 3901
win depth == planned reveals: 3901
multiplier == floor2(0.99*fair): 3872
multiplier == half_up2(0.99*fair): 1389
amount_won == floor8(amount*0.99*fair): 3851
amount_won == floor8(amount*served 2dp multiplier): 465
bust ends on first mine (mine is last opened): 4999
loss pays 0: 4999
steps: 6732
step mineTile match: 6732
```

`python3 -I perfile.py`:
```
mines-master-6900bets.json wins 3104
    exact: multiplier == floor2(0.99*fair) 3104
    exact: amount_won == floor8(amount*0.99*fair) 3104
    double: multiplier == floor2(prod*0.99) 3104
    double: amount_won == floor8(amount*prod*0.99) 3104
liqd-mines-capture-v3-2026-09-26T16-46-41- wins 404
    exact: multiplier == floor2(0.99*fair) 375
    exact: amount_won == floor8(amount*0.99*fair) 354
    double: multiplier == floor2(prod*0.99) 404
    double: amount_won == floor8(amount*prod*0.99) 404
liqd-mines-capture-v3-2026-10-03T11-58-54- wins 393
    exact: multiplier == floor2(0.99*fair) 393
    exact: amount_won == floor8(amount*0.99*fair) 393
    double: multiplier == floor2(prod*0.99) 370
    double: amount_won == floor8(amount*prod*0.99) 354
```

`python3 -I misc.py`: next hash == active hash after 175 / 175 rotations;
pre-capture link 3 / 3; nonces exactly 0…49 in 178 / 178 epochs; one client
seed per epoch 178 / 178.

---

## 8. Files and URLs opened while writing this spec

Opened: the task brief; the framework spec folder's `games/keno/ALGORITHM.md`
and `games/mines/ALGORITHM.md` (Duel specs, models of shape);
`games/mines/profile.json`; `repositories/liqd/mines/evidence/` E10, E11, E12,
E13, E14, E21 (PNG) and `rtp-page-labels-2026-10-01.json`;
`repositories/liqd/mines/data/` the three `.json` datasets (loaded by script).
E11 is the empty Verify form (field labels only, no code shown).
Revision of 21 Oct 2026 (O5 only): E22, a picture of the game board alone
(no code, no Verify tab), taken in the same 13 Oct 2026 session as E21.

URLs (GET, logged out, 20 Oct 2026): `curl` of `https://liqd.com/originals/mines`,
`https://liqd.com/provably-fair`, `https://liqd.com/fairness`,
`https://qa.liqd.com/originals/mines` → all **403** (bodies saved in the
scratchpad, not read). Headless browser navigation to
`https://liqd.com/originals/mines` → `net::ERR_ABORTED`; a follow-up text read
of the tab timed out with no content returned.

Not opened: any `src/`, `tests/`, `scripts/`, `capture/`, `outputs/`,
`verifier-parity/`, `verify.js`, `test.js`, `MANIFEST.md`, `README.md`,
`AUDIT_CONTEXT.md`, `workshop-notes/` of any LIQD package; anything named
`*verify-tab*`; any LIQD JS bundle; the auditor's other LIQD working folders; the older
`repositories/liqd-mines` and sibling copies; the browser tool's snapshot folder; the
`.journal.ndjson` capture journals next to the datasets.
