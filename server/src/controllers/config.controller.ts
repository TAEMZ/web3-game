import type { Request, Response } from "express";
import { config as web3Config, isTokenConfigured, isEscrowConfigured, minterAddress } from "../web3/arena.js";
import { usdConfig, isUsdConfigured } from "../web3/usd.js";
import { nftConfig } from "../web3/nft.js";
import { SUBSCRIPTION_USD } from "./subscription.controller.js";

const EXCHANGE_ADDRESS = (process.env.ARENA_EXCHANGE_ADDRESS || "").trim() || null;
// $1 = 100 ARENA — keep in sync with the client's EXCHANGE_RATE (client/src/lib/contracts.ts).
const EXCHANGE_RATE = 100; // ARENA per 1 USDC

// Public runtime config so the client can pick up the deployed contract
// addresses + economy settings without a rebuild (filled into server/.env at
// deploy time). All testnet/demo.
export const getConfig = (_req: Request, res: Response) => {
    res.json({
        chainId: web3Config.chainId,
        rpc: web3Config.rpc,
        tokenAddress: web3Config.token,
        escrowAddress: web3Config.escrow,
        tokenConfigured: isTokenConfigured(),
        escrowConfigured: isEscrowConfigured(),
        // demo-USD exchange
        usdAddress: usdConfig.address,
        usdConfigured: isUsdConfigured(),
        exchangeAddress: EXCHANGE_ADDRESS,
        exchangeRate: EXCHANGE_RATE, // ARENA per 1 USDC
        // 1 ARENA in USD (derived from the exchange rate so display + swap agree)
        arenaToUsd: EXCHANGE_RATE > 0 ? 1 / EXCHANGE_RATE : 0.01,
        // Arena Pass (wager unlock): price in USD, paid to the treasury for admin verification
        subscriptionUsd: SUBSCRIPTION_USD,
        treasuryAddress: minterAddress(),
        // soul-bound achievement badge NFTs
        nftAddress: nftConfig.address
    });
};
