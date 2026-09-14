// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../../src/Vault.sol";
import {VerifierRegistry} from "../../src/VerifierRegistry.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {VaultHandler} from "./VaultHandler.sol";

/// Invariants (spec §6.1):
///  I1  token.balanceOf(vault) >= Σ balances + Σ locked, per token
///  I2  accounted[token] == Σ balances + locked[token]   (ledger is internally consistent)
///  I3  attest never changes any balance                 (checked inside the handler)
///  I4  autoSettle reverts if any predicate fails        (checked inside the handler)
///  I5  amounts only accepted with a matching commitment (checked inside the handler)
///  I6  fee charged exactly once per job                 (Σ fee credits == Σ expected fees)
///  I7  attributeDeposit never pushes accounted above real balance (I1 covers it; handler tries)
///  I8  every job is in a terminal or reachable state; locked == Σ amounts of live jobs
contract VaultInvariantTest is Test {
    Vault internal vault;
    VerifierRegistry internal registry;
    MockUSDC internal usd;
    MockUSDC internal usd2;
    VaultHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal arbiter = makeAddr("arbiter");
    address internal intake = makeAddr("intake");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal verifier = makeAddr("verifier");

    function setUp() public {
        usd = new MockUSDC("USD Coin", "USDC");
        usd2 = new MockUSDC("pathUSD", "pathUSD");
        registry = new VerifierRegistry(owner);
        address[] memory tokens = new address[](2);
        tokens[0] = address(usd);
        tokens[1] = address(usd2);
        vault = new Vault(owner, address(registry), arbiter, intake, tokens);
        vm.startPrank(owner);
        registry.setVerifier(verifier, true, "");
        vault.setFee(100, feeRecipient);
        vm.stopPrank();

        handler = new VaultHandler(vault, usd, usd2, arbiter, intake, verifier, feeRecipient);
        targetContract(address(handler));
    }

    function invariant_I1_solvency() public view {
        _checkToken(usd);
        _checkToken(usd2);
    }

    function _checkToken(MockUSDC t) internal view {
        uint256 sumBalances = handler.sumBalances(address(t));
        uint256 lockedT = vault.locked(address(t));
        assertGe(t.balanceOf(address(vault)), sumBalances + lockedT, "I1: insolvent");
        assertEq(vault.accounted(address(t)), sumBalances + lockedT, "I2: ledger drift");
        assertEq(lockedT, handler.liveLocked(address(t)), "I8: locked != live jobs");
    }

    function invariant_I3_attestMovesNothing() public view {
        assertEq(handler.attestBalanceDrift(), 0, "I3: attest moved funds");
    }

    function invariant_I4_autoSettleGuarded() public view {
        assertEq(handler.badAutoSettles(), 0, "I4: autoSettle succeeded with a failing predicate");
    }

    function invariant_I5_commitBinding() public view {
        assertEq(handler.badReveals(), 0, "I5: wrong reveal accepted");
    }

    function invariant_I6_feeOnce() public view {
        assertEq(vault.balances(address(usd), feeRecipient), handler.expectedFees(address(usd)), "I6: fee drift usd");
        assertEq(vault.balances(address(usd2), feeRecipient), handler.expectedFees(address(usd2)), "I6: fee drift usd2");
    }

    function invariant_callSummary() public view {
        handler.callSummary();
    }
}
