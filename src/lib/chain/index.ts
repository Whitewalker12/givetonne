import { MockChain } from "./mock";
import type { ChainAdapter } from "./types";

// CHAIN_ADAPTER=toucan will slot in the real adapter once it exists.
export const chain: ChainAdapter = new MockChain();

export type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";
