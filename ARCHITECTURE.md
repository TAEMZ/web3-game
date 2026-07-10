# Chess Arena — Architecture & Workings

Full technical reference for how Chess Arena is built: the blockchain layer, the
token economics, the gas model, the in-game video chat, and the complete stack.

Chess itself runs **off-chain** (fast, free, real-time). The blockchain is touched
only at a few well-defined moments: wallet sign-in, end-of-match rewards, the
wager escrow lifecycle, the USDC↔ARENA exchange, and the one-time subscription.
Every on-chain helper degrades gracefully to a database-simulated fallback if its
contract address / key is not configured, so the game always runs.

---

## 1. On-chain vs off-chain split

| Concern | Where it lives |
|---|---|
| Chess rules, move validation, matchmaking, spectating | Off-chain — server (`chess.js`) + Socket.IO |
| Accounts, sessions, game history, wagers, withdrawals | Off-chain — Postgres |
| Real-time video / text chat | Off-chain — WebRTC (peer-to-peer) + Socket.IO signaling |
| Wallet login + gas/USDC top-ups | On-chain — Sepolia |
| Win/draw rewards (ARENA) + achievement badges (NFT) | On-chain — Sepolia |
| Wager staking + payout (escrow) | On-chain — Sepolia |
| USDC ↔ ARENA swap; one-time subscription | On-chain — Sepolia |

---

## 2. Blockchain network

- **Chain:** Ethereum **Sepolia** testnet — `chainId 11155111`
- **RPC:** `RPC_URL` env, default `https://ethereum-sepolia-rpc.publicnode.com`
- **Explorer:** `https://sepolia.etherscan.io`
- **Client SDK:** thirdweb v5 (`activeChain = sepolia`, `client/src/lib/thirdweb.ts`)
- **Server SDK:** viem v2 (`server/src/web3/*.ts`)

Everything is **testnet / demo** — no token here has real-world value.

---

## 3. Smart contracts

All five contracts are Solidity `^0.8.20` (compiled with **solc 0.8.24**), built on
**OpenZeppelin 5.1**, deployed by the treasury wallet
`0x8BC1B1243D7924E68C61fFDb14779aB6F8B094e6`.

| Contract | Type | Address (Sepolia) | Decimals |
|---|---|---|---|
| **ArenaToken** (`ARENA`) | ERC-20 | `0xa09a9f56167434af7b183a7d44ba0e06c1118d78` | 18 |
| **TestUSD** (`USDC`) | ERC-20 | `0xc7126fa76a9f7bb903c1049b59604eec2eb74c2f` | 6 |
| **ArenaExchange** | custom | `0xe12a87996f190e9e0242a84f6f6eb6e2a5914950` | — |
| **ArenaEscrow** | custom | `0x0b760c60e79abb5742997acb2e4dbd70439b492e` | — |
| **ArenaNFT** (`ARENA-BADGE`) | ERC-721 | `0x80db058f3371ef75e3c99c3102e5d9b4440939f5` | — |

### ArenaToken (`contracts/ArenaToken.sol`)
Reward + utility token.
- `mint(to, amount)` — gated by `MINTER_ROLE`; enforces `MAX_SUPPLY = 1,000,000,000 ARENA`.
- `burn(amount)` — holder burns their own (used by the exchange on sell-back).
- Roles: deployer holds `DEFAULT_ADMIN_ROLE` + `MINTER_ROLE`; the server treasury and the exchange are granted `MINTER_ROLE`.

### TestUSD (`contracts/TestUSD.sol`)
Mock USD stablecoin — "dollars" as a real coin on testnet.
- `decimals() = 6` (matches real USDC, unlike the ERC-20 default of 18).
- `mint(to, amount)` — `MINTER_ROLE` (treasury drips on sign-in; exchange mints on sell-back).
- `burn(amount)`.

### ArenaExchange (`contracts/ArenaExchange.sol`)
Fixed-rate swap between USDC (6-dec) and ARENA (18-dec). Mints on both directions,
so it never runs dry. Must hold `MINTER_ROLE` on **both** tokens (granted at deploy).
- `rate` — ARENA per 1 whole USDC; **default `100`** (⇒ ARENA ≈ $0.01). Admin-settable via `setRate`.
- `DECIMAL_GAP = 1e12` bridges the 18-vs-6 decimal gap.
- `buyArena(usdcAmount)` — pull USDC (needs approval) → mint `usdcAmount * rate * 1e12` ARENA.
- `sellArena(arenaAmount)` — pull + burn ARENA → mint USDC back (reverts on sub-1-unit dust).
- `arenaForUsdc()` / `usdcForArena()` — view quotes for the UI.

### ArenaEscrow (`contracts/ArenaEscrow.sol`)
Wager matches — both players stake equal ARENA, winner takes the pot.
`AccessControl` + `ReentrancyGuard`. States: `NONE → OPEN → FUNDED → SETTLED / CANCELLED`.
- `createMatch(stake)` — player 1 stakes (needs approval) → `OPEN`.
- `joinMatch(id)` — player 2 matches the stake → `FUNDED`.
- `settleMatch(id, winner)` — `SETTLER_ROLE` (server, after admin verification) pays `stake × 2` to winner.
- `settleDraw(id)` — `SETTLER_ROLE` refunds both stakes.
- `cancelMatch(id)` — creator or settler refunds an unjoined `OPEN` match.

### ArenaNFT (`contracts/ArenaNFT.sol`)
Soul-bound (non-transferable) achievement badges. Metadata **and** SVG art are
generated fully on-chain as a base64 `data:` URI — nothing is hosted off-chain.
- `mintAchievement(to, achievement)` — `MINTER_ROLE`, once per achievement per wallet.
- Non-transferable: `_update` allows mint/burn but reverts on transfer ("Soulbound").
- Four badges: `0` First Victory (1 win) · `1` Silver Champion (10 wins) · `2` Gold Champion (100 wins) · `3` Perfect Week (7 in a row).

---

## 4. Token economics & values

| Parameter | Value | Env var | Source |
|---|---|---|---|
| ARENA decimals | 18 | — | `ArenaToken.sol` |
| ARENA max supply | 1,000,000,000 | — | `ArenaToken.sol` |
| USDC (TestUSD) decimals | 6 | — | `TestUSD.sol` |
| Exchange rate | **100 ARENA = 1 USDC** (ARENA ≈ $0.01) | on-chain `rate` | `deployed-usd.sepolia.json` |
| Win reward | **+50 ARENA** | `REWARD_WIN` | `server/src/db/models/game.model.ts` |
| Draw reward | **+10 ARENA** | `REWARD_DRAW` | `server/src/db/models/game.model.ts` |
| Resign penalty (accounting) | **−25 ARENA** | — | `server/src/controllers/admin.controller.ts` |
| Sign-in USDC drip | **100 USDC** (top up if < 10) | `USD_DRIP` / `USD_FLOOR` | `server/src/web3/usd.ts` |
| Sign-in ETH gas drip | **0.004 ETH** (top up if < 0.0015) | `PLAYER_GAS_ETH` / `PLAYER_GAS_FLOOR` | `server/src/web3/gas.ts` |
| Subscription (unlock wager mode) | **500 ARENA** (one-time = 5 USDC ≈ $5) | `SUBSCRIPTION_ARENA` | `server/src/controllers/subscription.controller.ts` |

**Fiat display:** ARENA is shown as USD at `$0.01`/token; the withdrawal path further
converts USD → Ethiopian birr for an admin-verified manual payout (there is no
automated fiat on/off-ramp — deposits and withdrawals are admin-gated).

---

## 5. Gas & treasury model

A single **treasury wallet** (`DEPLOYER_PRIVATE_KEY`, address
`0x8BC1…094e6`) bankrolls the whole demo. All treasury transactions are
**nonce-serialized** through `serializeTreasury()` (`server/src/web3/treasuryQueue.ts`)
so concurrent mints/drips/settlements never collide on the account nonce.

**Treasury pays gas for** (server-signed):
- ARENA reward mints (`arena.ts → mintReward`)
- USDC sign-in drips (`usd.ts → dripUsdIfLow`)
- ETH gas top-ups to players (`gas.ts → fundGasIfLow`)
- NFT badge mints (`nft.ts`)
- Wager settlement / draw / cancel (`arena.ts → settleWager*`)

**Players pay their own gas** (from the 0.004 ETH they're auto-funded) for
transactions **they** sign in their thirdweb wallet:
- `approve` + `buyArena` / `sellArena` (exchange)
- `approve` + `createMatch` / `joinMatch` (wager stakes)
- the one-time subscription payment

On wallet sign-in the server fires both top-ups best-effort (never blocking login):
`fundGasIfLow(address)` then `dripUsdIfLow(address)`
(`server/src/controllers/auth.controller.ts`). Each is idempotent via a floor
check, so it only tops up wallets that are actually low.

**Graceful fallback:** every web3 module checks `isTokenConfigured()` /
`isUsdConfigured()` / `isEscrowConfigured()` and no-ops if the address or key is
missing — the game then runs on database-simulated balances.

---

## 6. In-game video chat (WebRTC)

Real-time camera/mic between the two players, watchable by spectators.
Implemented with **native browser WebRTC** (`RTCPeerConnection`) in a **full-mesh**
topology — no media server. Client: `client/src/components/game/VideoChat.tsx`.

- **Publishers:** the two players (`getUserMedia` camera + mic). **Subscribers:** the
  opponent and all spectators. Spectators are **receive-only** (never publish).
- **Topology:** one `RTCPeerConnection` per participant pair. Players connect to
  everyone; spectators connect only to the two players.
- **Signaling:** relayed over the existing Socket.IO game room via `rtcSignal`
  events (`server/src/socket/game.socket.ts`). The server stamps the sender `from`
  and either forwards to a specific peer (`to`) or broadcasts to the room for peer
  discovery. Message kinds: `hello` (discovery), `description` (SDP offer/answer),
  `candidate` (ICE), `bye`.
- **Glare avoidance:** exactly one side creates the offer — White initiates between
  the two players; a player always initiates toward a spectator.
- **ICE / NAT:** free Google public **STUN** servers
  (`stun.l.google.com:19302`, `stun1.l.google.com:19302`). **No TURN server** — peers
  behind strict/symmetric NATs may fail to connect (adding a TURN server is the
  documented next step). Camera/mic requires a secure context (HTTPS or localhost).

Text chat and in-game emotes ride the same Socket.IO room (`chat`, `emote` events).

---

## 7. Full stack

Monorepo managed with **pnpm workspaces** (`pnpm-workspace.yaml`): `client`,
`server`, `types`, `contracts`.

### client/ (`@arena/client`) → Vercel
- **Next.js 14** (App Router) · **React 18** · **TypeScript 5.5**
- **Tailwind CSS 3.4** + **daisyUI 2.52** (Ethiopian/Adwa-inspired theme)
- **react-chessboard 2.1** + **chess.js 1.0.0-beta.8** (board + rules)
- **socket.io-client 4.7** (realtime + WebRTC signaling)
- **thirdweb 5.120** — `inAppWallet` social login (Google / email) → self-custodial
  wallet, no seed phrase or browser extension
- `@tabler/icons-react` for icons

### server/ (`@arena/server`) → Render
- **Node + Express 4.19** · **TypeScript 5.5**
- **Socket.IO 4.7** — live games, chat, emotes, WebRTC signaling
- **express-session + connect-pg-simple** — Postgres-backed sessions
- **argon2** — password hashing · **xss**, **nanoid**
- **pg** — Postgres client
- **viem 2.54** — all on-chain reads/writes (`server/src/web3/`: `arena.ts`,
  `usd.ts`, `gas.ts`, `nft.ts`, `treasuryQueue.ts`)
- **stockfish 18.0.8** — the bot opponent, using Stockfish's native Skill Level
  (0–20) as the difficulty knob (`server/src/bot/`)

### types/ (`@arena/types`)
Shared TypeScript types imported by both client and server (`workspace:*`).

### contracts/ (`@arena/contracts`) → Ethereum Sepolia
- **Solidity ^0.8.20**, compiled with **solc 0.8.24**
- **OpenZeppelin Contracts 5.1** (ERC20, ERC721, AccessControl, ReentrancyGuard, Base64)
- **viem** deploy scripts (plain `.mjs`, **not** Hardhat/Foundry):
  `compile.mjs`, `deploy.mjs` (token + escrow), `deploy-usd.mjs` (TestUSD + Exchange),
  `deploy-nft.mjs`. Deployed addresses are recorded in `deployed*.sepolia.json`.

### Data
**Postgres** (hosted on Render) — users, games, wagers, deposits, withdrawals, and
the session store.

### Deployment targets
| Layer | Target |
|---|---|
| Client (Next.js) | Vercel |
| Server (Express + Socket.IO) | Render |
| Database (Postgres) | Render |
| Contracts | Ethereum Sepolia |

---

## 8. Authentication

- **Username / password** — argon2-hashed.
- **Guest** — play without saving stats.
- **Wallet** — thirdweb in-app wallet via Google / email social login; the wallet is
  bound to the account by verifying a signed nonce (SIWE-style). A wallet signed in
  on top of an existing username account is **linked** to it rather than creating a
  duplicate user.

---

## 9. End-to-end flows

**Sign-in:** authenticate → server best-effort tops up the wallet's gas (ETH) and
demo-USD (USDC) if low → balances appear in the wallet.

**Casual game:** matchmake → play over Socket.IO → on game over the server
fire-and-forget mints the ARENA reward (win +50 / draw +10) and any newly-earned
achievement badge NFTs to the winner.

**Wager game:** requires the one-time 500-ARENA subscription → both players
`approve` + stake into `ArenaEscrow` → play → server (SETTLER, after admin
verification) calls `settleMatch` (winner takes pot) or `settleDraw` (refund both).

**Exchange:** in the wallet, `approve` USDC → `buyArena` mints ARENA at 100:1
(or `sellArena` back to USDC).
