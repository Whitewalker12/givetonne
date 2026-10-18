import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { ChainAdapter, OnChainRetirement, RetireRequest, RetireResult } from "./types";

/**
 * A stand-in for Polygon that keeps an append-only ledger on disk.
 *
 * It is deliberately independent of the app database so the /verify page
 * really does cross-check two sources, the way a block explorer lookup would.
 */

type LedgerEntry = Omit<OnChainRetirement, "retiredAt"> & { retiredAt: string };
type Ledger = { blockNumber: number; nextTokenId: number; entries: LedgerEntry[] };

const CHAIN = "mock-polygon-amoy";
const CONTRACT = "0xCa7b0ngG1f7000000000000000000000000Re71re";
const LEDGER_PATH = path.join(process.cwd(), ".mockchain", "ledger.json");

function load(): Ledger {
  if (!existsSync(LEDGER_PATH)) {
    return { blockNumber: 14_200_000, nextTokenId: 1, entries: [] };
  }
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
}

function save(ledger: Ledger) {
  mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

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

    const ledger = load();
    const blockNumber = ++ledger.blockNumber;
    const certTokenId = ledger.nextTokenId++;
    const txHash = hash(`${req.giftId}:${blockNumber}:${req.beneficiaryName}`);
    const serialStart = 1_000_000 + blockNumber;
    const serialRange = `${req.projectRegistryId}-${serialStart}-${serialStart + Math.round(req.tonnes * 1000)}`;

    ledger.entries.push({
      chain: CHAIN,
      txHash,
      blockNumber,
      contract: CONTRACT,
      serialRange,
      certTokenId,
      beneficiaryName: req.beneficiaryName,
      beneficiaryMessage: req.beneficiaryMessage,
      tonnes: req.tonnes,
      retiredAt: new Date().toISOString(),
      claimedBy: null,
    });
    save(ledger);

    return { chain: CHAIN, txHash, blockNumber, contract: CONTRACT, serialRange, certTokenId };
  }

  async lookup(txHash: string): Promise<OnChainRetirement | null> {
    const entry = load().entries.find((e) => e.txHash === txHash);
    return entry ? { ...entry, retiredAt: new Date(entry.retiredAt) } : null;
  }

  async claimCertificate(certTokenId: number, wallet: string) {
    await sleep(600);
    const ledger = load();
    const entry = ledger.entries.find((e) => e.certTokenId === certTokenId);
    if (!entry) throw new Error("Certificate not found on chain");
    if (entry.claimedBy) throw new Error("Certificate already claimed");
    entry.claimedBy = wallet;
    ledger.blockNumber++;
    save(ledger);
    return { txHash: hash(`claim:${certTokenId}:${wallet}`) };
  }
}
