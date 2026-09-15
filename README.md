# Vouch

**Pay when it's delivered. Get paid when it's verified.**

Vouch is a conditional-settlement layer for agent and human work. A payer, human or AI agent, locks stablecoins against a written scope. An independent verifier agent compares the delivery to that scope and writes an evidence-backed attestation on-chain. Funds settle automatically under rules the payer chose, or on their approval. Any agent can use it in one tool call (MCP) or one HTTP request (MPP on Tempo, x402 on Base).

Built for the Colosseum Crypto World's Fair (Sept 14 – Oct 12, 2026). Tempo mainnet (4217) primary, Base mainnet (8453) secondary. First commit: Sept 14, 2026. Nothing copied from prior repos.

## The problem

Agent commerce today pays first: MPP and x402 answer "pay per call", and every pay-per-request service in the MPP directory hands over money before anyone checks the output. On the human side, 85% of freelancers report late payment and half of UK self-employed have completed work they were never paid for; most non-payment is a scope dispute with no neutral referee. The rails exist. The conditional layer does not.

## Five steps

1. **Lock** — payer writes the scope and locks the amount in the vault.
2. **Deliver** — worker submits; files are fingerprinted (sha256) and pinned before anyone reviews them.
3. **Verify** — the verifier agent compares delivery to scope and writes an attestation on-chain. It cannot move money.
4. **Settle** — funds release by payer approval, or automatically under the payer's policy (verdict, confidence, cap, review window).
5. **Dispute** — either party objects; an arbiter sees the same evidence and splits.

Not escrow: escrow is a box. Vouch is the judgment plus the settlement policy that lets money move without a human clicking. Not MPP/x402: Vouch sits on them. A Vouch job is *funded with* an MPP charge or an x402 payment.

## Try it

**Agent (Claude Code):**
```bash
claude mcp add vouch -e VOUCH_API_URL=https://vouch.dev -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @vouch/mcp
# then: "Use the hire_for_task prompt: summarise 3 PDFs into a 1-page brief, budget 5"
```

**Any HTTP client (Tempo):**
```bash
npx mppx https://vouch.dev/api/v1/jobs/<jobId>/fund -X POST     # 402 → pays the charge (memo = jobId) → 200 { status: "Funded", tx }
```

**Human:** open a job link, tap Pay (one sponsored transaction on Tempo, one USDC signature on Base), share the link with the worker.

**Unattended demo:** `examples/claude-code-payer` — payer agent creates + funds, worker agent delivers, verifier attests, Autopilot policy auto-settles. Zero clicks.

## Repository

| Path | What |
|---|---|
| [`contracts/`](contracts) | `Vault.sol`, `VerifierRegistry.sol`, Foundry unit/fuzz/invariant suites (100% line/branch), deploy script |
| [`packages/abi`](packages/abi) | ABIs, per-chain `addresses.json` |
| [`packages/shared`](packages/shared) | Types, zod schemas, policy presets, commitment/manifest/report hashing, EIP-712 types |
| [`packages/mcp`](packages/mcp) | `@vouch/mcp` — 8 tools, resources, `hire_for_task` prompt |
| [`apps/web`](apps/web) | Next.js service: REST `/api/v1`, MPP + x402 fund routes, verifier agent, indexer, relayer, timelock, web app S0–S7 |
| [`examples/`](examples) | Unattended payer demo, adversarial corpus, calibration harness |
| [`docs/`](docs) | [Architecture](docs/architecture.md) · [Threat model](docs/threat-model.md) · [Deploy](docs/deploy.md) |

## Contracts

| Chain | Vault | VerifierRegistry |
|---|---|---|
| Tempo 4217 | _pending deploy_ | _pending deploy_ |
| Tempo Moderato 42431 | _pending deploy_ | _pending deploy_ |
| Base 8453 | _pending deploy_ | _pending deploy_ |
| Base Sepolia 84532 | _pending deploy_ | _pending deploy_ |

Addresses are committed to `packages/abi/addresses.json` the day they are deployed, with explorer links and the deploy tx.

`Vault`: pooled multi-token ledger (`balances`, `locked`, `accounted`), jobs carry a commitment `keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))`, verifier is attest-only, settlement policy enforced on-chain (`autoSettle` reverts unless every predicate holds), disputes + arbiter split, `refundExpired`, `resubmit` (≤ 2), EIP-3009 deposits, surplus attribution for MPP/x402/memo payments, EIP-712 `*WithSig` relays, pause that never traps funds. See [contracts/README.md](contracts/README.md).

## Tempo integration
- **Fee sponsorship**: MPP pull-mode charges are co-signed by Vouch's feePayer; wallet-side funding uses a Tempo fee-payer service; humans never hold a fee token.
- **Batched transactions**: `approve → deposit → createJob → fund` in one atomic Tempo transaction from the payer's wallet.
- **Transfer memos**: any TIP-20 transfer to the vault with `memo = jobId` is attributed and funds the job — pay from any wallet.
- **MPP charge**: `POST /fund` is `tempo/charge`-gated with `memo = jobId`; handler runs only after payment is verified, reads the transfer from the receipt, attributes, funds. One round-trip.
- Stretch: virtual address per job; Private Zone payouts.

## Base integration
`POST /fund` speaks x402 (and the native evm/charge wire format): USDC EIP-3009 authorisation settled by the facilitator into the vault. Humans sign `ReceiveWithAuthorization` with a Privy embedded wallet; Vouch relays `depositWithAuthorization`. No ETH anywhere on the payer side.

## Verifier

Claude Sonnet 4.6, temperature 0, forced tool-use JSON, 60 s budget, ≤ 2 MB per artifact, no code execution. Inputs: scope verbatim, policy, pinned manifest, text/PDF/images, GitHub READMEs and PR diffs, Figma metadata, previous verdict on resubmission. Output: verdict, confidence, per-item checklist with evidence, questions, red flags. Post-rules: any `unverifiable` → NEEDS_REVIEW ≤ 0.6; instruction-like text → red flag, ≤ 0.5, never PASS.

**Threat model** — [docs/threat-model.md](docs/threat-model.md). Worst case for a payer: their own auto-cap on one job. Worst case for a worker: time.

### Calibration (adversarial corpus, rules layer only — model pass pending)

`pnpm --filter @vouch/web calibrate` on the 10 samples in `examples/adversarial`, without the model (a naive stand-in says PASS for anything non-empty, so this shows exactly what the rules alone guarantee):

| expected \ got | PASS | NEEDS_REVIEW | FAIL |
|---|---|---|---|
| NEEDS_REVIEW (8) | 2 | 6 | 0 |
| FAIL (2) | 1 | 0 | 1 |

All 7 injection samples flagged (10/10 flag decisions correct), confidence capped at ≤ 0.5 on every flagged one; 6/7 confidence caps met (the unverifiable-claims sample needs the model). The 3 wrong PASSes (unrelated content, partial delivery, unverifiable claims) are judgment calls the rules cannot make; they are the model's job and are re-run with `--model` before submission together with 20 real deliverables. No number is published here until it has been run.

## Privacy, stated honestly
Payer and worker addresses are in the job struct. Hidden on-chain: per-job amounts (commitment, until the amount appears in settlement calldata) and deposit → job linkage (deposits credit a balance; jobs draw from balance; payouts come from the vault). The web app gives every user a fresh embedded wallet so addresses carry no identity. Private Zone payouts on Tempo are the stretch goal.

## Run locally
See [docs/deploy.md](docs/deploy.md). In short: `pnpm install`, build `packages/abi` and `packages/shared`, fill `apps/web/.env`, `pnpm db:migrate`, `pnpm dev`. Contracts: `cd contracts && forge test`.

## Status against the build spec

| # | Feature | State |
|---|---|---|
| F1 | Vault + registry, 100% branch coverage, invariants | done (60 unit · 6 fuzz · 6 invariants × 10k calls) |
| F2 | Funding rails: Tempo batched, MPP charge, Base EIP-3009, x402 | implemented; mainnet tx links pending deploy |
| F3 | `@vouch/mcp` | implemented, stdio + HTTP; npm publish pending |
| F4 | Verifier + on-chain attestation | implemented |
| F5 | Settlement policy on-chain | done |
| F6 | Web app S0–S7 + motion system | implemented; Lighthouse run pending |
| F7 | Disputes + arbiter | implemented |
| F8 | Public job page + timeline | implemented, SSE ≤ 2 s after the service writes, ≤ 60 s via indexer |
| F9 | Unlinkable settlements | pooled vault + commitments; documented above |
| F10 | Observability | health, TxLog, verifier audit, Sentry, funnel |

Known gaps: job page first load is 209 kB gzipped (106 kB of it Next/React) against a 150 kB target; slither report not yet committed; remaining `[VERIFY]` items in the spec (Privy on 4217, mppx handler context, submission deadline) are re-checked on the day they are used.

Resolved Sept 15 from the Colosseum kickoff call: cross-chain submissions are allowed and a team can win any track it places in, but the track is decided by depth of integration. Tempo is the primary submission; the Base x402/EIP-3009 rail stays as built and gets no further UX work.

Launch wedge: judges and the pitch lead with agent services on the MPP directory hired from Claude Code with zero clicks; human beta users come from freelancers sharing a WhatsApp pay link. Tester conversations are logged in `docs/users.md`.

## Roadmap (out of scope for v1)
Third-party verifiers, worker bonds, Private Zone payouts, virtual deposit address per job, fiat rails, invoice financing on settlement history.

## License
MIT
