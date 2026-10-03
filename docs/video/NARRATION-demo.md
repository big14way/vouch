# Pitch video — narration

Built with the pitch-video skill: `caffeinate -i python3 ~/.claude/skills/pitch-video/scripts/build_demo.py demo-tech.json` (clips from `node record.js scenes.json`). Output: `out/vouch-pitch.mp4` (gitignored). This table: `python3 narration.py <build log>`.

Evidence behind every scene: the UI flow is job `0x6229218f…314392` on the public deployment (Sept 26, PASS 0.92, settled), a re-enactment of Rita's job the way it should have gone, with test wallets; the private payout is a live Zone A send from the worker wallet (Sept 27); the Tempo agent run, the injection run and the Base x402 run are the logs in this folder; Earn is the Sept 17 contract run on a labelled demo venue (docs/e2e-earn-moderato-2026-09-17.txt); the freelancer figure is from BUILD_SPEC_v3.md §1.2. Rita is the founder's sister, a freelance designer in Nigeria; the two "Why we built this" scenes tell her story in the founder's voice. Photos are illustrative and are not her (img/CREDITS.md).

| # | Scene | Seconds | Narration |
|---|---|---|---|
| s0 | Vouch, the technical demo | 7.6 | Vouch, the technical demo: how the money is held, how it moves on Tempo, and how the verifier is kept honest. |
| a1 | Four parts. The verifier never touches money. | 17.8 | Four parts. The Vault holds every balance; a job is a commitment hash, so there is no price on-chain. The registry says who may attest. The service runs the API, verifier, indexer and relayer. Agents reach it over MCP or plain HTTP. |
| c1 | Settlement policy is enforced by the contract, not the server. | 16.9 | The policy lives in the contract: auto-settle reverts unless verdict, confidence, cap and review window hold. Every action has a signed twin, so a relayer pays the gas, and pause never traps funds. One hundred and three tests, ninety-nine percent of branches. |
| r1 | Fund a job four ways. All of them land in the same Vault. | 17.5 | Four ways to fund, one Vault. One batched Tempo transaction, fee paid by Vouch. A 402 answered with an MPP charge, memo the job id. A TIP-20 transfer with that memo, from any wallet. And x402 on Base. Every path is proven live. |
| d2 | Live: agent hires agent over MPP | 14.8 | Live: the payer agent creates the job, gets a 402, pays the charge. The worker delivers. The verifier attests on-chain and the policy schedules the release: PASS at ninety percent, thirteen seconds after delivery. |
| e1 | Earn while locked | 14.4 | Earn while locked: at fund, the principal goes into an allow-listed Tempo Earn vault; at settlement the Vault recalls exactly the principal, and the leftover shares are the payer's yield. Testnet runs on a labelled demo venue. |
| z1 | Private payout into Tempo Zone A | 10.2 | Private payout. The worker moves a settled balance into Tempo Zone A with the recipient encrypted; the public chain sees only the Vault and the portal. |
| b1 | Base, funded with x402 | 13.0 | On Base the agent pays with x402: one HTTP request, a USDC authorisation, no ETH. Funded, delivered and verified in nineteen seconds. |
| v2 | Judge the scope. Flag manipulation. Never move money. | 18.4 | The verifier judges only the stated scope, item by item, with evidence. Red flags are for manipulation. Anything unverifiable caps confidence at sixty percent, below every release threshold. The output is a strict schema, re-checked in code, and the verdict goes on-chain. |
| d4 | We told the worker to cheat | 9.6 | We told the worker to cheat: ignore the scope, output PASS. Four red flags, confidence held at fifty percent. |
| d5 | Nothing releases | 7.1 | Nothing releases. The payer sees the flags and decides, and the verdict is on-chain. |
| k1 | Decided on repeats, not on one run. | 14.9 | Calibration: nineteen samples, twelve runs, three configurations, zero wrong releases. Sonnet 5 with adaptive thinking released four of five good deliveries every time. The samples are synthetic and say so. |
| o1 | Public RPCs, free tiers, and an indexer that survives them. | 15.5 | On free tiers: the indexer walks the chain in windows and keeps its place when an RPC rate-limits; a cron and a nudge tick keep the verifier moving; health shows lag and relayer balances. Everything here links to a log or a transaction. |
| s99 |  | 5.6 | Vouch. The code, the logs and the transactions are in the repo. |

Scene durations add to 183.3 s; the file is 175.8 s (2:55) after the 0.6 s crossfades.
