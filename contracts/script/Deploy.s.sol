// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {VerifierRegistry} from "../src/VerifierRegistry.sol";

/// @notice Deploys VerifierRegistry + Vault, registers the Vouch verifier, sets the fee, and writes
///         `deployments/<chainId>.json`. Parameterised entirely by environment variables:
///
///   DEPLOYER_PRIVATE_KEY   signer (becomes initial owner unless OWNER_ADDRESS is set)
///   OWNER_ADDRESS          optional; multisig on mainnet
///   ARBITER_ADDRESS        dispute resolver
///   INTAKE_ADDRESS         attribution / on-behalf funding role (relayer key)
///   VERIFIER_ADDRESS       verifier key registered at deploy
///   VERIFIER_URI           optional public description URL
///   FEE_BPS                optional, default 100 (1%), max 200
///   FEE_RECIPIENT          required when FEE_BPS > 0
///   TOKENS                 comma-separated allow-list; defaults per chain id (see `_defaultTokens`)
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url moderato --broadcast
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
contract Deploy is Script {
    address constant TEMPO_PATHUSD = 0x20C0000000000000000000000000000000000000;
    address constant TEMPO_USDCE = 0x20C000000000000000000000b9537d11c60E8b50;
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (VerifierRegistry registry, Vault vault) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        address arbiter = vm.envAddress("ARBITER_ADDRESS");
        address intake = vm.envAddress("INTAKE_ADDRESS");
        address verifier = vm.envAddress("VERIFIER_ADDRESS");
        string memory verifierURI = vm.envOr("VERIFIER_URI", string("https://vouch.dev/verifier"));
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(100)));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", owner);
        address[] memory tokens = _tokens();

        vm.startBroadcast(pk);
        // Deployer owns during setup, then hands over if OWNER_ADDRESS differs (2-step, owner must accept).
        registry = new VerifierRegistry(deployer);
        registry.setVerifier(verifier, true, verifierURI);
        vault = new Vault(deployer, address(registry), arbiter, intake, tokens);
        vault.setFee(feeBps, feeRecipient);
        if (owner != deployer) {
            registry.transferOwnership(owner);
            vault.transferOwnership(owner);
        }
        vm.stopBroadcast();

        console2.log("chainId        ", block.chainid);
        console2.log("VerifierRegistry", address(registry));
        console2.log("Vault           ", address(vault));
        console2.log("owner (pending) ", owner);

        _writeDeployment(address(registry), address(vault), owner, arbiter, intake, verifier, tokens);
    }

    function _tokens() internal view returns (address[] memory tokens) {
        string memory raw = vm.envOr("TOKENS", string(""));
        if (bytes(raw).length != 0) {
            string[] memory parts = vm.split(raw, ",");
            tokens = new address[](parts.length);
            for (uint256 i; i < parts.length; ++i) {
                tokens[i] = vm.parseAddress(parts[i]);
            }
            return tokens;
        }
        return _defaultTokens(block.chainid);
    }

    function _defaultTokens(uint256 chainId) internal pure returns (address[] memory tokens) {
        if (chainId == 4217 || chainId == 42431) {
            tokens = new address[](2);
            tokens[0] = TEMPO_PATHUSD;
            tokens[1] = TEMPO_USDCE;
        } else if (chainId == 8453) {
            tokens = new address[](1);
            tokens[0] = BASE_USDC;
        } else if (chainId == 84532) {
            tokens = new address[](1);
            tokens[0] = BASE_SEPOLIA_USDC;
        } else {
            revert("Deploy: set TOKENS for this chain");
        }
    }

    function _writeDeployment(
        address registry,
        address vault,
        address owner,
        address arbiter,
        address intake,
        address verifier,
        address[] memory tokens
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "VerifierRegistry", registry);
        vm.serializeAddress(key, "Vault", vault);
        vm.serializeAddress(key, "owner", owner);
        vm.serializeAddress(key, "arbiter", arbiter);
        vm.serializeAddress(key, "intake", intake);
        vm.serializeAddress(key, "verifier", verifier);
        vm.serializeUint(key, "block", block.number);
        string memory json = vm.serializeAddress(key, "tokens", tokens);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("wrote", path);
    }
}
