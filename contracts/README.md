# Vouch contracts

Solidity 0.8.26 · Foundry · OpenZeppelin 5.6

| Contract | Purpose |
|---|---|
| `Vault.sol` | Pooled conditional-settlement vault. Multi-token per deployment (6-decimal stablecoins). One primitive: lock → deliver → verify → settle. |
| `VerifierRegistry.sol` | Owner-managed allow-list of verifier keys that may call `attest`. |

## State machine

```
None ─createJob─▶ Open ─fund─▶ Funded ─submit─▶ Submitted ─attest─▶ Attested
                                 │                  │                  │
                                 │ refundExpired    │ settle           │ settle / autoSettle
                                 ▼                  ▼                  ▼
                              Refunded           Settled            Settled
                                                    │                  │ resubmit (Fail, ≤2) → Submitted
                                                    │ dispute          │ dispute
                                                    ▼                  ▼
                                                 Disputed ─resolve(workerBps)─▶ Resolved
```

## Money model

- Per-token internal ledger: `balances[token][user]` (available) and `locked[token]` (held in jobs). `accounted[token] == Σ balances + locked`.
- Tokens leave the vault only through `withdraw`. `attest` never touches balances.
- Amounts are never stored or emitted. Each job carries `commit = keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))`; the amount is revealed in calldata by whoever settles, refunds, or resolves.
- `attributeDeposit` credits a user only from the *unattributed surplus* (`balanceOf(vault) − accounted`). This is how MPP charges, x402 settlements, and memo'd TIP-20 transfers that land directly in the vault become spendable balance.
- Fee (≤ 2%) is charged exactly once per job, at settle/autoSettle/resolve, and credited to `feeRecipient`'s balance.

## Roles

| Role | Can | Cannot |
|---|---|---|
| payer | createJob, fund, settle, dispute, withdraw | attest, resolve |
| worker | submit, resubmit, dispute, withdraw | settle |
| verifier (registry) | attest | move any funds |
| arbiter | resolve disputes with a split | touch non-disputed jobs |
| intake | attributeDeposit; createJob/fund *on behalf of a payer from that payer's own balance* | withdraw, settle, attest |
| owner | setRegistry, setArbiter, setIntake, setFee, setToken, pause | withdraw anyone's balance |

While paused: deposits, job creation/funding, submit, attest, settle, autoSettle, resubmit are blocked. **Withdraw, dispute, resolve, refundExpired keep working** so no one is trapped.

## Gasless actions

Every party action has a `...WithSig` twin (`submitWithSig`, `resubmitWithSig`, `settleWithSig`, `disputeWithSig`, `withdrawWithSig`) that takes an EIP-712 signature (domain `Vouch Vault` v1) and a per-signer sequential nonce, so a relayer can pay gas on Base. On Tempo, native fee sponsorship makes the plain functions gasless already. Signatures are checked with `SignatureChecker`, so ERC-1271 smart accounts work too.

## Tests

```
forge test                # 60 unit · 6 fuzz · 6 invariants
forge coverage --no-match-coverage "(test|script|mocks)"
forge snapshot
```

Invariants (see `test/invariant/`): solvency (`balanceOf ≥ Σbalances + locked`), ledger consistency, `attest` moves nothing, `autoSettle` succeeds iff every predicate holds, wrong reveals rejected, fee charged once, `locked` equals the sum of live jobs.

## Deploy

```
cp ../.env.example ../.env   # fill DEPLOYER_PRIVATE_KEY, ARBITER_ADDRESS, INTAKE_ADDRESS, VERIFIER_ADDRESS, FEE_RECIPIENT
forge script script/Deploy.s.sol --rpc-url moderato     --broadcast
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
forge script script/Deploy.s.sol --rpc-url tempo        --broadcast
forge script script/Deploy.s.sol --rpc-url base         --broadcast --verify
```

The script writes `deployments/<chainId>.json`; copy the addresses into `packages/abi/addresses.json`. Default token allow-lists: Tempo (4217/42431) pathUSD + USDC.e; Base (8453) USDC; Base Sepolia (84532) USDC. Override with `TOKENS=0x…,0x…`.

Tempo explorer: `https://explore.mainnet.tempo.xyz` (verification via the explorer's Sourcify-style upload — flatten with `forge flatten src/Vault.sol`).
