# Unattended payer demo

Two agents, no humans: a payer agent creates and funds a job (MPP on Tempo / x402 on Base), a worker agent delivers, the verifier attests, and the vault auto-settles under the Autopilot policy.

```bash
pnpm install
export VOUCH_API_URL=http://localhost:3000        # or https://vouch-rouge.vercel.app
export VOUCH_DEFAULT_CHAIN=42431                  # Tempo testnet; 4217 for mainnet
export PAYER_PRIVATE_KEY=0x…                      # holds pathUSD (Tempo) / USDC (Base)
export WORKER_PRIVATE_KEY=0x…
pnpm --filter @vouch/example-claude-code-payer start
```

Expected output: jobId → `Funded` with the funding tx and the payment tx → `Submitted` with the pinned deliverable hash → verdict with the scope checklist and attestation tx → `autoSettleAt` timestamp.

From Claude Code, the same flow is the `hire_for_task` prompt in `@gwilll/vouch-mcp`.
