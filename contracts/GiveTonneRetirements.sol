// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GiveTonne retirement registry + certificate NFT
/// @notice Records a permanent carbon-credit retirement in a beneficiary's name and
///         mints a minimal ERC-721 certificate the beneficiary can claim later.
///         The operator (the GiveTonne backend wallet) is the only account that can
///         record retirements; anyone can read them. Retirements are append-only.
///
///         In production the `serialRange` references the registry serials actually
///         retired (Verra/Gold Standard), or, once tokenized credits are used, the
///         Toucan TCO2 retirement tx. This contract is the public, beneficiary-named
///         record either way.
contract GiveTonneRetirements {
    struct Retirement {
        string beneficiaryName;
        string message;
        uint256 tonnesMilli; // tonnes * 1000, avoids decimals
        string projectRegistryId;
        string serialRange;
        uint64 retiredAt;
        bytes32 giftRef; // keccak of the off-chain gift id
    }

    string public constant name = "GiveTonne Retirement Certificate";
    string public constant symbol = "GTRC";

    address public operator;
    uint256 public nextTokenId = 1;

    mapping(uint256 => Retirement) private _retirements;
    mapping(uint256 => address) private _owners; // tokenId => wallet (zero until claimed)
    mapping(address => uint256) private _balances;

    event Retired(
        uint256 indexed tokenId,
        bytes32 indexed giftRef,
        string beneficiaryName,
        uint256 tonnesMilli,
        string projectRegistryId,
        string serialRange
    );
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event OperatorChanged(address indexed previous, address indexed current);

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    constructor() {
        operator = msg.sender;
        emit OperatorChanged(address(0), msg.sender);
    }

    function setOperator(address next) external onlyOperator {
        emit OperatorChanged(operator, next);
        operator = next;
    }

    /// @notice Record a retirement and mint its certificate (held by the contract until claimed).
    function retire(
        string calldata beneficiaryName,
        string calldata message,
        uint256 tonnesMilli,
        string calldata projectRegistryId,
        string calldata serialRange,
        bytes32 giftRef
    ) external onlyOperator returns (uint256 tokenId) {
        require(bytes(beneficiaryName).length > 0, "beneficiary required");
        require(tonnesMilli > 0, "tonnes required");

        tokenId = nextTokenId++;
        _retirements[tokenId] = Retirement({
            beneficiaryName: beneficiaryName,
            message: message,
            tonnesMilli: tonnesMilli,
            projectRegistryId: projectRegistryId,
            serialRange: serialRange,
            retiredAt: uint64(block.timestamp),
            giftRef: giftRef
        });
        emit Retired(tokenId, giftRef, beneficiaryName, tonnesMilli, projectRegistryId, serialRange);
    }

    /// @notice Hand the certificate to the beneficiary's wallet. One-shot; the operator
    ///         verifies the claim link off-chain before calling this.
    function claim(uint256 tokenId, address to) external onlyOperator {
        require(tokenId > 0 && tokenId < nextTokenId, "no such certificate");
        require(_owners[tokenId] == address(0), "already claimed");
        require(to != address(0), "bad recipient");
        _owners[tokenId] = to;
        _balances[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function getRetirement(uint256 tokenId) external view returns (Retirement memory r, address claimedBy) {
        require(tokenId > 0 && tokenId < nextTokenId, "no such certificate");
        return (_retirements[tokenId], _owners[tokenId]);
    }

    function totalRetirements() external view returns (uint256) {
        return nextTokenId - 1;
    }

    // Minimal ERC-721 read surface so wallets and explorers recognise the certificate.
    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "unclaimed");
        return o;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x01ffc9a7; // ERC721, ERC165
    }
}
