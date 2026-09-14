# Architecture

```
 AGENTS                                   HUMANS
 Claude Code / Codex / Cursor             Web app (Next.js 15, PWA)
 ┌───────────┐ ┌───────────┐ ┌─────────┐  ┌──────────────────────────┐
 │ @vouch/mcp│ │ mppx      │ │ x402    │  │ Privy (email/Google →    │
 │ (stdio /  │ │ client    │ │ client  │  │ embedded wallet)         │
 │  http)    │ │           │ │         │  │ Tempo Wallet (batched tx)│
 └─────┬─────┘ └─────┬─────┘ └────┬────┘  └────────────┬─────────────┘
       └─────────────┴────────────┴────────────────────┘
                              │ https
 ┌────────────────────────────▼──────────────────────────────────────┐
 │ apps/web  (Next.js route handlers)                                │
 │  REST /api/v1 · SSE /events · OpenAPI                             │
 │  /fund: mppx tempo/charge (memo=jobId) · evm/charge (x402, Base)  │
 │  relayer (serialised nonces, TxLog) · intake · verifier key       │
 │  verifier agent (Anthropic, forced tool JSON, post-rules)         │
 │  indexer (poll + Alchemy webhook) · timelock cron · Prisma/Neon   │
 │  R2 (pinned files, reports) · Resend · Sentry                     │
 └──────┬───────────────────────────────────┬────────────────────────┘
        │                                   │
 ┌──────▼──────────┐               ┌────────▼────────┐
 │ TEMPO 4217/42431│               │ BASE 8453/84532 │
 │ Vault.sol       │               │ Vault.sol       │
 │ pathUSD, USDC.e │               │ USDC (EIP-3009) │
 │ TIP-20 memos    │               │                 │
 │ fee sponsorship │               │                 │
 └─────────────────┘               └─────────────────┘
```

## One codebase, two deployments
`Vault.sol` is deployed unchanged on Tempo and Base. It takes a per-chain token allow-list (all 6-decimal). `packages/abi/addresses.json` maps chain id → addresses; `VAULT_ADDRESS_<chainId>` env overrides.

## Money flow
1. **Deposit** — `deposit` (approve + transferFrom), `depositWithAuthorization` (Base USDC EIP-3009, relayed), or a direct transfer into the vault (MPP charge, x402 settlement, memo'd TIP-20 transfer) that the `intake` key attributes from the *unattributed surplus*. Every path ends as `balances[token][user]`.
2. **Lock** — `createJob` + `fund` move balance into `locked`. Amount is hidden behind `commit`. On Tempo a wallet can do approve → deposit → createJob → fund in one sponsored batched transaction; server-mediated routes have `intake` create + fund on the payer's behalf from the payer's own balance.
3. **Deliver** — files are sha256'd and stored; `deliverableHash = keccak256(canonical core)` is signed by the worker (EIP-712 `Submit`) and relayed.
4. **Verify** — the verifier key calls `attest(jobId, verdict, confidenceBps, attestationHash)`. No funds move.
5. **Settle** — `settleWithSig` (payer), `autoSettle` (anyone, only if every policy predicate holds, run by the timelock cron), `resolve` (arbiter split), `refundExpired`. Payouts credit balances; `withdraw`/`withdrawWithSig` moves tokens out.

## Fund routes
| Chain | Route | Mechanics |
|---|---|---|
| Tempo | MPP charge (agents) | `POST /fund` → 402 (tempo/charge, `memo = jobId`, feePayer sponsored) → client pays → server reads the tx receipt, attributes, funds → 200 |
| Tempo | Tempo wallet (humans) | one batched, sponsored tx; `POST /fund/confirm { txHash }` syncs |
| Tempo | Any wallet | transfer to vault with `memo = jobId`; indexer attributes; or `/fund/confirm` |
| Base | x402 / evm charge (agents) | `POST /fund` → 402 with EIP-3009 requirements → facilitator settles `transferWithAuthorization` into the vault → attribute + fund |
| Base | USDC signature (humans) | `ReceiveWithAuthorization` signed by the Privy wallet → `POST /fund/eip3009` relays `depositWithAuthorization` → fund |
| Both | Balance | if the payer already has enough vault balance, `fund` directly |

## Roles and keys
| Key | Used for | Blast radius |
|---|---|---|
| `INTAKE_PRIVATE_KEY` | attributeDeposit, createJob/fund on behalf of payers | can mis-assign surplus or lock a payer's own balance into that payer's job; cannot withdraw |
| `VERIFIER_PRIVATE_KEY` | attest | verdict only; bounded by the payer's policy |
| `RELAYER_PRIVATE_KEY` | relay signed actions, autoSettle, refundExpired, Base EIP-3009 deposits | gas; every call is signature- or predicate-gated on-chain |
| `TEMPO_FEEPAYER_PRIVATE_KEY` | MPP pull-mode sponsorship | pays fees only |
| `ARBITER_PRIVATE_KEY` / `ARBITER_ADDRESS` | resolve | disputed jobs only |
| `JOB_SECRETS_KEY` | AES-256-GCM for amount + salt at rest | reveals amounts if leaked (never funds) |

## Indexing
Polling every minute (cron) over the vault's logs and `TransferWithMemo(to = vault)` on the allow-listed tokens; Alchemy webhook on Base pushes the same logs. Events are unique on (chain, tx, logIndex); job state only moves forward. The service writes state immediately when it sends a transaction, so the UI is usually ahead of the indexer; SSE pushes snapshots every 2 s.

## Observability
`/api/v1/health` (chain heads, indexer lag, relayer balances with low flag, verifier queue), `TxLog` for every transaction the service sends, `Verdict` rows with prompt/response hashes and stage, Sentry on every unhandled error, funnel events for the pitch numbers (`/api/v1/stats`).
