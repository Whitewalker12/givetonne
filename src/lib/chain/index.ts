import { MockChain } from "./mock";
import type { ChainAdapter } from "./types";

/**
 * CHAIN_ADAPTER selects where retirements happen:
 *   toucan — real tokenized credits: redeem NCT → retire TCO2 → Toucan certificate NFT
 *   evm    — GiveTonne's own record contract (no credit asset behind it)
 *   mock   — in-database simulation (default)
 * toucan and evm need CHAIN_RPC_URL + CHAIN_OPERATOR_KEY; evm also CHAIN_CONTRACT_ADDRESS.
 */
function build(): ChainAdapter {
  switch (process.env.CHAIN_ADAPTER) {
    case "toucan": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ToucanChain } = require("./toucan") as typeof import("./toucan");
      return new ToucanChain();
    }
    case "evm": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EvmChain } = require("./evm") as typeof import("./evm");
      return new EvmChain();
    }
    default:
      return new MockChain();
  }
}

const globalForChain = globalThis as unknown as { chain?: ChainAdapter };
export const chain: ChainAdapter = globalForChain.chain ?? build();
if (process.env.NODE_ENV !== "production") globalForChain.chain = chain;

export type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";
