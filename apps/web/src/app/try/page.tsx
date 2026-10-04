import Link from "next/link";
import { Shell } from "@/components/layout/nav";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { db } from "@/lib/db";

export const metadata = { title: "Try Vouch" };
export const dynamic = "force-dynamic";

/** Wallets that fund the public test jobs (test money on Tempo testnet). */
const TESTER_PAYERS = (process.env.TESTER_PAYERS ?? "0xeBCfb9c6E03B5338684A0f96187DD15862cB2202")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

/** Open test jobs anyone can take as the worker. One evergreen link for every invite. */
export default async function TryPage() {
  const jobs = await db.job.findMany({
    where: { status: "Funded", worker: null, payer: { in: TESTER_PAYERS } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return (
    <Shell>
      <h1 className="text-[22px] font-semibold">Try Vouch as the worker</h1>
      <Muted className="mt-1">
        Each job below has real test money locked on Tempo testnet. Open one, sign in with your email, do the 10-minute task, deliver it on the page and watch the verifier check it. A pass pays 15 minutes later. The first person to deliver takes a job.
      </Muted>
      <Muted className="mt-1">Test money on a test network: nothing here is real dollars. Tell us what confused you or broke; that decides what we fix next.</Muted>

      {jobs.length === 0 ? (
        <Card className="mt-4">
          <CardTitle>No open test jobs right now</CardTitle>
          <Muted className="mt-1">Every job has been taken. New ones appear here as we fund them; check back in a few hours.</Muted>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3">
          {jobs.map((j) => (
            <Card key={j.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{j.title}</CardTitle>
                  <Muted className="mt-1">$5 of test {j.tokenSymbol} locked · Tempo testnet · about 10 minutes of work</Muted>
                </div>
                <Link href={`/j/${j.id}`} className="rounded-[var(--r-md)] bg-accent px-3 py-2 text-[13px] font-medium text-[#0b0c0e]">
                  Take this job
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardTitle>Building agents?</CardTitle>
        <Muted className="mt-1">Hire a worker agent from Claude Code and let the verifier decide whether it gets paid.</Muted>
        <pre className="mono mt-2 overflow-x-auto rounded-[var(--r-md)] bg-surface p-3 text-[12px] leading-relaxed">{`claude mcp add vouch -e VOUCH_API_URL=${process.env.NEXT_PUBLIC_APP_URL ?? "https://vouchhq.vercel.app"} -e VOUCH_AGENT_PRIVATE_KEY=0x… -e VOUCH_DEFAULT_CHAIN=42431 -- npx -y @gwilll/vouch-mcp`}</pre>
      </Card>
    </Shell>
  );
}
