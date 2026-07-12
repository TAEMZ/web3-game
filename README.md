# Chess Arena

Web3 chess arena — full-rules online chess (live 1v1 + bot) with a wallet and social layer.
Chess runs off-chain; the blockchain is only touched at login (wallet top-ups), end-of-match
(rewards + achievement badges), and the wager escrow / exchange / subscription flows.

> **Full technical reference:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md) — contracts,
> addresses, token economics, gas model, video chat, and the complete stack.

## Features

### 🎮 Chess Gameplay
- Full chess rules with legal move validation
- Live 1v1 multiplayer via WebSockets
- Real-time video chat and text messaging
- Move history navigation
- 10-minute chess clock per side (server-authoritative, auto-flag on timeout)
- Resign/quit functionality
- Spectator mode

### 🔐 Authentication
- Username/password accounts (argon2-hashed)
- Guest play (stats not saved)
- Wallet auth via **thirdweb in-app wallet** — Google / email social login → a
  self-custodial wallet (no seed phrase, no browser extension); linked to the
  account by a signed nonce

### 💰 Web3 Economy (Ethereum Sepolia testnet, chainId 11155111)
- **ARENA** (ERC-20, 18 decimals) — reward + utility token, 1B max supply
  - Win: **+50 ARENA** · Draw: **+10 ARENA** (resign: −25, accounting)
- **USDC / TestUSD** (ERC-20, 6 decimals) — demo "dollars"; **100 dripped on sign-in**
- **Exchange** — swap USDC ↔ ARENA at a fixed **100 ARENA = 1 USDC** (ARENA ≈ $0.01)
- **Subscription** — one-time **500 ARENA** unlocks wager mode
- **Wager escrow** — both players stake equal ARENA, winner takes the pot (minus a 15% house fee)
- **Achievement NFTs** (soul-bound, on-chain SVG): 🎖️ First Victory (1 win) ·
  🥈 Silver (10) · 🥇 Gold (100) · ⭐ Perfect Week (7 in a row)
- Auto gas: players are topped up with a little Sepolia ETH so they never buy test-ETH
- Victory rewards modal with confetti; rewards tracking page

### 🎨 UI/UX
- Ethiopian-themed design (Adwa inspired)
- Dark/light mode toggle
- Glassmorphism cards
- Gold shimmer effects
- Mobile responsive
- Wallet onboarding flow

## Stack

- **client/** — Next.js frontend → deploys to Vercel
- **server/** — Express + Socket.IO backend → deploys to Render
- **types/** — shared type definitions imported by both (`@arena/types`)
- **contracts/** — Solidity smart contracts for Web3 features

Postgres is hosted on Render.

## Local development

```bash
pnpm install
pnpm dev          # runs client (:3000) and server (:3001) together
```

Environment:

- `server/.env` — Postgres (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`), `PORT`, `CORS_ORIGIN`
- `client/.env.local` — `NEXT_PUBLIC_API_URL` (backend URL), `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`

## Web3 Setup

1. Get a free thirdweb client ID: https://thirdweb.com/dashboard
2. Add to `client/.env.local`:
   ```
   NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id_here
   ```
3. Deploy the smart contracts to Sepolia (see `contracts/README.md`).
4. Client addresses live in `client/src/lib/contracts.ts`; the server reads its
   addresses + treasury key from `server/.env`:
   ```
   ARENA_TOKEN_ADDRESS=…      ARENA_ESCROW_ADDRESS=…
   TEST_USD_ADDRESS=…         ARENA_EXCHANGE_ADDRESS=…   ARENA_NFT_ADDRESS=…
   DEPLOYER_PRIVATE_KEY=…     RPC_URL=…   (treasury that mints/drips/settles)
   SUBSCRIPTION_ARENA=500     USD_DRIP=100   USD_FLOOR=10
   REWARD_WIN=50              REWARD_DRAW=10
   PLAYER_GAS_CALLS=8         PLAYER_GAS_FLOOR_CALLS=3   PLAYER_GAS_MAX_ETH=0.05
   ```
   Player gas is budgeted in *transactions*, not ether: the treasury keeps each
   player's wallet funded for `PLAYER_GAS_CALLS` contract calls at the network's
   current gas price, refilling once it drops below `PLAYER_GAS_FLOOR_CALLS`.
   (Replaces the old fixed `PLAYER_GAS_ETH` / `PLAYER_GAS_FLOOR`, which went stale
   whenever the gas price moved and stranded players mid-wager.)
   Without the addresses/key, the web3 layer no-ops and balances are DB-simulated.

## Features Roadmap

- [x] Staked / wager matches (ARENA escrow)
- [x] AI opponent (Stockfish, skill 0–20)
- [x] USDC ↔ ARENA exchange + one-time subscription
- [x] Soul-bound achievement NFTs
- [ ] Deploy contracts to mainnet
- [ ] Tournament system
- [ ] ELO rating system
- [ ] Mobile app
- [ ] NFT marketplace
- [ ] Governance tokens
