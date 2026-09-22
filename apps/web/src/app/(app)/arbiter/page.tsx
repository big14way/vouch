"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/client/auth";
import { useQuery } from "@tanstack/react-query";
import { formatAmount, shortAddress } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { TxLink } from "@/components/ui/tx-link";
import { VerdictCard } from "@/components/job/verdict-card";
import { useToast } from "@/components/ui/toast";
import { jobs, me, ClientError, type ArbiterItem } from "@/lib/client/api";

function Item({ item, onDone }: { item: ArbiterItem; onDone: () => void }) {
  const toast = useToast();
  const [split, setSplit] = useState(50);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const j = item.job;
  const resolve = async () => {
    setBusy(true);
    try {
      const r = await jobs.resolve(j.id, split * 100, note);
      toast({ title: "Resolved", body: `${split}% to the worker.`, tone: "success" });
      onDone();
      void r;
    } catch (e) {
      const ce = e instanceof ClientError ? e : null;
      toast({ title: ce?.message ?? "Could not resolve.", body: ce?.next, tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{j.title}</CardTitle>
          <Muted className="mt-0.5">{j.amount ? formatAmount(j.amount, { symbol: j.tokenSymbol }) : ""} · payer {j.payer ? shortAddress(j.payer) : "?"} · worker {j.worker ? shortAddress(j.worker) : "?"}</Muted>
        </div>
        <StatusPill pill={j.pill} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[15px] font-medium">Scope</summary>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px]">{j.scopeMd}</pre>
      </details>
      <details className="mt-2" open>
        <summary className="cursor-pointer text-[15px] font-medium">Evidence</summary>
        <ul className="mt-2 space-y-1 text-[13px]">
          {item.evidence.files.map((f) => <li key={f.sha256}><a className="text-info hover:underline" href={f.url} target="_blank" rel="noreferrer">{f.name}</a> <span className="mono text-muted">{f.sha256.slice(0, 18)}…</span></li>)}
          {item.evidence.links.map((l) => <li key={l}><a className="text-info hover:underline break-all" href={l} target="_blank" rel="noreferrer">{l}</a></li>)}
          {item.evidence.note ? <li className="text-muted">Note: {item.evidence.note}</li> : null}
        </ul>
      </details>
      <div className="mt-3"><VerdictCard verdict={item.verdict} chainId={j.chainId} /></div>
      {item.disputes.map((d) => (
        <div key={d.id} className="mt-3 rounded-[var(--r-md)] border border-danger/30 p-3 text-[13px]">
          <p><span className="font-medium">{d.by === j.payer ? "Payer" : "Worker"} says:</span> {d.reason}</p>
          <Muted className="mt-1">{new Date(d.createdAt).toLocaleString()}</Muted>
        </div>
      ))}
      {j.status === "Disputed" ? (
        <div className="mt-4">
          <label htmlFor={`split-${j.id}`} className="text-[13px] font-medium">Worker receives {split}% · payer {100 - split}%</label>
          <input id={`split-${j.id}`} type="range" min={0} max={100} step={5} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
          <textarea aria-label="Decision note" className="mt-2 w-full rounded-[var(--r-md)] border border-border bg-bg p-2 text-[13px]" placeholder="Why (kept with the case)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="mt-2" full loading={busy} onClick={resolve}>Resolve {split}/{100 - split}</Button>
        </div>
      ) : <Muted className="mt-3">Stuck: delivered over a week ago with no decision. Nudge the payer{j.txs.submitted ? <> · <TxLink chainId={j.chainId} hash={j.txs.submitted} /></> : null}</Muted>}
    </Card>
  );
}

/** S7 Arbiter (allow-listed): both sides' evidence, verifier report, split slider, resolve. */
export default function ArbiterPage() {
  const { ready, authenticated, login } = useAuth();
  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);
  const who = useQuery({ queryKey: ["me"], queryFn: me.get, enabled: ready && authenticated });
  const q = useQuery({ queryKey: ["arbiter"], queryFn: me.arbiterQueue, enabled: Boolean(who.data?.isArbiter) });
  return (
    <Shell>
      <h1 className="text-[22px] font-semibold">Disputes</h1>
      {who.data && !who.data.isArbiter ? <EmptyState title="Arbiters only" body="Your account is not on the arbiter list." /> : q.isLoading ? <Skeleton className="mt-4 h-40" /> : q.data?.items.length ? (
        <div className="mt-4 space-y-4">{q.data.items.map((it) => <Item key={it.job.id} item={it} onDone={() => q.refetch()} />)}</div>
      ) : <EmptyState title="Queue is empty" body="No open disputes or stuck jobs." />}
    </Shell>
  );
}
