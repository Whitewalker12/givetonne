import { MockChain } from "./mock";
import type { ChainAdapter } from "./types";

/**
 * CHAIN_ADAPTER=evm uses the real contract (needs CHAIN_RPC_URL,
 * CHAIN_OPERATOR_KEY, CHAIN_CONTRACT_ADDRESS). Anything else, or nothing,
 * uses the in-database simulation.
 */
function build(): ChainAdapter {
  if (process.env.CHAIN_ADAPTER === "evm") {
    // Lazy require keeps viem out of the bundle path when it's not configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EvmChain } = require("./evm") as typeof import("./evm");
    return new EvmChain();
  }
  return new MockChain();
}

const globalForChain = globalThis as unknown as { chain?: ChainAdapter };
export const chain: ChainAdapter = globalForChain.chain ?? build();
if (process.env.NODE_ENV !== "production") globalForChain.chain = chain;

export type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";
