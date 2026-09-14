// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IVerifierRegistry
/// @notice Minimal interface the Vault uses to check whether an address may attest.
interface IVerifierRegistry {
    function isVerifier(address account) external view returns (bool);
}
