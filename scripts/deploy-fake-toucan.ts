/**
 * Deploys the Fake Toucan contracts to a local dev node and funds the operator
 * with NCT, then prints the env vars for CHAIN_ADAPTER=toucan. Tests only.
 *
 *   CHAIN_RPC_URL=http://127.0.0.1:8545 CHAIN_ID=1337 CHAIN_OPERATOR_KEY=0x... \
 *   npx tsx scripts/deploy-fake-toucan.ts
 */
import { createPublicClient, createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "../src/lib/chain/evm-config";
import { FakeNCT, FakeRegistry, FakeRetirementCertificates, FakeTCO2 } from "./generated/FakeToucan";

async function main() {
  const rpcUrl = process.env.CHAIN_RPC_URL;
  const key = process.env.CHAIN_OPERATOR_KEY as Hex | undefined;
  if (!rpcUrl || !key) throw new Error("Set CHAIN_RPC_URL and CHAIN_OPERATOR_KEY");

  const chain = resolveChain(process.env.CHAIN_ID);
  const account = privateKeyToAccount(key);
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });

  async function deploy<T extends { abi: readonly unknown[]; bytecode: Hex }>(c: T, args: unknown[] = []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await wallet.deployContract({ abi: c.abi as any, bytecode: c.bytecode, args: args as any });
    const r = await pub.waitForTransactionReceipt({ hash });
    return r.contractAddress as Address;
  }
  async function write(address: Address, abi: readonly unknown[], functionName: string, args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await wallet.writeContract({ address, abi: abi as any, functionName, args: args as any });
    await pub.waitForTransactionReceipt({ hash });
  }

  const certs = await deploy(FakeRetirementCertificates);
  const registry = await deploy(FakeRegistry, [certs]);
  const tco2 = await deploy(FakeTCO2, ["Toucan Protocol: TCO2-VCS-2418-2023", "TCO2-VCS-2418-2023", 1n, certs]);
  const nct = await deploy(FakeNCT);
  await write(tco2, FakeTCO2.abi, "setPool", [nct]);
  await write(nct, FakeNCT.abi, "setScoredTCO2s", [[tco2]]);
  await write(registry, FakeRegistry.abi, "addERC20", [tco2]);
  await write(nct, FakeNCT.abi, "faucet", [account.address, parseEther("100")]);

  console.log(`CHAIN_ADAPTER=toucan`);
  console.log(`TOUCAN_POOL_ADDRESS=${nct}`);
  console.log(`TOUCAN_REGISTRY_ADDRESS=${registry}`);
  console.log(`# fake TCO2 ${tco2}, certificates ${certs}; operator funded with 100 NCT`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
