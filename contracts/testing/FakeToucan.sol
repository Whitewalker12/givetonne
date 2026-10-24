// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Local stand-ins for the Toucan contracts GiveTonne talks to, with the same
/// function signatures, events and struct layouts as ToucanProtocol/contracts.
/// Used only to test the Toucan adapter on a dev node; never deployed for real.

contract FakeRegistry {
    address public retirementCertificatesAddress;
    mapping(address => bool) public isValidERC20;

    constructor(address certs) {
        retirementCertificatesAddress = certs;
    }

    function addERC20(address erc20) external {
        isValidERC20[erc20] = true;
    }
}

contract FakeRetirementCertificates {
    struct CertificateData {
        uint256[] retirementEventIds;
        uint256 createdAt;
        address retiringEntity;
        address beneficiary;
        string retiringEntityString;
        string beneficiaryString;
        string retirementMessage;
        string beneficiaryLocation;
        string consumptionCountryCode;
        uint256 consumptionPeriodStart;
        uint256 consumptionPeriodEnd;
    }

    struct RetirementEvent {
        uint256 createdAt;
        address retiringEntity;
        uint256 amount;
        uint256 projectVintageTokenId;
    }

    event CertificateMinted(uint256 tokenId);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    uint256 public nextEventId = 1;
    uint256 public nextTokenId = 1;
    mapping(uint256 => RetirementEvent) private _retirements;
    mapping(uint256 => address) private _eventOwner;
    mapping(uint256 => bool) private _eventUsed;
    mapping(uint256 => CertificateData) private _certificates;
    mapping(uint256 => address) private _owners;

    /// Called by TCO2 contracts when tokens are retired.
    function registerEvent(address retiringEntity, uint256 projectVintageTokenId, uint256 amount) external returns (uint256 eventId) {
        eventId = nextEventId++;
        _retirements[eventId] = RetirementEvent(block.timestamp, retiringEntity, amount, projectVintageTokenId);
        _eventOwner[eventId] = retiringEntity;
    }

    function mintCertificate(
        address retiringEntity,
        string calldata retiringEntityString,
        address beneficiary,
        string calldata beneficiaryString,
        string calldata retirementMessage,
        uint256[] calldata retirementEventIds
    ) external returns (uint256 tokenId) {
        require(retirementEventIds.length > 0, "no events");
        for (uint256 i = 0; i < retirementEventIds.length; i++) {
            uint256 id = retirementEventIds[i];
            require(_eventOwner[id] == msg.sender, "not event owner");
            require(!_eventUsed[id], "event already used");
            _eventUsed[id] = true;
        }
        tokenId = nextTokenId++;
        CertificateData storage c = _certificates[tokenId];
        c.retirementEventIds = retirementEventIds;
        c.createdAt = block.timestamp;
        c.retiringEntity = retiringEntity;
        c.beneficiary = beneficiary;
        c.retiringEntityString = retiringEntityString;
        c.beneficiaryString = beneficiaryString;
        c.retirementMessage = retirementMessage;
        address to = beneficiary == address(0) ? retiringEntity : beneficiary;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
        emit CertificateMinted(tokenId);
    }

    function certificates(uint256 tokenId) external view returns (CertificateData memory) {
        return _certificates[tokenId];
    }

    function retirements(uint256 eventId) external view returns (RetirementEvent memory) {
        return _retirements[eventId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "no token");
        return _owners[tokenId];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from && msg.sender == from, "not owner");
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }
}

contract FakeTCO2 {
    event Retired(address sender, uint256 amount, uint256 eventId);
    event Transfer(address indexed from, address indexed to, uint256 value);

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public immutable projectVintageTokenId;
    FakeRetirementCertificates public immutable certs;
    mapping(address => uint256) public balanceOf;
    address public pool;

    constructor(string memory _name, string memory _symbol, uint256 _vintageId, FakeRetirementCertificates _certs) {
        name = _name;
        symbol = _symbol;
        projectVintageTokenId = _vintageId;
        certs = _certs;
    }

    function setPool(address p) external {
        pool = p;
    }

    /// Pool hands TCO2 to the redeemer.
    function mintTo(address to, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function retire(uint256 amount) external returns (uint256 retirementEventId) {
        require(balanceOf[msg.sender] >= amount, "insufficient TCO2");
        balanceOf[msg.sender] -= amount;
        emit Transfer(msg.sender, address(0), amount);
        retirementEventId = certs.registerEvent(msg.sender, projectVintageTokenId, amount);
        emit Retired(msg.sender, amount, retirementEventId);
    }
}

contract FakeNCT {
    event Redeemed(address account, address erc20, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);

    string public constant name = "Toucan Protocol: Nature Carbon Tonne";
    string public constant symbol = "NCT";
    uint8 public constant decimals = 18;
    uint256 public feeRedeemPercentageInBase = 25; // 0.25% like mainnet NCT
    uint256 public constant feeRedeemDivider = 10000;
    mapping(address => uint256) public balanceOf;
    address[] private _scored;

    function faucet(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function setScoredTCO2s(address[] calldata tco2s) external {
        _scored = tco2s;
    }

    function getScoredTCO2s() external view returns (address[] memory) {
        return _scored;
    }

    /// Burns `amount` NCT and hands back the lowest-ranked TCO2, net of the redemption fee.
    function redeemAuto2(uint256 amount) external returns (address[] memory tco2s, uint256[] memory amounts) {
        require(balanceOf[msg.sender] >= amount, "insufficient NCT");
        require(_scored.length > 0, "pool empty");
        balanceOf[msg.sender] -= amount;
        emit Transfer(msg.sender, address(0), amount);

        uint256 fee = (amount * feeRedeemPercentageInBase) / feeRedeemDivider;
        uint256 net = amount - fee;
        tco2s = new address[](1);
        amounts = new uint256[](1);
        tco2s[0] = _scored[0];
        amounts[0] = net;
        FakeTCO2(_scored[0]).mintTo(msg.sender, net);
        emit Redeemed(msg.sender, _scored[0], net);
    }
}
