/**
 * Chain adapter boundary.
 *
 * The demo uses MockChain. Swapping to real tokenized credits means adding a
 * ToucanChain (Polygon) that calls the Toucan/Klima retirement aggregator
 * `retireExactCarbonDefault(..., beneficiaryName, retirementMessage)` and
 * reads back the retirement certificate NFT id. Nothing above this boundary
 * needs to change.
 */

export type RetireRequest = {
  giftId: string;
  projectRegistryId: string;
  tonnes: number;
  beneficiaryName: string;
  beneficiaryMessage: string;
};

export type RetireResult = {
  chain: string;
  txHash: string;
  blockNumber: number;
  contract: string;
  serialRange: string;
  certTokenId: number;
};

export type OnChainRetirement = RetireResult & {
  beneficiaryName: string;
  beneficiaryMessage: string;
  tonnes: number;
  retiredAt: Date;
  claimedBy: string | null;
};

export interface ChainAdapter {
  readonly name: string;
  /** Block explorer URL for a tx hash. */
  explorerTxUrl(txHash: string): string;
  /** Permanently retire credits in the beneficiary's name. */
  retire(req: RetireRequest): Promise<RetireResult>;
  /** Look up a retirement by tx hash, as a third party would. */
  lookup(txHash: string): Promise<OnChainRetirement | null>;
  /** Transfer the certificate NFT to a wallet. */
  claimCertificate(certTokenId: number, wallet: string): Promise<{ txHash: string }>;
}
