// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IERC3009
/// @notice Subset of EIP-3009 (Transfer With Authorization) implemented by Circle's USDC.
///         `receiveWithAuthorization` must be called by the `to` address, which protects the
///         vault against front-running of the authorization by a third party.
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
