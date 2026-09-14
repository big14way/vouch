// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {Vault} from "../../src/Vault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Bounded random actor driving the Vault through every public path with ghost accounting.
contract VaultHandler is Test {
    Vault public vault;
    MockUSDC[2] public tokens;
    address public arbiter;
    address public intake;
    address public verifier;
    address public feeRecipient;

    address[] public actors;
    bytes32[] public jobIds;

    struct Ghost {
        uint256 amount;
        bytes32 scopeHash;
        bytes32 salt;
        address token;
        address payer;
        address worker;
        bool live; // funds are locked in this job
    }

    mapping(bytes32 => Ghost) public ghost;
    mapping(address token => uint256) public expectedFees;
    uint256 public attestBalanceDrift;
    uint256 public badAutoSettles;
    uint256 public badReveals;
    mapping(bytes32 => uint256) public calls;

    uint256 internal nonce;

    constructor(
        Vault vault_,
        MockUSDC t0,
        MockUSDC t1,
        address arbiter_,
        address intake_,
        address verifier_,
        address feeRecipient_
    ) {
        vault = vault_;
        tokens[0] = t0;
        tokens[1] = t1;
        arbiter = arbiter_;
        intake = intake_;
        verifier = verifier_;
        feeRecipient = feeRecipient_;
        for (uint256 i; i < 6; ++i) {
            address a = makeAddr(string(abi.encodePacked("actor", i)));
            actors.push(a);
            for (uint256 t; t < 2; ++t) {
                tokens[t].mint(a, 1e15);
                vm.prank(a);
                tokens[t].approve(address(vault), type(uint256).max);
            }
        }
    }

    // ---------------- ghost views ----------------

    function sumBalances(address token) external view returns (uint256 s) {
        for (uint256 i; i < actors.length; ++i) {
            s += vault.balances(token, actors[i]);
        }
        s += vault.balances(token, feeRecipient);
        s += vault.balances(token, arbiter);
        s += vault.balances(token, intake);
        s += vault.balances(token, verifier);
    }

    function liveLocked(address token) external view returns (uint256 s) {
        for (uint256 i; i < jobIds.length; ++i) {
            Ghost storage g = ghost[jobIds[i]];
            if (g.live && g.token == token) s += g.amount;
        }
    }

    function callSummary() external view {
        console2.log("deposit", calls["deposit"]);
        console2.log("attribute", calls["attribute"]);
        console2.log("createAndFund", calls["createAndFund"]);
        console2.log("submit", calls["submit"]);
        console2.log("attest", calls["attest"]);
        console2.log("settle", calls["settle"]);
        console2.log("autoSettle", calls["autoSettle"]);
        console2.log("dispute", calls["dispute"]);
        console2.log("resolve", calls["resolve"]);
        console2.log("refundExpired", calls["refundExpired"]);
        console2.log("resubmit", calls["resubmit"]);
        console2.log("withdraw", calls["withdraw"]);
    }

    // ---------------- helpers ----------------

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _token(uint256 seed) internal view returns (MockUSDC) {
        return tokens[seed % 2];
    }

    function _job(uint256 seed) internal view returns (bytes32) {
        if (jobIds.length == 0) return bytes32(0);
        return jobIds[seed % jobIds.length];
    }

    function _fee(uint256 amount) internal view returns (uint256) {
        return (amount * vault.feeBps()) / 10_000;
    }

    // ---------------- actions ----------------

    function deposit(uint256 actorSeed, uint256 tokenSeed, uint256 amount) external {
        amount = bound(amount, 1, 1e9);
        address a = _actor(actorSeed);
        vm.prank(a);
        vault.deposit(address(_token(tokenSeed)), amount);
        calls["deposit"]++;
    }

    function attribute(uint256 actorSeed, uint256 tokenSeed, uint256 amount, uint256 overAsk) external {
        amount = bound(amount, 1, 1e9);
        overAsk = bound(overAsk, 0, 1e9);
        address a = _actor(actorSeed);
        MockUSDC t = _token(tokenSeed);
        vm.prank(a);
        t.transfer(address(vault), amount);
        bytes32 ref = keccak256(abi.encode("ref", nonce++));
        uint256 s = vault.surplus(address(t));
        // over-ask must revert
        vm.prank(intake);
        try vault.attributeDeposit(address(t), a, s + 1 + overAsk, ref) {
            badReveals++; // repurposed: attribution above surplus accepted
        } catch {}
        vm.prank(intake);
        vault.attributeDeposit(address(t), a, s, ref);
        calls["attribute"]++;
    }

    function createAndFund(
        uint256 payerSeed,
        uint256 workerSeed,
        uint256 tokenSeed,
        uint256 amount,
        Vault.Policy memory policy
    ) external {
        address p = _actor(payerSeed);
        address w = _actor(workerSeed);
        if (w == p) w = address(0); // open job
        MockUSDC t = _token(tokenSeed);
        amount = bound(amount, 1, 1e9);
        policy.autoRelease = uint8(bound(policy.autoRelease, 0, 2));
        policy.minConfidenceBps = uint16(bound(policy.minConfidenceBps, 0, 10_000));
        policy.reviewWindow = uint32(bound(policy.reviewWindow, 0, 7 days));
        policy.submitDeadline = uint32(bound(policy.submitDeadline, 0, 30 days));

        bytes32 jobId = keccak256(abi.encode("job", nonce++));
        Ghost memory g = Ghost({
            amount: amount,
            scopeHash: keccak256(abi.encode("scope", jobId)),
            salt: keccak256(abi.encode("salt", jobId)),
            token: address(t),
            payer: p,
            worker: w,
            live: true
        });
        _createAndFund(jobId, g, policy);
        ghost[jobId] = g;
        jobIds.push(jobId);
        calls["createAndFund"]++;
    }

    function _createAndFund(bytes32 jobId, Ghost memory g, Vault.Policy memory policy) internal {
        bytes32 c = vault.computeCommit(jobId, g.payer, g.worker, g.token, g.amount, g.scopeHash, g.salt);
        if (vault.balances(g.token, g.payer) < g.amount) {
            vm.prank(g.payer);
            vault.deposit(g.token, g.amount);
        }
        vm.prank(g.payer);
        vault.createJob(jobId, c, g.payer, g.worker, g.token, policy);

        // wrong reveal must be rejected
        vm.prank(g.payer);
        try vault.fund(jobId, g.amount + 1, g.scopeHash, g.salt) {
            badReveals++;
        } catch {}

        vm.prank(g.payer);
        vault.fund(jobId, g.amount, g.scopeHash, g.salt);
    }

    function submit(uint256 jobSeed, uint256 actorSeed) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        if (j.status != Vault.Status.Funded) return;
        address w = j.openWorker ? _actor(actorSeed) : j.worker;
        if (w == j.payer) return;
        vm.prank(w);
        try vault.submit(jobId, keccak256(abi.encode("deliverable", nonce++))) {
            ghost[jobId].worker = w;
            calls["submit"]++;
        } catch {}
    }

    function attest(uint256 jobSeed, uint8 verdictRaw, uint16 conf) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        if (vault.getJob(jobId).status != Vault.Status.Submitted) return;
        bytes32 before = _snapshot(jobId);
        vm.prank(verifier);
        vault.attest(
            jobId, Vault.Verdict(uint8(bound(verdictRaw, 1, 3))), uint16(bound(conf, 0, 10_000)), keccak256("report")
        );
        if (_snapshot(jobId) != before) attestBalanceDrift++;
        calls["attest"]++;
    }

    function _snapshot(bytes32 jobId) internal view returns (bytes32) {
        Ghost storage g = ghost[jobId];
        return keccak256(
            abi.encode(
                vault.locked(g.token),
                vault.accounted(g.token),
                vault.balances(g.token, g.payer),
                vault.balances(g.token, g.worker),
                vault.balances(g.token, feeRecipient)
            )
        );
    }

    function settle(uint256 jobSeed) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        if (j.status != Vault.Status.Submitted && j.status != Vault.Status.Attested) return;
        Ghost storage g = ghost[jobId];
        vm.prank(g.payer);
        try vault.settle(jobId, g.amount + 1, g.scopeHash, g.salt) {
            badReveals++;
        } catch {}
        vm.prank(g.payer);
        vault.settle(jobId, g.amount, g.scopeHash, g.salt);
        g.live = false;
        expectedFees[g.token] += _fee(g.amount);
        calls["settle"]++;
    }

    function autoSettle(uint256 jobSeed) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        Ghost storage g = ghost[jobId];
        bool predicate = j.status == Vault.Status.Attested && j.policy.autoRelease != 0
            && block.timestamp >= uint256(j.attestedAt) + j.policy.reviewWindow
            && (j.verdict == Vault.Verdict.Pass
                || (j.policy.autoRelease == 2 && j.verdict == Vault.Verdict.NeedsReview))
            && j.confidenceBps >= j.policy.minConfidenceBps && g.amount <= j.policy.maxAutoAmount;
        try vault.autoSettle(jobId, g.amount, g.scopeHash, g.salt) {
            if (!predicate) badAutoSettles++;
            g.live = false;
            expectedFees[g.token] += _fee(g.amount);
            calls["autoSettle"]++;
        } catch {
            if (predicate) badAutoSettles++;
        }
    }

    function dispute(uint256 jobSeed, bool byWorker) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        if (j.status != Vault.Status.Submitted && j.status != Vault.Status.Attested) return;
        address by = byWorker ? j.worker : j.payer;
        vm.prank(by);
        vault.dispute(jobId, keccak256("reason"));
        calls["dispute"]++;
    }

    function resolve(uint256 jobSeed, uint16 workerBps) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        if (vault.getJob(jobId).status != Vault.Status.Disputed) return;
        Ghost storage g = ghost[jobId];
        workerBps = uint16(bound(workerBps, 0, 10_000));
        vm.prank(arbiter);
        try vault.resolve(jobId, g.amount, g.scopeHash, keccak256("wrong"), workerBps) {
            badReveals++;
        } catch {}
        vm.prank(arbiter);
        vault.resolve(jobId, g.amount, g.scopeHash, g.salt, workerBps);
        g.live = false;
        expectedFees[g.token] += _fee(g.amount);
        calls["resolve"]++;
    }

    function refundExpired(uint256 jobSeed) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        if (j.status != Vault.Status.Funded || j.policy.submitDeadline == 0) return;
        if (block.timestamp <= uint256(j.fundedAt) + j.policy.submitDeadline) return;
        Ghost storage g = ghost[jobId];
        vault.refundExpired(jobId, g.amount, g.scopeHash, g.salt);
        g.live = false;
        calls["refundExpired"]++;
    }

    function resubmit(uint256 jobSeed) external {
        bytes32 jobId = _job(jobSeed);
        if (jobId == 0) return;
        Vault.Job memory j = vault.getJob(jobId);
        if (j.status != Vault.Status.Attested || j.verdict != Vault.Verdict.Fail || j.resubmits >= 2) return;
        vm.prank(j.worker);
        vault.resubmit(jobId, keccak256(abi.encode("v", nonce++)));
        calls["resubmit"]++;
    }

    function withdraw(uint256 actorSeed, uint256 tokenSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        address t = address(_token(tokenSeed));
        uint256 bal = vault.balances(t, a);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(a);
        vault.withdraw(t, amount, a);
        calls["withdraw"]++;
    }

    function warp(uint32 by) external {
        vm.warp(block.timestamp + bound(by, 1, 3 days));
    }
}
