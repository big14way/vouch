// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VaultBase} from "./VaultBase.t.sol";
import {Vault} from "../src/Vault.sol";
import {MockEarnVault} from "./mocks/MockEarnVault.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// Earn while locked (F11): principal in an Earn vault while the job runs, exact recall at settlement,
/// yield to the payer, losses charged to the payer, idle-balance Earn for anyone.
contract VaultEarnTest is VaultBase {
    bytes32 internal constant JOB = keccak256("earn-job");
    MockEarnVault internal earn; // for `usd`
    MockEarnVault internal earn2; // for `usd2`
    address internal sink = makeAddr("sink");

    function setUp() public override {
        super.setUp();
        earn = new MockEarnVault(IERC20(address(usd)));
        earn2 = new MockEarnVault(IERC20(address(usd2)));
        vm.startPrank(owner);
        vault.setEarnVault(address(earn), true);
        vault.setEarnVault(address(earn2), true);
        vm.stopPrank();
    }

    function earnPolicy() internal view returns (Vault.Policy memory p) {
        p = manualPolicy();
        p.earnVault = address(earn);
    }

    function autoEarnPolicy() internal view returns (Vault.Policy memory p) {
        p = autopilotPolicy();
        p.earnVault = address(earn);
    }

    /// Simulate venue yield: assets appear in the Earn vault.
    function accrue(uint256 assets) internal {
        usd.mint(address(earn), assets);
    }

    function invariantHolds() internal view {
        assertGe(
            usd.balanceOf(address(vault)) + vault.deployed(address(usd)), vault.accounted(address(usd)), "solvency"
        );
    }

    // ------------------------------------------------------------------
    // admin + createJob validation
    // ------------------------------------------------------------------

    function test_setEarnVault_adminAndValidation() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setEarnVault(address(earn), false);

        vm.startPrank(owner);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.setEarnVault(address(0), true);
        // vault whose asset is not an allowed token
        MockUSDC other = new MockUSDC("Other", "OTH");
        MockEarnVault bad = new MockEarnVault(IERC20(address(other)));
        vm.expectRevert(Vault.EarnAssetMismatch.selector);
        vault.setEarnVault(address(bad), true);
        vault.setEarnVault(address(earn), false);
        assertFalse(vault.allowedEarnVault(address(earn)));
        vm.expectRevert(Vault.SlippageTooHigh.selector);
        vault.setEarnSlippage(1001);
        vault.setEarnSlippage(100);
        assertEq(vault.earnSlippageBps(), 100);
        vm.stopPrank();
    }

    function test_createJob_rejectsUnknownOrMismatchedEarnVault() public {
        Vault.Policy memory p = manualPolicy();
        p.earnVault = makeAddr("not-a-vault");
        bytes32 c = commitFor(JOB, worker, AMOUNT);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.EarnVaultNotAllowed.selector, p.earnVault));
        vault.createJob(JOB, c, payer, worker, address(usd), p);

        p.earnVault = address(earn2); // allowed, but its asset is usd2 and the job token is usd
        vm.prank(payer);
        vm.expectRevert(Vault.EarnAssetMismatch.selector);
        vault.createJob(JOB, c, payer, worker, address(usd), p);
    }

    // ------------------------------------------------------------------
    // fund → deposit into Earn
    // ------------------------------------------------------------------

    function test_fund_depositsPrincipalIntoEarn() public {
        depositAs(payer, AMOUNT);
        createJob(JOB, worker, AMOUNT, earnPolicy());
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.JobEarnDeposited(JOB, address(earn));
        vault.fund(JOB, AMOUNT, SCOPE, SALT);

        Vault.Job memory j = vault.getJob(JOB);
        assertEq(j.earnShares, AMOUNT, "1:1 shares at first deposit");
        assertEq(vault.deployed(address(usd)), AMOUNT);
        assertEq(vault.locked(address(usd)), AMOUNT);
        assertEq(usd.balanceOf(address(vault)), 0, "principal left the vault");
        assertEq(usd.balanceOf(address(earn)), AMOUNT);
        assertEq(earn.shares(address(vault)), AMOUNT);
        assertEq(vault.surplus(address(usd)), 0, "deployed principal is not surplus");
        invariantHolds();
    }

    function test_fund_skipsEarnWhenVaultPaused() public {
        earn.setDepositsPaused(true);
        depositAs(payer, AMOUNT);
        createJob(JOB, worker, AMOUNT, earnPolicy());
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.JobEarnSkipped(JOB, address(earn));
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.getJob(JOB).earnShares, 0);
        assertEq(vault.deployed(address(usd)), 0);
        assertEq(usd.allowance(address(vault), address(earn)), 0, "approval reset");
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Funded), "job is still funded, just not earning");
    }

    // ------------------------------------------------------------------
    // settle: exact recall, yield to payer
    // ------------------------------------------------------------------

    function test_settle_recallsExactPrincipal_yieldToPayer() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        accrue(AMOUNT / 10); // +10% while the work happens
        submitAs(worker, JOB);

        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.JobEarnRecalled(JOB, address(earn), true, 0);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);

        uint256 fee = feeOn(AMOUNT);
        assertEq(vault.balances(address(usd), worker), AMOUNT - fee, "worker gets exactly amount - fee");
        assertEq(vault.balances(address(usd), feeRecipient), fee);
        assertEq(vault.deployed(address(usd)), 0);
        assertEq(vault.getJob(JOB).earnShares, 0);
        uint256 payerShares = vault.userEarnShares(payer, address(earn));
        assertGt(payerShares, 0, "leftover shares are the payer's yield");
        assertApproxEqAbs(earn.previewRedeem(payerShares), AMOUNT / 10, 2, "yield ~ 10% of principal");
        assertEq(usd.balanceOf(address(vault)), AMOUNT, "principal is back in the vault");
        invariantHolds();

        // payer turns the yield into balance
        vm.prank(payer);
        vault.redeemFromEarn(address(earn), payerShares, 0);
        assertApproxEqAbs(vault.balances(address(usd), payer), AMOUNT / 10, 2);
        assertEq(vault.userEarnShares(payer, address(earn)), 0);
        invariantHolds();
    }

    function test_autoSettle_withEarn() public {
        createAndFund(JOB, worker, AMOUNT, autoEarnPolicy());
        accrue(1_000);
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Pass, 9500);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT));
        assertGt(vault.userEarnShares(payer, address(earn)), 0);
        assertEq(vault.deployed(address(usd)), 0);
        invariantHolds();
    }

    function test_resolve_withEarn_splitsPrincipalYieldToPayer() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        accrue(500_000);
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("r"));
        vm.prank(arbiter);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 5000);
        uint256 net = AMOUNT - feeOn(AMOUNT);
        assertEq(vault.balances(address(usd), worker), net / 2);
        assertEq(vault.balances(address(usd), payer), net - net / 2);
        assertGt(vault.userEarnShares(payer, address(earn)), 0);
        invariantHolds();
    }

    function test_refundExpired_withEarn() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        accrue(250_000);
        vm.warp(vm.getBlockTimestamp() + 7 days + 1);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), payer), AMOUNT, "full principal back");
        assertGt(vault.userEarnShares(payer, address(earn)), 0, "yield kept as shares");
        assertEq(vault.deployed(address(usd)), 0);
        invariantHolds();
    }

    // ------------------------------------------------------------------
    // fallback paths
    // ------------------------------------------------------------------

    function test_settle_fallbackRedeemAll_whenWithdrawExactUnavailable() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        accrue(100_000);
        earn.setFailWithdrawExact(true);
        submitAs(worker, JOB);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.JobEarnRecalled(JOB, address(earn), false, 0);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT), "worker whole");
        assertEq(vault.balances(address(usd), payer), 100_000, "yield paid to payer as balance");
        assertEq(vault.userEarnShares(payer, address(earn)), 0);
        invariantHolds();
    }

    function test_settle_lossCoveredByPayerBalance() public {
        depositAs(payer, 2 * AMOUNT); // extra balance to absorb a loss
        createJob(JOB, worker, AMOUNT, earnPolicy());
        vm.prank(payer);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        earn.slash(1_000_000, sink); // venue loses 20% of the principal
        submitAs(worker, JOB);

        uint256 accountedBefore = vault.accounted(address(usd));
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.JobEarnRecalled(JOB, address(earn), false, 1_000_000);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);

        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT), "worker made whole");
        assertEq(vault.balances(address(usd), payer), AMOUNT - 1_000_000, "payer absorbed the loss");
        assertEq(vault.accounted(address(usd)), accountedBefore - 1_000_000, "ledger shrank by the loss");
        invariantHolds();
    }

    function test_settle_lossNotCovered_workerGetsWhatExists() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy()); // payer has no spare balance
        earn.slash(2_000_000, sink); // 40% loss
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        uint256 got = AMOUNT - 2_000_000;
        assertEq(
            vault.balances(address(usd), worker) + vault.balances(address(usd), feeRecipient),
            got,
            "only what came back is distributed"
        );
        assertEq(vault.balances(address(usd), payer), 0);
        assertEq(vault.locked(address(usd)), 0);
        invariantHolds();
    }

    function test_refundExpired_loss() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        earn.slash(500_000, sink);
        vm.warp(vm.getBlockTimestamp() + 7 days + 1);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), payer), AMOUNT - 500_000, "payer takes the venue loss on a refund");
        invariantHolds();
    }

    // ------------------------------------------------------------------
    // idle-balance Earn
    // ------------------------------------------------------------------

    function test_depositToEarn_andRedeem() public {
        depositAs(payer, AMOUNT);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.EarnDeposited(payer, address(earn), address(usd), AMOUNT, AMOUNT);
        vault.depositToEarn(address(earn), AMOUNT);
        assertEq(vault.balances(address(usd), payer), 0);
        assertEq(vault.accounted(address(usd)), 0, "balance left the ledger while it earns");
        assertEq(vault.userEarnShares(payer, address(earn)), AMOUNT);
        invariantHolds();

        accrue(AMOUNT / 20); // +5%
        vm.prank(payer);
        vault.redeemFromEarn(address(earn), AMOUNT, AMOUNT);
        assertEq(vault.balances(address(usd), payer), AMOUNT + AMOUNT / 20);
        assertEq(vault.accounted(address(usd)), AMOUNT + AMOUNT / 20);
        assertEq(vault.userEarnShares(payer, address(earn)), 0);
        invariantHolds();
    }

    function test_earn_reverts() public {
        depositAs(payer, AMOUNT);
        vm.startPrank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.EarnVaultNotAllowed.selector, address(0xBEEF)));
        vault.depositToEarn(address(0xBEEF), 1);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.depositToEarn(address(earn), 0);
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.depositToEarn(address(earn), AMOUNT + 1);
        vault.depositToEarn(address(earn), AMOUNT);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.redeemFromEarn(address(earn), 0, 0);
        vm.expectRevert(Vault.InsufficientShares.selector);
        vault.redeemFromEarn(address(earn), AMOUNT + 1, 0);
        vm.expectRevert(MockEarnVault.MinimumAssetsNotMet.selector);
        vault.redeemFromEarn(address(earn), AMOUNT, AMOUNT + 1);
        vm.stopPrank();
    }

    function test_earn_pausedBlocksDepositNotRedeem() public {
        depositAs(payer, AMOUNT);
        vm.prank(payer);
        vault.depositToEarn(address(earn), AMOUNT);
        vm.prank(owner);
        vault.pause();
        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.depositToEarn(address(earn), 1);
        vm.prank(payer);
        vault.redeemFromEarn(address(earn), AMOUNT, 0);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
    }

    function test_earn_withSig() public {
        depositAs(payer, AMOUNT);
        uint256 deadline = vm.getBlockTimestamp() + 1 hours;
        bytes memory sig = sign(
            payerKey, keccak256(abi.encode(vault.EARN_DEPOSIT_TYPEHASH(), address(earn), AMOUNT, uint256(0), deadline))
        );
        vm.prank(stranger);
        vault.depositToEarnWithSig(address(earn), AMOUNT, payer, deadline, sig);
        assertEq(vault.userEarnShares(payer, address(earn)), AMOUNT);

        bytes memory sig2 = sign(
            payerKey,
            keccak256(abi.encode(vault.EARN_REDEEM_TYPEHASH(), address(earn), AMOUNT, uint256(1), uint256(1), deadline))
        );
        vm.prank(stranger);
        vault.redeemFromEarnWithSig(address(earn), AMOUNT, 1, payer, deadline, sig2);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.nonces(payer), 2);
    }

    // ------------------------------------------------------------------
    // surplus accounting with deployed principal
    // ------------------------------------------------------------------

    function test_surplus_ignoresDeployedPrincipal() public {
        createAndFund(JOB, worker, AMOUNT, earnPolicy());
        assertEq(vault.surplus(address(usd)), 0);
        vm.prank(worker);
        usd.transfer(address(vault), 123);
        assertEq(vault.surplus(address(usd)), 123, "direct transfer is surplus even while principal is deployed");
        vm.prank(intake);
        vault.attributeDeposit(address(usd), worker, 123, keccak256("ref"));
        assertEq(vault.surplus(address(usd)), 0);
        invariantHolds();
    }
}
