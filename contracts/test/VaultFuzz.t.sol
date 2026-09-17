// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VaultBase} from "./VaultBase.t.sol";
import {Vault} from "../src/Vault.sol";

contract VaultFuzzTest is VaultBase {
    bytes32 internal constant JOB = keccak256("fuzz-job");

    function _boundPolicy(uint8 autoRelease, uint16 minConf, uint96 cap, uint32 review, uint32 deadline)
        internal
        pure
        returns (Vault.Policy memory)
    {
        return Vault.Policy({
            autoRelease: uint8(bound(autoRelease, 0, 2)),
            minConfidenceBps: uint16(bound(minConf, 0, 10_000)),
            maxAutoAmount: cap,
            reviewWindow: review,
            submitDeadline: deadline,
            earnVault: address(0)
        });
    }

    /// Fee is charged exactly once and the split is exact for any amount, fee and split.
    function testFuzz_settle_conservesValue(uint256 amount, uint16 feeBps, uint16 workerBps, bool viaDispute) public {
        amount = bound(amount, 1, 1_000_000_000);
        feeBps = uint16(bound(feeBps, 0, 200));
        workerBps = uint16(bound(workerBps, 0, 10_000));
        vm.prank(owner);
        vault.setFee(feeBps, feeRecipient);

        createAndFund(JOB, worker, amount, manualPolicy());
        submitAs(worker, JOB);
        if (viaDispute) {
            vm.prank(payer);
            vault.dispute(JOB, keccak256("r"));
            vm.prank(arbiter);
            vault.resolve(JOB, amount, SCOPE, SALT, workerBps);
        } else {
            vm.prank(payer);
            vault.settle(JOB, amount, SCOPE, SALT);
            workerBps = 10_000;
        }
        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;
        uint256 toWorker = (net * workerBps) / 10_000;
        assertEq(vault.balances(address(usd), worker), toWorker);
        assertEq(vault.balances(address(usd), payer), net - toWorker);
        assertEq(vault.balances(address(usd), feeRecipient), fee);
        assertEq(vault.locked(address(usd)), 0);
        assertEq(vault.accounted(address(usd)), amount);
        assertGe(usd.balanceOf(address(vault)), vault.accounted(address(usd)));
    }

    /// autoSettle succeeds iff every predicate holds; `canAutoSettle` agrees with it.
    function testFuzz_autoSettle_predicates(
        uint256 amount,
        Vault.Policy memory p,
        uint8 verdictRaw,
        uint16 conf,
        uint32 elapsed
    ) public {
        amount = bound(amount, 1, 1_000_000_000);
        p = _boundPolicy(p.autoRelease, p.minConfidenceBps, p.maxAutoAmount, p.reviewWindow, 30 days);
        Vault.Verdict verdict = Vault.Verdict(uint8(bound(verdictRaw, 1, 3)));
        conf = uint16(bound(conf, 0, 10_000));

        createAndFund(JOB, worker, amount, p);
        submitAs(worker, JOB);
        attestAs(JOB, verdict, conf);
        vm.warp(vm.getBlockTimestamp() + elapsed);

        bool expected = _expectedAuto(amount, p, verdict, conf, elapsed);
        (bool ok,) = vault.canAutoSettle(JOB, amount);
        assertEq(ok, expected, "canAutoSettle mismatch");

        if (expected) {
            vault.autoSettle(JOB, amount, SCOPE, SALT);
            assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
            assertEq(vault.balances(address(usd), worker), amount - feeOn(amount));
        } else {
            vm.expectRevert();
            vault.autoSettle(JOB, amount, SCOPE, SALT);
            assertEq(uint8(status(JOB)), uint8(Vault.Status.Attested));
            assertEq(vault.balances(address(usd), worker), 0);
        }
    }

    function _expectedAuto(uint256 amount, Vault.Policy memory p, Vault.Verdict verdict, uint16 conf, uint32 elapsed)
        internal
        pure
        returns (bool)
    {
        bool verdictOk = verdict == Vault.Verdict.Pass || (p.autoRelease == 2 && verdict == Vault.Verdict.NeedsReview);
        return p.autoRelease != 0 && elapsed >= p.reviewWindow && verdictOk && conf >= p.minConfidenceBps
            && amount <= p.maxAutoAmount;
    }

    /// A reveal that differs from the commitment in any field is rejected.
    function testFuzz_commitBinding(uint256 amount, uint256 wrongAmount, bytes32 wrongScope, bytes32 wrongSalt) public {
        amount = bound(amount, 1, 1_000_000_000);
        vm.assume(wrongAmount != amount);
        vm.assume(wrongScope != SCOPE);
        vm.assume(wrongSalt != SALT);
        depositAs(payer, amount);
        createJob(JOB, worker, amount, manualPolicy());
        vm.startPrank(payer);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.fund(JOB, wrongAmount, SCOPE, SALT);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.fund(JOB, amount, wrongScope, SALT);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.fund(JOB, amount, SCOPE, wrongSalt);
        vault.fund(JOB, amount, SCOPE, SALT);
        vm.stopPrank();
        assertEq(vault.locked(address(usd)), amount);
    }

    /// Attribution never pushes accounted above the real balance, whatever the mix of deposits and surplus.
    function testFuzz_attribute_boundedBySurplus(uint256 dep, uint256 direct, uint256 ask) public {
        dep = bound(dep, 0, 500_000_000);
        direct = bound(direct, 0, 500_000_000);
        ask = bound(ask, 1, 1_000_000_000);
        if (dep > 0) depositAs(payer, dep);
        if (direct > 0) {
            vm.prank(worker);
            usd.transfer(address(vault), direct);
        }
        assertEq(vault.surplus(address(usd)), direct);
        vm.prank(intake);
        if (ask > direct) {
            vm.expectRevert(abi.encodeWithSelector(Vault.InsufficientSurplus.selector, direct));
            vault.attributeDeposit(address(usd), stranger, ask, keccak256("ref"));
        } else {
            vault.attributeDeposit(address(usd), stranger, ask, keccak256("ref"));
            assertEq(vault.balances(address(usd), stranger), ask);
        }
        assertGe(usd.balanceOf(address(vault)), vault.accounted(address(usd)));
    }

    /// Submit deadline is enforced exactly at the boundary.
    function testFuzz_submitDeadline(uint32 deadline, uint32 elapsed) public {
        deadline = uint32(bound(deadline, 1, 365 days));
        Vault.Policy memory p = manualPolicy();
        p.submitDeadline = deadline;
        createAndFund(JOB, worker, AMOUNT, p);
        uint256 fundedAt = vm.getBlockTimestamp();
        vm.warp(fundedAt + elapsed);
        vm.prank(worker);
        if (elapsed > deadline) {
            vm.expectRevert(Vault.DeadlinePassed.selector);
            vault.submit(JOB, DELIVERABLE);
            vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
            assertEq(vault.balances(address(usd), payer), AMOUNT);
        } else {
            vault.submit(JOB, DELIVERABLE);
            vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Submitted));
            vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        }
    }

    /// Withdrawals can never exceed a user's credited balance.
    function testFuzz_withdraw_bounded(uint256 dep, uint256 w) public {
        dep = bound(dep, 1, 1_000_000_000);
        w = bound(w, 1, 2_000_000_000);
        depositAs(payer, dep);
        vm.prank(payer);
        if (w > dep) {
            vm.expectRevert(Vault.InsufficientBalance.selector);
            vault.withdraw(address(usd), w, payer);
        } else {
            vault.withdraw(address(usd), w, payer);
            assertEq(vault.balances(address(usd), payer), dep - w);
        }
        assertGe(usd.balanceOf(address(vault)), vault.accounted(address(usd)));
    }
}
