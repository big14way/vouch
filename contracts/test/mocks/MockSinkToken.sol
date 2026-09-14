// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Malicious/odd token: every transfer "succeeds" but moves nothing (100% fee-on-transfer).
contract MockSinkToken {
    mapping(address => uint256) public balanceOf;

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function receiveWithAuthorization(address, address, uint256, uint256, uint256, bytes32, uint8, bytes32, bytes32)
        external
        pure {}
}
