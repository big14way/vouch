"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { formatAmount, parseAmount, POLICY_PRESET_COPY, TOKENS, CHAINS, type ChainId, type JobDto } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow, KV } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CopyField } from "@/components/ui/copy-field";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { PolicyPicker, defaultPolicyValue } from "@/components/job/policy-picker";
import { EarnToggle } from "@/components/job/earn-toggle";
import { jobs, ClientError } from "@/lib/client/api";

const TEMPLATE = `## Deliverables
- 

## Format
- 

## Deadline
- 

## Out of scope
- `;

const DEFAULT_CHAIN = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 4217) as ChainId;
const ENABLED = (process.env.NEXT_PUBLIC_ENABLED_CHAINS ?? "4217,8453").split(",").map(Number).filter((n): n is ChainId => n in CHAINS);

/** S2 New job. One primary action; success sheet with share options. */
export default function NewJob() {
  const router = useRouter();
  const { authenticated, login, ready } = useAuth();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [amount, setAmount] = useState("");
  const [chainId, setChainId] = useState<ChainId>(ENABLED.includes(DEFAULT_CHAIN) ? DEFAULT_CHAIN : (ENABLED[0] ?? 4217));
  const [token, setToken] = useState<string>(TOKENS[chainId][0]!.address);
  const [worker, setWorker] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [policy, setPolicy] = useState(defaultPolicyValue());
  const [earnVault, setEarnVault] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ job: JobDto; payUrl: string; mcpHint: string } | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = "Give the job a short title.";
    if (scope.trim().length < 10) e.scope = "Describe what you expect. The check is only as good as the scope.";
    let base = 0n;
    try { base = parseAmount(amount); if (base <= 0n) e.amount = "Enter an amount above zero."; } catch (x) { e.amount = x instanceof Error ? x.message : "Enter an amount."; }
    setErrs(e);
    if (Object.keys(e).length) return;
    if (!authenticated) return login();
    setBusy(true);
    try {
      const r = await jobs.create({ title, scopeMd: scope, amount: base.toString(), chainId, token, worker: worker.trim() || undefined, policyPreset: policy.preset === "custom" ? undefined : policy.preset, policy: policy.preset === "custom" ? policy.policy : undefined, earnVault: earnVault ?? undefined, paymentDeadline: Number(deadlineDays) * 86400 || undefined });
      setCreated({ job: r.job, payUrl: r.payUrl, mcpHint: r.mcpHint });
    } catch (x) {
      const ce = x instanceof ClientError ? x : null;
      setErrs({ form: ce ? `${ce.message} ${ce.next ?? ""}` : "Could not create the job." });
    } finally {
      setBusy(false);
    }
  };

  const share = (kind: "whatsapp" | "email") => {
    if (!created) return;
    const text = `Job: ${created.job.title}. Pay-on-delivery link: ${created.payUrl}`;
    window.open(kind === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(text)}` : `mailto:?subject=${encodeURIComponent(created.job.title)}&body=${encodeURIComponent(text)}`, "_blank");
  };

  const amountOk = (() => { try { return parseAmount(amount) > 0n; } catch { return false; } })();
  const tokenMeta = TOKENS[chainId].find((t) => t.address === token);
  const releaseText =
    policy.policy.autoRelease === 0
      ? "You review the delivery and release the payment yourself."
      : `Releases automatically when verified at ${Math.round(policy.policy.minConfidenceBps / 100)}% or higher, ${Math.round(policy.policy.reviewWindow / 3600)} h after the verdict, up to ${formatAmount(policy.policy.maxAutoAmount)}.`;
  const cta = authenticated ? "Create job link" : "Sign in and create";

  return (
    <Shell>
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[28px]">New job</h1>
        <p className="mt-1 text-[13px] text-muted">Write what you expect, set the amount, and choose when it pays. Nothing is charged until you lock it.</p>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6">
          <Section n="1" title="The work" hint="The check compares the delivery to this scope, line by line. Be specific.">
            <Field error={errs.title}>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brand identity for Kora Coffee" maxLength={120} />
            </Field>
            <Field error={errs.scope} className="mb-0">
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="scope">Scope</Label>
                <button type="button" className="text-[12px] text-primary hover:underline" onClick={() => setScope((s) => (s.trim() ? s : TEMPLATE))}>Use template</button>
              </div>
              <Textarea id="scope" value={scope} onChange={(e) => setScope(e.target.value)} className="mono min-h-52 text-[13px] leading-6" placeholder={"## Deliverables\n- …\n\n## Format\n- …"} />
            </Field>
          </Section>

          <Section n="2" title="Payment" hint="Locked in the vault when you pay. The fee comes out of the payout.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
              <Field error={errs.amount} className="mb-0">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-faint">$</span>
                  <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" className="tnum pl-7" />
                </div>
              </Field>
              <Field className="mb-0">
                <Label htmlFor="token">Paid in</Label>
                <Select id="token" value={`${chainId}:${token}`} onChange={(e) => { const [c, t] = e.target.value.split(":"); setChainId(Number(c) as ChainId); setToken(t!); }}>
                  {ENABLED.map((c) => TOKENS[c].map((t) => <option key={`${c}:${t.address}`} value={`${c}:${t.address}`}>{t.symbol} · {CHAINS[c].shortName}</option>))}
                </Select>
              </Field>
            </div>
          </Section>

          <Section n="3" title="When it pays" hint="Pick how much of the release you hand to the check.">
            <PolicyPicker value={policy} onChange={setPolicy} />
          </Section>

          <Section n="4" title="Options" hint="All optional.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field className="mb-0">
                <Label htmlFor="worker">Worker</Label>
                <Input id="worker" value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Email, wallet address or agent URL" />
              </Field>
              <Field className="mb-0">
                <Label htmlFor="deadline" hint="days the link stays open">Payment deadline</Label>
                <Input id="deadline" type="number" min={1} max={90} value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} className="tnum" />
              </Field>
            </div>
            <div className="mt-3">
              <EarnToggle chainId={chainId} value={earnVault} onChange={setEarnVault} />
            </div>
          </Section>
        </div>

        {/* Live summary: what you are about to create. */}
        <aside className="lg:sticky lg:top-20">
          <Card flush className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <Eyebrow>Summary</Eyebrow>
              <p className={cn("mt-2 truncate text-[15px] font-medium", !title && "text-faint")}>{title || "Untitled job"}</p>
            </div>
            <div className="px-5 py-5">
              <p className={cn("tnum text-[36px] font-semibold leading-none tracking-[-0.035em]", !amountOk && "text-faint")}>
                {amountOk ? formatAmount(parseAmount(amount)) : "$0.00"}
              </p>
              <p className="mt-2 text-[12px] text-muted">{tokenMeta?.symbol} on {CHAINS[chainId].name}</p>
              <KV
                className="mt-5"
                rows={[
                  ["Release", POLICY_PRESET_COPY[policy.preset].title],
                  ["Worker", worker.trim() ? <span key="w" className="block truncate">{worker.trim()}</span> : "Anyone with the link"],
                  ["Link open", `${deadlineDays || "?"} days`],
                  earnVault ? ["Earning", "Yes, yield to you"] : null,
                ]}
              />
              <p className="mt-4 rounded-[var(--r-md)] border border-border bg-bg/50 p-3 text-[12px] leading-[18px] text-muted">{releaseText}</p>
            </div>
            <div className="border-t border-border bg-bg/40 px-5 py-4">
              {errs.form ? <p role="alert" className="mb-3 text-[12px] text-danger">{errs.form}</p> : null}
              <Button full size="lg" loading={busy} onClick={submit} disabled={!ready}>{cta}</Button>
              <p className="mt-2.5 text-center text-[12px] text-faint">Next: lock the money from the job page and share the link.</p>
            </div>
          </Card>
        </aside>
      </div>

      <Sheet open={Boolean(created)} onClose={() => created && router.push(`/j/${created.job.id}`)} title="Your job link is ready">
        {created ? (
          <div className="space-y-4">
            <p className="text-[14px] leading-6 text-muted">Share it with the worker. They see the scope and, once you lock the payment, that the money is held for them.</p>
            <CopyField label="Link" value={created.payUrl} mono={false} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => share("whatsapp")}>WhatsApp</Button>
              <Button variant="secondary" onClick={() => share("email")}>Email</Button>
            </div>
            <div>
              <Eyebrow>Or hand it to an agent</Eyebrow>
              <CopyField className="mt-2" label="MCP" value={created.mcpHint} />
            </div>
            <Button full size="lg" onClick={() => router.push(`/j/${created.job.id}`)}>Open job and lock payment</Button>
          </div>
        ) : null}
      </Sheet>
    </Shell>
  );
}

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card flush>
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="tnum mt-px grid size-5 shrink-0 place-items-center rounded-full border border-border-strong text-[11px] font-medium text-muted">{n}</span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </Card>
  );
}
