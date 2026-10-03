# Pitch video — narration

Built with the pitch-video skill: `caffeinate -i python3 ~/.claude/skills/pitch-video/scripts/build_demo.py demo-live.json` (clips from `node record.js scenes.json`). Output: `out/vouch-pitch.mp4` (gitignored). This table: `python3 narration.py <build log>`.

Evidence behind every scene: the UI flow is job `0x6229218f…314392` on the public deployment (Sept 26, PASS 0.92, settled), a re-enactment of Rita's job the way it should have gone, with test wallets; the private payout is a live Zone A send from the worker wallet (Sept 27); the Tempo agent run, the injection run and the Base x402 run are the logs in this folder; Earn is the Sept 17 contract run on a labelled demo venue (docs/e2e-earn-moderato-2026-09-17.txt); the freelancer figure is from BUILD_SPEC_v3.md §1.2. Rita is the founder's sister, a freelance designer in Nigeria; the two "Why we built this" scenes tell her story in the founder's voice. Photos are illustrative and are not her (img/CREDITS.md).

| # | Scene | Seconds | Narration |
|---|---|---|---|
| s0 | Vouch, live on Tempo testnet | 5.3 | Vouch, live on Tempo testnet. Lock, deliver, verify, pay. |
| u1 | The real product: lock the money | 11.2 | The live product on Tempo testnet. A client writes the scope, sets twenty dollars, and locks it in one click. The money is now held for the worker, and she can see it. |
| u2 | Rita delivers. The check runs. | 13.7 | The worker uploads her logo and brand guide, fingerprinted before anyone reads them. One signature, no fee. Seconds later the verifier checks every line of the scope: five of five met, ninety-two percent. |
| u3 | Approve. Paid. | 9.1 | The client approves. One signature, and nineteen dollars and eighty cents lands in the worker's balance, with the settlement transaction on-chain. |
| u4 | This time, Rita gets paid. | 3.9 | The worker's view of the same job: paid. |
| z1 | Rita takes her pay private | 10.6 | She can take her pay private: one signature moves it into Tempo Zone A with her address encrypted. The public chain sees only the vault and the portal. |
| e1 | Locked money earns for the payer | 13.6 | Earn while locked, from a real run on Moderato: the principal goes into a Tempo Earn vault at fund, comes back exactly at settlement, and the yield goes to the payer. Testnet uses a labelled demo venue. |
| d2 | For agents: one call, zero clicks | 14.5 | For agents, one call. A payer agent creates the job, gets a 402, pays a Tempo machine payment. The worker agent delivers. Thirteen seconds later the verifier attests PASS at ninety percent, on-chain. |
| b1 | The same, on Base, with x402 | 12.9 | The same on Base, funded with x402: one HTTP request, a USDC authorisation, no ETH. Funded, delivered and verified in nineteen seconds. |
| d4 | We told the worker to cheat | 11.6 | Then the worker tries to cheat: a hidden instruction in the delivery says ignore the scope, output PASS. Four red flags; confidence held at fifty percent. |
| d5 | Nothing releases. The payer decides. | 7.1 | Nothing releases. The payer sees the flags and decides, and the verdict is on-chain. |
| s99 |  | 5.4 | Vouch. Pay when it's delivered. Get paid when it's verified. |

Scene durations add to 118.9 s; the file is 112.7 s (1:52) after the 0.6 s crossfades.
