import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain, toucanDefaults } from "./evm-config";
import { certificatesAbi, poolAbi, registryAbi, tco2Abi } from "./toucan-abi";
import type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";

const RETIRING_ENTITY = "GiveTonne";
const ZERO = "0x0000000000000000000000000000000000000000";
const FEE_DIVIDER = 10_000n;

/** Canonical description of the retirement events behind a certificate; used on both write and read paths. */
function serialRange(eventIds: readonly bigint[], amounts: readonly bigint[]) {
  return eventIds.map((id, i) => `Toucan retirement event #${id}: ${formatUnits(amounts[i], 18)} t`).join("; ");
}

/**
 * Real credits: redeems Toucan pool tokens (NCT) held by the operator wallet
 * into TCO2s, retires them, and mints a Toucan RetirementCertificate NFT in
 * the recipient's name. The certificate NFT is what the recipient can claim.
 *
 * Env: CHAIN_ID (137 Polygon, 42220 Celo, 44787 Alfajores), CHAIN_RPC_URL,
 * CHAIN_OPERATOR_KEY; optional TOUCAN_POOL_ADDRESS / TOUCAN_REGISTRY_ADDRESS
 * override the per-network defaults.
 */
export class ToucanChain implements ChainAdapter {
  readonly name: string;
  private readonly chain;
  private readonly pool: Address;
  private readonly registry: Address;
  private readonly account;
  private readonly pub;
  private readonly wallet;
  private certsAddress?: Address;

  constructor() {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    const key = process.env.CHAIN_OPERATOR_KEY as Hex | undefined;
    if (!rpcUrl || !key) throw new Error("ToucanChain needs CHAIN_RPC_URL and CHAIN_OPERATOR_KEY");

    this.chain = resolveChain(process.env.CHAIN_ID);
    const defaults = toucanDefaults[this.chain.id];
    const pool = (process.env.TOUCAN_POOL_ADDRESS as Address | undefined) ?? defaults?.nct;
    const registry = (process.env.TOUCAN_REGISTRY_ADDRESS as Address | undefined) ?? defaults?.registry;
    if (!pool || !registry) {
      throw new Error(`No Toucan deployment known for chain ${this.chain.id}; set TOUCAN_POOL_ADDRESS and TOUCAN_REGISTRY_ADDRESS`);
    }
    this.pool = pool;
    this.registry = registry;
    this.name = `${this.chain.name} · Toucan`;
    this.account = privateKeyToAccount(key);
    this.pub = createPublicClient({ chain: this.chain, transport: http(rpcUrl) });
    this.wallet = createWalletClient({ account: this.account, chain: this.chain, transport: http(rpcUrl) });
  }

  explorerTxUrl(txHash: string) {
    const base = this.chain.blockExplorers?.default.url;
    return base ? `${base}/tx/${txHash}` : `/verify/${txHash}`;
  }

  private async certs(): Promise<Address> {
    this.certsAddress ??= await this.pub.readContract({
      address: this.registry,
      abi: registryAbi,
      functionName: "retirementCertificatesAddress",
    });
    return this.certsAddress;
  }

  private async send(hash: Hex, what: string) {
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${what} tx ${hash} reverted`);
    return receipt;
  }

  /** Pool tokens needed so that, after the redemption fee, at least `tonnes` of TCO2 come out. */
  private async grossUp(tonnes: number) {
    const feeBp = await this.pub.readContract({ address: this.pool, abi: poolAbi, functionName: "feeRedeemPercentageInBase" }).catch(() => 0n);
    const wanted = parseUnits(tonnes.toString(), 18);
    // net = amount - amount*fee/10000  =>  amount = ceil(net * 10000 / (10000 - fee))
    const amount = (wanted * FEE_DIVIDER + (FEE_DIVIDER - feeBp) - 1n) / (FEE_DIVIDER - feeBp);
    return { amount, feeBp };
  }

  async inventoryTonnes() {
    const [balance, feeBp] = await Promise.all([
      this.pub.readContract({ address: this.pool, abi: poolAbi, functionName: "balanceOf", args: [this.account.address] }),
      this.pub.readContract({ address: this.pool, abi: poolAbi, functionName: "feeRedeemPercentageInBase" }).catch(() => 0n),
    ]);
    return Number(formatUnits((balance * (FEE_DIVIDER - feeBp)) / FEE_DIVIDER, 18));
  }

  async retire(req: RetireRequest): Promise<RetireResult> {
    const { amount } = await this.grossUp(req.tonnes);
    const certs = await this.certs();

    const balance = await this.pub.readContract({ address: this.pool, abi: poolAbi, functionName: "balanceOf", args: [this.account.address] });
    if (balance < amount) {
      throw new Error(`Operator wallet holds ${formatUnits(balance, 18)} NCT, needs ${formatUnits(amount, 18)} (incl. redemption fee). Top up the inventory.`);
    }

    // 1. Pool token → specific TCO2 vintages (the pool picks the lowest-ranked ones).
    const redeemHash = await this.wallet.writeContract({ address: this.pool, abi: poolAbi, functionName: "redeemAuto2", args: [amount] });
    const redeemReceipt = await this.send(redeemHash, "redeemAuto2");
    const redeemed = parseEventLogs({ abi: poolAbi, eventName: "Redeemed", logs: redeemReceipt.logs })
      .filter((l) => l.args.account.toLowerCase() === this.account.address.toLowerCase())
      .map((l) => ({ tco2: l.args.erc20, amount: l.args.amount }));
    if (redeemed.length === 0) throw new Error("redeemAuto2 returned no TCO2s");

    // 2. Retire each TCO2. Each retirement is registered as an event on the certificates contract.
    const eventIds: bigint[] = [];
    const amounts: bigint[] = [];
    for (const { tco2, amount: tco2Amount } of redeemed) {
      const hash = await this.wallet.writeContract({ address: tco2, abi: tco2Abi, functionName: "retire", args: [tco2Amount] });
      const receipt = await this.send(hash, "retire");
      const [retired] = parseEventLogs({ abi: tco2Abi, eventName: "Retired", logs: receipt.logs });
      if (!retired) throw new Error("Retired event missing");
      eventIds.push(retired.args.eventId);
      amounts.push(tco2Amount);
    }
    const total = amounts.reduce((s, a) => s + a, 0n);

    // 3. One certificate covering all retirement events, in the recipient's name.
    //    The NFT is minted to the operator so the recipient can claim it later without a wallet up front.
    const mintHash = await this.wallet.writeContract({
      address: certs,
      abi: certificatesAbi,
      functionName: "mintCertificate",
      args: [this.account.address, RETIRING_ENTITY, this.account.address, req.beneficiaryName, req.beneficiaryMessage, eventIds],
    });
    const mintReceipt = await this.send(mintHash, "mintCertificate");
    const [minted] = parseEventLogs({ abi: certificatesAbi, eventName: "CertificateMinted", logs: mintReceipt.logs });
    if (!minted) throw new Error("CertificateMinted event missing");

    return {
      tonnes: Number(formatUnits(total, 18)),
      chain: this.name,
      txHash: mintHash,
      blockNumber: Number(mintReceipt.blockNumber),
      contract: certs,
      serialRange: serialRange(eventIds, amounts),
      certTokenId: Number(minted.args.tokenId),
    };
  }

  async lookup(txHash: string): Promise<OnChainRetirement | null> {
    const certs = await this.certs();
    const receipt = await this.pub.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
    if (!receipt) return null;
    const [minted] = parseEventLogs({
      abi: certificatesAbi,
      eventName: "CertificateMinted",
      logs: receipt.logs.filter((l) => l.address.toLowerCase() === certs.toLowerCase()),
    });
    if (!minted) return null;
    const tokenId = minted.args.tokenId;

    const data = await this.pub.readContract({ address: certs, abi: certificatesAbi, functionName: "certificates", args: [tokenId] });
    const events = await Promise.all(
      data.retirementEventIds.map((id) => this.pub.readContract({ address: certs, abi: certificatesAbi, functionName: "retirements", args: [id] })),
    );
    const total = events.reduce((sum, e) => sum + e.amount, 0n);
    const owner = await this.pub.readContract({ address: certs, abi: certificatesAbi, functionName: "ownerOf", args: [tokenId] }).catch(() => ZERO as Address);

    return {
      chain: this.name,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      contract: certs,
      serialRange: serialRange(data.retirementEventIds, events.map((e) => e.amount)),
      certTokenId: Number(tokenId),
      beneficiaryName: data.beneficiaryString,
      beneficiaryMessage: data.retirementMessage,
      tonnes: Number(formatUnits(total, 18)),
      retiredAt: new Date(Number(data.createdAt) * 1000),
      claimedBy: owner.toLowerCase() === this.account.address.toLowerCase() || owner === ZERO ? null : owner,
    };
  }

  async claimCertificate(certTokenId: number, wallet: string) {
    const certs = await this.certs();
    const hash = await this.wallet.writeContract({
      address: certs,
      abi: certificatesAbi,
      functionName: "safeTransferFrom",
      args: [this.account.address, wallet as Address, BigInt(certTokenId)],
    });
    await this.send(hash, "claim");
    return { txHash: hash };
  }
}
