import { Shell } from "@/components/layout/nav";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <Shell narrow>
      <h1 className="text-[22px] font-semibold">Privacy</h1>
      <div className="mt-4 space-y-3 text-[15px]">
        <p><strong>What we store.</strong> Your email (if you sign in), a display name, your wallet address, job titles and scopes, delivered files and links, verifier reports, and transaction hashes. Files are kept for one year.</p>
        <p><strong>What is on-chain.</strong> Payer and worker addresses, job ids, hashes of the scope, delivery and report, verdicts and confidence. Per-job amounts are hidden behind a commitment until settlement, when the amount appears in transaction data. Deposits credit a balance rather than a job, so a deposit is not linked to a specific job on-chain. The web app gives every user a fresh wallet, so addresses carry no identity by default.</p>
        <p><strong>Who sees deliveries.</strong> The payer, the worker, the automated verifier (Anthropic API, no training on your data), and an arbiter if a dispute is opened.</p>
        <p><strong>Third parties.</strong> Privy (sign-in and wallets), Neon (database), Cloudflare R2 (files), Resend (email), Sentry (errors), Vercel (hosting).</p>
        <p><strong>Your choices.</strong> Email <a className="text-primary" href="mailto:support@vouch.dev">support@vouch.dev</a> with a job id to delete files or your account. On-chain data cannot be deleted.</p>
      </div>
    </Shell>
  );
}
