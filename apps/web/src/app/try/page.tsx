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
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  // Several funded copies of the same task exist so more than one person can try it; show each task once with a count
  // (tester, Oct 6: "17 cards, 5 titles, I don't know which one to pick").
  const tasks = [...jobs.reduce((m, j) => m.set(j.title, [...(m.get(j.title) ?? []), j]), new Map<string, typeof jobs>())];
  return (
    <Shell>
      <h1 className="text-[22px] font-semibold">Try Vouch as the worker</h1>
      <Muted className="mt-1">
        Each task below has real test money locked on Tempo testnet. Pick one, sign in with your email, do the 10-minute task, deliver it on the page and watch the verifier check it. If the verifier scores your delivery 85% or more, you are paid automatically 15 minutes later. The first person to deliver takes a slot.
      </Muted>
      <Muted className="mt-1">
        Every verdict is recorded on-chain before any money moves, with a reason for each scope item, so you can see exactly why a delivery passed or not.
      </Muted>
      <Muted className="mt-1">Test money on a test network: nothing here is real dollars. Tell us what confused you or broke; that decides what we fix next.</Muted>

      {jobs.length === 0 ? (
        <Card className="mt-4">
          <CardTitle>No open test jobs right now</CardTitle>
          <Muted className="mt-1">Every job has been taken. New ones appear here as we fund them; check back in a few hours.</Muted>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3">
          {tasks.map(([title, open]) => (
            <Card key={title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{title}</CardTitle>
                  <Muted className="mt-1">
                    $5 of test {open[0]?.tokenSymbol} locked · you receive $4.95 · {open.length} open {open.length === 1 ? "slot" : "slots"} · about 10 minutes of work
                  </Muted>
                </div>
                <Link href={`/j/${open[0]?.id}`} className="rounded-[var(--r-md)] bg-accent px-3 py-2 text-[13px] font-medium text-[#0b0c0e]">
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
        <Muted className="mt-2">Use a fresh key that holds only test funds. The key sits in your MCP config and your shell history, so never paste one that controls real money.</Muted>
      </Card>
    </Shell>
  );
}
