# Pitch video — narration

Built with the pitch-video skill: `caffeinate -i python3 ~/.claude/skills/pitch-video/scripts/build_demo.py demo.json` (clips from `node record.js scenes.json`). Output: `out/vouch-pitch.mp4` (gitignored). This table: `python3 narration.py <build log>`.

Evidence behind every scene: the UI flow is job `0x6229218f…314392` on the public deployment (Sept 26, PASS 0.92, settled), a re-enactment of Rita's job the way it should have gone, with test wallets; the private payout is a live Zone A send from the worker wallet (Sept 27); the Tempo agent run, the injection run and the Base x402 run are the logs in this folder; Earn is the Sept 17 contract run on a labelled demo venue (docs/e2e-earn-moderato-2026-09-17.txt); the freelancer figure is from Remote's State of Freelance Work 2025 (85% report late payment). Rita is the founder's sister, a freelance designer in Nigeria; the two "Why we built this" scenes tell her story in the founder's voice. Photos are illustrative and are not her (img/CREDITS.md).

| # | Scene | Seconds | Narration |
|---|---|---|---|
| s0 | Pay when it's delivered. Get paid when it's verified. | 6.1 | This is Vouch. Money locked against a scope, released only when the work is verified. |
| t0 | One engineer. Four weeks. One reason. | 11.7 | I'm Godswill Idolor, a full-stack Web3 engineer: Rust and Solidity, a Flare and Stellar fellow before this. I built Vouch alone in four weeks, because of my sister. |
| p1 | My sister Rita did the work. | 14.1 | Rita is my sister. She is a freelance designer in Nigeria. A client overseas wanted a full brand identity. Half upfront, the rest on delivery. She gave it three weeks of late nights. And she delivered, on time. |
| p1b | The money never came. | 14.1 | Then one message. Not what we asked for. They kept her files. And they went quiet. No referee. No court she could afford. She never saw that money. Three weeks of my sister's life, gone. That is why we built Vouch. |
| p2 | Work first, then hope. For people and now for agents. | 10.3 | My sister is not rare. Eighty-five percent of freelancers get paid late. And now AI agents hire each other on rails that pay first. Nobody checks the work. |
| p3 | The money waits for the proof. | 10.7 | The payer locks stablecoins against a written scope. The worker delivers. An independent verifier checks the work and records its verdict on-chain, and it can never move the money. |
| u3 | Approve. Paid. | 11.6 | In the real product, live on Tempo testnet: the client approves, and nineteen dollars and eighty cents lands in the worker's balance. No invoice. No chasing. No silence. |
| u4 | This time, Rita gets paid. | 3.9 | This time, my sister gets paid. |
| d4 | We told the worker to cheat | 9.6 | And when a worker tried to cheat the verifier with a hidden instruction, it flagged it four times and released nothing. |
| p6 | One percent of every settled job. | 14.2 | Vouch takes one percent of every settled job; a check costs about a dime, so it pays from a ten-dollar job. And it works for strangers: two users took jobs, passed at ninety-three and ninety-five percent, and were paid automatically. |
| p7 | Every job, paid on the outcome. | 11.8 | In ten years, every job between people and agents settles on a verified outcome, and verifiers compete on how well they judge. So that no one's sister loses three weeks to silence again. |
| s99 |  | 5.4 | Vouch. Pay when it's delivered. Get paid when it's verified. |

Scene durations add to 123.5 s; the file is 117.0 s (1:57) after the 0.6 s crossfades.
