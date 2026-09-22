// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VaultBase} from "./VaultBase.t.sol";
import {Vault} from "../src/Vault.sol";
import {MockEarnVault, IVenueObserver} from "./mocks/MockEarnVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// Checks-effects-interactions on every path that reaches an Earn venue (Slither v5 item):
/// by the time the venue is called the job is already closed and the principal already unlocked,
/// and a venue that tries to re-enter the Vault is stopped by the guard.
contract VaultReentrancyTest is VaultBase, IVenueObserver {
    bytes32 internal constant JOB = keccak256("cei-job");
    MockEarnVault internal earn;

    // What the venue saw while the Vault was mid-call.
    Vault.Status internal seenStatus;
    uint256 internal seenLocked;
    uint256 internal seenEarnShares;
    bytes4 internal seenSelector;
    bytes4 internal reentryError;
    uint256 internal calls;

    function setUp() public override {
        super.setUp();
        earn = new MockEarnVault(IERC20(address(usd)));
        vm.prank(owner);
        vault.setEarnVault(address(earn), true);
        earn.setObserver(address(this));
    }

    function earnPolicy() internal view returns (Vault.Policy memory p) {
        p = manualPolicy();
        p.earnVault = address(earn);
    }

    function autoEarnPolicy() internal view returns (Vault.Policy memory p) {
        p = autopilotPolicy();
        p.earnVault = address(earn);
    }

    /// Called by the mock venue at the start of deposit / withdrawExact / redeem.
    function onVenueCall(bytes4 selector) external {
        calls++;
        seenSelector = selector;
        Vault.Job memory j = vault.getJob(JOB);
        seenStatus = j.status;
        seenEarnShares = j.earnShares;
        seenLocked = vault.locked(address(usd));
        // Try to re-enter through the payer's settle: the guard must stop it before any status check.
        // (No prank here: the caller is this contract, which is not the payer, so if the guard were
        // missing the revert would be NotPayer and the assertion below would catch the difference.)
        try vault.settle(JOB, AMOUNT, SCOPE, SALT) {
            reentryError = bytes4(0);
        } catch (bytes memory reason) {
            // the first four bytes are the error selector, the rest is dropped on purpose
            // forge-lint: disable-next-line(unsafe-typecast)
            reentryError = bytes4(reason);
        }
    }

    function assertClosedBeforeVenue(Vault.Status expected, bytes4 venueSelector) internal view {
        assertEq(calls, 1, "venue called exactly once");
        assertEq(seenSelector, venueSelector, "venue entry point");
        assertEq(uint8(seenStatus), uint8(expected), "status already terminal when the venue ran");
        assertEq(seenLocked, 0, "principal already unlocked when the venue ran");
        assertEq(seenEarnShares, 0, "earn shares already cleared when the venue ran");
        assertEq(reentryError, ReentrancyGuard.ReentrancyGuardReentrantCall.selector, "re-entry stopped by the guard");
    }

    function test_settle_closesJobBeforeVenue() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        calls = 0; // ignore the deposit at fund
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        assertClosedBeforeVenue(Vault.Status.Settled, MockEarnVault.withdrawExact.selector);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT));
    }

    function test_autoSettle_closesJobBeforeVenue() public {
        createAndFund(JOB, worker, AMOUNT, autoEarnPolicy());
        calls = 0;
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Pass, 9500);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(stranger);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
        assertClosedBeforeVenue(Vault.Status.Settled, MockEarnVault.withdrawExact.selector);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    function test_resolve_closesJobBeforeVenue() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        calls = 0;
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("late"));
        vm.prank(arbiter);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 5000);
        assertClosedBeforeVenue(Vault.Status.Resolved, MockEarnVault.withdrawExact.selector);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Resolved));
    }

    function test_refundExpired_closesJobBeforeVenue() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        calls = 0;
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(stranger);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        assertClosedBeforeVenue(Vault.Status.Refunded, MockEarnVault.withdrawExact.selector);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Refunded));
        assertEq(vault.balances(address(usd), payer), AMOUNT);
    }

    function test_settle_fallbackRedeem_closesJobBeforeVenue() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        calls = 0;
        earn.setFailWithdrawExact(true);
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        // withdrawExact reverted inside the Vault's try (which also rolled back that observation), then
        // redeem ran: the surviving observation is the redeem call.
        assertEq(calls, 1, "the withdrawExact observation was rolled back with its revert");
        assertEq(seenSelector, MockEarnVault.redeem.selector);
        assertEq(uint8(seenStatus), uint8(Vault.Status.Settled));
        assertEq(seenLocked, 0);
        assertEq(reentryError, ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    /// fund is the one path where the venue is called after the job moved to Funded; the guard still holds.
    function test_fund_guardHoldsDuringDeposit() public {
        depositAs(payer, AMOUNT);
        createJob(JOB, worker, AMOUNT, earnPolicy());
        vm.prank(payer);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        assertEq(calls, 1);
        assertEq(seenSelector, MockEarnVault.deposit.selector);
        assertEq(uint8(seenStatus), uint8(Vault.Status.Funded), "status written before the deposit");
        assertEq(seenLocked, AMOUNT, "principal locked before the deposit");
        assertEq(reentryError, ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    }
}
