/**
 * Deploys GiveTonneRetirements with the operator wallet and prints the address
 * to put in CHAIN_CONTRACT_ADDRESS.
 *
 *   CHAIN_RPC_URL=https://rpc-amoy.polygon.technology \
 *   CHAIN_OPERATOR_KEY=0x... \
 *   npm run chain:deploy
 */
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "../src/lib/chain/evm-config";
import { abi, bytecode } from "../src/lib/chain/GiveTonneRetirements";

async function main() {
  const rpcUrl = process.env.CHAIN_RPC_URL;
  const key = process.env.CHAIN_OPERATOR_KEY as Hex | undefined;
  if (!rpcUrl || !key) throw new Error("Set CHAIN_RPC_URL and CHAIN_OPERATOR_KEY");

  const chain = resolveChain(process.env.CHAIN_ID);
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Operator ${account.address} on ${chain.name}, balance ${Number(balance) / 1e18}`);
  if (balance === 0n) throw new Error("Operator wallet has no gas. Fund it from a faucet first.");

  const hash = await wallet.deployContract({ abi, bytecode });
  console.log(`Deploy tx ${hash}, waiting…`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\nCHAIN_CONTRACT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
