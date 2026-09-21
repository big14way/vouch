# Vouch

**Pay when it's delivered. Get paid when it's verified.**

Vouch is a conditional-settlement layer for agent and human work. A payer, human or AI agent, locks stablecoins against a written scope. An independent verifier agent compares the delivery to that scope and writes an evidence-backed attestation on-chain. Funds settle automatically under rules the payer chose, or on their approval. Any agent can use it in one tool call (MCP) or one HTTP request (MPP on Tempo, x402 on Base).

Built for the Colosseum Crypto World's Fair (Sept 14 – Oct 12, 2026). Tempo mainnet (4217) primary, Base mainnet (8453) secondary. First commit: Sept 14, 2026. Nothing copied from prior repos.

Live: **https://vouch-rouge.vercel.app** (testnets: Tempo Moderato 42431 + Base Sepolia 84532, Vault v4). MPP discovery at `/openapi.json` and `/llms.txt`.

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
claude mcp add vouch -e VOUCH_API_URL=https://vouch-rouge.vercel.app -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @gwilll/vouch-mcp
# then: "Use the hire_for_task prompt: summarise 3 PDFs into a 1-page brief, budget 5"
```

**Any HTTP client (Tempo):**
```bash
npx mppx https://vouch-rouge.vercel.app/api/v1/jobs/<jobId>/fund -X POST     # 402 → pays the charge (memo = jobId) → 200 { status: "Funded", tx }
```

**Human:** open a job link, tap Pay (one sponsored transaction on Tempo, one USDC signature on Base), share the link with the worker.

**Unattended demo:** `examples/claude-code-payer` — payer agent creates + funds, worker agent delivers, verifier attests, Autopilot policy auto-settles. Zero clicks.

## Repository

| Path | What |
|---|---|
| [`contracts/`](contracts) | `Vault.sol`, `VerifierRegistry.sol`, Foundry unit/fuzz/invariant suites (100% line/branch), deploy script |
| [`packages/abi`](packages/abi) | ABIs, per-chain `addresses.json` |
| [`packages/shared`](packages/shared) | Types, zod schemas, policy presets, commitment/manifest/report hashing, EIP-712 types |
| [`packages/mcp`](packages/mcp) | `@gwilll/vouch-mcp` — 8 tools, resources, `hire_for_task` prompt |
| [`apps/web`](apps/web) | Next.js service: REST `/api/v1`, MPP + x402 fund routes, verifier agent, indexer, relayer, timelock, web app S0–S7 |
| [`examples/`](examples) | Unattended payer demo, adversarial corpus, calibration harness |
| [`docs/`](docs) | [Architecture](docs/architecture.md) · [Threat model](docs/threat-model.md) · [Deploy](docs/deploy.md) |

## Contracts

| Chain | Vault | VerifierRegistry |
|---|---|---|
| Tempo 4217 | _pending deploy_ | _pending deploy_ |
| Tempo Moderato 42431 | [`0xaD15409d1B7EFA36a9898107fa9757E58a36442D`](https://explore.moderato.tempo.xyz/address/0xaD15409d1B7EFA36a9898107fa9757E58a36442D) (v4 with Earn + Zone payout, Sept 17; [deploy tx](https://explore.moderato.tempo.xyz/tx/0x7d1cb6a07b8c1161be42396363a66e227a4ce681a96e647bcaba09d9c269b5d5)) | [`0xBA8C173dB605414ea8b7bB5dbC57BA9724c70b9C`](https://explore.moderato.tempo.xyz/address/0xBA8C173dB605414ea8b7bB5dbC57BA9724c70b9C) |
| Base 8453 | _pending deploy_ | _pending deploy_ |
| Base Sepolia 84532 | [`0x9fA83aa77f155D3CC55Ca5034617313634a48fAd`](https://sepolia.basescan.org/address/0x9fA83aa77f155D3CC55Ca5034617313634a48fAd) (v4, Sept 17; [Sourcify match](https://repo.sourcify.dev/84532/0x9fA83aa77f155D3CC55Ca5034617313634a48fAd)) | [`0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca`](https://sepolia.basescan.org/address/0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca) ([Sourcify match](https://repo.sourcify.dev/84532/0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca)) |

Addresses are committed to `packages/abi/addresses.json` the day they are deployed, with explorer links and the deploy tx.

**Public deployment, Sept 21:** [`docs/e2e-service-public-2026-09-21.txt`](docs/e2e-service-public-2026-09-21.txt) is `examples/moderato-e2e/service.ts` run against https://vouch-rouge.vercel.app: create, MPP-funded, submitted, verified on-chain by Claude Sonnet 5 (NEEDS_REVIEW at 0.55 with an evidence-backed report stored in R2), approved and settled, 50 seconds end to end with every check passing.

**Two agents, no humans, Sept 17:** [`docs/e2e-agent-payer-moderato-2026-09-17.txt`](docs/e2e-agent-payer-moderato-2026-09-17.txt) is `examples/claude-code-payer` run unattended against the service on Moderato: the payer agent creates a $5 job and pays the 402 with an MPP charge, the worker agent submits the pinned deliverable, all in 27 seconds and three transactions. The verifier stage reports `failed` in that run because no model key is configured yet, so the job waits for payer review instead of auto-settling.

**Service layer live on Moderato, Sept 16:** [`docs/e2e-service-moderato-2026-09-16.txt`](docs/e2e-service-moderato-2026-09-16.txt) drives the REST API with the `@gwilll/vouch-mcp` client: wallet-bound API key → `POST /jobs` → `POST /fund` answered with a 402, paid by mppx as a Tempo charge with `memo = jobId`, attributed and funded by intake in the same round-trip → worker's relayed `submitWithSig` → payer's relayed `settleWithSig` → timeline, indexer and timelock crons. The indexer backfilled every Vault event since deployment (72 events, 13 kinds) and linked the job's four. The verifier stage reports `failed: ANTHROPIC_API_KEY not configured` in that run, as designed without a model key.

**Live on Moderato, Sept 15:** [`docs/e2e-moderato-2026-09-15.txt`](docs/e2e-moderato-2026-09-15.txt) is a full run of `examples/moderato-e2e` against the deployed contracts, 15 transactions with explorer links: wallet-path job (approve → deposit → createJob → fund → submit → attest PASS → autoSettle → withdraw of real pathUSD) and memo-path job (`transferWithMemo` into the vault → intake attribution → job created and funded on the payer's behalf → open worker submits → NEEDS_REVIEW → payer-signed, relayer-sent `settleWithSig`). Tempo deploy notes (gas per byte, 30M cap, `--network tempo` fork caveat) are in [contracts/README.md](contracts/README.md).

`Vault` v4 (Sept 17) adds Earn while locked (F11) and private payouts into Tempo Zones (F12); the earlier addresses (v1 Sept 15, v2/v3 Sept 17) stay in `contracts/deployments/*.json` for the earlier evidence logs.

`Vault`: pooled multi-token ledger (`balances`, `locked`, `accounted`), jobs carry a commitment `keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))`, verifier is attest-only, settlement policy enforced on-chain (`autoSettle` reverts unless every predicate holds), disputes + arbiter split, `refundExpired`, `resubmit` (≤ 2), EIP-3009 deposits, surplus attribution for MPP/x402/memo payments, EIP-712 `*WithSig` relays, pause that never traps funds. See [contracts/README.md](contracts/README.md).

## Tempo integration
- **Fee sponsorship**: MPP pull-mode charges are co-signed by Vouch's feePayer; wallet-side funding uses a Tempo fee-payer service; humans never hold a fee token.
- **Batched transactions**: `approve → deposit → createJob → fund` in one atomic Tempo transaction from the payer's wallet. Proven live on Moderato, Sept 16 ([log](docs/e2e-moderato-batched-2026-09-16.txt)): one transaction, job Funded, payer's pathUSD moved by exactly the job amount, fee paid by the Vouch feePayer key (2,543 base units); the same batch was also accepted by Tempo's public sponsor service.
- **Transfer memos**: any TIP-20 transfer to the vault with `memo = jobId` is attributed and funds the job — pay from any wallet.
- **MPP charge**: `POST /fund` is `tempo/charge`-gated with `memo = jobId`; handler runs only after payment is verified, reads the transfer from the receipt, attributes, funds. One round-trip.
- **Earn while locked (F11)**: a payer can have the locked principal sit in a Tempo Earn vault while the work happens. The Vault deposits at `fund`, recalls exactly the principal with `withdrawExact` at settle/refund/resolve, and credits the leftover shares (the yield) to the payer; a venue shortfall is charged to the payer's balance before the worker is short. Proven live on Moderato, Sept 17 ([log](docs/e2e-earn-moderato-2026-09-17.txt)): principal into the venue, exact recall, yield shares to the payer, and the same flow funded by an MPP charge through the API. Honest note: both Tempo testnet pathUSD Earn vaults currently revert deposits with a stale-price error, and the Vault handles that by funding without Earn (`JobEarnSkipped`); the live proof therefore uses a clearly labelled demo venue (`MockEarnVault`) with simulated yield. Mainnet vaults are allow-listed by Tempo; the ask is in the spec.
- **Discovery**: MPP discovery document at [`/openapi.json`](apps/web/src/lib/openapi.ts) (`x-payment-info.offers[]` on the fund route, `x-service-info`, `llms.txt`), validated in CI with mppx's validator. Listing on MPPScan and the mpp.dev directory is prepared in [docs/mpp-listing.md](docs/mpp-listing.md) and waits only on the public deploy.
- **Private payout via Tempo Zone (F12, testnet-only)**: a worker (or any user) moves an Available balance straight into Tempo Zone A with `withdrawToZone`. The recipient and the job memo are encrypted in the browser to the zone sequencer and the Vault calls the Zone Portal, so the public chain shows only Vault → Portal and the amount; the credit is visible only to the recipient's signed zone session. Proven live on Moderato, Sept 17 ([log](docs/e2e-zone-moderato-2026-09-17.txt)): encrypted deposit from the Vault, portal event with the Vault as sender, private Zone A balance up by the full amount within seconds. Honest notes: Zones are testnet-only, and the Zone A portal is an older build (4-argument `depositEncrypted`, pre-August encryption scheme, refunds return to the Vault as surplus that intake attributes back). The Vault marks such portals with `legacyZonePortal` and the client builds the matching payload; a payload built for the wrong generation is accepted on-chain but never credited, which cost one $2 test deposit before the scheme was pinned down.
- Stretch: virtual address per job; zone-funded jobs (Vault as withdrawal receiver).

## Base integration
`POST /fund` speaks x402 (and the native evm/charge wire format): USDC EIP-3009 authorisation settled by the facilitator into the vault. Humans sign `ReceiveWithAuthorization` with a Privy embedded wallet; Vouch relays `depositWithAuthorization`. No ETH anywhere on the payer side.

## Verifier

Claude Sonnet 4.6, temperature 0, forced tool-use JSON, 60 s budget, ≤ 2 MB per artifact, no code execution. Inputs: scope verbatim, policy, pinned manifest, text/PDF/images, GitHub READMEs and PR diffs, Figma metadata, previous verdict on resubmission. Output: verdict, confidence, per-item checklist with evidence, questions, red flags. Post-rules: any `unverifiable` → NEEDS_REVIEW ≤ 0.6; instruction-like text → red flag, ≤ 0.5, never PASS.

**Threat model** — [docs/threat-model.md](docs/threat-model.md). Worst case for a payer: their own auto-cap on one job. Worst case for a worker: time.

### Calibration (19 samples, model + rules, Sept 21)

`pnpm --filter @vouch/web calibrate --model` over the 10 adversarial samples in `examples/adversarial` plus 9 job samples in `examples/calibration` (5 acceptable deliveries: a sourced brief, landing copy, a Python function with tests, a CSV clean-up, a French translation; 3 realistic near-misses; 1 invoice sent instead of the work). The 9 are **synthetic**, written by the team on Sept 21 so the PASS row is not empty; field samples replace them as testers' jobs come in. Three configurations were run over all 19, then each three more times over the 9 job samples to check the result is stable ([repeat runs](docs/calibration-2026-09-21-repeats.md)). Transcripts with the model's reasoning: [Sonnet 4.6](docs/calibration-2026-09-21-claude-sonnet-4-6.txt), [Sonnet 5, thinking off](docs/calibration-2026-09-21-claude-sonnet-5.txt), [Sonnet 5, adaptive thinking](docs/calibration-2026-09-21-claude-sonnet-5-adaptive.txt). Rows are the human label, columns what the verifier returned after the rules layer.

| expected \ got | Sonnet 4.6: PASS | NEEDS_REVIEW | FAIL | Sonnet 5 (thinking off): PASS | NEEDS_REVIEW | FAIL | **Sonnet 5 + adaptive thinking (production):** PASS | NEEDS_REVIEW | FAIL |
|---|---|---|---|---|---|---|---|---|---|
| PASS (5) | 5 | 0 | 0 | 3 | 2 | 0 | **4** | 1 | 0 |
| NEEDS_REVIEW (11) | 0 | 9 | 2 | 0 | 8 | 3 | 0 | 8 | 3 |
| FAIL (3) | 0 | 1 | 2 | 0 | 1 | 2 | 0 | 1 | 2 |

| | Sonnet 4.6 | Sonnet 5, thinking off | **Sonnet 5, adaptive thinking** |
|---|---|---|---|
| wrong PASS (the only outcome that can move money) | **0** | **0** | **0** |
| good deliveries released at ≥ 0.90, full run | 5/5 | 3/5 | 4/5 |
| good deliveries released, three repeat runs on the 9 job samples | 4/5, 4/5, 4/5 | 2/5, 2/5, 3/5 | 4/5, 4/5, 4/5 |
| accuracy, full run | 16/19 | 13/19 | 14/19 |
| injection samples flagged | 7/7 | 7/7 | 7/7 |
| schema-invalid verdicts | 0 | 0 | 0 |
| tokens for the 19 runs (in / out) | 41,956 / 12,436 | 50,355 / 16,727 | 50,355 / 14,977 |
| cost for the 19 runs at list price | $0.31 | $0.27 | $0.25 |

No configuration produced a wrong PASS in any of the twelve runs. Every miss is in the safe direction: a NEEDS_REVIEW sample judged FAIL, the unrelated-content FAIL held at NEEDS_REVIEW, or a good delivery held for review. Sonnet 4.6 and Sonnet 5 with thinking on behave the same on the release path (four of five, stable across repeats; the 5/5 in the 4.6 full run did not repeat); Sonnet 5 with thinking off holds two or three of five, on a row count it gets wrong. **Production runs Sonnet 5 with adaptive thinking at medium effort** (`VERIFIER_THINKING=adaptive`, `VERIFIER_EFFORT=medium`): same release rate and safety as 4.6, current generation, a third cheaper per token, about 15 s per verification.

The one good delivery every configuration holds is the landing copy, whose scope sets word limits: the models miscount or add a limit the scope does not state, and the rules turn that into a hold at 0.60. Scopes with tight word or character limits are where verification is least reliable, and the failure mode is a review, never a release.

Two harness defects were found and fixed on the way, both worth knowing: the first synthetic run had Sonnet 5 flag every good delivery because the harness built a manifest declaring each file as 0 bytes, and the model correctly noticed the contradiction (production manifests carry real sizes); and `red_flags` had no definition, so the model used it for any concern, which the rules layer treats as manipulation. The field now says manipulation and fraud only, and the prompt tells the verifier not to add requirements the scope does not state. The rules-only pass (naive stand-in that says PASS to anything non-empty) shows 7 wrong PASSes on the same set, which is the gap the model closes.

## Privacy, stated honestly
Payer and worker addresses are in the job struct. Hidden on-chain: per-job amounts (commitment, until the amount appears in settlement calldata) and deposit → job linkage (deposits credit a balance; jobs draw from balance; payouts come from the vault). The web app gives every user a fresh embedded wallet so addresses carry no identity. On Tempo testnet a payout can leave the Vault straight into Zone A with the recipient encrypted (F12), so the public ledger never shows who was paid.

## Run locally
See [docs/deploy.md](docs/deploy.md). In short: `pnpm install`, build `packages/abi` and `packages/shared`, fill `apps/web/.env`, `pnpm db:migrate`, `pnpm dev`. Contracts: `cd contracts && forge test`.

## Status against the build spec

| # | Feature | State |
|---|---|---|
| F1 | Vault + registry, 100% branch coverage, invariants | done (60 unit · 6 fuzz · 6 invariants × 10k calls) |
| F2 | Funding rails: Tempo batched, MPP charge, Base EIP-3009, x402 | implemented; contracts live on Moderato and Base Sepolia (Sept 15); mainnets pending |
| F3 | `@gwilll/vouch-mcp` | implemented, stdio + HTTP; its client drove the live service run on Moderato; npm publish pending |
| F4 | Verifier + on-chain attestation | implemented |
| F5 | Settlement policy on-chain | done; autoSettle and settleWithSig exercised live on Moderato |
| F6 | Web app S0–S7 + motion system | implemented; Lighthouse run pending |
| F7 | Disputes + arbiter | implemented |
| F8 | Public job page + timeline | implemented; indexer proven on Moderato (backfill from deployment block, events linked to jobs); SSE ≤ 2 s after the service writes |
| F9 | Unlinkable settlements | pooled vault + commitments; documented above |
| F10 | Observability | health, TxLog, verifier audit, Sentry, funnel |
| F11 | Earn while locked + idle-balance Earn | contracts done (17 tests, invariants with yield/loss), API + MCP + picker done, live on Moderato with a demo venue; real venue pending Tempo allow-list |
| F12 | Private payout via Tempo Zone | contracts done (7 tests: legacy + current portal shapes, WithSig binds the payload), API route + withdraw-page card, live on Moderato Zone A with the private balance credited; testnet-only, behind `ZONES_ENABLED` |

Known gaps: job page first load is 244 kB (106 kB of it Next/React) against a 150 kB target; Slither triage is in [docs/slither-2026-09-17.md](docs/slither-2026-09-17.md) (33 results, none blocking, two hardening items queued for the mainnet release); remaining `[VERIFY]` items in the spec (Privy on 4217, mppx handler context, submission deadline) are re-checked on the day they are used.

Resolved Sept 15 from the Colosseum kickoff call: cross-chain submissions are allowed and a team can win any track it places in, but the track is decided by depth of integration. Tempo is the primary submission; the Base x402/EIP-3009 rail stays as built and gets no further UX work.

Launch wedge: judges and the pitch lead with agent services on the MPP directory hired from Claude Code with zero clicks; human beta users come from freelancers sharing a WhatsApp pay link. Tester conversations are logged in `docs/users.md`.

## Roadmap (out of scope for v1)
Third-party verifiers, worker bonds, zone-funded jobs, virtual deposit address per job, fiat rails, invoice financing on settlement history.

## License
MIT
