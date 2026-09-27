# WhatsApp messages

Send one link per person (from `links.local.md`), and write their name in its "Sent to" column so no link goes to two people. Be clear that the money is test money: it is a real product on a test network, not a paid gig.

## 1. The invite (freelancers: designers, writers, social media managers)

> Hi {name}! I'm building Vouch, an app that makes sure freelancers get paid for work they deliver. The client locks the money first, an independent check compares your work to the brief, and the payment releases on its own.
>
> Could you try it for 10 minutes? There's a small task waiting for you with $5 already locked (test money on a test network, so nothing real changes hands, but everything else is the real app):
>
> 👉 {link}
>
> 1. Open the link and sign in with your email
> 2. Read the brief, do the task, and deliver it on the page
> 3. Watch it get checked. If it passes, it pays you automatically 15 minutes later
>
> Then tell me honestly what confused you or what you'd change. That's the part that helps me most 🙏

## 2. If they haven't opened it after a day

> Hey {name}, just checking, did the link work for you? Takes about 10 minutes, and I'd really value your honest take, even if it's "this confused me".

## 3. Follow-up after they deliver (ask right after, while it's fresh)

> Thank you! 5 quick questions, short answers are perfect:
>
> 1. What was the most confusing moment?
> 2. Did anything break or feel slow? What were you doing when it happened?
> 3. When the check came back, did you agree with it? Why or why not?
> 4. Have you ever done work and not been paid, or been paid late? What happened?
> 5. Would you send a client a Vouch link for your next job? What would stop you?
>
> And can I quote you (first name + city) in my submission? Totally fine to say no.

## 4. Clients (people who hire freelancers), optional second round

> Hi {name}, you hire freelancers sometimes, right? I'm building Vouch: you lock the payment against a written brief, an independent check verifies the delivery, and it pays only when the work matches. Would you try creating a job for 10 minutes? I'll top up your test balance so you can lock the money yourself: sign in at https://vouch-rouge.vercel.app and send me the email you used.

(When a client signs in, their wallet address appears in the account menu. Credit their test balance the same way the demo payer was credited: a pathUSD transfer to the Vault plus `attributeDeposit` from the intake key, with `--gas-limit 1500000`.)
