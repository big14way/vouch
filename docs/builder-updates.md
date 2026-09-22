# Builder Updates (Colosseum arena feed)

One per 24 h, each with one real artefact. #1 (Sept 15, kickoff + Moderato lifecycle) and #2 (Sept 16, batched sponsored funding tx) were posted from chat drafts; from #3 on, the text is kept here.

## #3 — Sept 17 — Money earns while it is locked, and payouts can leave the vault privately

Two Tempo-specific pieces shipped and proven live on Moderato today.

**Earn while locked.** A payer can park the locked principal in a Tempo Earn vault while the work happens. The Vault deposits at fund, recalls exactly the principal at settle, refund or dispute, and the leftover shares (the yield) go to the payer; a venue shortfall is charged to the payer before the worker is ever short. Honest note: both testnet pathUSD vaults currently reject deposits with a stale-price error, so the live run uses a clearly labelled demo venue, and the Vault handles a rejecting venue by funding without Earn. Log: `docs/e2e-earn-moderato-2026-09-17.txt`.

**Private payout into Tempo Zone A.** A worker moves a settled balance straight from the Vault into the zone with the recipient and job memo encrypted to the zone sequencer. The public chain shows Vault → Portal and the amount; the private balance appeared in the zone in the same second as the L1 block.
Tx: https://explore.moderato.tempo.xyz/tx/0x23f60cc6ea2c66df798231a852d8c446d6ec8aaf1ec5fbe6a67f3563e9c40646

**Lesson worth sharing.** The Zone A portal is an older build than the current viem release assumes: a 4-argument `depositEncrypted`, and a sequencer that derives the AES key without the sender binding viem added in July. A payload built the new way is accepted on-chain but never credited. The Vault now carries a legacy flag per portal and the client builds the matching payload. Cost: one $2 test deposit.

Vault v4 is live on Moderato (`0xaD15409d1B7EFA36a9898107fa9757E58a36442D`) and Base Sepolia (Sourcify verified), 96 Foundry tests green. Next: a public URL and the first testers, then mainnet.

## #4 — Sept 19 — Public URL, real database, and an indexer that survives public RPCs

Vouch is live at https://vouch-rouge.vercel.app (Vercel Hobby + Neon Postgres). Health: https://vouch-rouge.vercel.app/api/v1/health shows both vaults reachable, indexer lag and relayer balances.

**What it took.** Outbound Postgres is blocked from my machine, so migrations run inside the Vercel build over the direct Neon URL. Hobby crons fire twice a day, which is useless for a verifier, so a GitHub Actions schedule drives indexer, verifier and timelock every five minutes, and because GitHub's schedule is best-effort the API also runs a short indexer tick after a job read when nothing has ticked for 20 s. The indexer now walks 2 000-block windows until caught up inside a 40 s budget, polls both chains concurrently, and keeps its persisted progress when sepolia.base.org rate-limits it.

Next: the MCP package on npm, then calibration of the verifier on real deliverables.

## #5 — Sept 21 — `npx -y @gwilll/vouch-mcp`, a settlement on the public deployment in 50 s, and a verifier decision made on repeats

**Agents can hire through Vouch from Claude Code now.** `claude mcp add vouch -e VOUCH_API_URL=https://vouch-rouge.vercel.app -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @gwilll/vouch-mcp` (npm: https://www.npmjs.com/package/@gwilll/vouch-mcp). Lesson: 0.1.0 shipped `workspace:*` dependencies and could not be installed outside the monorepo; 0.1.1 bundles the shared package with esbuild. Verified from a clean directory against the live API.

**End to end on the public deployment.** Create, fund over MPP, deliver, verdict, approve: settled in 50 s, every step on chain. Job: https://vouch-rouge.vercel.app/j/0xc116004cc5eaad86fce7c8b3497ca0c4b201c3f880142cb272994706ed6226fe. Log: `docs/e2e-service-public-2026-09-21.txt`.

**Verifier model, decided on repeats.** Three repeat runs per configuration over 9 job samples (5 that should release, 3 near-misses, 1 non-delivery) plus 10 adversarial samples. Zero wrong releases in all 12 runs. Sonnet 4.6 released 4 of 5 good deliveries every run; Sonnet 5 with thinking off held 2 to 3 of 5; Sonnet 5 with adaptive thinking released 4 of 5 every run and is what production runs now. The honest weak spot: every configuration holds a word-limit scope because models miscount words, so the safe direction, "needs review", wins. Lesson from the day: a manifest with `size: 0` made the model red-flag every good delivery; the harness now sends real sizes and types. Runs: `docs/calibration-2026-09-21-repeats.md`.

## #6 — Sept 22 — Vault v5 hardening, and a landing page that shows the product instead of describing it

**Contracts.** The two items queued from the Slither triage are in: every path that reaches an Earn venue now writes the terminal job status and releases the lock before the venue is called (checks-effects-interactions even without the re-entrancy guard), and the constructor and setters reject a zero arbiter or intake. A new test venue inspects the Vault mid-call on every payout path and tries to re-enter; 103 tests green. Commit `02ebbce`.

**Landing.** The hero is the real job card playing its five states on a loop (lock, deliver, verify, verdict, paid), the five steps draw in on a rail, the two doors (people, agents) carry a terminal with copyable snippets, and a proof section links every claim to its transaction, report or code, next to a screenshot of a job that settled on the public deployment. Photos are Unsplash-licensed and credited in the repo. A link-preview image is generated for this feed and for chats.

**Found on the way.** Every page was client-rendered because the wallet provider was loaded with server rendering disabled and the whole app sat inside it, and the job page fetched everything after load. Now the public pages (landing, docs, legal) render on the server without the wallet SDK, the job page loads job, verdict and timeline on the server, and a page that arrives with a verdict already recorded shows it at once instead of hiding it behind the reveal animation. Lighthouse mobile against the live deployment: landing 81 performance, job page 84 (from 51, largest paint 15 s → 2 s, layout shift 0.78 → 0.002), accessibility 100 on both. The product also moved to a dark theme with the real job card lit in light mode as the hero.
