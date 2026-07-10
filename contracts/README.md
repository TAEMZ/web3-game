# Chess Arena Smart Contracts

Five contracts power the on-chain economy: reward/utility token, mock stablecoin,
a fixed-rate exchange, wager escrow, and soul-bound achievement badges.

- **Solidity** `^0.8.20`, compiled with **solc 0.8.24**
- **OpenZeppelin Contracts 5.1** (ERC20, ERC721, AccessControl, ReentrancyGuard, Base64)
- Deploy scripts are plain **viem `.mjs`** — no Hardhat/Foundry
- Deployed on **Ethereum Sepolia** (`chainId 11155111`)

> See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for token economics, the gas/treasury
> model, and how the server calls these contracts.

## Contracts & deployed addresses (Sepolia)

| Contract | Symbol | Address |
|---|---|---|
| `ArenaToken.sol` (ERC-20, 18 dec) | ARENA | `0xa09a9f56167434af7b183a7d44ba0e06c1118d78` |
| `TestUSD.sol` (ERC-20, 6 dec) | USDC | `0xc7126fa76a9f7bb903c1049b59604eec2eb74c2f` |
| `ArenaExchange.sol` | — | `0xe12a87996f190e9e0242a84f6f6eb6e2a5914950` |
| `ArenaEscrow.sol` | — | `0x0b760c60e79abb5742997acb2e4dbd70439b492e` |
| `ArenaNFT.sol` (ERC-721) | ARENA-BADGE | `0x80db058f3371ef75e3c99c3102e5d9b4440939f5` |

Deployer / treasury: `0x8BC1B1243D7924E68C61fFDb14779aB6F8B094e6`.
Addresses are also recorded in `deployed.sepolia.json`, `deployed-usd.sepolia.json`,
and `deployed-nft.sepolia.json`.

### ArenaToken (ERC-20)
Reward + utility token. `mint(to, amount)` (MINTER_ROLE), `burn(amount)`.
Max supply 1,000,000,000 ARENA. Rewards: win **50**, draw **10** (minted by the server).

### TestUSD (ERC-20)
Testnet mock USD, **6 decimals** like real USDC. Freely minted by the treasury and
dripped on sign-in; also minted by the exchange on sell-back. No real value.

### ArenaExchange
Fixed-rate USDC ↔ ARENA swap. Default `rate = 100` (100 ARENA per 1 USDC; ARENA ≈ $0.01),
admin-settable via `setRate`. `buyArena` mints ARENA; `sellArena` burns ARENA and mints
USDC back. Must hold `MINTER_ROLE` on both tokens (granted at deploy).

### ArenaEscrow
Wager matches: `createMatch(stake)` → `joinMatch(id)` → `settleMatch(id, winner)` (pot to
winner) or `settleDraw(id)` (refund both). `SETTLER_ROLE` = the server, after admin
verification. `ReentrancyGuard`; unjoined matches can be `cancelMatch`-ed.

### ArenaNFT (ERC-721)
Soul-bound (non-transferable) achievement badges, metadata + SVG generated fully on-chain.
`mintAchievement(to, achievement)` (MINTER_ROLE), once per achievement per wallet.
Badges: 0 First Victory (1 win) · 1 Silver (10) · 2 Gold (100) · 3 Perfect Week (7-streak).

## Deployment

```bash
pnpm install
# Requires env: DEPLOYER_PRIVATE_KEY (funded with Sepolia ETH), RPC_URL
node compile.mjs        # solc → ABI + bytecode
node deploy.mjs         # ArenaToken + ArenaEscrow      → deployed.sepolia.json
node deploy-usd.mjs     # TestUSD + ArenaExchange        → deployed-usd.sepolia.json
node deploy-nft.mjs     # ArenaNFT                       → deployed-nft.sepolia.json
```

After deploying, copy the addresses into `client/src/lib/contracts.ts` and `server/.env`,
and grant the server treasury `MINTER_ROLE` (token, USD, NFT) + `SETTLER_ROLE` (escrow),
plus the exchange `MINTER_ROLE` on both tokens.

Get Sepolia test ETH from any Sepolia faucet; explorer: https://sepolia.etherscan.io.

## Mainnet

This is a testnet demo. A mainnet launch would require an audit, real tokenomics, and a
funded treasury — none of these tokens have value on Sepolia.
