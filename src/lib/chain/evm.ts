import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "./evm-config";
import { abi } from "./GiveTonneRetirements";
import type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";

/**
 * Real EVM adapter: talks to the GiveTonneRetirements contract on Polygon
 * (Amoy testnet by default) with the operator wallet.
 *
 * Env: CHAIN_RPC_URL, CHAIN_OPERATOR_KEY, CHAIN_CONTRACT_ADDRESS, CHAIN_ID (optional).
 */
export class EvmChain implements ChainAdapter {
  readonly name: string;
  private readonly chain;
  private readonly contract: Address;
  private readonly publicClient;
  private readonly wallet;

  constructor() {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    const key = process.env.CHAIN_OPERATOR_KEY as Hex | undefined;
    const contract = process.env.CHAIN_CONTRACT_ADDRESS as Address | undefined;
    if (!rpcUrl || !key || !contract) {
      throw new Error("EvmChain needs CHAIN_RPC_URL, CHAIN_OPERATOR_KEY and CHAIN_CONTRACT_ADDRESS");
    }
    this.chain = resolveChain(process.env.CHAIN_ID);
    this.name = this.chain.name;
    this.contract = contract;
    this.publicClient = createPublicClient({ chain: this.chain, transport: http(rpcUrl) });
    this.wallet = createWalletClient({
      account: privateKeyToAccount(key),
      chain: this.chain,
      transport: http(rpcUrl),
    });
  }

  explorerTxUrl(txHash: string) {
    const base = this.chain.blockExplorers?.default.url;
    return base ? `${base}/tx/${txHash}` : `/verify/${txHash}`;
  }

  async retire(req: RetireRequest): Promise<RetireResult> {
    const tonnesMilli = BigInt(Math.round(req.tonnes * 1000));
    const serialRange = `${req.projectRegistryId}-${req.giftId}`; // replaced by real serials once credits are sourced
    const giftRef = keccak256(stringToHex(req.giftId));

    const hash = await this.wallet.writeContract({
      address: this.contract,
      abi,
      functionName: "retire",
      args: [req.beneficiaryName, req.beneficiaryMessage, tonnesMilli, req.projectRegistryId, serialRange, giftRef],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Retirement tx ${hash} reverted`);

    const [log] = parseEventLogs({ abi, eventName: "Retired", logs: receipt.logs });
    if (!log) throw new Error("Retired event missing from receipt");
    const { tokenId } = log.args;

    return {
      chain: this.name,
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      contract: this.contract,
      serialRange,
      certTokenId: Number(tokenId),
    };
  }

  async lookup(txHash: string): Promise<OnChainRetirement | null> {
    const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
    if (!receipt || receipt.to?.toLowerCase() !== this.contract.toLowerCase()) return null;

    const [log] = parseEventLogs({ abi, eventName: "Retired", logs: receipt.logs });
    if (!log) return null;
    const { tokenId } = log.args;

    const [r, claimedBy] = await this.publicClient.readContract({
      address: this.contract,
      abi,
      functionName: "getRetirement",
      args: [tokenId],
    });

    return {
      chain: this.name,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      contract: this.contract,
      serialRange: r.serialRange,
      certTokenId: Number(tokenId),
      beneficiaryName: r.beneficiaryName,
      beneficiaryMessage: r.message,
      tonnes: Number(r.tonnesMilli) / 1000,
      retiredAt: new Date(Number(r.retiredAt) * 1000),
      claimedBy: claimedBy === "0x0000000000000000000000000000000000000000" ? null : claimedBy,
    };
  }

  async claimCertificate(certTokenId: number, wallet: string) {
    const hash = await this.wallet.writeContract({
      address: this.contract,
      abi,
      functionName: "claim",
      args: [BigInt(certTokenId), wallet as Address],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Claim tx ${hash} reverted`);
    return { txHash: hash };
  }
}
