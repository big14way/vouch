// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IVerifierRegistry} from "./interfaces/IVerifierRegistry.sol";

/// @title VerifierRegistry
/// @notice Owner-managed allow-list of verifier keys that may write attestations to the Vault.
///         One Vouch key at launch; third-party verifiers can be added later without touching the Vault.
contract VerifierRegistry is IVerifierRegistry, Ownable2Step {
    mapping(address => bool) public isVerifier;
    mapping(address => string) public verifierURI;

    event VerifierSet(address indexed verifier, bool allowed, string uri);

    error ZeroAddress();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Add or update a verifier. `uri` points to the verifier's public description / methodology.
    function setVerifier(address verifier, bool allowed, string calldata uri) external onlyOwner {
        if (verifier == address(0)) revert ZeroAddress();
        isVerifier[verifier] = allowed;
        verifierURI[verifier] = allowed ? uri : "";
        emit VerifierSet(verifier, allowed, allowed ? uri : "");
    }
}
