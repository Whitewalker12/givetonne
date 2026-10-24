import { defineChain, type Address, type Chain } from "viem";
import { celo, celoAlfajores, polygon, polygonAmoy } from "viem/chains";

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
  [celo.id]: celo,
  [celoAlfajores.id]: celoAlfajores,
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

/**
 * Toucan deployments (NCT pool + ToucanContractRegistry), from
 * ToucanProtocol/toucan-sdk src/utils/addresses.ts. Toucan's testnet is
 * Celo Alfajores; there is no Polygon Amoy deployment.
 */
export const toucanDefaults: Record<number, { nct: Address; registry: Address }> = {
  [polygon.id]: {
    nct: "0xD838290e877E0188a4A44700463419ED96c16107",
    registry: "0x263fA1c180889b3a3f46330F32a4a23287E99FC9",
  },
  [celo.id]: {
    nct: "0x02De4766C272abc10Bc88c220D214A26960a7e92",
    registry: "0xa30589F50b9641dacCB98AA2B4A8F24739c5B007",
  },
  [celoAlfajores.id]: {
    nct: "0xfb60a08855389F3c0A66b29aB9eFa911ed5cbCB5",
    registry: "0x48E04110aa4691ec3E9493187e6e9A3dB613e6e4",
  },
};
