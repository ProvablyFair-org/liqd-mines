# LIQD Mines: algorithm specification

Written for the ProvablyFair.org audit of LIQD Mines
(LIQD Originals, `liqd.com`, game id `fast-games-13`).

This document is the only input an implementer needs to rebuild LIQD Mines' mine
layout and settlement. `src/rng.ts` was written from the algorithm stated in §1
and §2 by an implementer who never opened LIQD's code, its client bundle or any
port of it. **Every count, vector and example here comes from the
production captures of 8–10 November 2026** (`data/`). The module does not
implement payouts (§3.4–§3.6).

Every step names where it comes from:

- **PAGE**: the text of `https://liqd.com/originals/mines`, read logged out on
  1 October 2026 (`evidence/rtp-page-labels-2026-10-01.json`).
- **WIRE**: the requests and replies of LIQD's own endpoints as the capture
  runner recorded them in the raw captures (`data/*.ndjson`): place-bet,
  open-tile, cash-out, seed rotation and the verifier
  `POST /api/v1/fast-games/provably-fair/verify/mine`.
- **STANDARD**: the standard provably-fair construction (SHA-256 commitment to a
  server seed; HMAC-SHA256 keyed by the server seed over
  `clientSeed:nonce:cursor`; 4 bytes to an unsigned integer; Fisher–Yates
  shuffle; rejection sampling against modulo bias; multiplier = (1 − edge) /
  P(win)).
- **DATA**: fixed by testing the standard candidates against every one of the
  **6,574** production rounds of `data/mines-prod-full-6574bets.json` (three
  captures: 5,000 rounds of 8–9 November, 1,450 and 124 rounds of 10 November
  2026). §7 gives the command and its output.

No public page found states the algorithm. LIQD's page names the economics
(edge, rounding statement); the verifier names the inputs; everything in §2 and
the settlement arithmetic in §3 are settled by DATA.

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | **32 lowercase hex characters** (16 bytes); secret until the pair is rotated | WIRE: the rotation reply carries `activeServerSeedHash`, `nextServerSeedHash` and, for the retired pair, `revealedServerSeed`. DATA: all 39 revealed seeds (36 epoch seeds and the 3 pre-capture seeds) are 32 lowercase hex characters |
| `clientSeed` | text string | WIRE: the rotation request submits it and the reply returns it as `clientSeed`. DATA: 17-character seeds (`audit` + 12 hex) on 6,074 rounds, 34-character player-set seeds on 500 (phase D) |
| `nonce` | integer ≥ 0; 0 on the first round after a rotation, +1 per round | WIRE: `nonce` in the rotation reply and in every settled round. DATA: every one of the 36 epochs carries nonces exactly 0 … size − 1 (sizes 200, 100, 190, 124) |
| `mineCount` (m) | integer 1…24 | PAGE: "You decide how many are mines, 1 to 24". DATA: all 24 values played |
| `betAmount` | the stake, in the account's display fiat | DATA: 0.1 and 10 |
| opened tiles | ordered list of distinct tiles chosen by the player | WIRE: one open-tile request per tile; DATA: `openTiles` |

The board has 25 tiles (PAGE: "Twenty-five tiles"). In every record tiles are
numbered **1…25** (DATA: min 1, max 25 over all opened and mine tiles). Which
cell of the 5 × 5 grid on screen carries which number is not stated by any
source read and was not captured on production (O5); no step
below depends on it.

LIQD's verifier takes exactly four values for Mines: `serverSeed`, `clientSeed`,
`nonce`, `mineCount` (WIRE: 6,574 verifier requests). The layout depends on
those four only.

### 1.2 Commitment

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

i.e. hash the **32 ASCII characters** of the seed, **not** the 16 bytes they
encode. (The HMAC key in §2 is the decoded 16 bytes: the two steps use different
forms of the same seed.)

- SOURCE: STANDARD (SHA-256, hex output) + DATA (byte form).
- Candidates: SHA-256 over the ASCII string → **36 / 36** round commitments
  resolve, covering **6,574 / 6,574** rounds; over the hex-decoded 16 bytes →
  **0 / 36**.
- Pairing seeds to rounds: **by hashing.** Build `{commitment(seed): seed}` over
  every revealed seed and look up each round's `hashedServerSeed`.
- Forward commitment: the `nextHashedServerSeed` published before each rotation
  equals the active hash after it on **33 / 33** rotations between epochs of the
  same capture, and each capture's pre-capture pair chains into its first epoch
  (**3 / 3**). The three captures are separate runs; no link between them is
  recorded.

---

## 2. Mine layout derivation

### Step 1: one HMAC per draw (cursor = draw index)

```
key        = hex_decode(serverSeed)                                    # 16 bytes
digest(i)  = HMAC-SHA256(key, UTF-8(clientSeed + ":" + dec(nonce) + ":" + dec(i)))
```

`dec(x)` is plain base 10, no padding, no sign (`0`, `2`, `38`). Draw `i`
(i = 0, 1, …, m − 1) uses its own digest with cursor `i`. Example message:
`audit5065faa79b0b:0:0`.

- SOURCE: STANDARD (HMAC-SHA256, server seed as key, `client:nonce:cursor` as
  message) + DATA for key form, separator and cursor.
- DATA, nearest neighbours on all 6,574 rounds (as a set / in served order):
  ASCII key 46 / 45; cursor `i+1` 40 / 35; cursor `24−i` 43 / 41; message
  `c:n-i` 49 / 45.

### Step 2: bytes to an offset in [0, r)

```
draw(i, r):
    LIMIT = floor(2^32 / r) * r
    for off in 0, 4, 8, …, 28:
        v = digest(i)[off .. off+3] read as unsigned 32-bit BIG-ENDIAN
        if v < LIMIT: return v mod r
    # all 8 chunks rejected: see O1
```

- SOURCE: DATA for "first 4 bytes, big-endian, mod r" (little-endian: 228 / 224
  of 6,574); STANDARD for the rejection loop. `2^32 mod r ≠ 0` for 20 of the 24
  ranges 2…25 (all but 2, 4, 8, 16); a chunk is rejected with probability
  ≤ 4.9 × 10⁻⁹ per draw. **0 rejected chunks in 45,822 draws** (Σ m over the
  6,574 rounds), so the data cannot tell rejection from plain `v mod r`: both
  give 6,574 / 6,574 (O1).

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
  **6,574 / 6,574** rounds. Compare as an ordered list; the order is part of
  what is reproduced. LIQD's verifier returns the same tiles in the same order
  on 6,574 / 6,574 rounds (measured 11 November 2026 on the raw captures);
  Step 22 (j) compares its list as a set, which is the weaker check.
- Draws beyond `m` (a full 24-step shuffle) would not change `a[0..m−1]`;
  whether LIQD performs them is unobservable and irrelevant to the layout.
- The layout depends only on (serverSeed, clientSeed, nonce, m), not on the
  stake or on the tiles the player opens.

---

## 3. Win condition and payout

### 3.1 Win condition

Let `opened = [p₁, …, p_k]` be the tiles opened, in order, distinct, in 1…25.

```
loss ⇔ some pₜ ∈ mines; the round ends on that tile (it is the last one opened)
win  ⇔ no pₜ ∈ mines; the player cashed out after k ≥ 1 safe tiles,
        or opened the last safe tile of the board (the round then settles itself, §3.7)
```

- SOURCE: PAGE for the game shape ("Then you open tiles until you cash out, or
  you don't") + DATA for the rule: `result` agrees on **6,574 / 6,574**; every
  loss ends on exactly the first mine opened, **3,883 / 3,883**; the reply to
  each open-tile request agrees with `tile ∈ mines` on **19,498 / 19,498**
  reveals; win depth equals the planned reveal count on **2,691 / 2,691** wins.

### 3.2 Fair and edged multiplier

```
fair(m, k) = ∏_{t=0}^{k−1} (25 − t) / (25 − m − t) = C(25, k) / C(25 − m, k)
edged(m,k) = 0.99 × fair(m, k)
```

- SOURCE: STANDARD (1 / P(survive k reveals)) + PAGE for the edge ("Edge:
  1.00%", "House Edge 1%", "99% RTP at every setting"; the served settings
  record carries `"houseEdge":1`) + DATA (the amounts below match only with
  0.99).
- Page check: "1.03x on the safest first pick" = edged(1,1) = 1.03125 shown cut
  to 2 decimals; "5,148,297x if you ever clear a 12-mine board" = edged(12,13) =
  0.99 × 5,200,300 = 5,148,297 exactly: the top multiplier on the formula,
  payable only within the round payout limit (MANIFEST DL-7).

### 3.3 Displayed multiplier (`multiplier` field)

```
multiplier = floor( edged(m, k) , 2 decimals )          # cut, not rounded
```

- DATA: floor to 2 decimals of the exact edged value matches **2,691 / 2,691**
  wins; round-half-up matches 1,073. Example: 3 mines, 1 tile, served `1.12`
  while the edged value is 1.125.
- **This contradicts the mines page**, which says: "Multipliers are rounded to
  two decimals rather than cut, so the realised edge moves a little with the
  exact mines-and-picks combination, between 0.64% and 1.44%, around the nominal
  1%." On the captured data the multiplier field is cut, and neither amount
  below is computed from it (O2).
- On a loss the field is absent (3,883 / 3,883).

### 3.4 Booked amount (`winningAmount`, in the stake's fiat)

LIQD's place-bet takes `betAmount` in the account's display fiat and books the
round in it (`fiatCurrency`: CAD on 5,000 rounds, USD on 1,574).

```
win : winningAmount = floor( betAmount × edged(m, k) , 2 decimals )     # cents
loss: winningAmount = 0
```

computed **exactly** (rational arithmetic), floor toward zero at the cent.

- DATA: **2,691 / 2,691** wins; losses book 0 on 3,883 / 3,883. Other
  candidates: round-half-up to the cent 1,042; `floor2(betAmount × the 2-decimal
  multiplier)` 2,582 — it differs from the rule on the 109 wins at a 10.00
  stake (11.20 against the booked 11.25), which is what separates the two.
- The booked amount drops the fraction of a cent. At a 0.10 stake that is up to
  a tenth of the stake: a win at 1 mine, 2 tiles (edged 1.0760…) is booked as
  0.10.

### 3.5 Wallet field (`winningAmountWallet`, in the bet currency)

The reply carries a wallet stake `betAmountWallet` and a wallet win `winningAmountWallet` in
the bet currency, USDT, on the 8-decimal grid.

```
win : winningAmountWallet = floor( betAmountWallet × floor(edged(m, k), 8 decimals) , 8 decimals )
loss: no wallet win (winningAmountWallet absent or 0)
```

- DATA: **2,691 / 2,691** wins (60 distinct wallet stakes). Other candidates:
  the exact product `floor8(betAmountWallet × edged)` 2,629 — one 1e-8 unit above
  the wallet field on the other 62, all at the non-round wallet stakes of the CAD
  capture; `floor8(betAmountWallet × the 2-decimal multiplier)` 262.
- The wallet field keeps the fraction of a cent the booked amount drops. Where
  the served rate is 1.00000000 (the USD captures) the wallet stake equals the
  fiat stake and the two can be compared directly: a win at 24 mines, 1 tile on
  a 0.10 stake is booked 2.47 and carries 2.47500000 in the wallet field.

### 3.6 Exchange rate

`exchangeRate` is served to 2 decimals (1.41 and 1.40 on the CAD capture, 1.00
on the USD captures) while `betAmountWallet` on the CAD capture takes 58
distinct values between 0.07084688 and 0.07096596: the rate LIQD applies is finer than the one it
serves. This specification states no rule for it; each amount is checked in the
currency it is recorded in (O7).

### 3.7 Rounds the site settles by itself

When the tile opened is the last safe tile of the board, the open-tile reply is
the settled round (`autoFinish: true`, `result: "won"`, the multiplier and both
amounts) and no cash-out request is needed.

- DATA: 3 rounds, each the single safe tile of a 24-mine board; booked and
  carried in the wallet field by §3.4 and §3.5. Every other open-tile reply on a safe tile is
  `{ "mineTile": false }` and nothing else: no multiplier is served between
  reveals.

### 3.8 Limits

The settings record served with every loss carries `minOdds` 1.01, `houseEdge`
1, `minBet` 0.01, `maxBet` and `maxExposure` in the booking fiat (7,050 / 70,500
or 7,060 / 70,600 CAD; 5,000 / 50,000 USD), `maxExposureUsdc` 50,000 and
`maxBetUsdc` "5000.00000000", and **no `maxOdds` key** (3,886 records). No
captured round approached a limit; how a round at the exposure limit is settled
is unwitnessed (O4).

### 3.9 Fields an implementation must not read

`mineTiles`, `localMines`, `verified`, `commitVerified`, `chainLinkOk`,
`result`, `multiplier`, `winningAmount`, `winningAmountWallet` and the open-tile
`mineTile` flags are claims (the operator's, or the converter's), to be checked.
The derivation reads only `serverSeed`, `clientSeed`, `nonce`, `mineCount`, the
stakes, the opened tiles in order, and the edge 0.01.

---

## 4. Source per step (summary)

| Step | Source | Evidence (production) |
|---|---|---|
| Inputs: client seed, server seed, nonce, mine count | WIRE | the verifier's four request fields, 6,574 requests |
| Commitment SHA-256, hex output | STANDARD + WIRE | 64-hex `activeServerSeedHash` in every rotation reply |
| Hash input = 32 ASCII characters | DATA | 36/36 (hex-decoded 0/36) |
| Forward chain next hash → active hash | WIRE + DATA | 33/33 within captures + 3/3 pre-capture |
| HMAC-SHA256, key = hex-decoded 16 bytes | STANDARD + DATA | 6,574/6,574 (ASCII key 46) |
| Message `clientSeed:nonce:i`, one digest per draw, i from 0 | STANDARD + DATA | 6,574/6,574 (cursor `i+1` 40, `24−i` 43, `c:n-i` 49) |
| First 4 bytes, u32 big-endian, mod r | DATA | 6,574/6,574 (little-endian 228) |
| Rejection ≥ floor(2³²/r)·r, next chunk | STANDARD | 0 rejections in 45,822 draws; O1 |
| Forward Fisher–Yates of 1…25, mines = a[0..m−1] in order | STANDARD + DATA | 6,574/6,574 in served order |
| Win ⇔ no opened mine; bust on first mine | PAGE + DATA | 6,574/6,574; 19,498/19,498 reveals |
| edged = 0.99 × C(25,k)/C(25−m,k) | STANDARD + PAGE + DATA | "Edge: 1.00%"; 2,691 wins via §3.3–§3.5 |
| `multiplier` = floor to 2 decimals of edged | DATA (contradicts PAGE) | 2,691/2,691 |
| Booked amount = floor to the cent of stake × edged | DATA | 2,691/2,691 |
| Wallet field = floor8(wallet stake × floor8(edged)) | DATA | 2,691/2,691 (exact product 2,629) |

---

## 5. Test vectors (production rounds)

Seed found by hashing. "offsets" lists `draw(i, 25 − i)` for i = 0 … m − 1;
draw i swaps `a[i]` with `a[i + offset]`. Edge 0.01 throughout.
`tests/mines/rngSpecTests.ts` runs these against `src/rng.ts`.

**V1: round `k09hZxP4ZhUYw3SuDhspz`** (capture 1, phase A, m = 1, two tiles, 0.10 CAD)
```
serverSeed  c5777675456c54fb9096287dfb1cd804
commitment  4378c7dcd852995859795f0bbc5a535c98bbb7fa2c97fc141aae5292811e4119
clientSeed  audit5065faa79b0b   nonce 0   mines 1   amount 0.1 CAD
HMAC(c:n:0) 561e4a30dea37fad39e8109c7d3fc7c34e94bb58f824845ac3b21f9a798dbd36   u32 1444825648 → offset 23
mines [24]                    served mineTiles [24]
opened [2, 21] → win, k = 2   edged 99/92 = 1.0760869…
multiplier 1.07 (served 1.07)   booked 0.10 (served 0.1)
wallet stake 0.07085468 → floor8(0.07085468 × 1.07608695) = 0.07624579 (served 0.07624579)
```

**V2: round `Z6B5Y_EKOsIi9rFGBZ8XX`** (capture 2, phase A top-up, m = 24, the one safe tile, 0.10 USD; settled by the site itself)
```
serverSeed  00e770d6e05988f3ad2541120747356d
commitment  3d240b15cd531ef7e6b3d5b80382e6aaf3ed5fd6ab5b3c130a5ee114fb6992bd
clientSeed  audit85eaa242e54a   nonce 37   mines 24   amount 0.1 USD
HMAC(c:n:0) 7f8acfbaafb92678d64a901c4ec8c2db497365c3df73df6df485bd8bede09d7c   u32 2139803578 → offset 3
offsets 3 17 11 6 0 11 7 10 8 10 0 6 0 10 7 5 7 2 3 1 0 2 2 0
mines (draw order) 4 19 14 10 5 17 3 18 6 20 11 8 13 24 22 21 7 1 15 16 12 9 25 2   (= served, same order)
opened [23] → win, k = 1      edged 99/4 = 24.75
multiplier 24.75   booked 2.47 (served 2.47)   wallet stake 0.10000000 → 2.47500000 (served 2.47500000)
```

**V3: round `4QJN4i6P5Fxc_NB4gxkE4`** (capture 3, phase C, m = 3, one tile, 10.00 USD)
```
serverSeed  3cf098f6c5ba08f60eb228995ec061e6
commitment  0f2be4ce60e2cdf3309e0de3525a1a7a1a326f120568a6f756e0c0b07658778b
clientSeed  audit12902b0c80f4   nonce 123   mines 3   amount 10 USD
HMAC(c:n:0) b54ee76c0d1dff48465551da5e900896cc42924a1107d59a50fc3c37584f7c7b   u32 3041847148 → offset 23
offsets 23 5 18
mines [24, 7, 21]             served [24, 7, 21]
opened [25] → win, k = 1      edged 9/8 = 1.125
multiplier 1.12 (cut; served 1.12)   booked 11.25 (served 11.25)   wallet stake 10.00000000 → 11.25000000 (served 11.25000000)
```

**V4: round `PQMz0IhGUim57nUHy0IwG`** (capture 1, phase A, m = 12, five tiles, 0.10 CAD)
```
serverSeed  c66188d98acb72928e588e353413e929
commitment  8b6cf0887521631e00ce27b8290712427f7cf2cdc2bdf9094569b424e384e4b1
clientSeed  audit1f90826fce1e   nonce 139   mines 12   amount 0.1 CAD
HMAC(c:n:0) 55c612cc7fe35fed2855d3146d8fec11aef37b10c0c3c4b72b5025f904c69d96   u32 1439044300 → offset 0
offsets 0 5 10 2 3 11 5 5 7 5 8 5
mines [1, 7, 13, 6, 8, 17, 12, 3, 16, 15, 19, 4]   (= served, same order)
opened [18, 9, 22, 24, 21] → all safe → win, k = 5
fair 1610/39   edged 5313/130 = 40.869230769…
multiplier 40.86 (served 40.86)   booked 4.08 (served 4.08)
wallet stake 0.07088791 → floor8(0.07088791 × 40.86923076) = 2.89713435 (served 2.89713435)
```

**V5: round `NkMq1Is_kkTu9ZYCiCXIV`** (capture 2, phase D, player-set client seed, m = 12, bust on the third tile)
```
serverSeed  dd0386a9ff7f578ad9369df19b6136ab
commitment  61669ff57a1550fe13e1066da7d7a0b194f8418a0ad31e15cb0692f753be8e12
clientSeed  pfaudit-prod-mines-d1-d55af3b7500b   nonce 38   mines 12   amount 0.1 USD
HMAC(c:n:0) 0d0e0864868f13f14d76d255f201210296863dcdc6b9ebf9b204e9b7f33e986c   u32 219023460 → offset 10
offsets 10 17 9 2 7 3 5 6 7 6 14 2
mines [11, 19, 12, 6, 3, 9, 5, 14, 16, 4, 25, 8]   (= served, same order)
opened 10 (safe), 7 (safe), 12 (mine) → loss
multiplier absent   booked 0   no wallet win
```

**The wallet rule against the exact product (§3.5).** Round
`r80BHxgDMcDuXkFpe-h40` (capture 1, epoch 0, nonce 36, m = 12, two tiles):
edged `0.99 × 600/156 = 3.807692307…`, floored to 8 decimals `3.80769230`;
wallet stake `0.07085468`; wallet field `0.26979281`, where the exact product floors
to `0.26979282`. One of the 62.

---

## 6. Open points the sources do not settle

- **O1: rejection.** 0 rejected chunks in 45,822 draws (≤ 4.9 × 10⁻⁹ per draw),
  so rejection against plain `v mod r` is unwitnessed. Plain mod biases each
  offset by at most r/2³² (≤ 5.8 × 10⁻⁹). To settle: search a revealed seed for a
  nonce whose first chunk is ≥ LIMIT and ask LIQD's verifier; or LIQD's written
  rules. What the module does when all eight chunks of a digest are rejected is
  not specified here (it throws).
- **O2: page against data on rounding.** The mines page (1 October 2026) says
  multipliers are "rounded to two decimals rather than cut" and the realised
  edge varies "between 0.64% and 1.44%". On the three production captures the
  2-decimal multiplier is cut, the booked amount is the exact product cut to the
  cent and the wallet field uses the multiplier at 8 decimals. The page
  describes something the captured settlement does not do.
- **O4: payout limit.** `maxExposure` in the settings record against the page's
  5,148,297x ceiling. No captured round approaches it; behaviour at the limit is
  unwitnessed.
- **O5: tile numbering on the grid.** Records use 1…25. Which cell on screen is
  tile 1 was not captured on production.
- **O6: no written algorithm.** No LIQD page read states HMAC, the key form (and
  the asymmetry: ASCII for the commitment, decoded bytes for the key), the
  cursor, or the shuffle.
- **O7: exchange rate.** §3.6. The rate between the display fiat and the wallet
  currency is not specified and not checked.
- **O8: client-seed encoding beyond ASCII.** UTF-8 assumed; all captured seeds
  are ASCII.

(The number O3 is not used.)

---

## 7. Reproduction of this specification

`node scripts/spec-check.mjs` (Node `crypto` only; imports nothing from this
package) runs the specification and its nearest candidates on every production
round. Output of 10 November 2026:

```
revealed seeds 39 distinct (36 epoch seeds + 3 pre-capture); distinct bet commitments 36
commitment SHA256(ascii 32-char seed) resolves 36 / 36 commitments, 6574 / 6574 bets
commitment SHA256(hex-decoded 16 bytes) resolves 0 / 36
all revealed seeds are 32 lowercase hex characters: 39 / 39
spec (hex key, c:n:i, u32BE, rejection, forward FY, first m): as set 6574/6574, in served order 6574/6574
same, plain v mod r: as set 6574/6574, in served order 6574/6574
ascii key: as set 46/6574, in served order 45/6574
cursor i+1: as set 40/6574, in served order 35/6574
cursor 24-i: as set 43/6574, in served order 41/6574
message c:n-i: as set 49/6574, in served order 45/6574
u32 little-endian: as set 228/6574, in served order 224/6574
rejection census over the draws that place a mine: 0 rejected chunks in 45822 draws
next hash == active hash after 33 / 33 rotations between epochs of the same capture; pre-capture link 3 / 3
nonces exactly 0…size−1 in 36 / 36 epochs (sizes {"100":5,"124":1,"190":5,"200":25}); one client seed per epoch 36 / 36
client seeds: audit+12hex on 6074 rounds (17 chars), player-set on 500 rounds (34 chars)
mine counts played: 24; tile range over opened and mine tiles: 1…25
outcome match: 6574 / 6574; wins 2691; win depth == planned reveals 2691
multiplier == floor2(0.99*fair): 2691; == half_up2: 1073
booked winningAmount == floor2(amount*0.99*fair): 2691; == half_up2: 1042; == floor2(amount*floor2 multiplier): 2582
losses 3883: bust ends on first mine (mine is last opened) 3883; loss books 0: 3883; multiplier absent on a loss: 3883
wallet field on 2691 wins: == floor8(stake*floor8(0.99*fair)) 2691; == floor8(stake*0.99*fair) 2629; == floor8(stake*floor2 multiplier) 262; distinct wallet stakes 60
reveal replies: 19498; flag (or, on a self-settled reply, safe tile) agrees with the layout 19498; self-settled 3
served exchangeRate by capture:fiat:rate {"1:CAD:1.41000000":3548,"1:CAD:1.40000000":1452,"2:USD:1.00000000":1450,"3:USD:1.00000000":124}
```

---

## 8. Sources read

`data/mines-prod-full-6574bets.json` and the three raw captures in `data/`
(loaded by `scripts/spec-check.mjs`); `evidence/rtp-page-labels-2026-10-01.json`.
No LIQD source code, client bundle or port of it was opened.
