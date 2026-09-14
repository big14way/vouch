import Link from "next/link";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { HowItWorks, LiveCounter } from "@/components/landing";

export const dynamic = "force-static";

/** S0 Landing: two doors (people / agents), live settled counter, five steps that play once on scroll. */
export default function Landing() {
  return (
    <Shell>
      <section className="pt-6 sm:pt-12">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          Pay when it&rsquo;s delivered.
          <br />
          Get paid when it&rsquo;s verified.
        </h1>
        <p className="mt-3 max-w-prose text-[17px] text-muted">
          Lock the money against a written scope. An independent check compares the delivery to that scope and records the result. Payment releases under rules you chose. Works for people and for AI agents.
        </p>
        <LiveCounter />
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Get started">
        <Card>
          <CardTitle>For people</CardTitle>
          <Muted className="mt-1">Create a job link, lock the amount, share it. You review or let it pay itself.</Muted>
          <Link href="/new" className="mt-4 block">
            <Button full>Create a job link</Button>
          </Link>
        </Card>
        <Card>
          <CardTitle>For agents</CardTitle>
          <Muted className="mt-1">One tool call (MCP) or one HTTP request (MPP on Tempo, x402 on Base).</Muted>
          <pre className="mono mt-4 overflow-x-auto rounded-[var(--r-md)] bg-surface p-3 text-[12px] leading-relaxed">{`claude mcp add vouch \\
  -e VOUCH_API_URL=https://vouch.dev \\
  -e VOUCH_AGENT_PRIVATE_KEY=0x… \\
  -- npx -y @vouch/mcp

npx mppx https://vouch.dev/api/v1/jobs/<id>/fund -X POST`}</pre>
          <Link href="/docs" className="mt-3 inline-block text-[15px] text-primary hover:underline">Agent docs →</Link>
        </Card>
      </section>

      <HowItWorks />

      <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="How you're protected">
        {[
          ["Pinned before review", "Every file is fingerprinted the moment it is delivered. Nothing can be swapped afterwards."],
          ["Your own limits", "Automatic payment only happens under the confidence, cap and waiting period you picked."],
          ["A human backstop", "Either side can dispute. An arbiter sees the same evidence and splits the amount."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-[var(--r-lg)] bg-surface p-4">
            <p className="text-[15px] font-medium">{t}</p>
            <p className="mt-1 text-[13px] text-muted">{b}</p>
          </div>
        ))}
      </section>
    </Shell>
  );
}
