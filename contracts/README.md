# Chess Arena Smart Contracts

Web3 reward system for Chess Arena - tokens and NFT badges for achievements.

## Contracts

### ArenaToken.sol (ERC-20)
- **Symbol**: ARENA
- **Purpose**: Reward token earned by winning games
- **Rewards**:
  - Win: 50 ARENA tokens
  - Draw: 10 ARENA tokens
- **Max Supply**: 1 billion tokens
- **Features**: Mintable by game server, burnable for future staking features

### ArenaNFT.sol (ERC-721)
- **Symbol**: ARENA-BADGE
- **Purpose**: Soul-bound NFTs for achievements
- **Types**:
  - 🎖️ First Win - Win your first game
  - 🥈 10 Wins - Win 10 games
  - 🥇 100 Wins - Win 100 games
  - ⭐ Perfect Week - Win 7 games in a row (coming soon)
- **Features**: Non-transferable (soul-bound), minted automatically on achievement unlock

## Deployment (Polygon Amoy Testnet)

### Prerequisites
```bash
npm install -g hardhat
npm install @openzeppelin/contracts
```

### Deploy ArenaToken
```bash
npx hardhat run scripts/deploy-token.js --network amoy
```

### Deploy ArenaNFT
```bash
npx hardhat run scripts/deploy-nft.js --network amoy
```

### Grant Minter Role to Backend
```javascript
// After deployment, grant MINTER_ROLE to your backend server address
const BACKEND_ADDRESS = "0x..."; // Your backend wallet
await arenaToken.grantRole(MINTER_ROLE, BACKEND_ADDRESS);
await arenaNFT.grantRole(MINTER_ROLE, BACKEND_ADDRESS);
```

## Integration

1. Deploy contracts to Polygon Amoy
2. Copy contract addresses to `client/src/lib/rewards.ts`
3. Set up backend wallet with minter permissions
4. Backend calls `mint()` after each game ends

## Testnet

Currently running on **Polygon Amoy** testnet:
- Get test MATIC: https://faucet.polygon.technology/
- Block explorer: https://amoy.polygonscan.com/

## Mainnet Launch

When launching on mainnet:
1. Audit contracts
2. Deploy to Polygon PoS mainnet
3. Update chain config in `client/src/lib/thirdweb.ts`
4. Tokens will have real value - implement proper tokenomics
5. Consider adding staking, marketplace, and governance features

## Future Features

- 🎯 Staked matches (wager tokens)
- 🏪 NFT marketplace
- 🗳️ Governance (vote on game features)
- 💎 Rare achievement NFTs
- 🎁 Season rewards
- 🔥 Token burning mechanics
