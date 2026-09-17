// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";
import {VerifierRegistry} from "../src/VerifierRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Shared fixture: vault, registry, two tokens, named actors, and helpers.
abstract contract VaultBase is Test {
    Vault internal vault;
    VerifierRegistry internal registry;
    MockUSDC internal usd;
    MockUSDC internal usd2;

    address internal owner = makeAddr("owner");
    address internal arbiter = makeAddr("arbiter");
    address internal intake = makeAddr("intake");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal verifier = makeAddr("verifier");
    address internal stranger = makeAddr("stranger");

    uint256 internal payerKey = 0xA11CE;
    uint256 internal workerKey = 0xB0B;
    address internal payer = vm.addr(payerKey);
    address internal worker = vm.addr(workerKey);

    bytes32 internal constant SCOPE = keccak256("scope: summarise 3 PDFs into a 1-page brief");
    bytes32 internal constant SALT = keccak256("salt");
    bytes32 internal constant DELIVERABLE = keccak256("deliverable manifest");
    bytes32 internal constant REPORT = keccak256("attestation report");

    uint256 internal constant AMOUNT = 5_000_000; // $5

    function setUp() public virtual {
        usd = new MockUSDC("USD Coin", "USDC");
        usd2 = new MockUSDC("pathUSD", "pathUSD");
        registry = new VerifierRegistry(owner);
        address[] memory tokens = new address[](2);
        tokens[0] = address(usd);
        tokens[1] = address(usd2);
        vault = new Vault(owner, address(registry), arbiter, intake, tokens);

        vm.startPrank(owner);
        registry.setVerifier(verifier, true, "https://vouch.dev/verifier");
        vault.setFee(100, feeRecipient); // 1%
        vm.stopPrank();

        usd.mint(payer, 1_000_000_000);
        usd.mint(worker, 1_000_000_000);
        usd2.mint(payer, 1_000_000_000);
        vm.prank(payer);
        usd.approve(address(vault), type(uint256).max);
        vm.prank(payer);
        usd2.approve(address(vault), type(uint256).max);
        vm.prank(worker);
        usd.approve(address(vault), type(uint256).max);
    }

    // ---------------- helpers ----------------

    function manualPolicy() internal pure returns (Vault.Policy memory) {
        return Vault.Policy({
            autoRelease: 0,
            minConfidenceBps: 0,
            maxAutoAmount: 0,
            reviewWindow: 0,
            submitDeadline: 7 days,
            earnVault: address(0)
        });
    }

    function trustedPolicy() internal pure returns (Vault.Policy memory) {
        return Vault.Policy({
            autoRelease: 1,
            minConfidenceBps: 8500,
            maxAutoAmount: 200_000_000,
            reviewWindow: 3 days,
            submitDeadline: 14 days,
            earnVault: address(0)
        });
    }

    function autopilotPolicy() internal pure returns (Vault.Policy memory) {
        return Vault.Policy({
            autoRelease: 1,
            minConfidenceBps: 9000,
            maxAutoAmount: 50_000_000,
            reviewWindow: 1 days,
            submitDeadline: 7 days,
            earnVault: address(0)
        });
    }

    function commitFor(bytes32 jobId, address w, uint256 amount) internal view returns (bytes32) {
        return vault.computeCommit(jobId, payer, w, address(usd), amount, SCOPE, SALT);
    }

    function createJob(bytes32 jobId, address w, uint256 amount, Vault.Policy memory p) internal {
        bytes32 c = commitFor(jobId, w, amount);
        vm.prank(payer);
        vault.createJob(jobId, c, payer, w, address(usd), p);
    }

    function depositAs(address who, uint256 amount) internal {
        vm.prank(who);
        vault.deposit(address(usd), amount);
    }

    function createAndFund(bytes32 jobId, address w, uint256 amount, Vault.Policy memory p) internal {
        depositAs(payer, amount);
        createJob(jobId, w, amount, p);
        vm.prank(payer);
        vault.fund(jobId, amount, SCOPE, SALT);
    }

    function submitAs(address who, bytes32 jobId) internal {
        vm.prank(who);
        vault.submit(jobId, DELIVERABLE);
    }

    function attestAs(bytes32 jobId, Vault.Verdict v, uint16 conf) internal {
        vm.prank(verifier);
        vault.attest(jobId, v, conf, REPORT);
    }

    function status(bytes32 jobId) internal view returns (Vault.Status) {
        return vault.getJob(jobId).status;
    }

    function sign(uint256 key, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", vault.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function feeOn(uint256 amount) internal view returns (uint256) {
        return (amount * vault.feeBps()) / 10_000;
    }
}
