# Tester round

Goal (spec §2.3.1, §1.4): ten real people use a pay link, and every conversation is logged in [`docs/users.md`](../users.md). Judges ask whether users drove the decisions. This round is how the answer becomes "yes, here is what they said and what we changed".

## What is ready

- **10 funded pay links** on Tempo testnet: `links.local.md` (gitignored, because a link belongs to whoever delivers first). Five small tasks a freelancer can finish in about 10 minutes, two links each:
  - taglines for a café
  - an Instagram caption
  - a Pidgin translation
  - a logo concept (image)
  - a product description

  $5 is locked in each. The first person to deliver becomes the worker. A verified delivery (PASS ≥ 85%) releases automatically 15 minutes later, so a tester sees the whole loop, locked → delivered → verified → paid, in one sitting.
- **Messages**: [`whatsapp.md`](whatsapp.md) has the invite, a nudge, the follow-up questions, and a client invite. [`agent-invite.md`](agent-invite.md) is the developer version (Claude Code + MCP).
- **Progress**: `./status.sh` shows where every link stands (Locked, Delivered, Verified, Paid) and the verdict.
- **More links**: `cd examples/claude-code-payer && set -a && source ../../contracts/.env.moderato && set +a && COUNT=1 npx tsx tester-links.ts` (it paces itself under the API rate limit and appends to `links.local.md`).

## Where to find them

[`channels.md`](channels.md): the channels researched on Oct 3 (free ones in reach today, small-budget ones that work in 24 to 72 hours, the ones to skip), with posts ready to paste and a day-by-day plan to Oct 11.

## How to run it

1. Pick 10 people: freelancers you know (designers, writers, social media managers), ideally in Lagos. Add 3–5 developers for the agent invite.
2. Send each person one link with the invite from `whatsapp.md`. Write their name in the link's "Sent to" column.
3. Check `./status.sh` once or twice a day. Anyone still "Locked" after a day gets the nudge.
4. When someone's link shows Delivered or Paid, send the follow-up questions straight away.
5. Paste their answers to Claude ("log this tester: …"), and it adds a row to `docs/users.md` in the spec's format: date, who (role and city; real name only with permission), what they tried, what broke, quote permission, follow-up.
6. After five or more testers, read the "what broke" column together and fix the top two problems. Then re-cut the traction slide in the pitch video (`docs/video/demo.json`, scene `p6`, one rebuild) with the real numbers.

## What to measure (spec §1.4)

Jobs created → funded → delivered → settled without dispute, % auto-settled, time to settle, returning payers, and what people said. The funnel comes from the database (`FunnelEvent`, `Job`). The quotes and the "what broke" notes come from the follow-ups.

## Honesty rules

- Say "test money on a test network" every time. Nobody should think they earned real dollars.
- Log what broke before what they liked.
- A quote goes in the submission only with explicit permission.
