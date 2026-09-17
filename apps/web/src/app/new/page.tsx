"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { parseAmount, TOKENS, CHAINS, type ChainId, type JobDto } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
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

  return (
    <Shell narrow>
      <h1 className="text-[22px] font-semibold">New job</h1>
      <Muted className="mt-1">Write what you expect, set the amount, choose when it pays.</Muted>
      <Card className="mt-4">
        <Field error={errs.title}>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Logo redesign" maxLength={120} />
        </Field>
        <Field error={errs.scope}>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="scope">Scope</Label>
            <Button type="button" variant="link" size="sm" onClick={() => setScope((s) => (s.trim() ? s : TEMPLATE))}>Use template</Button>
          </div>
          <Textarea id="scope" value={scope} onChange={(e) => setScope(e.target.value)} className="min-h-48 mono text-[13px]" placeholder="Deliverables, format, deadline, out of scope." />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field error={errs.amount}>
            <Label htmlFor="amount">Amount ($)</Label>
            <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" />
          </Field>
          <Field>
            <Label htmlFor="token">Token</Label>
            <Select id="token" value={`${chainId}:${token}`} onChange={(e) => { const [c, t] = e.target.value.split(":"); setChainId(Number(c) as ChainId); setToken(t!); }}>
              {ENABLED.map((c) => TOKENS[c].map((t) => <option key={`${c}:${t.address}`} value={`${c}:${t.address}`}>{t.symbol} · {CHAINS[c].shortName}</option>))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label htmlFor="worker" hint="optional">Worker</Label>
          <Input id="worker" value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Email, wallet address, or agent URL" />
        </Field>
        <div className="mb-4">
          <PolicyPicker value={policy} onChange={setPolicy} />
        </div>
        <div className="mb-4">
          <EarnToggle chainId={chainId} value={earnVault} onChange={setEarnVault} />
        </div>
        <Field>
          <Label htmlFor="deadline" hint="days the pay link stays open">Payment deadline</Label>
          <Input id="deadline" type="number" min={1} max={90} value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} />
        </Field>
        {errs.form ? <p role="alert" className="mb-3 text-[13px] text-danger">{errs.form}</p> : null}
        <Button full size="lg" loading={busy} onClick={submit} disabled={!ready}>{authenticated ? "Create job link" : "Sign in and create"}</Button>
      </Card>

      <Sheet open={Boolean(created)} onClose={() => created && router.push(`/j/${created.job.id}`)} title="Your job link is ready">
        {created ? (
          <div className="space-y-3">
            <Muted>Share it with the worker. Lock the payment from the job page when you are ready.</Muted>
            <CopyField label="Link" value={created.payUrl} mono={false} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => share("whatsapp")}>WhatsApp</Button>
              <Button variant="secondary" onClick={() => share("email")}>Email</Button>
            </div>
            <CardTitle className="pt-2 text-[15px]">Send to an agent</CardTitle>
            <CopyField label="MCP" value={created.mcpHint} />
            <Button full size="lg" onClick={() => router.push(`/j/${created.job.id}`)}>Open job</Button>
          </div>
        ) : null}
      </Sheet>
    </Shell>
  );
}
