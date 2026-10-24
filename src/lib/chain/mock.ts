import { createHash } from "node:crypto";
import { prisma } from "../db";
import type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";

/**
 * A stand-in for Polygon that keeps an append-only ledger in its own table.
 *
 * It is deliberately kept apart from the Gift/Retirement records so the
 * /verify page really does cross-check two sources, the way a block explorer
 * lookup would.
 */

const CHAIN = "mock-polygon-amoy";
const CONTRACT = "0xCa7b0ngG1f7000000000000000000000000Re71re";
const GENESIS_BLOCK = 14_200_000;

function hash(input: string) {
  return "0x" + createHash("sha256").update(input).digest("hex");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockChain implements ChainAdapter {
  readonly name = CHAIN;

  explorerTxUrl(txHash: string) {
    return `/verify/${txHash}`;
  }

  async retire(req: RetireRequest): Promise<RetireResult> {
    await sleep(1200); // pretend to wait for block confirmation

    const head = await prisma.mockLedgerEntry.aggregate({
      _max: { blockNumber: true, certTokenId: true },
    });
    const blockNumber = (head._max.blockNumber ?? GENESIS_BLOCK) + 1;
    const certTokenId = (head._max.certTokenId ?? 0) + 1;
    const txHash = hash(`${req.giftId}:${blockNumber}:${req.beneficiaryName}`);
    const serialStart = 1_000_000 + blockNumber;
    const serialRange = `${req.projectRegistryId}-${serialStart}-${serialStart + Math.round(req.tonnes * 1000)}`;

    await prisma.mockLedgerEntry.create({
      data: {
        txHash,
        blockNumber,
        contract: CONTRACT,
        serialRange,
        certTokenId,
        beneficiaryName: req.beneficiaryName,
        beneficiaryMsg: req.beneficiaryMessage,
        tonnes: req.tonnes,
      },
    });

    return { tonnes: req.tonnes, chain: CHAIN, txHash, blockNumber, contract: CONTRACT, serialRange, certTokenId };
  }

  async lookup(txHash: string): Promise<OnChainRetirement | null> {
    const e = await prisma.mockLedgerEntry.findUnique({ where: { txHash } });
    if (!e) return null;
    return {
      chain: CHAIN,
      txHash: e.txHash,
      blockNumber: e.blockNumber,
      contract: e.contract,
      serialRange: e.serialRange,
      certTokenId: e.certTokenId,
      beneficiaryName: e.beneficiaryName,
      beneficiaryMessage: e.beneficiaryMsg,
      tonnes: e.tonnes,
      retiredAt: e.retiredAt,
      claimedBy: e.claimedBy,
    };
  }

  async claimCertificate(certTokenId: number, wallet: string) {
    await sleep(600);
    const entry = await prisma.mockLedgerEntry.findUnique({ where: { certTokenId } });
    if (!entry) throw new Error("Certificate not found on chain");
    if (entry.claimedBy) throw new Error("Certificate already claimed");
    await prisma.mockLedgerEntry.update({ where: { certTokenId }, data: { claimedBy: wallet } });
    return { txHash: hash(`claim:${certTokenId}:${wallet}`) };
  }
}
