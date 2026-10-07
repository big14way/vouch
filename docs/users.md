# Users

Every person outside the team who has used Vouch, in order. Names appear only with permission. Each entry lists what broke before what worked, and what changed because of it.

Both users so far are fellow Colosseum builders who took an open job as the worker. Every amount is test money on Tempo Moderato. Explorer links: [explore.moderato.tempo.xyz](https://explore.moderato.tempo.xyz).

## 1. Sundram Mahajan (TxWhy), Oct 4, 2026

**What he did.** Took the "Instagram caption for a new jollof dish" job ([job page](https://vouchhq.vercel.app/j/0x0583f85805c229b893bae195d805f92308d43f92217d3d1b82b4359480e635fe)): signed in with email, pasted the caption and attached a file, signed once.

**What broke.**
- Google sign-in was offered but not enabled, so the first click was a dead end.
- The verifier failed because the Anthropic API spend limit had been reached. The page said "retries automatically", which could not be true, and it showed him the raw API error.
- The open job hid its amount until after delivery.
- The scope asked for "a note or a Markdown file", but the form had a file box, a links box and a "Note to the payer" box, so he was unsure where a plain caption belonged.

**What worked.** Quick email sign-in, no wallet or gas to think about, a clear signing prompt, the delivery fingerprint and on-chain record appearing at once, and the five-step progress bar.

**What changed, the same evening.** Email-only sign-in; the amount shown on open jobs; the note field relabelled "Your work, or a note about it"; verifier failures shown as one plain sentence, with budget and rate-limit failures no longer using up a retry. The spend limit was raised.

**Outcome.** PASS at 0.93, every scope item met, released automatically 15 minutes later; $4.95 to his balance after the 1% fee. Transactions: [funded](https://explore.moderato.tempo.xyz/tx/0x905fe98bf8185309a083946a1f625a4efe37c3c0317f99f7a49b32fc2993edb7) · [submitted](https://explore.moderato.tempo.xyz/tx/0xa3c6a39faac8594cdeb30e68f55efbc717d55b86e9ca1dacdd89d8cc8fba8f33) · [attested](https://explore.moderato.tempo.xyz/tx/0x54307e83fe3ebf55424364193cc70ef1a072f0bd8449dc9de9780f694b5f3786) · [settled](https://explore.moderato.tempo.xyz/tx/0xe56504c8532f11a8ce5def4eb91e903131a1a2a4169b988c3d66c25fd3dc7c5a).

## 2. Endrew from Chroma (chromalaunch.fun), Oct 6, 2026

**What he did.** Opened the job list and a job page, signed in with email and reached onboarding. After the fix below, took the "Simple logo concept for Ada's Tailoring" job ([job page](https://vouchhq.vercel.app/j/0xd80ee55f4c48fb12601aef9856dff6324ec720fa55033a326dd99e4e0d155e1c)) and delivered a PNG.

**What broke.**
- Blocker: onboarding showed "Creating your wallet…" before anything was clicked and never finished. Privy had linked his email but never created the wallet, and nothing told him.
- The job list showed 17 cards with 5 titles and no way to tell them apart.
- The timing contradicted itself: "a pass pays 15 minutes later" on the list, "Auto at ≥ 85% after 0 h" on the job page. "≥ 85%" was not explained.
- The fee read "1% of the payout" instead of what he would receive.
- "Tempo Moderato" means nothing to someone outside crypto.
- The agent command passes a private key on the command line with no warning.

**What worked.** In his words, the five-step bar, the fixed scope with deliverables and format, and "How you are protected": "those three make a stranger trust the job before signing in."

**What changed, the same morning.** The wallet is created on demand when login skipped it, with a 20-second timeout, a plain reason and Try again; the app also retries on its own after sign-in. The job list groups copies of a task with an open-slot count. The release rule reads "Automatic when the verifier scores the delivery 85% or more, 15m after the check", the fee row "1%: you receive $4.95", the network "Tempo Moderato (test network)". The agent command carries a fresh-key warning.

**Outcome.** Signed in again without the wallet problem and delivered: PASS at 0.95, 4 of 4 scope items, released automatically 16 minutes later; $4.95 to his balance. He wrote: "The per-item breakdown with a reason for each is great — I knew exactly why it passed." He suggested saying on the job list that every verdict is recorded on-chain before money moves; that line went live the next day. Transactions: [funded](https://explore.moderato.tempo.xyz/tx/0x2acb43537a356491abf4c4a86e4bc573cec006811309f19b90fa11b8014edc2e) · [submitted](https://explore.moderato.tempo.xyz/tx/0x8b4b2440306a896474b24a1391c05f1826bd8e483f0aac04bb099d552e29fe02) · [attested](https://explore.moderato.tempo.xyz/tx/0xd552f710dca90b445269f115284bff0cdd26d07420525bca53481ff8c6fe7561) · [settled](https://explore.moderato.tempo.xyz/tx/0xbab9a95af59e9ef189b5208df4939cf408a8dca8715e5392e6621e6b607d6958).
