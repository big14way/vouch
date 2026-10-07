# Vouch

**Pay when it's delivered. Get paid when it's verified.**

Vouch is a conditional-settlement layer for work done by people and by AI agents. A payer locks stablecoins against a written scope. The worker delivers. An independent verifier agent checks the delivery against the scope and records its verdict on-chain. The money then settles under rules the payer chose, or on the payer's approval, and either side can take a disagreement to an arbiter. An agent uses Vouch with one MCP tool call or one HTTP request, funded over MPP on Tempo or x402 on Base.

| | |
|---|---|
| Live product | **https://vouchhq.vercel.app** (Tempo Moderato and Base Sepolia, test money only) |
| Try it as a worker | https://vouchhq.vercel.app/try: open test jobs with $5 of test pathUSD locked |
| Demo video (1:52) | https://youtu.be/k5toO06qlC0 |
| Pitch video (1:57) | https://youtu.be/jyHFoB0QfXE |
| Agent package | [`@gwilll/vouch-mcp`](https://www.npmjs.com/package/@gwilll/vouch-mcp) on npm |
| Agent discovery | [`/openapi.json`](https://vouchhq.vercel.app/openapi.json) · [`/llms.txt`](https://vouchhq.vercel.app/llms.txt) · [For agents](https://vouchhq.vercel.app/docs) |

Built solo for the Colosseum Crypto World's Fair (Sept 14 to Oct 12, 2026). Tempo is the primary integration, Base the secondary one. First commit Sept 14; nothing is copied from earlier repositories.

## At a glance

- **Two outside users have been paid through it.** Each took an open job on the live product, delivered, passed the verifier (93% and 95%, every scope item met) and was paid automatically under the job's policy, with every step on-chain. Everything they reported was fixed the same day. See [Users](#users).
- **The verifier can never move money.** It only attests; settlement rules are enforced by the contract. Across the calibration runs it never released a delivery that should have been held. See [Verifier](#verifier).
- **Deep on Tempo.** Fee-sponsored batched funding, MPP charges answered with `memo = jobId`, transfer-memo funding from any wallet, Earn while funds are locked, and private payouts into a Tempo Zone, each proven by a logged run with transaction links. See [Tempo integration](#tempo-integration).
- **Testnet by decision.** The organisers did not ask for mainnet, so the final weeks went to users and the verifier. The mainnet deploy is the same script with a fee-sponsor key and an Earn allow-list ([docs/deploy.md](docs/deploy.md)).

## The problem

Agent payment rails pay first. MPP and x402 answer "pay per call", and a pay-per-request service is paid before anyone checks what it returned. People who work for clients have the same problem from the other side: 85% of freelancers report being paid late (Remote, State of Freelance Work 2025), and half of the UK's self-employed have done work they were never paid for (IPSE). Most non-payment is a dispute about scope with no neutral referee. The payment rails exist; the conditional layer between "paid" and "done" does not.

## How it works

1. **Lock.** The payer writes the scope and locks the amount in the Vault.
2. **Deliver.** The worker submits. Files are fingerprinted (sha256) and pinned before anyone reviews them, so what is sent is what gets judged.
3. **Verify.** The verifier agent compares the delivery with the scope and writes an attestation on-chain: verdict, confidence and the hash of a per-item report. It cannot move money.
4. **Settle.** Funds release on the payer's approval, or automatically when the payer's policy allows it: verdict, minimum confidence, amount cap and review window, all checked by the contract.
5. **Dispute.** Either side can object. An arbiter sees the same evidence and decides the split.

Vouch is not escrow: escrow holds money, Vouch adds the judgment and the policy that let money move without anyone clicking. It does not compete with MPP or x402 either; a Vouch job is funded with an MPP charge or an x402 payment.

## Try it

**As a worker (no wallet, no gas):** open https://vouchhq.vercel.app/try, take a task, sign in with any email, deliver on the page and watch the check run. A delivery scored 85% or more is paid automatically 15 minutes later.

**As an agent (Claude Code):**
```bash
claude mcp add vouch -e VOUCH_API_URL=https://vouchhq.vercel.app \
  -e VOUCH_AGENT_PRIVATE_KEY=0x… -e VOUCH_DEFAULT_CHAIN=42431 -- npx -y @gwilll/vouch-mcp
# then: "Use the hire_for_task prompt: summarise 3 PDFs into a 1-page brief, budget 5"
```
Use a fresh key that holds only test funds.

**From any HTTP client (Tempo MPP):**
```bash
npx mppx https://vouchhq.vercel.app/api/v1/jobs/<jobId>/fund -X POST
# 402 → the charge is paid with memo = jobId → 200 { "status": "Funded", "tx": "0x…" }
```

**Unattended:** [`examples/claude-code-payer`](examples/claude-code-payer) runs a payer agent that creates and funds a job, a worker agent that delivers, the verifier, and automatic settlement, with no clicks.

## Users

Two people outside the team have used Vouch end to end, as workers on open jobs:

| Date | User | Result |
|---|---|---|
| Oct 4 | Sundram Mahajan (TxWhy) | Instagram caption job: PASS 0.93, paid automatically |
| Oct 6 | Endrew from Chroma (chromalaunch.fun) | Logo concept job: PASS 0.95, 4 of 4 scope items, paid automatically |

Both agreed to be named. [docs/users.md](docs/users.md) records each conversation: what broke first, then what worked. What they changed, each shipped the day it was reported:

- Sign-in is email only. Google was offered but not enabled, and it dead-ended on the first click.
- An open job shows its amount, and what the worker receives after the fee, to anyone who might take it.
- A verifier failure is shown as one plain sentence, and a budget or rate-limit failure no longer uses up a retry.
- If the wallet is not created at login, onboarding creates it on the click, with a 20-second timeout, a plain reason and a retry, instead of a button stuck on "Creating your wallet…".
- Job terms read in plain words: "Automatic when the verifier scores the delivery 85% or more, 15m after the check"; "Tempo Moderato (test network)".
- The job list groups copies of a task with an open-slot count, and says up front that every verdict is recorded on-chain before money moves.

## Contracts

| Chain | Vault | VerifierRegistry |
|---|---|---|
| Tempo Moderato 42431 | [`0xaD15409d1B7EFA36a9898107fa9757E58a36442D`](https://explore.moderato.tempo.xyz/address/0xaD15409d1B7EFA36a9898107fa9757E58a36442D) (v4, [deploy tx](https://explore.moderato.tempo.xyz/tx/0x7d1cb6a07b8c1161be42396363a66e227a4ce681a96e647bcaba09d9c269b5d5)) | [`0xBA8C173dB605414ea8b7bB5dbC57BA9724c70b9C`](https://explore.moderato.tempo.xyz/address/0xBA8C173dB605414ea8b7bB5dbC57BA9724c70b9C) |
| Base Sepolia 84532 | [`0x9fA83aa77f155D3CC55Ca5034617313634a48fAd`](https://sepolia.basescan.org/address/0x9fA83aa77f155D3CC55Ca5034617313634a48fAd) (v4, [Sourcify](https://repo.sourcify.dev/84532/0x9fA83aa77f155D3CC55Ca5034617313634a48fAd)) | [`0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca`](https://sepolia.basescan.org/address/0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca) ([Sourcify](https://repo.sourcify.dev/84532/0xCD4f2A717F5cC11607d9d0C2F0501B4Caf040Bca)) |

Addresses live in [`packages/abi/addresses.json`](packages/abi/addresses.json); earlier versions stay in `contracts/deployments/` for the evidence logs that used them. Vault v5, in this repository, adds the Earn-venue hardening below and ships with the mainnet deploy.

The **Vault** is a pooled multi-token ledger (`balances`, `locked`, `accounted`). A job is stored as a commitment, `keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))`. The verifier can only attest. `autoSettle` reverts unless every predicate of the payer's policy holds. It also implements disputes with an arbiter split, `refundExpired`, up to two resubmissions, EIP-3009 deposits, attribution of MPP, x402 and memo payments, EIP-712 `*WithSig` relays, and a pause that never traps funds. Details in [contracts/README.md](contracts/README.md).

**Tests:** 106 Foundry tests (94 unit, 6 fuzz, 6 invariants at 10k calls each), 99% branch coverage. Slither triage: [docs/slither-2026-09-17.md](docs/slither-2026-09-17.md), 33 results, none blocking.

## Tempo integration

- **Fee sponsorship and batched funding.** `approve → deposit → createJob → fund` runs as one atomic Tempo transaction from the payer's wallet, with the fee paid by Vouch's fee payer, so people never hold a fee token ([log, Sept 16](docs/e2e-moderato-batched-2026-09-16.txt)).
- **MPP charge.** `POST /fund` is gated by a `tempo/charge` with `memo = jobId`; the handler runs only after the payment is verified, reads the transfer from the receipt and funds the job in the same round-trip ([log, Sept 16](docs/e2e-service-moderato-2026-09-16.txt)).
- **Transfer memos.** Any TIP-20 transfer to the Vault with `memo = jobId` is attributed and funds the job, so a payer can pay from any wallet ([log, Sept 15](docs/e2e-moderato-2026-09-15.txt)).
- **Earn while locked.** The locked principal can sit in a Tempo Earn vault while the work happens; the exact principal is recalled at settlement and the yield goes to the payer. Proven on a labelled demo venue on Sept 17 ([log](docs/e2e-earn-moderato-2026-09-17.txt)). On Oct 4 Tempo's team pointed us at a working Moderato Earn vault; the v4 Vault could not recall from it because the venue burns shares through an allowance v4 never granted. Vault v5 approves the share token before every recall, writes a failing venue off instead of blocking a payout, and was proven against that venue the same day ([log](docs/e2e-earn-moderato-2026-10-04-v5.txt), instance `0x6fEdf025FE10D5F411A0483696898BD33638039f`).
- **Private payouts into Tempo Zone A** (testnet only). A worker can move their balance straight into Zone A: the recipient is encrypted in the browser to the zone sequencer, so the public chain shows only Vault → Portal and the amount ([log, Sept 17](docs/e2e-zone-moderato-2026-09-17.txt)).
- **Discovery.** MPP discovery document at `/openapi.json` (with `x-payment-info` on the fund route) and `/llms.txt`, validated in CI with mppx's validator. Directory listing text: [docs/mpp-listing.md](docs/mpp-listing.md).

## Base integration

`POST /fund` also speaks x402: a USDC EIP-3009 authorisation settled into the Vault. People sign `ReceiveWithAuthorization` with an embedded wallet and Vouch relays `depositWithAuthorization`, so no ETH is needed on the payer side. Same contracts on Base Sepolia, kept deliberately shallow.

## Verifier

Claude Sonnet 5 with adaptive thinking at medium effort, a strict tool-use schema, a 60-second budget, up to 2 MB per artifact, and no code execution. Inputs: the scope verbatim, the payment policy, the pinned delivery manifest, text, PDFs, images, GitHub READMEs and PR diffs, Figma metadata, and the previous verdict on a resubmission. Output: verdict, confidence, a per-item checklist with evidence, questions and red flags. A rules layer then applies two hard limits: anything unverifiable becomes NEEDS_REVIEW at 0.6 or below, and text that tries to instruct the verifier is a red flag, capped at 0.5 and never a PASS. A verification costs $0.05 to $0.12 and takes about 15 seconds.

Threat model: [docs/threat-model.md](docs/threat-model.md). The worst case for a payer is their own automatic-release cap on one job; the worst case for a worker is time.

### Calibration (19 samples, Sept 21)

10 adversarial samples ([`examples/adversarial`](examples/adversarial), including prompt-injection attempts) and 9 job samples ([`examples/calibration`](examples/calibration): 5 acceptable deliveries, 3 near-misses, 1 invoice sent instead of the work). The 9 job samples are **synthetic**, written by the team; the two users' deliveries above are the first real ones. Three model configurations were run over all 19, then three more times over the 9 job samples to check stability ([repeat runs](docs/calibration-2026-09-21-repeats.md)). Full transcripts: [Sonnet 4.6](docs/calibration-2026-09-21-claude-sonnet-4-6.txt), [Sonnet 5, thinking off](docs/calibration-2026-09-21-claude-sonnet-5.txt), [Sonnet 5, adaptive thinking](docs/calibration-2026-09-21-claude-sonnet-5-adaptive.txt).

| | Sonnet 4.6 | Sonnet 5, thinking off | **Sonnet 5, adaptive (production)** |
|---|---|---|---|
| Wrong PASS (the only outcome that can move money) | **0** | **0** | **0** |
| Good deliveries released at ≥ 0.90, full run | 5/5 | 3/5 | 4/5 |
| Good deliveries released, three repeat runs | 4/5, 4/5, 4/5 | 2/5, 2/5, 3/5 | 4/5, 4/5, 4/5 |
| Accuracy, full run | 16/19 | 13/19 | 14/19 |
| Injection attempts flagged | 7/7 | 7/7 | 7/7 |
| Schema-invalid verdicts | 0 | 0 | 0 |
| Cost of the 19 runs | $0.31 | $0.27 | $0.25 |

<details>
<summary>Confusion matrices and findings</summary>

| expected \ got | 4.6: PASS | NEEDS_REVIEW | FAIL | 5, off: PASS | NEEDS_REVIEW | FAIL | **5, adaptive: PASS** | NEEDS_REVIEW | FAIL |
|---|---|---|---|---|---|---|---|---|---|
| PASS (5) | 5 | 0 | 0 | 3 | 2 | 0 | **4** | 1 | 0 |
| NEEDS_REVIEW (11) | 0 | 9 | 2 | 0 | 8 | 3 | 0 | 8 | 3 |
| FAIL (3) | 0 | 1 | 2 | 0 | 1 | 2 | 0 | 1 | 2 |

No configuration produced a wrong PASS in any of the twelve runs; every miss is in the safe direction. The one good delivery every configuration holds is landing copy with word limits: the models miscount, and the rules turn that into a hold at 0.60. Scopes with tight word or character limits are where verification is least reliable, and the failure is a review, never a release. Two harness defects were found and fixed along the way: a manifest that declared every file as 0 bytes (the model correctly flagged the contradiction), and an undefined `red_flags` field, now limited to manipulation and fraud. A rules-only baseline that passes anything non-empty makes 7 wrong PASSes on the same set; that is the gap the model closes.
</details>

## Evidence

Every claim above links to a run log with transaction links. The main ones:

| Date | Run | Log |
|---|---|---|
| Sept 15 | Wallet-path and memo-path jobs on Moderato, 15 transactions | [e2e-moderato-2026-09-15](docs/e2e-moderato-2026-09-15.txt) |
| Sept 16 | One batched, fee-sponsored funding transaction | [e2e-moderato-batched-2026-09-16](docs/e2e-moderato-batched-2026-09-16.txt) |
| Sept 16 | REST API driven by the MCP client, MPP-funded, relayed settlement | [e2e-service-moderato-2026-09-16](docs/e2e-service-moderato-2026-09-16.txt) |
| Sept 17 | Two agents, no humans: payer agent funds over MPP, worker agent delivers | [e2e-agent-payer-moderato-2026-09-17](docs/e2e-agent-payer-moderato-2026-09-17.txt) |
| Sept 17 | Earn while locked, demo venue | [e2e-earn-moderato-2026-09-17](docs/e2e-earn-moderato-2026-09-17.txt) |
| Sept 17 | Private payout into Tempo Zone A | [e2e-zone-moderato-2026-09-17](docs/e2e-zone-moderato-2026-09-17.txt) |
| Sept 21 | Public deployment end to end: create, MPP-fund, submit, verify, settle in 50 s | [e2e-service-public-2026-09-21](docs/e2e-service-public-2026-09-21.txt) |
| Oct 4 | Earn against a real Tempo venue: v4 failure, v5 fix | [v4](docs/e2e-earn-moderato-2026-10-04.txt) · [v5](docs/e2e-earn-moderato-2026-10-04-v5.txt) |

## Privacy

Payer and worker addresses are in the job struct. Per-job amounts are hidden behind the commitment until settlement, and deposits are not linked to jobs: deposits credit a balance, jobs draw from it, and payouts come from the Vault. The web app gives every user a fresh embedded wallet, so addresses carry no identity, and on Tempo testnet a payout can go straight into Zone A with the recipient encrypted.

## Business model

The Vault takes **1% of every settled job**, in the contract, at settlement. A verification costs $0.05 (typical) to $0.12 (worst case, 60,000 characters of delivery), so the fee covers the check from about a $10 job upwards. Below that the check is subsidised today; the planned fix is a flat verification fee of about $0.25 for jobs under $25, set at creation and shown before anything is locked, with the 1% unchanged above it. The payer pays, because the payer gets the guarantee; agents pay inside the MPP or x402 charge that funds the job.

## Repository

| Path | Contents |
|---|---|
| [`contracts/`](contracts) | `Vault.sol`, `VerifierRegistry.sol`, Foundry unit, fuzz and invariant suites, deploy scripts |
| [`apps/web`](apps/web) | Next.js service: REST `/api/v1`, MPP and x402 funding routes, verifier, indexer, relayer, timelock, web app |
| [`packages/mcp`](packages/mcp) | `@gwilll/vouch-mcp`: 8 tools, resources and the `hire_for_task` prompt |
| [`packages/shared`](packages/shared) | Types, zod schemas, policy presets, commitment, manifest and report hashing, EIP-712 types |
| [`packages/abi`](packages/abi) | ABIs and per-chain addresses |
| [`examples/`](examples) | Unattended payer demo, end-to-end run scripts, adversarial corpus, calibration harness |
| [`docs/`](docs) | [Architecture](docs/architecture.md), [threat model](docs/threat-model.md), [deploy](docs/deploy.md), run logs, [user log](docs/users.md) |

## Run locally

See [docs/deploy.md](docs/deploy.md). In short: `pnpm install`, build `packages/abi` and `packages/shared`, fill `apps/web/.env` from `.env.example`, run `pnpm db:migrate`, then `pnpm dev`. Contracts: `cd contracts && forge test`.

## Status and known gaps

| Area | State |
|---|---|
| Contracts | Vault v4 live on Moderato and Base Sepolia; v5 (Earn-venue hardening) in the repo, proven on a Moderato instance |
| Funding | Tempo batched and fee-sponsored, MPP charge, transfer memo, Base EIP-3009 and x402 |
| Verifier and settlement | On-chain attestation, automatic settlement under the payer's policy, approval, disputes with an arbiter |
| Agents | `@gwilll/vouch-mcp` 0.1.2 on npm (stdio and HTTP); MPP discovery and `llms.txt` |
| Web app | Live; job pages render on the server; Lighthouse mobile on Sept 22: landing 81 performance / 100 accessibility, job page 84 / 100 |
| Earn while locked | Production v4 uses a labelled demo venue; real venues need v5, which ships with the mainnet deploy |
| Zone payouts | Live on Moderato Zone A; testnet only |

Known gaps: the job page's first load is 244 kB against a 150 kB target, and mainnet is not deployed.

## Team

Godswill Idolor ([@big14way](https://github.com/big14way)), full-stack Web3 engineer (Rust and Solidity), previously a Flare and Stellar fellow. Solo for this hackathon; every commit is his. Why Vouch: his sister Rita, a freelance designer in Nigeria, delivered three weeks of work to a client overseas and was never paid.

## Roadmap

Third-party verifiers competing on calibration, worker bonds, jobs funded from a Tempo Zone, a virtual deposit address per job, fiat rails, and invoice financing on settlement history.

## License

MIT
