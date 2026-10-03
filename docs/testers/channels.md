# Where to find testers (researched Oct 3, 2026)

Goal: 10 logged testers in `docs/users.md` before the Oct 11 submission, with the "what broke" column filled. Every link is a real job with $5 of **test money on Tempo testnet**; say so in every post. Public links: `links-public.local.md` (already published in builder update #7); WhatsApp batch: `links.local.md`. Progress: `./status.sh links-public.local.md`.

## A. Free and already in reach (post today)

| Channel | Who is there | How | Expect |
|---|---|---|---|
| WhatsApp, your contacts and Rita's | Freelancers in Nigeria: the exact user | `whatsapp.md` invite, one link per person, name in the "Sent to" column | The best feedback; 3 to 5 people |
| Colosseum arena (builder update #8) | Other hackathon teams | "Test mine and I'll test yours" with the five public links and the `claude mcp add` one-liner | Fast, developer-minded; 2 to 4, mostly the agent path |
| Superteam Nigeria Discord and X (superteam.fun; 10,000 Discord users, 300 core builders, creatives and operators) | Nigerian Web3 builders, designers, writers | Post in their showcase or feedback channel, link the public jobs | 2 to 5 |
| Web3Bridge Telegram, t.me/web3bridge | Nigerian Solidity developers; the group allows job posts and networking | The developer invite from `agent-invite.md` plus one freelancer link | 1 to 3 developers |
| X, tagging @tempo | Tempo has no public Discord or Telegram (checked tempo.xyz: X, GitHub, hello@tempo.xyz only) | One post with a tester link and the job page screenshot; email hello@tempo.xyz asking them to amplify | Low, but it is the sponsor's ecosystem |
| Reddit: r/alphaandbetausers, r/betatests, r/SideProject | Global early adopters, developer-skewed | One post each, plain title, what it is, test money, the link | 1 to 3, slow |

## B. Small budget, fast (24 to 72 hours)

| Channel | Cost | How | Why it works |
|---|---|---|---|
| **Superteam Earn bounty** (superteam.fun/earn; "230,000+ talent"; bounties, projects, grants) | $100 to $150 in USDC | Sponsor sign-up is self-serve; the listing is reviewed before it goes live; prizes are paid by you, in USDC, usually on Solana. "Try Vouch, deliver one task, tell us what broke": 5 prizes of $20 for the most useful reports, proof = the delivered job link | Nigerian and global freelancers and developers who already do bounties; the strongest single lever for 10+ real users |
| **r/slavelabour** (about 480k members; beta-test tasks are common there) | $5 per tester, cap 10 | A `[TASK]` post: do the 10-minute job on the link, fill the follow-up questions, get $5 by PayPal or USDC. Read the sidebar rules before posting | People there do exactly this for exactly this money |
| **Fiverr or Upwork** | $5 to $10 per gig, 3 to 5 gigs | Buy real gigs from sellers filtered to Nigeria for the same tasks (taglines, caption, logo concept). Instruction in the brief: "upload the final file on this job page as well". Pay on the platform, so their terms are kept | Real freelancers doing real work through Vouch, and you learn what a working professional trips over |
| **Terawork** (Nigerian marketplace; free sign-up, RFQ posts, escrow, naira) | The quotes you accept | Post the same micro-jobs as RFQs, same delivery instruction | Nigerian freelancers off the WhatsApp circle |

## C. Not before Oct 11

- Zealy: the free plan is not listed on Explore or Earn, so nobody finds it; paid plans start at $359 a month. Only useful with an audience you already have.
- Galxe: free, but it draws airdrop farmers who will not write what broke.
- Layer3: around $10,000 and an external audit.
- BetaList, BetaTesting, Centercode, UserTesting: weeks of queue or enterprise pricing.

## Posts, ready to paste

**Superteam Earn (bounty, $100 to $150 USDC, 5 winners)**
> Title: Try Vouch (pay on verified delivery) and tell us what broke
> Vouch locks a payment against a written scope and releases it when an independent verifier passes the work. It runs live on Tempo testnet: https://vouchhq.vercel.app
> Task (10 minutes): open one of the pay links below, sign in with email, do the small task (taglines, a caption, a translation, a logo concept or a product description), deliver it on the page, watch the check run. A pass pays $5 of test money 15 minutes later. First to deliver takes a job; if one is taken, try the next.
> Submission: the link to your delivered job plus answers to: what confused you, what broke, would you send a client a pay link, what would you change. The five most useful reports win $20 each.
> Developers: `claude mcp add vouch -e VOUCH_API_URL=https://vouchhq.vercel.app -e VOUCH_AGENT_PRIVATE_KEY=0x… -e VOUCH_DEFAULT_CHAIN=42431 -- npx -y @gwilll/vouch-mcp` and hire an agent instead.
> Test money on a test network, not real dollars. We log every report and reply to each one.

**r/slavelabour**
> [TASK] Test a pay-on-delivery web app (10 min, Tempo testnet, test money) and answer 4 questions. $5
> Open a link, sign in with email, do a 10-minute writing or design task, upload it on the page, watch an automated check run, then answer four questions by DM. $5 PayPal or USDC per completed job, 10 spots, one per person. Links in the comments after you claim.

**Fiverr or Upwork brief (add to any gig order)**
> Please also upload the final file on this page before you mark the order complete: <link>. It is our delivery portal (sign in with email, upload, submit). Your payment is here on the platform as normal; the page shows a test-money amount from a test network. Tell me if anything on that page confused you; I'm collecting feedback on it.

**Superteam NG Discord or Web3Bridge Telegram**
> Built for the Crypto World's Fair: Vouch, pay on verified delivery, live on Tempo testnet. I need 10 people to try a $5 test-money job (10 minutes: taglines, a caption, a Pidgin translation, a logo concept) and tell me what broke. Links: <five public links>. Developers: hire an agent from Claude Code with `npx -y @gwilll/vouch-mcp`. I'll test your project back.

**X**
> Lock the money, deliver the work, an independent check releases it. Vouch is live on @tempo testnet. Trying to get 10 freelancers to break it this week: $5 test-money jobs at <link>. What broke, I fix.

## The week

- Oct 3: WhatsApp round, arena update #8, Superteam NG, Web3Bridge, Superteam Earn listing submitted, r/slavelabour post.
- Oct 4 to 5: Fiverr or Terawork orders placed; answer every DM the same day; nudge anyone still "Locked".
- Oct 6: follow-up questions to everyone who delivered; log each one in `docs/users.md`.
- Oct 7 to 8: fix the top two things that broke; builder update with the numbers.
- Oct 9: re-cut the traction scene (`docs/video/demo.json`, scene `p6`) with real counts and one quote (with permission).
- Oct 11: submit.
