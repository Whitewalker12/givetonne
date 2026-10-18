import { defineChain, type Chain } from "viem";
import { polygon, polygonAmoy } from "viem/chains";

/** Local dev node (ganache / anvil / hardhat). */
export const localhost = defineChain({
  id: 1337,
  name: "Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const known: Record<number, Chain> = {
  [polygonAmoy.id]: polygonAmoy,
  [polygon.id]: polygon,
  [localhost.id]: localhost,
  31337: { ...localhost, id: 31337 },
};

/** Pick the viem chain definition from CHAIN_ID (defaults to Polygon Amoy testnet). */
export function resolveChain(chainId: string | undefined): Chain {
  const id = chainId ? Number(chainId) : polygonAmoy.id;
  const chain = known[id];
  if (!chain) throw new Error(`Unsupported CHAIN_ID ${id}`);
  return chain;
}
