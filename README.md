# Chess Arena

Web3 chess arena — full-rules online chess (live 1v1 + bot) with a wallet and social layer.
Chess runs off-chain; the blockchain is only touched at login (wallet) and end-of-match
(record result, rewards, escrow payout).

## Features

### 🎮 Chess Gameplay
- Full chess rules with legal move validation
- Live 1v1 multiplayer via WebSockets
- Real-time video chat and text messaging
- Move history navigation
- Resign/quit functionality
- Spectator mode

### 🔐 Authentication
- Username/password accounts
- Guest play (stats not saved)
- Wallet-based auth (MetaMask, Coinbase, etc.)
- Social login (Google, Apple, Phone) via thirdweb

### 💰 Web3 Rewards (Polygon Amoy Testnet)
- **ARENA Tokens**: ERC-20 tokens earned from wins
  - Win: +50 ARENA
  - Draw: +10 ARENA
- **Achievement NFTs**: Soul-bound badges for milestones
  - 🎖️ First Victory
  - 🥈 10 Wins
  - 🥇 100 Wins
  - ⭐ Perfect Week (coming soon)
- Victory rewards modal with confetti
- Rewards tracking page
- On-chain game record storage

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
3. Deploy smart contracts (see `contracts/README.md`)
4. Update contract addresses in `client/src/lib/rewards.ts`

## Features Roadmap

- [ ] Deploy contracts to mainnet
- [ ] Staked matches (wager tokens)
- [ ] Tournament system
- [ ] ELO rating system
- [ ] AI opponent
- [ ] Mobile app
- [ ] NFT marketplace
- [ ] Governance tokens
