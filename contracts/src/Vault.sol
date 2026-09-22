// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IVerifierRegistry} from "./interfaces/IVerifierRegistry.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";
import {IEarnVault} from "./interfaces/IEarnVault.sol";
import {IZonePortal, IZonePortalLegacy} from "./interfaces/IZonePortal.sol";

/// @title Vault
/// @notice Pooled conditional-settlement vault. One primitive: lock → deliver → verify → settle.
///
/// Money model
/// - Every token has an internal ledger: `balances[token][user]` (available) and `locked[token]` (held in jobs).
/// - `accounted[token] == Σ balances + locked`. `deployed[token]` is locked principal currently held as Tempo
///   Earn shares instead of tokens. Invariant: `token.balanceOf(this) + deployed[token] >= accounted[token]`.
/// - Tokens only leave the vault through `withdraw` or into an allow-listed Earn vault. `attest` never moves money.
/// - Per-job amounts are never stored or emitted; jobs carry a commitment
///   `keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))` and the amount is
///   revealed in calldata only by the party that settles/refunds/resolves the job.
///
/// Earn while locked (Tempo Earn)
/// - `Policy.earnVault` (0 = off) names an allow-listed Earn vault. On `fund` the locked principal is deposited
///   there and the job's Earn shares are recorded. On settle/autoSettle/resolve/refund the Vault recalls exactly
///   the principal with `withdrawExact`; the shares left over are the yield and go to the payer's Earn position.
///   If the venue cannot return the full principal, every job share is redeemed and the shortfall is charged to
///   the payer's available balance before the worker is short. Opt-in per job; the payer carries that risk.
/// - Idle-balance Earn: `depositToEarn` / `redeemFromEarn` move a user's available balance into / out of an
///   allow-listed vault; meanwhile the user holds shares (`userEarnShares`), not a balance.
///
/// Private payout (Tempo Zones, testnet-only at the time of writing)
/// - `withdrawToZone` moves a user's available balance into a Tempo Zone through an owner-allow-listed Zone Portal
///   (`depositEncrypted`): the public chain shows Vault → Portal and the amount; the recipient and memo are
///   encrypted to the zone sequencer (payload built client-side, e.g. viem `encryptedDeposit.prepareRecipient`
///   with `sender = this vault`). The user is the refund recipient if the deposit bounces.
///
/// Roles
/// - `payer` / `worker`: parties to a job. They act directly or via an EIP-712 signature relayed by anyone.
/// - `registry` verifiers: may call `attest`. Attest-only.
/// - `arbiter`: resolves disputes with a split.
/// - `intake`: attributes unaccounted deposits (MPP charges, x402 settlements, memo'd TIP-20 transfers)
///   and may create/fund jobs on behalf of a payer from that payer's own balance. It can mis-assign
///   surplus and mis-lock a payer's balance into that payer's own job; it can never withdraw.
/// - `owner`: parameters, Earn allow-list and pause. Withdraw, dispute, resolve, refundExpired and
///   redeemFromEarn keep working while paused.
contract Vault is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Status {
        None,
        Open,
        Funded,
        Submitted,
        Attested,
        Settled,
        Disputed,
        Resolved,
        Refunded,
        Expired
    }

    enum Verdict {
        None,
        Pass,
        NeedsReview,
        Fail
    }

    struct Policy {
        uint8 autoRelease; // 0 off · 1 on Pass · 2 on Pass or NeedsReview
        uint16 minConfidenceBps; // 8500 = 0.85
        uint96 maxAutoAmount; // auto-settle only if amount <= this
        uint32 reviewWindow; // seconds after attestation before autoSettle
        uint32 submitDeadline; // seconds after funding for worker to submit; 0 = no deadline
        address earnVault; // allow-listed Tempo Earn vault holding the locked principal; 0 = off
    }

    struct Job {
        bytes32 commit;
        address payer;
        Status status;
        Verdict verdict;
        uint16 confidenceBps;
        uint8 resubmits;
        bool openWorker; // worker was address(0) at creation; first submitter becomes the worker
        address worker;
        uint40 fundedAt;
        uint40 submittedAt;
        address token;
        uint40 attestedAt;
        bytes32 deliverableHash;
        bytes32 attestationHash;
        uint256 earnShares; // Earn shares held for this job's principal
        Policy policy;
    }

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 200;
    uint16 public constant MAX_EARN_SLIPPAGE_BPS = 1_000;
    uint8 public constant MAX_RESUBMITS = 2;

    bytes32 public constant SUBMIT_TYPEHASH =
        keccak256("Submit(bytes32 jobId,bytes32 deliverableHash,uint256 nonce,uint256 deadline)");
    bytes32 public constant RESUBMIT_TYPEHASH =
        keccak256("Resubmit(bytes32 jobId,bytes32 deliverableHash,uint256 nonce,uint256 deadline)");
    bytes32 public constant SETTLE_TYPEHASH = keccak256("Settle(bytes32 jobId,uint256 nonce,uint256 deadline)");
    bytes32 public constant DISPUTE_TYPEHASH =
        keccak256("Dispute(bytes32 jobId,bytes32 reasonHash,uint256 nonce,uint256 deadline)");
    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address token,uint256 amount,address to,uint256 nonce,uint256 deadline)");
    bytes32 public constant EARN_DEPOSIT_TYPEHASH =
        keccak256("EarnDeposit(address earnVault,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 public constant EARN_REDEEM_TYPEHASH =
        keccak256("EarnRedeem(address earnVault,uint256 shares,uint256 minAssets,uint256 nonce,uint256 deadline)");
    bytes32 public constant ZONE_WITHDRAW_TYPEHASH = keccak256(
        "ZoneWithdraw(address portal,address token,uint256 amount,uint256 keyIndex,bytes32 payloadHash,uint256 nonce,uint256 deadline)"
    );

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    mapping(bytes32 jobId => Job) internal _jobs;
    mapping(address token => mapping(address user => uint256)) public balances;
    mapping(address token => uint256) public locked;
    mapping(address token => uint256) public accounted; // Σ balances + locked
    mapping(address token => uint256) public deployed; // locked principal held as Earn shares
    mapping(address token => bool) public allowedToken;
    mapping(bytes32 ref => bool) public attributedRef;
    mapping(address signer => uint256) public nonces;
    mapping(address earnVault => bool) public allowedEarnVault;
    mapping(address user => mapping(address earnVault => uint256)) public userEarnShares;
    mapping(address portal => bool) public allowedZonePortal;
    mapping(address portal => bool) public legacyZonePortal; // no refund-recipient arg; bounces land here as surplus

    uint16 public feeBps;
    uint16 public earnSlippageBps = 50;
    address public feeRecipient;
    address public arbiter;
    address public intake;
    IVerifierRegistry public registry;

    // ------------------------------------------------------------------
    // Events (job events indexed by jobId; no amounts)
    // ------------------------------------------------------------------

    event Deposited(address indexed token, address indexed user, uint256 amount);
    event Attributed(address indexed token, address indexed to, uint256 amount, bytes32 indexed ref);
    event JobCreated(
        bytes32 indexed jobId,
        address indexed payer,
        address indexed worker,
        address token,
        bytes32 commit,
        Policy policy
    );
    event Funded(bytes32 indexed jobId);
    event Submitted(bytes32 indexed jobId, address indexed worker, bytes32 deliverableHash);
    event Attested(
        bytes32 indexed jobId, address indexed verifier, Verdict verdict, uint16 confidenceBps, bytes32 attestationHash
    );
    event Settled(bytes32 indexed jobId);
    event AutoSettled(bytes32 indexed jobId, address indexed caller);
    event Disputed(bytes32 indexed jobId, address indexed by, bytes32 reasonHash);
    event Resolved(bytes32 indexed jobId, uint16 workerBps);
    event Refunded(bytes32 indexed jobId);
    event Resubmitted(bytes32 indexed jobId, bytes32 deliverableHash, uint8 resubmits);
    event Withdrawn(address indexed token, address indexed user, address indexed to, uint256 amount);

    event JobEarnDeposited(bytes32 indexed jobId, address indexed earnVault);
    event JobEarnSkipped(bytes32 indexed jobId, address indexed earnVault);
    /// @param exact true when `withdrawExact` returned the full principal; false on the redeem-all fallback
    /// @param shortfall principal not returned by the venue (charged to the payer's balance where possible)
    event JobEarnRecalled(bytes32 indexed jobId, address indexed earnVault, bool exact, uint256 shortfall);
    event EarnYieldCredited(bytes32 indexed jobId, address indexed payer, address indexed earnVault, uint256 shares);
    event EarnDeposited(address indexed user, address indexed earnVault, address token, uint256 amount, uint256 shares);
    event EarnRedeemed(address indexed user, address indexed earnVault, address token, uint256 shares, uint256 assets);
    /// Recipient and memo are encrypted inside the portal deposit; only the amount is public.
    event WithdrawnToZone(address indexed token, address indexed user, address indexed portal, uint256 amount);

    event RegistrySet(address registry);
    event ArbiterSet(address arbiter);
    event IntakeSet(address intake);
    event FeeSet(uint16 feeBps, address feeRecipient);
    event TokenSet(address indexed token, bool allowed);
    event EarnVaultSet(address indexed earnVault, bool allowed);
    event EarnSlippageSet(uint16 bps);
    event ZonePortalSet(address indexed portal, bool allowed, bool legacy);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed(address token);
    error FeeTooHigh();
    error JobExists(bytes32 jobId);
    error UnknownJob(bytes32 jobId);
    error WrongStatus(Status actual);
    error NotPayer();
    error NotWorker();
    error NotParty();
    error NotArbiter();
    error NotIntake();
    error NotVerifier();
    error NotPayerOrIntake();
    error BadCommit();
    error BadPolicy();
    error BadVerdict();
    error BadConfidence();
    error BadSplit();
    error InsufficientBalance();
    error InsufficientSurplus(uint256 surplus);
    error RefAlreadyAttributed(bytes32 ref);
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NoDeadline();
    error ReviewWindowOpen();
    error AutoReleaseOff();
    error VerdictNotEligible();
    error ConfidenceTooLow();
    error AmountAboveCap();
    error ResubmitLimit();
    error NotFailed();
    error WorkerIsPayer();
    error ZeroHash();
    error SignatureExpired();
    error BadSignature();
    error EarnVaultNotAllowed(address earnVault);
    error EarnAssetMismatch();
    error InsufficientShares();
    error SlippageTooHigh();
    error ZonePortalNotAllowed(address portal);
    error ZoneDepositsInactive();
    error AmountTooLarge();

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address initialOwner, address registry_, address arbiter_, address intake_, address[] memory tokens)
        Ownable(initialOwner)
        EIP712("Vouch Vault", "1")
    {
        if (registry_ == address(0) || arbiter_ == address(0) || intake_ == address(0)) revert ZeroAddress();
        registry = IVerifierRegistry(registry_);
        arbiter = arbiter_;
        intake = intake_;
        for (uint256 i; i < tokens.length; ++i) {
            if (tokens[i] == address(0)) revert ZeroAddress();
            allowedToken[tokens[i]] = true;
            emit TokenSet(tokens[i], true);
        }
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getJob(bytes32 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    /// @notice Unaccounted tokens sitting in the vault (direct transfers, MPP charges, x402 settlements).
    ///         Principal deployed to Earn is expected to be absent, so it is excluded from what must be held.
    function surplus(address token) public view returns (uint256) {
        uint256 bal = IERC20(token).balanceOf(address(this));
        uint256 expected = accounted[token] - deployed[token];
        return bal > expected ? bal - expected : 0;
    }

    function computeCommit(
        bytes32 jobId,
        address payer,
        address worker,
        address token,
        uint256 amount,
        bytes32 scopeHash,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt));
    }

    /// @notice True when `autoSettle` would succeed for this job at the current time and revealed amount.
    function canAutoSettle(bytes32 jobId, uint256 amount) external view returns (bool ok, bytes4 reason) {
        Job storage job = _jobs[jobId];
        if (job.status != Status.Attested) return (false, WrongStatus.selector);
        if (paused()) return (false, Pausable.EnforcedPause.selector);
        return _autoPredicates(job, amount);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ------------------------------------------------------------------
    // Deposits
    // ------------------------------------------------------------------

    /// @notice Pull `amount` of `token` from the caller (requires prior approve) and credit their balance.
    function deposit(address token, uint256 amount) external whenNotPaused nonReentrant {
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (amount == 0) revert ZeroAmount();
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        _credit(token, msg.sender, received);
        emit Deposited(token, msg.sender, received);
    }

    /// @notice Base USDC EIP-3009 deposit. Anyone may relay; `from` is credited. The payer never needs ETH.
    function depositWithAuthorization(
        address token,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (value == 0) revert ZeroAmount();
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC3009(token).receiveWithAuthorization(from, address(this), value, validAfter, validBefore, nonce, v, r, s);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        _credit(token, from, received);
        emit Deposited(token, from, received);
    }

    /// @notice Credit `to` with `amount` taken from the unattributed surplus. Idempotent per `ref`.
    function attributeDeposit(address token, address to, uint256 amount, bytes32 ref) external whenNotPaused {
        if (msg.sender != intake) revert NotIntake();
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (attributedRef[ref]) revert RefAlreadyAttributed(ref);
        uint256 s = surplus(token);
        if (amount > s) revert InsufficientSurplus(s);
        attributedRef[ref] = true;
        _credit(token, to, amount);
        emit Attributed(token, to, amount, ref);
    }

    // ------------------------------------------------------------------
    // Job lifecycle
    // ------------------------------------------------------------------

    /// @notice Create a job for `payer`. Callable by the payer, or by `intake` on the payer's behalf.
    ///         `worker == address(0)` means the first address to submit becomes the worker.
    function createJob(
        bytes32 jobId,
        bytes32 commit,
        address payer,
        address worker,
        address token,
        Policy calldata policy
    ) external whenNotPaused {
        if (msg.sender != payer && msg.sender != intake) revert NotPayerOrIntake();
        if (payer == address(0)) revert ZeroAddress();
        if (worker == payer) revert WorkerIsPayer();
        if (commit == bytes32(0)) revert ZeroHash();
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (policy.autoRelease > 2 || policy.minConfidenceBps > BPS) revert BadPolicy();
        if (policy.earnVault != address(0)) {
            if (!allowedEarnVault[policy.earnVault]) revert EarnVaultNotAllowed(policy.earnVault);
            if (IEarnVault(policy.earnVault).asset() != token) revert EarnAssetMismatch();
        }
        Job storage job = _jobs[jobId];
        if (job.status != Status.None) revert JobExists(jobId);

        job.commit = commit;
        job.payer = payer;
        job.worker = worker;
        job.openWorker = worker == address(0);
        job.token = token;
        job.status = Status.Open;
        job.policy = policy;
        emit JobCreated(jobId, payer, worker, token, commit, policy);
    }

    /// @notice Move `amount` from the payer's available balance into the job. Reveal must match the commitment.
    ///         When the policy names an Earn vault, the principal is deposited there (best effort: a paused or
    ///         reverting vault leaves the job funded without Earn).
    function fund(bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt) external whenNotPaused nonReentrant {
        Job storage job = _jobs[jobId];
        if (job.status != Status.Open) revert WrongStatus(job.status);
        if (msg.sender != job.payer && msg.sender != intake) revert NotPayerOrIntake();
        _checkCommit(job, jobId, amount, scopeHash, salt);
        uint256 bal = balances[job.token][job.payer];
        if (bal < amount) revert InsufficientBalance();
        balances[job.token][job.payer] = bal - amount;
        locked[job.token] += amount;
        job.status = Status.Funded;
        job.fundedAt = uint40(block.timestamp);
        emit Funded(jobId);
        _deployToEarn(job, jobId, amount);
    }

    function submit(bytes32 jobId, bytes32 deliverableHash) external whenNotPaused {
        _submit(jobId, msg.sender, deliverableHash);
    }

    function submitWithSig(bytes32 jobId, bytes32 deliverableHash, address signer, uint256 deadline, bytes calldata sig)
        external
        whenNotPaused
    {
        _useSig(
            signer,
            deadline,
            sig,
            keccak256(abi.encode(SUBMIT_TYPEHASH, jobId, deliverableHash, nonces[signer], deadline))
        );
        _submit(jobId, signer, deliverableHash);
    }

    /// @notice Registered verifier writes a verdict. No funds move.
    function attest(bytes32 jobId, Verdict verdict, uint16 confidenceBps, bytes32 attestationHash)
        external
        whenNotPaused
    {
        if (!registry.isVerifier(msg.sender)) revert NotVerifier();
        Job storage job = _jobs[jobId];
        if (job.status != Status.Submitted) revert WrongStatus(job.status);
        if (verdict == Verdict.None) revert BadVerdict();
        if (confidenceBps > BPS) revert BadConfidence();
        if (attestationHash == bytes32(0)) revert ZeroHash();
        job.verdict = verdict;
        job.confidenceBps = confidenceBps;
        job.attestationHash = attestationHash;
        job.attestedAt = uint40(block.timestamp);
        job.status = Status.Attested;
        emit Attested(jobId, msg.sender, verdict, confidenceBps, attestationHash);
    }

    /// @notice Payer approves: pays the worker `amount - fee`.
    function settle(bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt)
        external
        whenNotPaused
        nonReentrant
    {
        _settle(jobId, msg.sender, amount, scopeHash, salt);
    }

    function settleWithSig(
        bytes32 jobId,
        uint256 amount,
        bytes32 scopeHash,
        bytes32 salt,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external whenNotPaused nonReentrant {
        _useSig(signer, deadline, sig, keccak256(abi.encode(SETTLE_TYPEHASH, jobId, nonces[signer], deadline)));
        _settle(jobId, signer, amount, scopeHash, salt);
    }

    /// @notice Anyone may settle once every predicate of the payer's policy holds.
    function autoSettle(bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt)
        external
        whenNotPaused
        nonReentrant
    {
        Job storage job = _jobs[jobId];
        if (job.status != Status.Attested) revert WrongStatus(job.status);
        _checkCommit(job, jobId, amount, scopeHash, salt);
        (bool ok, bytes4 reason) = _autoPredicates(job, amount);
        if (!ok) _revertWith(reason);
        job.status = Status.Settled;
        _payout(job, jobId, amount, BPS);
        emit AutoSettled(jobId, msg.sender);
    }

    function dispute(bytes32 jobId, bytes32 reasonHash) external {
        _dispute(jobId, msg.sender, reasonHash);
    }

    function disputeWithSig(bytes32 jobId, bytes32 reasonHash, address signer, uint256 deadline, bytes calldata sig)
        external
    {
        _useSig(
            signer, deadline, sig, keccak256(abi.encode(DISPUTE_TYPEHASH, jobId, reasonHash, nonces[signer], deadline))
        );
        _dispute(jobId, signer, reasonHash);
    }

    /// @notice Arbiter splits a disputed job: `workerBps` of (amount - fee) to the worker, the rest back to the payer.
    function resolve(bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt, uint16 workerBps)
        external
        nonReentrant
    {
        if (msg.sender != arbiter) revert NotArbiter();
        if (workerBps > BPS) revert BadSplit();
        Job storage job = _jobs[jobId];
        if (job.status != Status.Disputed) revert WrongStatus(job.status);
        _checkCommit(job, jobId, amount, scopeHash, salt);
        job.status = Status.Resolved;
        _payout(job, jobId, amount, workerBps);
        emit Resolved(jobId, workerBps);
    }

    /// @notice Funded job whose worker missed the submit deadline: amount returns to the payer's balance.
    function refundExpired(bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt) external nonReentrant {
        Job storage job = _jobs[jobId];
        if (job.status != Status.Funded) revert WrongStatus(job.status);
        if (job.policy.submitDeadline == 0) revert NoDeadline();
        if (block.timestamp <= uint256(job.fundedAt) + job.policy.submitDeadline) revert DeadlineNotPassed();
        _checkCommit(job, jobId, amount, scopeHash, salt);
        job.status = Status.Refunded;
        locked[job.token] -= amount;
        uint256 available = _recall(job, jobId, amount);
        balances[job.token][job.payer] += available;
        emit Refunded(jobId);
    }

    function resubmit(bytes32 jobId, bytes32 deliverableHash) external whenNotPaused {
        _resubmit(jobId, msg.sender, deliverableHash);
    }

    function resubmitWithSig(
        bytes32 jobId,
        bytes32 deliverableHash,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external whenNotPaused {
        _useSig(
            signer,
            deadline,
            sig,
            keccak256(abi.encode(RESUBMIT_TYPEHASH, jobId, deliverableHash, nonces[signer], deadline))
        );
        _resubmit(jobId, signer, deliverableHash);
    }

    // ------------------------------------------------------------------
    // Withdraw
    // ------------------------------------------------------------------

    function withdraw(address token, uint256 amount, address to) external nonReentrant {
        _withdraw(token, msg.sender, amount, to);
    }

    function withdrawWithSig(
        address token,
        uint256 amount,
        address to,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        _useSig(
            signer, deadline, sig, keccak256(abi.encode(WITHDRAW_TYPEHASH, token, amount, to, nonces[signer], deadline))
        );
        _withdraw(token, signer, amount, to);
    }

    // ------------------------------------------------------------------
    // Idle-balance Earn
    // ------------------------------------------------------------------

    /// @notice Move `amount` of available balance into an allow-listed Earn vault; the caller holds the shares.
    function depositToEarn(address earnVault, uint256 amount) external whenNotPaused nonReentrant {
        _depositToEarn(msg.sender, earnVault, amount);
    }

    function depositToEarnWithSig(
        address earnVault,
        uint256 amount,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external whenNotPaused nonReentrant {
        _useSig(
            signer,
            deadline,
            sig,
            keccak256(abi.encode(EARN_DEPOSIT_TYPEHASH, earnVault, amount, nonces[signer], deadline))
        );
        _depositToEarn(signer, earnVault, amount);
    }

    /// @notice Redeem Earn shares back into available balance. Works while paused.
    function redeemFromEarn(address earnVault, uint256 shares, uint256 minAssets) external nonReentrant {
        _redeemFromEarn(msg.sender, earnVault, shares, minAssets);
    }

    function redeemFromEarnWithSig(
        address earnVault,
        uint256 shares,
        uint256 minAssets,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        _useSig(
            signer,
            deadline,
            sig,
            keccak256(abi.encode(EARN_REDEEM_TYPEHASH, earnVault, shares, minAssets, nonces[signer], deadline))
        );
        _redeemFromEarn(signer, earnVault, shares, minAssets);
    }

    // ------------------------------------------------------------------
    // Private payout into a Tempo Zone
    // ------------------------------------------------------------------

    /// @notice Move `amount` of the caller's available balance into a Tempo Zone through an allow-listed portal.
    ///         `encrypted` was prepared client-side for `sender = address(this)`; the caller is the refund recipient.
    function withdrawToZone(
        address portal,
        address token,
        uint256 amount,
        uint256 keyIndex,
        IZonePortal.EncryptedPayload calldata encrypted
    ) external nonReentrant {
        _withdrawToZone(msg.sender, portal, token, amount, keyIndex, encrypted);
    }

    function withdrawToZoneWithSig(
        address portal,
        address token,
        uint256 amount,
        uint256 keyIndex,
        IZonePortal.EncryptedPayload calldata encrypted,
        address signer,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        _useSig(
            signer,
            deadline,
            sig,
            keccak256(
                abi.encode(
                    ZONE_WITHDRAW_TYPEHASH,
                    portal,
                    token,
                    amount,
                    keyIndex,
                    keccak256(abi.encode(encrypted)),
                    nonces[signer],
                    deadline
                )
            )
        );
        _withdrawToZone(signer, portal, token, amount, keyIndex, encrypted);
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IVerifierRegistry(registry_);
        emit RegistrySet(registry_);
    }

    function setArbiter(address arbiter_) external onlyOwner {
        if (arbiter_ == address(0)) revert ZeroAddress();
        arbiter = arbiter_;
        emit ArbiterSet(arbiter_);
    }

    function setIntake(address intake_) external onlyOwner {
        if (intake_ == address(0)) revert ZeroAddress();
        intake = intake_;
        emit IntakeSet(intake_);
    }

    function setFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (feeBps_ != 0 && feeRecipient_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeSet(feeBps_, feeRecipient_);
    }

    function setToken(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = allowed;
        emit TokenSet(token, allowed);
    }

    /// @notice Allow-list an Earn vault. Its asset must be an allowed token.
    function setEarnVault(address earnVault, bool allowed) external onlyOwner {
        if (earnVault == address(0)) revert ZeroAddress();
        if (allowed && !allowedToken[IEarnVault(earnVault).asset()]) revert EarnAssetMismatch();
        allowedEarnVault[earnVault] = allowed;
        emit EarnVaultSet(earnVault, allowed);
    }

    /// @notice Allow-list a Tempo Zone Portal for private payouts. `legacy` portals (Moderato Zone A, Sept 2026)
    ///         take no refund recipient: a bounced deposit returns to this contract as surplus, which intake
    ///         attributes back to the user via `attributeDeposit`.
    function setZonePortal(address portal, bool allowed, bool legacy) external onlyOwner {
        if (portal == address(0)) revert ZeroAddress();
        allowedZonePortal[portal] = allowed;
        legacyZonePortal[portal] = allowed && legacy;
        emit ZonePortalSet(portal, allowed, allowed && legacy);
    }

    function setEarnSlippage(uint16 bps) external onlyOwner {
        if (bps > MAX_EARN_SLIPPAGE_BPS) revert SlippageTooHigh();
        earnSlippageBps = bps;
        emit EarnSlippageSet(bps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _credit(address token, address user, uint256 amount) internal {
        balances[token][user] += amount;
        accounted[token] += amount;
    }

    function _checkCommit(Job storage job, bytes32 jobId, uint256 amount, bytes32 scopeHash, bytes32 salt)
        internal
        view
    {
        address committedWorker = job.openWorker ? address(0) : job.worker;
        if (computeCommit(jobId, job.payer, committedWorker, job.token, amount, scopeHash, salt) != job.commit) {
            revert BadCommit();
        }
    }

    function _autoPredicates(Job storage job, uint256 amount) internal view returns (bool, bytes4) {
        Policy memory p = job.policy;
        if (p.autoRelease == 0) return (false, AutoReleaseOff.selector);
        if (block.timestamp < uint256(job.attestedAt) + p.reviewWindow) return (false, ReviewWindowOpen.selector);
        bool verdictOk = job.verdict == Verdict.Pass || (p.autoRelease == 2 && job.verdict == Verdict.NeedsReview);
        if (!verdictOk) return (false, VerdictNotEligible.selector);
        if (job.confidenceBps < p.minConfidenceBps) return (false, ConfidenceTooLow.selector);
        if (amount > p.maxAutoAmount) return (false, AmountAboveCap.selector);
        return (true, bytes4(0));
    }

    function _revertWith(bytes4 selector) internal pure {
        assembly ("memory-safe") {
            mstore(0x00, selector)
            revert(0x00, 0x04)
        }
    }

    /// @dev Release `amount` from lock, recall principal from Earn (if any); fee once; split by workerBps.
    ///      Callers write the terminal `job.status` first, so the job is closed before any venue is called.
    function _payout(Job storage job, bytes32 jobId, uint256 amount, uint16 workerBps) internal {
        address token = job.token;
        locked[token] -= amount;
        uint256 available = _recall(job, jobId, amount);
        uint256 fee = feeRecipient == address(0) ? 0 : (available * feeBps) / BPS;
        uint256 net = available - fee;
        uint256 toWorker = (net * workerBps) / BPS;
        uint256 toPayer = net - toWorker;
        if (fee != 0) balances[token][feeRecipient] += fee;
        if (toWorker != 0) balances[token][job.worker] += toWorker;
        if (toPayer != 0) balances[token][job.payer] += toPayer;
    }

    /// @dev Best-effort deposit of a job's principal into its Earn vault.
    function _deployToEarn(Job storage job, bytes32 jobId, uint256 amount) internal {
        address ev = job.policy.earnVault;
        if (ev == address(0)) return;
        address token = job.token;
        uint256 minShares = (IEarnVault(ev).previewWithdraw(amount) * (BPS - earnSlippageBps)) / BPS;
        if (minShares == 0) minShares = 1;
        IERC20(token).forceApprove(ev, amount);
        try IEarnVault(ev).deposit(amount, address(this), minShares) returns (uint256 shares) {
            job.earnShares = shares;
            deployed[token] += amount;
            emit JobEarnDeposited(jobId, ev);
        } catch {
            IERC20(token).forceApprove(ev, 0);
            emit JobEarnSkipped(jobId, ev);
        }
    }

    /// @dev Bring a job's principal back from Earn. Returns the assets actually available for the payout:
    ///      `amount` normally; less only when the venue returned less and the payer's balance could not cover it.
    function _recall(Job storage job, bytes32 jobId, uint256 amount) internal returns (uint256 available) {
        uint256 shares = job.earnShares;
        if (shares == 0) return amount;
        address ev = job.policy.earnVault;
        address token = job.token;
        job.earnShares = 0;
        deployed[token] -= amount;

        if (IEarnVault(ev).previewWithdraw(amount) <= shares) {
            try IEarnVault(ev).withdrawExact(amount, address(this), shares) returns (uint256 burned) {
                uint256 yieldShares = shares - burned;
                if (yieldShares != 0) {
                    userEarnShares[job.payer][ev] += yieldShares;
                    emit EarnYieldCredited(jobId, job.payer, ev, yieldShares);
                }
                emit JobEarnRecalled(jobId, ev, true, 0);
                return amount;
            } catch {}
        }

        // Fallback: redeem everything; the ledger absorbs the difference against the promised principal.
        uint256 got = IEarnVault(ev).redeem(shares, address(this), 1);
        if (got >= amount) {
            uint256 extra = got - amount;
            if (extra != 0) {
                balances[token][job.payer] += extra;
                accounted[token] += extra;
            }
            emit JobEarnRecalled(jobId, ev, false, 0);
            return amount;
        }
        uint256 shortfall = amount - got;
        uint256 payerBal = balances[token][job.payer];
        uint256 cover = payerBal < shortfall ? payerBal : shortfall;
        balances[token][job.payer] = payerBal - cover;
        accounted[token] -= shortfall;
        emit JobEarnRecalled(jobId, ev, false, shortfall);
        return got + cover;
    }

    function _depositToEarn(address user, address ev, uint256 amount) internal {
        if (!allowedEarnVault[ev]) revert EarnVaultNotAllowed(ev);
        if (amount == 0) revert ZeroAmount();
        address token = IEarnVault(ev).asset();
        uint256 bal = balances[token][user];
        if (bal < amount) revert InsufficientBalance();
        balances[token][user] = bal - amount;
        accounted[token] -= amount;
        uint256 minShares = (IEarnVault(ev).previewWithdraw(amount) * (BPS - earnSlippageBps)) / BPS;
        if (minShares == 0) minShares = 1;
        IERC20(token).forceApprove(ev, amount);
        uint256 shares = IEarnVault(ev).deposit(amount, address(this), minShares);
        userEarnShares[user][ev] += shares;
        emit EarnDeposited(user, ev, token, amount, shares);
    }

    function _redeemFromEarn(address user, address ev, uint256 shares, uint256 minAssets) internal {
        if (shares == 0) revert ZeroAmount();
        uint256 have = userEarnShares[user][ev];
        if (have < shares) revert InsufficientShares();
        userEarnShares[user][ev] = have - shares;
        address token = IEarnVault(ev).asset();
        uint256 assets = IEarnVault(ev).redeem(shares, address(this), minAssets == 0 ? 1 : minAssets);
        _credit(token, user, assets);
        emit EarnRedeemed(user, ev, token, shares, assets);
    }

    function _withdrawToZone(
        address user,
        address portal,
        address token,
        uint256 amount,
        uint256 keyIndex,
        IZonePortal.EncryptedPayload calldata encrypted
    ) internal {
        if (!allowedZonePortal[portal]) revert ZonePortalNotAllowed(portal);
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge();
        if (!IZonePortal(portal).areDepositsActive(token)) revert ZoneDepositsInactive();
        uint256 bal = balances[token][user];
        if (bal < amount) revert InsufficientBalance();
        balances[token][user] = bal - amount;
        accounted[token] -= amount;
        IERC20(token).forceApprove(portal, amount);
        if (legacyZonePortal[portal]) {
            IZonePortalLegacy(portal).depositEncrypted(token, uint128(amount), keyIndex, encrypted);
        } else {
            IZonePortal(portal).depositEncrypted(token, uint128(amount), keyIndex, encrypted, user);
        }
        emit WithdrawnToZone(token, user, portal, amount);
    }

    function _submit(bytes32 jobId, address worker, bytes32 deliverableHash) internal {
        Job storage job = _jobs[jobId];
        if (job.status != Status.Funded) revert WrongStatus(job.status);
        if (deliverableHash == bytes32(0)) revert ZeroHash();
        if (job.openWorker && job.worker == address(0)) {
            if (worker == job.payer) revert WorkerIsPayer();
            job.worker = worker;
        } else if (worker != job.worker) {
            revert NotWorker();
        }
        uint32 dl = job.policy.submitDeadline;
        if (dl != 0 && block.timestamp > uint256(job.fundedAt) + dl) revert DeadlinePassed();
        job.deliverableHash = deliverableHash;
        job.submittedAt = uint40(block.timestamp);
        job.status = Status.Submitted;
        emit Submitted(jobId, worker, deliverableHash);
    }

    function _settle(bytes32 jobId, address payer, uint256 amount, bytes32 scopeHash, bytes32 salt) internal {
        Job storage job = _jobs[jobId];
        if (payer != job.payer) revert NotPayer();
        if (job.status != Status.Submitted && job.status != Status.Attested) revert WrongStatus(job.status);
        _checkCommit(job, jobId, amount, scopeHash, salt);
        job.status = Status.Settled;
        _payout(job, jobId, amount, BPS);
        emit Settled(jobId);
    }

    function _dispute(bytes32 jobId, address by, bytes32 reasonHash) internal {
        Job storage job = _jobs[jobId];
        if (by != job.payer && by != job.worker) revert NotParty();
        if (job.status != Status.Submitted && job.status != Status.Attested) revert WrongStatus(job.status);
        job.status = Status.Disputed;
        emit Disputed(jobId, by, reasonHash);
    }

    function _resubmit(bytes32 jobId, address worker, bytes32 deliverableHash) internal {
        Job storage job = _jobs[jobId];
        if (worker != job.worker) revert NotWorker();
        if (job.status != Status.Attested) revert WrongStatus(job.status);
        if (job.verdict != Verdict.Fail) revert NotFailed();
        if (job.resubmits >= MAX_RESUBMITS) revert ResubmitLimit();
        if (deliverableHash == bytes32(0)) revert ZeroHash();
        job.resubmits += 1;
        job.deliverableHash = deliverableHash;
        job.submittedAt = uint40(block.timestamp);
        job.attestedAt = 0;
        job.verdict = Verdict.None;
        job.confidenceBps = 0;
        job.attestationHash = bytes32(0);
        job.status = Status.Submitted;
        emit Resubmitted(jobId, deliverableHash, job.resubmits);
    }

    function _withdraw(address token, address user, uint256 amount, address to) internal {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balances[token][user];
        if (bal < amount) revert InsufficientBalance();
        balances[token][user] = bal - amount;
        accounted[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, user, to, amount);
    }

    function _useSig(address signer, uint256 deadline, bytes calldata sig, bytes32 structHash) internal {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (signer == address(0)) revert ZeroAddress();
        bytes32 digest = _hashTypedDataV4(structHash);
        if (!SignatureChecker.isValidSignatureNow(signer, digest, sig)) revert BadSignature();
        nonces[signer] += 1;
    }
}
