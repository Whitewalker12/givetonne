import { parseAbi } from "viem";

/**
 * Minimal ABIs for the Toucan contracts GiveTonne touches, transcribed from
 * ToucanProtocol/contracts (PoolWithFixedFees, PoolERC20able,
 * ToucanCarbonOffsetsBase, RetirementCertificates, IToucanContractRegistry).
 */

export const poolAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function feeRedeemPercentageInBase() view returns (uint256)",
  "function getScoredTCO2s() view returns (address[])",
  // Burns pool tokens and sends back the lowest-ranked TCO2s, net of the redemption fee.
  "function redeemAuto2(uint256 amount) returns (address[] tco2s, uint256[] amounts)",
  "event Redeemed(address account, address erc20, uint256 amount)",
]);

export const tco2Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function retire(uint256 amount) returns (uint256 retirementEventId)",
  "event Retired(address sender, uint256 amount, uint256 eventId)",
]);

export const registryAbi = parseAbi([
  "function retirementCertificatesAddress() view returns (address)",
  "function isValidERC20(address erc20) view returns (bool)",
]);

export const certificatesAbi = parseAbi([
  "struct CertificateData { uint256[] retirementEventIds; uint256 createdAt; address retiringEntity; address beneficiary; string retiringEntityString; string beneficiaryString; string retirementMessage; string beneficiaryLocation; string consumptionCountryCode; uint256 consumptionPeriodStart; uint256 consumptionPeriodEnd; }",
  "struct RetirementEvent { uint256 createdAt; address retiringEntity; uint256 amount; uint256 projectVintageTokenId; }",
  "function mintCertificate(address retiringEntity, string retiringEntityString, address beneficiary, string beneficiaryString, string retirementMessage, uint256[] retirementEventIds) returns (uint256)",
  "function certificates(uint256 tokenId) view returns (CertificateData)",
  "function retirements(uint256 eventId) view returns (RetirementEvent)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event CertificateMinted(uint256 tokenId)",
]);
