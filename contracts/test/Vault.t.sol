// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VaultBase} from "./VaultBase.t.sol";
import {Vault} from "../src/Vault.sol";
import {VerifierRegistry} from "../src/VerifierRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockSinkToken} from "./mocks/MockSinkToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract VaultTest is VaultBase {
    bytes32 internal constant JOB = keccak256("job-1");

    // ------------------------------------------------------------------
    // constructor / admin
    // ------------------------------------------------------------------

    function test_constructor_setsRoles() public view {
        assertEq(vault.owner(), owner);
        assertEq(address(vault.registry()), address(registry));
        assertEq(vault.arbiter(), arbiter);
        assertEq(vault.intake(), intake);
        assertTrue(vault.allowedToken(address(usd)));
        assertTrue(vault.allowedToken(address(usd2)));
        assertEq(vault.feeBps(), 100);
        assertEq(vault.feeRecipient(), feeRecipient);
    }

    function test_constructor_revertsZeroRegistry() public {
        address[] memory t = new address[](0);
        vm.expectRevert(Vault.ZeroAddress.selector);
        new Vault(owner, address(0), arbiter, intake, t);
    }

    function test_constructor_revertsZeroToken() public {
        address[] memory t = new address[](1);
        vm.expectRevert(Vault.ZeroAddress.selector);
        new Vault(owner, address(registry), arbiter, intake, t);
    }

    function test_admin_onlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setRegistry(address(1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setArbiter(address(1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setIntake(address(1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setFee(1, address(1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setToken(address(1), true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.pause();
        vm.stopPrank();
    }

    function test_admin_setters() public {
        vm.startPrank(owner);
        VerifierRegistry r2 = new VerifierRegistry(owner);
        vault.setRegistry(address(r2));
        assertEq(address(vault.registry()), address(r2));
        vault.setArbiter(address(0xA));
        assertEq(vault.arbiter(), address(0xA));
        vault.setIntake(address(0xB));
        assertEq(vault.intake(), address(0xB));
        vault.setFee(200, address(0xC));
        assertEq(vault.feeBps(), 200);
        vault.setFee(0, address(0));
        assertEq(vault.feeBps(), 0);
        vault.setToken(address(0xD), true);
        assertTrue(vault.allowedToken(address(0xD)));
        vault.setToken(address(0xD), false);
        assertFalse(vault.allowedToken(address(0xD)));
        vm.stopPrank();
    }

    function test_admin_setterReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.setRegistry(address(0));
        vm.expectRevert(Vault.FeeTooHigh.selector);
        vault.setFee(201, feeRecipient);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.setFee(50, address(0));
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.setToken(address(0), true);
        vm.stopPrank();
    }

    function test_pause_blocksStateChangesButNotExits() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(owner);
        vault.pause();

        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(address(usd), 1);
        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        vm.prank(verifier);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.attest(JOB, Vault.Verdict.Pass, 9000, REPORT);

        // dispute + resolve + withdraw still work
        vm.prank(worker);
        vault.dispute(JOB, keccak256("reason"));
        vm.prank(arbiter);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 5000);
        uint256 net = AMOUNT - feeOn(AMOUNT);
        vm.prank(worker);
        vault.withdraw(address(usd), net / 2, worker);

        vm.prank(owner);
        vault.unpause();
        depositAs(payer, 1);
    }

    // ------------------------------------------------------------------
    // deposit / withdraw
    // ------------------------------------------------------------------

    function test_deposit_creditsBalance() public {
        vm.expectEmit(true, true, false, true);
        emit Vault.Deposited(address(usd), payer, AMOUNT);
        depositAs(payer, AMOUNT);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.accounted(address(usd)), AMOUNT);
        assertEq(usd.balanceOf(address(vault)), AMOUNT);
    }

    function test_deposit_reverts() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.TokenNotAllowed.selector, address(0xBEEF)));
        vault.deposit(address(0xBEEF), 1);
        vm.prank(payer);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.deposit(address(usd), 0);
    }

    function test_deposit_revertsWhenNothingReceived() public {
        MockSinkToken sink = new MockSinkToken();
        vm.prank(owner);
        vault.setToken(address(sink), true);
        vm.prank(payer);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.deposit(address(sink), AMOUNT);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.depositWithAuthorization(address(sink), payer, AMOUNT, 0, block.timestamp + 1, bytes32(0), 0, 0, 0);
        assertEq(vault.accounted(address(sink)), 0);
    }

    function test_withdraw_transfersOut() public {
        depositAs(payer, AMOUNT);
        address to = makeAddr("to");
        vm.prank(payer);
        vm.expectEmit(true, true, true, true);
        emit Vault.Withdrawn(address(usd), payer, to, AMOUNT);
        vault.withdraw(address(usd), AMOUNT, to);
        assertEq(usd.balanceOf(to), AMOUNT);
        assertEq(vault.balances(address(usd), payer), 0);
        assertEq(vault.accounted(address(usd)), 0);
    }

    function test_withdraw_reverts() public {
        depositAs(payer, AMOUNT);
        vm.startPrank(payer);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.withdraw(address(usd), 1, address(0));
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.withdraw(address(usd), 0, payer);
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.withdraw(address(usd), AMOUNT + 1, payer);
        vm.stopPrank();
    }

    function test_withdrawWithSig() public {
        depositAs(payer, AMOUNT);
        address to = makeAddr("to");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = sign(
            payerKey, keccak256(abi.encode(vault.WITHDRAW_TYPEHASH(), address(usd), AMOUNT, to, uint256(0), deadline))
        );
        vm.prank(stranger); // relayer
        vault.withdrawWithSig(address(usd), AMOUNT, to, payer, deadline, sig);
        assertEq(usd.balanceOf(to), AMOUNT);
        assertEq(vault.nonces(payer), 1);

        // replay fails (nonce consumed)
        vm.prank(stranger);
        vm.expectRevert(Vault.BadSignature.selector);
        vault.withdrawWithSig(address(usd), AMOUNT, to, payer, deadline, sig);
    }

    function test_sig_expiredAndWrongSigner() public {
        depositAs(payer, AMOUNT);
        uint256 deadline = block.timestamp + 1;
        bytes32 sh = keccak256(abi.encode(vault.WITHDRAW_TYPEHASH(), address(usd), AMOUNT, payer, uint256(0), deadline));
        bytes memory good = sign(payerKey, sh);
        bytes memory bad = sign(workerKey, sh);

        vm.expectRevert(Vault.BadSignature.selector);
        vault.withdrawWithSig(address(usd), AMOUNT, payer, payer, deadline, bad);

        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.withdrawWithSig(address(usd), AMOUNT, payer, address(0), deadline, good);

        vm.warp(deadline + 1);
        vm.expectRevert(Vault.SignatureExpired.selector);
        vault.withdrawWithSig(address(usd), AMOUNT, payer, payer, deadline, good);
    }

    // ------------------------------------------------------------------
    // depositWithAuthorization (EIP-3009)
    // ------------------------------------------------------------------

    function _authSig(uint256 key, address from, uint256 value, uint256 va, uint256 vb, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 sh = keccak256(
            abi.encode(usd.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), from, address(vault), value, va, vb, nonce)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usd.domainSeparator(), sh));
        return vm.sign(key, digest);
    }

    function test_depositWithAuthorization_creditsFrom() public {
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s) = _authSig(payerKey, payer, AMOUNT, 0, block.timestamp + 1 days, nonce);
        vm.prank(stranger); // any relayer
        vm.expectEmit(true, true, false, true);
        emit Vault.Deposited(address(usd), payer, AMOUNT);
        vault.depositWithAuthorization(address(usd), payer, AMOUNT, 0, block.timestamp + 1 days, nonce, v, r, s);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.accounted(address(usd)), AMOUNT);
    }

    function test_depositWithAuthorization_reverts() public {
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s) = _authSig(payerKey, payer, AMOUNT, 0, block.timestamp + 1 days, nonce);
        vm.expectRevert(abi.encodeWithSelector(Vault.TokenNotAllowed.selector, address(0xBEEF)));
        vault.depositWithAuthorization(address(0xBEEF), payer, AMOUNT, 0, block.timestamp + 1 days, nonce, v, r, s);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.depositWithAuthorization(address(usd), payer, 0, 0, block.timestamp + 1 days, nonce, v, r, s);
        // wrong signer for `from`
        vm.expectRevert(MockUSDC.InvalidSignature.selector);
        vault.depositWithAuthorization(address(usd), worker, AMOUNT, 0, block.timestamp + 1 days, nonce, v, r, s);
        // replay
        vault.depositWithAuthorization(address(usd), payer, AMOUNT, 0, block.timestamp + 1 days, nonce, v, r, s);
        vm.expectRevert(MockUSDC.AuthUsed.selector);
        vault.depositWithAuthorization(address(usd), payer, AMOUNT, 0, block.timestamp + 1 days, nonce, v, r, s);
    }

    // ------------------------------------------------------------------
    // attributeDeposit
    // ------------------------------------------------------------------

    function test_attributeDeposit_fromSurplus() public {
        // simulate an MPP charge / memo transfer landing directly in the vault
        vm.prank(payer);
        usd.transfer(address(vault), AMOUNT);
        assertEq(vault.surplus(address(usd)), AMOUNT);

        bytes32 ref = keccak256("tx:0xabc");
        vm.prank(intake);
        vm.expectEmit(true, true, true, true);
        emit Vault.Attributed(address(usd), payer, AMOUNT, ref);
        vault.attributeDeposit(address(usd), payer, AMOUNT, ref);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.surplus(address(usd)), 0);
        assertTrue(vault.attributedRef(ref));
    }

    function test_attributeDeposit_reverts() public {
        vm.prank(payer);
        usd.transfer(address(vault), AMOUNT);
        bytes32 ref = keccak256("ref");

        vm.prank(stranger);
        vm.expectRevert(Vault.NotIntake.selector);
        vault.attributeDeposit(address(usd), payer, AMOUNT, ref);

        vm.startPrank(intake);
        vm.expectRevert(abi.encodeWithSelector(Vault.TokenNotAllowed.selector, address(0xBEEF)));
        vault.attributeDeposit(address(0xBEEF), payer, AMOUNT, ref);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.attributeDeposit(address(usd), address(0), AMOUNT, ref);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.attributeDeposit(address(usd), payer, 0, ref);
        vm.expectRevert(abi.encodeWithSelector(Vault.InsufficientSurplus.selector, AMOUNT));
        vault.attributeDeposit(address(usd), payer, AMOUNT + 1, ref);
        vault.attributeDeposit(address(usd), payer, AMOUNT, ref);
        vm.expectRevert(abi.encodeWithSelector(Vault.RefAlreadyAttributed.selector, ref));
        vault.attributeDeposit(address(usd), payer, 1, ref);
        vm.stopPrank();
    }

    function test_attributeDeposit_cannotExceedRealBalance() public {
        depositAs(payer, AMOUNT); // accounted == balance, surplus 0
        vm.prank(intake);
        vm.expectRevert(abi.encodeWithSelector(Vault.InsufficientSurplus.selector, 0));
        vault.attributeDeposit(address(usd), stranger, 1, keccak256("r"));
    }

    // ------------------------------------------------------------------
    // createJob / fund
    // ------------------------------------------------------------------

    function test_createJob_emitsAndStores() public {
        Vault.Policy memory p = trustedPolicy();
        bytes32 c = commitFor(JOB, worker, AMOUNT);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true);
        emit Vault.JobCreated(JOB, payer, worker, address(usd), c, p);
        vault.createJob(JOB, c, payer, worker, address(usd), p);
        Vault.Job memory j = vault.getJob(JOB);
        assertEq(uint8(j.status), uint8(Vault.Status.Open));
        assertEq(j.payer, payer);
        assertEq(j.worker, worker);
        assertEq(j.token, address(usd));
        assertEq(j.commit, c);
        assertFalse(j.openWorker);
        assertEq(j.policy.minConfidenceBps, 8500);
    }

    function test_createJob_byIntakeForPayer() public {
        bytes32 c = commitFor(JOB, worker, AMOUNT);
        vm.prank(intake);
        vault.createJob(JOB, c, payer, worker, address(usd), manualPolicy());
        assertEq(vault.getJob(JOB).payer, payer);
    }

    function test_createJob_reverts() public {
        bytes32 c = commitFor(JOB, worker, AMOUNT);
        Vault.Policy memory p = manualPolicy();

        vm.prank(stranger);
        vm.expectRevert(Vault.NotPayerOrIntake.selector);
        vault.createJob(JOB, c, payer, worker, address(usd), p);

        vm.startPrank(intake);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.createJob(JOB, c, address(0), worker, address(usd), p);
        vm.stopPrank();

        vm.startPrank(payer);
        vm.expectRevert(Vault.WorkerIsPayer.selector);
        vault.createJob(JOB, c, payer, payer, address(usd), p);
        vm.expectRevert(Vault.ZeroHash.selector);
        vault.createJob(JOB, bytes32(0), payer, worker, address(usd), p);
        vm.expectRevert(abi.encodeWithSelector(Vault.TokenNotAllowed.selector, address(0xBEEF)));
        vault.createJob(JOB, c, payer, worker, address(0xBEEF), p);

        Vault.Policy memory bad = manualPolicy();
        bad.autoRelease = 3;
        vm.expectRevert(Vault.BadPolicy.selector);
        vault.createJob(JOB, c, payer, worker, address(usd), bad);
        bad = manualPolicy();
        bad.minConfidenceBps = 10_001;
        vm.expectRevert(Vault.BadPolicy.selector);
        vault.createJob(JOB, c, payer, worker, address(usd), bad);

        vault.createJob(JOB, c, payer, worker, address(usd), p);
        vm.expectRevert(abi.encodeWithSelector(Vault.JobExists.selector, JOB));
        vault.createJob(JOB, c, payer, worker, address(usd), p);
        vm.stopPrank();
    }

    function test_fund_locksBalance() public {
        depositAs(payer, AMOUNT);
        createJob(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(payer);
        vm.expectEmit(true, false, false, true);
        emit Vault.Funded(JOB);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), payer), 0);
        assertEq(vault.locked(address(usd)), AMOUNT);
        assertEq(vault.accounted(address(usd)), AMOUNT);
        Vault.Job memory j = vault.getJob(JOB);
        assertEq(uint8(j.status), uint8(Vault.Status.Funded));
        assertEq(j.fundedAt, uint40(block.timestamp));
    }

    function test_fund_byIntake() public {
        depositAs(payer, AMOUNT);
        createJob(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(intake);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Funded));
    }

    function test_fund_reverts() public {
        depositAs(payer, AMOUNT - 1);
        createJob(JOB, worker, AMOUNT, manualPolicy());

        vm.prank(stranger);
        vm.expectRevert(Vault.NotPayerOrIntake.selector);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);

        vm.startPrank(payer);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.fund(JOB, AMOUNT + 1, SCOPE, SALT);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.fund(JOB, AMOUNT, SCOPE, keccak256("other salt"));
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        vm.stopPrank();

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.None));
        vault.fund(keccak256("nope"), AMOUNT, SCOPE, SALT);

        depositAs(payer, 1);
        vm.prank(payer);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Funded));
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
    }

    // ------------------------------------------------------------------
    // submit
    // ------------------------------------------------------------------

    function test_submit_byWorker() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(worker);
        vm.expectEmit(true, true, false, true);
        emit Vault.Submitted(JOB, worker, DELIVERABLE);
        vault.submit(JOB, DELIVERABLE);
        Vault.Job memory j = vault.getJob(JOB);
        assertEq(uint8(j.status), uint8(Vault.Status.Submitted));
        assertEq(j.deliverableHash, DELIVERABLE);
        assertEq(j.submittedAt, uint40(block.timestamp));
    }

    function test_submit_openWorker_firstSubmitterAssigned() public {
        createAndFund(JOB, address(0), AMOUNT, manualPolicy());
        assertTrue(vault.getJob(JOB).openWorker);
        vm.prank(payer);
        vm.expectRevert(Vault.WorkerIsPayer.selector);
        vault.submit(JOB, DELIVERABLE);
        submitAs(stranger, JOB);
        assertEq(vault.getJob(JOB).worker, stranger);
        // commit still verifies with address(0) as worker
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), stranger), AMOUNT - feeOn(AMOUNT));
    }

    function test_submit_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(stranger);
        vm.expectRevert(Vault.NotWorker.selector);
        vault.submit(JOB, DELIVERABLE);
        vm.prank(worker);
        vm.expectRevert(Vault.ZeroHash.selector);
        vault.submit(JOB, bytes32(0));
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(worker);
        vm.expectRevert(Vault.DeadlinePassed.selector);
        vault.submit(JOB, DELIVERABLE);

        bytes32 j2 = keccak256("job-2");
        createJob(j2, worker, AMOUNT, manualPolicy());
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Open));
        vault.submit(j2, DELIVERABLE);
    }

    function test_submit_noDeadlineWhenZero() public {
        Vault.Policy memory p = manualPolicy();
        p.submitDeadline = 0;
        createAndFund(JOB, worker, AMOUNT, p);
        vm.warp(block.timestamp + 365 days);
        submitAs(worker, JOB);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Submitted));
    }

    function test_submitWithSig() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig =
            sign(workerKey, keccak256(abi.encode(vault.SUBMIT_TYPEHASH(), JOB, DELIVERABLE, uint256(0), deadline)));
        vm.prank(stranger);
        vault.submitWithSig(JOB, DELIVERABLE, worker, deadline, sig);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Submitted));
        assertEq(vault.nonces(worker), 1);
    }

    // ------------------------------------------------------------------
    // attest
    // ------------------------------------------------------------------

    function test_attest_writesVerdictNoFundsMove() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        uint256 lockedBefore = vault.locked(address(usd));
        vm.prank(verifier);
        vm.expectEmit(true, true, false, true);
        emit Vault.Attested(JOB, verifier, Vault.Verdict.Pass, 9300, REPORT);
        vault.attest(JOB, Vault.Verdict.Pass, 9300, REPORT);
        Vault.Job memory j = vault.getJob(JOB);
        assertEq(uint8(j.status), uint8(Vault.Status.Attested));
        assertEq(uint8(j.verdict), uint8(Vault.Verdict.Pass));
        assertEq(j.confidenceBps, 9300);
        assertEq(j.attestationHash, REPORT);
        assertEq(vault.locked(address(usd)), lockedBefore);
        assertEq(vault.balances(address(usd), worker), 0);
        assertEq(vault.balances(address(usd), verifier), 0);
    }

    function test_attest_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(stranger);
        vm.expectRevert(Vault.NotVerifier.selector);
        vault.attest(JOB, Vault.Verdict.Pass, 9000, REPORT);
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Funded));
        vault.attest(JOB, Vault.Verdict.Pass, 9000, REPORT);
        submitAs(worker, JOB);
        vm.startPrank(verifier);
        vm.expectRevert(Vault.BadVerdict.selector);
        vault.attest(JOB, Vault.Verdict.None, 9000, REPORT);
        vm.expectRevert(Vault.BadConfidence.selector);
        vault.attest(JOB, Vault.Verdict.Pass, 10_001, REPORT);
        vm.expectRevert(Vault.ZeroHash.selector);
        vault.attest(JOB, Vault.Verdict.Pass, 9000, bytes32(0));
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // settle
    // ------------------------------------------------------------------

    function test_settle_fromSubmitted_paysWorkerMinusFee() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(payer);
        vm.expectEmit(true, false, false, true);
        emit Vault.Settled(JOB);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        uint256 fee = feeOn(AMOUNT);
        assertEq(vault.balances(address(usd), worker), AMOUNT - fee);
        assertEq(vault.balances(address(usd), feeRecipient), fee);
        assertEq(vault.locked(address(usd)), 0);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    function test_settle_fromAttested() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.NeedsReview, 6000);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    function test_settle_zeroFeeWhenNoRecipient() public {
        vm.prank(owner);
        vault.setFee(0, address(0));
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), worker), AMOUNT);
    }

    function test_settle_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Funded));
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        submitAs(worker, JOB);
        vm.prank(worker);
        vm.expectRevert(Vault.NotPayer.selector);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        vm.prank(intake);
        vm.expectRevert(Vault.NotPayer.selector);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        vm.prank(payer);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.settle(JOB, AMOUNT - 1, SCOPE, SALT);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Settled));
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_settleWithSig_relayed() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = sign(payerKey, keccak256(abi.encode(vault.SETTLE_TYPEHASH(), JOB, uint256(0), deadline)));
        vm.prank(stranger);
        vault.settleWithSig(JOB, AMOUNT, SCOPE, SALT, payer, deadline, sig);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));

        // signature from the worker is not a payer approval
        bytes32 j2 = keccak256("job-2");
        createAndFund(j2, worker, AMOUNT, manualPolicy());
        submitAs(worker, j2);
        bytes memory wsig = sign(workerKey, keccak256(abi.encode(vault.SETTLE_TYPEHASH(), j2, uint256(0), deadline)));
        vm.expectRevert(Vault.NotPayer.selector);
        vault.settleWithSig(j2, AMOUNT, SCOPE, SALT, worker, deadline, wsig);
    }

    // ------------------------------------------------------------------
    // autoSettle
    // ------------------------------------------------------------------

    function _attestedAutopilot(Vault.Verdict v, uint16 conf) internal {
        createAndFund(JOB, worker, AMOUNT, autopilotPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, v, conf);
    }

    function test_autoSettle_happyPath() public {
        _attestedAutopilot(Vault.Verdict.Pass, 9300);
        vm.warp(block.timestamp + 1 days);
        (bool ok,) = vault.canAutoSettle(JOB, AMOUNT);
        assertTrue(ok);
        vm.prank(stranger);
        vm.expectEmit(true, true, false, true);
        emit Vault.AutoSettled(JOB, stranger);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT));
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    function test_autoSettle_revertsBeforeReviewWindow() public {
        _attestedAutopilot(Vault.Verdict.Pass, 9300);
        vm.warp(block.timestamp + 1 days - 1);
        (bool ok, bytes4 reason) = vault.canAutoSettle(JOB, AMOUNT);
        assertFalse(ok);
        assertEq(reason, Vault.ReviewWindowOpen.selector);
        vm.expectRevert(Vault.ReviewWindowOpen.selector);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_autoSettle_revertsWhenPolicyOff() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Pass, 10_000);
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(Vault.AutoReleaseOff.selector);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_autoSettle_revertsNeedsReviewUnderPolicy1() public {
        _attestedAutopilot(Vault.Verdict.NeedsReview, 9900);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Vault.VerdictNotEligible.selector);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_autoSettle_needsReviewAllowedUnderPolicy2() public {
        Vault.Policy memory p = autopilotPolicy();
        p.autoRelease = 2;
        createAndFund(JOB, worker, AMOUNT, p);
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.NeedsReview, 9500);
        vm.warp(block.timestamp + 1 days);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Settled));
    }

    function test_autoSettle_revertsOnFail() public {
        _attestedAutopilot(Vault.Verdict.Fail, 9900);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Vault.VerdictNotEligible.selector);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_autoSettle_revertsLowConfidence() public {
        _attestedAutopilot(Vault.Verdict.Pass, 8999);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Vault.ConfidenceTooLow.selector);
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_autoSettle_revertsAboveCap() public {
        uint256 big = 60_000_000; // > $50 cap
        createAndFund(JOB, worker, big, autopilotPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Pass, 9900);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Vault.AmountAboveCap.selector);
        vault.autoSettle(JOB, big, SCOPE, SALT);
    }

    function test_autoSettle_revertsWrongStatusAndCommit() public {
        _attestedAutopilot(Vault.Verdict.Pass, 9300);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.autoSettle(JOB, AMOUNT + 1, SCOPE, SALT);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("no"));
        (bool ok, bytes4 reason) = vault.canAutoSettle(JOB, AMOUNT);
        assertFalse(ok);
        assertEq(reason, Vault.WrongStatus.selector);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Disputed));
        vault.autoSettle(JOB, AMOUNT, SCOPE, SALT);
    }

    function test_canAutoSettle_reportsPaused() public {
        _attestedAutopilot(Vault.Verdict.Pass, 9300);
        vm.warp(block.timestamp + 2 days);
        vm.prank(owner);
        vault.pause();
        (bool ok, bytes4 reason) = vault.canAutoSettle(JOB, AMOUNT);
        assertFalse(ok);
        assertEq(reason, Pausable.EnforcedPause.selector);
    }

    // ------------------------------------------------------------------
    // dispute / resolve
    // ------------------------------------------------------------------

    function test_dispute_byEitherParty() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true);
        emit Vault.Disputed(JOB, payer, keccak256("r"));
        vault.dispute(JOB, keccak256("r"));
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Disputed));

        bytes32 j2 = keccak256("job-2");
        createAndFund(j2, worker, AMOUNT, manualPolicy());
        submitAs(worker, j2);
        attestAs(j2, Vault.Verdict.Fail, 9000);
        vm.prank(worker);
        vault.dispute(j2, keccak256("r"));
        assertEq(uint8(status(j2)), uint8(Vault.Status.Disputed));
    }

    function test_dispute_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.prank(stranger);
        vm.expectRevert(Vault.NotParty.selector);
        vault.dispute(JOB, keccak256("r"));
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Funded));
        vault.dispute(JOB, keccak256("r"));
    }

    function test_disputeWithSig() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 reason = keccak256("r");
        bytes memory sig =
            sign(workerKey, keccak256(abi.encode(vault.DISPUTE_TYPEHASH(), JOB, reason, uint256(0), deadline)));
        vault.disputeWithSig(JOB, reason, worker, deadline, sig);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Disputed));
    }

    function test_resolve_splits() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("r"));
        vm.prank(arbiter);
        vm.expectEmit(true, false, false, true);
        emit Vault.Resolved(JOB, 7000);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 7000);
        uint256 fee = feeOn(AMOUNT);
        uint256 net = AMOUNT - fee;
        uint256 toWorker = (net * 7000) / 10_000;
        assertEq(vault.balances(address(usd), worker), toWorker);
        assertEq(vault.balances(address(usd), payer), net - toWorker);
        assertEq(vault.balances(address(usd), feeRecipient), fee);
        assertEq(vault.locked(address(usd)), 0);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Resolved));
    }

    function test_resolve_fullRefundAndFullPay() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("r"));
        vm.prank(arbiter);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 0);
        assertEq(vault.balances(address(usd), payer), AMOUNT - feeOn(AMOUNT));
        assertEq(vault.balances(address(usd), worker), 0);

        bytes32 j2 = keccak256("job-2");
        createAndFund(j2, worker, AMOUNT, manualPolicy());
        submitAs(worker, j2);
        vm.prank(worker);
        vault.dispute(j2, keccak256("r"));
        vm.prank(arbiter);
        vault.resolve(j2, AMOUNT, SCOPE, SALT, 10_000);
        assertEq(vault.balances(address(usd), worker), AMOUNT - feeOn(AMOUNT));
    }

    function test_resolve_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Submitted));
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 5000);
        vm.prank(payer);
        vault.dispute(JOB, keccak256("r"));
        vm.prank(stranger);
        vm.expectRevert(Vault.NotArbiter.selector);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 5000);
        vm.prank(arbiter);
        vm.expectRevert(Vault.BadSplit.selector);
        vault.resolve(JOB, AMOUNT, SCOPE, SALT, 10_001);
        vm.prank(arbiter);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.resolve(JOB, AMOUNT + 1, SCOPE, SALT, 5000);
    }

    // ------------------------------------------------------------------
    // refundExpired
    // ------------------------------------------------------------------

    function test_refundExpired() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        vm.expectRevert(Vault.DeadlineNotPassed.selector);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(stranger);
        vm.expectEmit(true, false, false, true);
        emit Vault.Refunded(JOB);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.locked(address(usd)), 0);
        assertEq(uint8(status(JOB)), uint8(Vault.Status.Refunded));
    }

    function test_refundExpired_reverts() public {
        Vault.Policy memory p = manualPolicy();
        p.submitDeadline = 0;
        createAndFund(JOB, worker, AMOUNT, p);
        vm.warp(block.timestamp + 365 days);
        vm.expectRevert(Vault.NoDeadline.selector);
        vault.refundExpired(JOB, AMOUNT, SCOPE, SALT);

        bytes32 j2 = keccak256("job-2");
        createAndFund(j2, worker, AMOUNT, manualPolicy());
        submitAs(worker, j2);
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Submitted));
        vault.refundExpired(j2, AMOUNT, SCOPE, SALT);

        bytes32 j3 = keccak256("job-3");
        createAndFund(j3, worker, AMOUNT, manualPolicy());
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(Vault.BadCommit.selector);
        vault.refundExpired(j3, AMOUNT + 1, SCOPE, SALT);
    }

    // ------------------------------------------------------------------
    // resubmit
    // ------------------------------------------------------------------

    function test_resubmit_afterFail_maxTwice() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Fail, 9000);
        bytes32 h2 = keccak256("v2");
        vm.prank(worker);
        vm.expectEmit(true, false, false, true);
        emit Vault.Resubmitted(JOB, h2, 1);
        vault.resubmit(JOB, h2);
        Vault.Job memory j = vault.getJob(JOB);
        assertEq(uint8(j.status), uint8(Vault.Status.Submitted));
        assertEq(j.deliverableHash, h2);
        assertEq(uint8(j.verdict), uint8(Vault.Verdict.None));
        assertEq(j.confidenceBps, 0);
        assertEq(j.attestationHash, bytes32(0));
        assertEq(j.attestedAt, 0);
        assertEq(j.resubmits, 1);

        attestAs(JOB, Vault.Verdict.Fail, 9000);
        vm.prank(worker);
        vault.resubmit(JOB, keccak256("v3"));
        attestAs(JOB, Vault.Verdict.Fail, 9000);
        vm.prank(worker);
        vm.expectRevert(Vault.ResubmitLimit.selector);
        vault.resubmit(JOB, keccak256("v4"));
    }

    function test_resubmit_reverts() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(Vault.WrongStatus.selector, Vault.Status.Submitted));
        vault.resubmit(JOB, keccak256("v2"));
        attestAs(JOB, Vault.Verdict.NeedsReview, 6000);
        vm.prank(worker);
        vm.expectRevert(Vault.NotFailed.selector);
        vault.resubmit(JOB, keccak256("v2"));
        vm.prank(stranger);
        vm.expectRevert(Vault.NotWorker.selector);
        vault.resubmit(JOB, keccak256("v2"));

        bytes32 j2 = keccak256("job-2");
        createAndFund(j2, worker, AMOUNT, manualPolicy());
        submitAs(worker, j2);
        attestAs(j2, Vault.Verdict.Fail, 9000);
        vm.prank(worker);
        vm.expectRevert(Vault.ZeroHash.selector);
        vault.resubmit(j2, bytes32(0));
    }

    function test_resubmitWithSig() public {
        createAndFund(JOB, worker, AMOUNT, manualPolicy());
        submitAs(worker, JOB);
        attestAs(JOB, Vault.Verdict.Fail, 9000);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 h2 = keccak256("v2");
        bytes memory sig =
            sign(workerKey, keccak256(abi.encode(vault.RESUBMIT_TYPEHASH(), JOB, h2, uint256(0), deadline)));
        vault.resubmitWithSig(JOB, h2, worker, deadline, sig);
        assertEq(vault.getJob(JOB).deliverableHash, h2);
    }

    // ------------------------------------------------------------------
    // multi-token isolation + end-to-end withdraw
    // ------------------------------------------------------------------

    function test_multiToken_ledgersAreIsolated() public {
        depositAs(payer, AMOUNT);
        vm.prank(payer);
        vault.deposit(address(usd2), 3 * AMOUNT);
        bytes32 c = vault.computeCommit(JOB, payer, worker, address(usd2), AMOUNT, SCOPE, SALT);
        vm.prank(payer);
        vault.createJob(JOB, c, payer, worker, address(usd2), manualPolicy());
        vm.prank(payer);
        vault.fund(JOB, AMOUNT, SCOPE, SALT);
        assertEq(vault.locked(address(usd)), 0);
        assertEq(vault.locked(address(usd2)), AMOUNT);
        assertEq(vault.balances(address(usd), payer), AMOUNT);
        assertEq(vault.balances(address(usd2), payer), 2 * AMOUNT);
        submitAs(worker, JOB);
        vm.prank(payer);
        vault.settle(JOB, AMOUNT, SCOPE, SALT);
        uint256 net = AMOUNT - feeOn(AMOUNT);
        vm.prank(worker);
        vault.withdraw(address(usd2), net, worker);
        assertEq(usd2.balanceOf(worker), net);
        assertGe(usd2.balanceOf(address(vault)), vault.accounted(address(usd2)));
    }

    // ------------------------------------------------------------------
    // registry
    // ------------------------------------------------------------------

    function test_registry() public {
        assertTrue(registry.isVerifier(verifier));
        assertEq(registry.verifierURI(verifier), "https://vouch.dev/verifier");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.setVerifier(stranger, true, "");
        vm.prank(owner);
        vm.expectRevert(VerifierRegistry.ZeroAddress.selector);
        registry.setVerifier(address(0), true, "");
        vm.prank(owner);
        registry.setVerifier(verifier, false, "ignored");
        assertFalse(registry.isVerifier(verifier));
        assertEq(registry.verifierURI(verifier), "");
    }
}
