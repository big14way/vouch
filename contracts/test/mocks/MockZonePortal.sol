// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IZonePortal} from "../../src/interfaces/IZonePortal.sol";

/// @dev Zone Portal look-alike: pulls the token, deducts a fixed deposit fee, records the deposit.
contract MockZonePortal is IZonePortal {
    using SafeERC20 for IERC20;

    uint32 public immutable zoneId;
    uint128 public fee;
    mapping(address => bool) public active;
    mapping(uint256 => bool) public keyValid;
    uint256 public depositCount;
    bool public failDeposits;

    struct Record {
        address sender;
        address token;
        uint128 net;
        uint256 keyIndex;
        address refundTo;
        bytes32 payloadHash;
    }

    Record[] public deposits;

    error DepositsInactive();
    error InvalidKey();
    error Forced();

    constructor(uint32 zoneId_, address token, uint128 fee_) {
        zoneId = zoneId_;
        fee = fee_;
        active[token] = true;
        keyValid[0] = true;
    }

    function setActive(address token, bool v) external {
        active[token] = v;
    }

    function setKeyValid(uint256 k, bool v) external {
        keyValid[k] = v;
    }

    function setFail(bool v) external {
        failDeposits = v;
    }

    function areDepositsActive(address token) external view returns (bool) {
        return active[token];
    }

    function calculateDepositFee() external view returns (uint128) {
        return fee;
    }

    function isEncryptionKeyValid(uint256 keyIndex) external view returns (bool, uint64) {
        return (keyValid[keyIndex], type(uint64).max);
    }

    function depositEncrypted(
        address token,
        uint128 amount,
        uint256 keyIndex,
        EncryptedPayload calldata encrypted,
        address tempoRefundRecipient
    ) external returns (bytes32) {
        if (failDeposits) revert Forced();
        if (!active[token]) revert DepositsInactive();
        if (!keyValid[keyIndex]) revert InvalidKey();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits.push(
            Record({
                sender: msg.sender,
                token: token,
                net: amount - fee,
                keyIndex: keyIndex,
                refundTo: tempoRefundRecipient,
                payloadHash: keccak256(abi.encode(encrypted))
            })
        );
        depositCount++;
        return keccak256(abi.encode(depositCount));
    }

    function last() external view returns (Record memory) {
        return deposits[deposits.length - 1];
    }
}

/// @dev Older portal shape: no refund recipient argument; the sender is the implicit refund recipient.
contract MockZonePortalLegacy {
    using SafeERC20 for IERC20;

    uint128 public fee;
    address public lastSender;
    uint128 public lastNet;
    bytes32 public lastPayloadHash;

    constructor(uint128 fee_) {
        fee = fee_;
    }

    function areDepositsActive(address) external pure returns (bool) {
        return true;
    }

    function depositEncrypted(address token, uint128 amount, uint256, IZonePortal.EncryptedPayload calldata encrypted)
        external
        returns (bytes32)
    {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        lastSender = msg.sender;
        lastNet = amount - fee;
        lastPayloadHash = keccak256(abi.encode(encrypted));
        return keccak256(abi.encode(amount));
    }
}
