# Builder Updates (Colosseum arena feed)

One per 24 h, each with one real artefact. #1 (Sept 15, kickoff + Moderato lifecycle) and #2 (Sept 16, batched sponsored funding tx) were posted from chat drafts; from #3 on, the text is kept here.

## #3 — Sept 17 — Money earns while it is locked, and payouts can leave the vault privately

Two Tempo-specific pieces shipped and proven live on Moderato today.

**Earn while locked.** A payer can park the locked principal in a Tempo Earn vault while the work happens. The Vault deposits at fund, recalls exactly the principal at settle, refund or dispute, and the leftover shares (the yield) go to the payer; a venue shortfall is charged to the payer before the worker is ever short. Honest note: both testnet pathUSD vaults currently reject deposits with a stale-price error, so the live run uses a clearly labelled demo venue, and the Vault handles a rejecting venue by funding without Earn. Log: `docs/e2e-earn-moderato-2026-09-17.txt`.

**Private payout into Tempo Zone A.** A worker moves a settled balance straight from the Vault into the zone with the recipient and job memo encrypted to the zone sequencer. The public chain shows Vault → Portal and the amount; the private balance appeared in the zone in the same second as the L1 block.
Tx: https://explore.moderato.tempo.xyz/tx/0x23f60cc6ea2c66df798231a852d8c446d6ec8aaf1ec5fbe6a67f3563e9c40646

**Lesson worth sharing.** The Zone A portal is an older build than the current viem release assumes: a 4-argument `depositEncrypted`, and a sequencer that derives the AES key without the sender binding viem added in July. A payload built the new way is accepted on-chain but never credited. The Vault now carries a legacy flag per portal and the client builds the matching payload. Cost: one $2 test deposit.

Vault v4 is live on Moderato (`0xaD15409d1B7EFA36a9898107fa9757E58a36442D`) and Base Sepolia (Sourcify verified), 96 Foundry tests green. Next: a public URL and the first testers, then mainnet.
