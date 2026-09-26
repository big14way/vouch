"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight, Plus } from "lucide-react";
import { formatAmount, chainMeta } from "@vouch/shared";
import { useAuth } from "@/lib/client/auth";
import { Shell } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, Eyebrow } from "@/components/ui/card";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { StatusDot, StatusPill } from "@/components/ui/status-pill";
import { dur, ease } from "@/components/motion";
import { jobs, me } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Tab = "all" | "payer" | "worker";

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function sum(values: string[]) {
  return values.reduce((a, b) => a + BigInt(b), 0n);
}

/** Balances, then every job you pay for or deliver, newest activity first. */
export default function Dashboard() {
  const { ready, authenticated, login } = useAuth();
  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);
  const enabled = ready && authenticated;
  const list = useQuery({ queryKey: ["jobs"], queryFn: jobs.list, enabled });
  const bal = useQuery({ queryKey: ["balances"], queryFn: me.balances, enabled });
  const [tab, setTab] = useState<Tab>("all");
  // Until auth resolves the queries are idle, not empty: show the skeleton, never a false "No jobs yet".
  const loadingJobs = !enabled || list.isLoading;
  const loadingBal = !enabled || bal.isLoading;

  const all = useMemo(() => [...(list.data?.jobs ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [list.data]);
  const rows = all.filter((j) => tab === "all" || j.role === tab);
  const needsYou = all.filter((j) => j.role === "payer" && j.status === "Attested" && !j.autoSettleAt).length;
  const balances = bal.data?.balances ?? [];
  const available = sum(balances.map((b) => b.available));
  const locked = sum(balances.map((b) => b.locked));
  const incoming = sum(all.filter((j) => j.role === "worker" && j.amount && ["Funded", "Submitted", "Attested"].includes(j.status)).map((j) => j.amount!));

  const tiles = [
    { k: "Available", v: available, sub: balances.filter((b) => BigInt(b.available) > 0n).map((b) => `${b.symbol} · ${chainMeta(b.chainId).shortName}`).join(", ") || "Paid out or refunded to you", accent: true, href: "/withdraw" },
    { k: "Locked as payer", v: locked, sub: "Held until the work is verified" },
    { k: "Incoming", v: incoming, sub: "Locked for work you are delivering" },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[28px]">Jobs</h1>
          <p className="mt-1 text-[13px] text-muted">{needsYou ? <span className="text-warn">{needsYou} waiting for your review</span> : "Everything you pay for or deliver."}</p>
        </div>
        <Link href="/new" className={buttonVariants({ size: "md" })}>
          <Plus className="size-4" strokeWidth={2.5} /> New job
        </Link>
      </div>

      <div className="-mx-5 mt-7 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {tiles.map((t) => {
          const body = (
            <Card className={cn("h-full min-w-[240px] snap-start transition-colors", t.href && "hover:border-border-strong")}>
              <div className="flex items-center justify-between">
                <Eyebrow>{t.k}</Eyebrow>
                {t.href ? <ArrowUpRight className="size-4 text-faint" /> : null}
              </div>
              {(t.k === "Incoming" ? loadingJobs : loadingBal) ? <Skeleton className="mt-3 h-8 w-32" /> : <p className={cn("tnum mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.03em]", t.accent && t.v > 0n ? "text-success" : t.v > 0n ? "text-text" : "text-faint")}>{formatAmount(t.v)}</p>}
              <p className="mt-2 truncate text-[12px] text-faint">{t.sub}</p>
            </Card>
          );
          return t.href ? <Link key={t.k} href={t.href} className="block">{body}</Link> : <div key={t.k}>{body}</div>;
        })}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <div className="relative flex rounded-[var(--r-md)] border border-border bg-surface p-0.5" role="tablist">
          {(["all", "payer", "worker"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("relative h-8 rounded-[var(--r-sm)] px-3.5 text-[13px] transition-colors", tab === k ? "text-text" : "text-muted hover:text-text")}>
              {tab === k ? <m.span layoutId="tab-bg" className="absolute inset-0 rounded-[var(--r-sm)] border border-border-strong bg-overlay" transition={{ duration: dur.fast, ease: ease.out }} /> : null}
              <span className="relative">{k === "all" ? "All" : k === "payer" ? "Paying" : "Getting paid"}</span>
            </button>
          ))}
        </div>
        {!loadingJobs && all.length ? <span className="tnum text-[12px] text-faint">{rows.length} {rows.length === 1 ? "job" : "jobs"}</span> : null}
      </div>

      <div className="mt-3">
        {loadingJobs ? (
          <Card flush>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </Card>
        ) : rows.length ? (
          <Card flush className="overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_120px_60px_16px] gap-4 border-b border-border px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint md:grid">
              <span>Job</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Updated</span>
              <span />
            </div>
            <ul>
              {rows.map((j, i) => (
                <m.li key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.fast, delay: Math.min(i, 8) * 0.03 }}>
                  <Link href={`/j/${j.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-overlay/60 md:grid-cols-[minmax(0,1fr)_140px_120px_60px_16px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusDot pill={j.pill} className="md:hidden" />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{j.title}</p>
                        <p className="mt-0.5 truncate text-[12px] text-muted">{j.role === "payer" ? "You pay" : j.role === "worker" ? "You deliver" : "Viewing"} · {chainMeta(j.chainId).shortName}</p>
                      </div>
                    </div>
                    <span className="hidden md:block"><StatusPill pill={j.pill} /></span>
                    <span className="tnum text-right text-[14px] font-medium">{j.amount ? formatAmount(j.amount) : "—"}</span>
                    <span className="tnum hidden text-right text-[12px] text-faint md:block">{ago(j.updatedAt)}</span>
                    <ChevronRight className="hidden size-4 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text md:block" />
                    <span className="text-[12px] text-faint md:hidden">{j.pill} · {ago(j.updatedAt)}</span>
                  </Link>
                </m.li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title={tab === "worker" ? "Nothing to deliver yet" : "No jobs yet"}
            body={tab === "worker" ? "When someone sends you a job link, it shows up here." : "Lock your first job. The money stays yours until the work passes."}
            action={<Link href="/new" className={buttonVariants({})}><Plus className="size-4" strokeWidth={2.5} /> Create a job</Link>}
            preview={
              <div className="space-y-2 text-left">
                {["Brand identity for Kora Coffee", "Landing page copy, 3 sections"].map((t) => (
                  <div key={t} className="flex items-center gap-3 rounded-[var(--r-md)] border border-border bg-bg px-4 py-3">
                    <span className="size-1.5 rounded-full bg-info" />
                    <span className="text-[13px]">{t}</span>
                    <span className="tnum ml-auto text-[13px] text-muted">$250.00</span>
                  </div>
                ))}
              </div>
            }
          />
        )}
      </div>
    </Shell>
  );
}
