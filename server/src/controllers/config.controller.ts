import type { Request, Response } from "express";
import { config as web3Config, isTokenConfigured, isEscrowConfigured } from "../web3/arena.js";

// Public runtime config so the client can pick up the deployed contract
// addresses without a rebuild (they're filled into server/.env at deploy time).
export const getConfig = (_req: Request, res: Response) => {
    res.json({
        chainId: web3Config.chainId,
        rpc: web3Config.rpc,
        tokenAddress: web3Config.token,
        escrowAddress: web3Config.escrow,
        tokenConfigured: isTokenConfigured(),
        escrowConfigured: isEscrowConfigured(),
        arenaToUsd: Number(process.env.ARENA_TO_USD ?? 0.1),
        usdToBirr: Number(process.env.USD_TO_BIRR ?? 57)
    });
};
