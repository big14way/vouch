"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import type { JobDto } from "@vouch/shared";
import { chainMeta, earnsWhileLocked, formatAmount, formatDuration, shortAddress } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Card, Eyebrow, KV, PanelHeader } from "@/components/ui/card";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { CompactTimeline, Timeline } from "@/components/ui/timeline";
import { AmountDisplay } from "@/components/ui/amount-display";
import dynamic from "next/dynamic";
import { VerdictCard } from "@/components/job/verdict-card";
import { Activity, ScopeView } from "@/components/job/activity";
import { Padlock } from "@/components/job/padlock";
import { ease, useMotion } from "@/components/motion";
import { useJob, useNow, type JobSnapshot } from "@/lib/client/hooks";
import { useAuth } from "@/lib/client/auth";
import { cn } from "@/lib/utils";

export type JobInitial = JobSnapshot;

// Wallet-touching panels load only when the viewer can act, keeping the public job page light.
const PayPanel = dynamic(() => import("@/components/job/pay-panel").then((m) => m.PayPanel), { ssr: false, loading: () => <Skeleton className="h-44 rounded-[var(--r-lg)]" /> });
const DeliverForm = dynamic(() => import("@/components/job/deliver-form").then((m) => m.DeliverForm), { ssr: false, loading: () => <Skeleton className="h-72 rounded-[var(--r-lg)]" /> });
const JobActions = dynamic(() => import("@/components/job/actions").then((m) => m.JobActions), { ssr: false });

const PAID = new Set(["Settled", "Resolved"]);

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** One sentence under the stepper: what happens next, for this viewer, and when. */
function nextStep(job: JobDto, now: number): { text: string; tone: "muted" | "warn" | "success" | "danger" } {
  const payer = job.role === "payer";
  const worker = job.role === "worker";
  const deadline = job.submitDeadlineAt ? new Date(job.submitDeadlineAt).toLocaleDateString([], { month: "short", day: "numeric" }) : null;
  switch (job.status) {
    case "Open":
      return { text: payer ? "Lock the payment to start. The worker sees it is held before they begin." : "Waiting for the payer to lock the payment.", tone: "muted" };
    case "Funded":
      return { text: worker || job.role === "public" ? `The money is locked for this job. Deliver${deadline ? ` by ${deadline}` : ""} to get paid.` : `Locked. Waiting for the delivery${deadline ? ` by ${deadline}` : ""}.`, tone: "muted" };
    case "Submitted":
      return { text: "Delivered. The verifier is checking it against the scope.", tone: "muted" };
    case "Attested": {
      if (job.autoSettleAt) {
        const left = Math.max(0, Math.round((new Date(job.autoSettleAt).getTime() - now) / 1000));
        return { text: left === 0 ? "Paying now." : `Pays automatically in ${formatDuration(left)}${payer ? " unless you review" : ""}.`, tone: "warn" };
      }
      return { text: payer ? "Review the verdict, then release the payment or dispute it." : "Waiting for the payer to review and release.", tone: "warn" };
    }
    case "Settled":
    case "Resolved":
      return { text: `Paid ${job.settledAt ? ago(job.settledAt, now) : ""}. ${job.status === "Resolved" ? "Split by the arbiter's decision." : "Sent to the worker's Vouch balance, withdrawable any time."}`, tone: "success" };
    case "Disputed":
      return { text: "In dispute. An arbiter reviews the same pinned evidence and decides the split.", tone: "danger" };
    case "Refunded":
    case "Expired":
      return { text: "Nothing was delivered in time. The locked amount went back to the payer.", tone: "muted" };
    default:
      return { text: "", tone: "muted" };
  }
}

export function JobView({ id, initial }: { id: string; initial?: JobInitial | null }) {
  const { job, verdict, timeline, loading, error } = useJob(id, initial);
  const qc = useQueryClient();
  const mo = useMotion();
  const now = useNow(1000);
  const [justLocked, setJustLocked] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const { ready, authenticated } = useAuth();
  // The first fetch can run before sign-in resolves (public view); refetch once it does, to get the viewer's role.
  useEffect(() => {
    if (ready && authenticated) void qc.invalidateQueries({ queryKey: ["job", id] });
  }, [ready, authenticated, qc, id]);
  const onChange = (j: JobDto) => {
    if (job && job.status === "Open" && j.status === "Funded") setJustLocked(true);
    if (job && !PAID.has(job.status) && PAID.has(j.status)) setJustPaid(true);
    qc.setQueryData(["job", id], { job: j });
  };
  useEffect(() => {
    if (!justLocked && !justPaid) return;
    const t = setTimeout(() => {
      setJustLocked(false);
      setJustPaid(false);
    }, 1400);
    return () => clearTimeout(t);
  }, [justLocked, justPaid]);

  if (loading) {
    return (
      <Shell>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-8 w-2/3 max-w-lg" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-[var(--r-lg)]" />
            <Skeleton className="h-64 rounded-[var(--r-lg)]" />
          </div>
          <Skeleton className="h-72 rounded-[var(--r-lg)]" />
        </div>
      </Shell>
    );
  }
  if (error || !job) {
    return (
      <Shell narrow>
        <EmptyState title="This job does not exist." body="Check the link, or ask the person who sent it." />
      </Shell>
    );
  }

  const locked = job.status !== "Open";
  const paid = PAID.has(job.status);
  const verdictArrivedLive = !(initial?.verdict?.stage != null && verdict?.attestationHash === initial.verdict.attestationHash && verdict?.stage === initial.verdict.stage);
  const disputed = job.status === "Disputed";
  const showDeliver = (job.role === "worker" || (job.role === "public" && !job.worker)) && job.status === "Funded";
  const showResubmit = job.role === "worker" && job.status === "Attested" && job.verdict === "FAIL" && job.resubmits < 2;
  const next = nextStep(job, now);
  const roleLabel = job.role === "payer" ? "You pay" : job.role === "worker" ? "You deliver" : job.role === "arbiter" ? "You arbitrate" : null;
  const amountLabel = paid ? "Paid" : job.status === "Refunded" || job.status === "Expired" ? "Refunded" : locked ? "Locked" : "Amount";

  return (
    <Shell>
      {/* Header */}
      <nav className="flex items-center gap-1.5 text-[12px] text-faint" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-text">Jobs</Link>
        <ChevronRight className="size-3.5" />
        <span className="mono">{job.shortId}</span>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.025em] sm:text-[28px] sm:leading-9">{job.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {roleLabel ? <span className="text-text">{roleLabel}</span> : null}
            {roleLabel ? <span className="text-faint">·</span> : null}
            <span>{chainMeta(job.chainId).name}</span>
            <span className="text-faint">·</span>
            <span>Created {ago(job.createdAt, now)}</span>
          </p>
        </div>
        <StatusPill pill={job.pill} className="mt-1.5" />
      </div>

      <div className="mt-7 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        {/* Main column */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          {/* Money card */}
          <m.div
            className={cn("order-1 relative overflow-hidden rounded-[var(--r-lg)] border bg-surface shadow-[var(--shadow)]", paid ? "border-success/35" : locked ? "border-primary/30" : "border-border")}
            initial={false}
            animate={{ borderColor: disputed ? "color-mix(in oklab, var(--danger) 45%, transparent)" : undefined }}
          >
            {/* Soft light from the lock: stronger once money is held. */}
            <div className={cn("pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl transition-opacity duration-500", paid ? "bg-success/15 opacity-100" : locked ? "bg-primary/10 opacity-100" : "opacity-0")} aria-hidden />
            {justPaid && !mo.reduced ? <m.div className="pointer-events-none absolute inset-0 bg-success/10" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6, ease: ease.out }} aria-hidden /> : null}
            <div className="relative flex items-start justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <Eyebrow>{amountLabel}</Eyebrow>
                <div className="mt-2">
                  <AmountDisplay amount={job.amount} symbol={job.tokenSymbol} size="xl" countUp={justLocked} className={paid && job.role === "worker" ? "text-success" : undefined} />
                </div>
                {job.amount && paid ? <p className="mt-2 text-[12px] text-muted">Worker receives {formatAmount(BigInt(job.amount) - (BigInt(job.amount) * BigInt(job.feeBps)) / 10000n)} after the {job.feeBps / 100}% fee</p> : null}
              </div>
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-[var(--r-md)] border", paid ? "border-success/30 bg-success/10" : locked ? "border-primary/25 bg-primary/10" : "border-border bg-bg")}>
                <Padlock locked={locked} />
              </span>
            </div>
            <div className="relative border-t border-border px-5 py-5 sm:px-6">
              <Timeline status={job.status} disputed={disputed} className="hidden sm:flex" />
              <CompactTimeline status={job.status} disputed={disputed} className="sm:hidden" />
            </div>
            {next.text ? (
              <div className={cn("relative flex items-center gap-2.5 border-t border-border bg-bg/40 px-5 py-3 text-[13px] sm:px-6", next.tone === "warn" ? "text-warn" : next.tone === "success" ? "text-success" : next.tone === "danger" ? "text-danger" : "text-muted")}>
                <span className={cn("size-1.5 shrink-0 rounded-full", next.tone === "warn" ? "pulse-soft bg-warn" : next.tone === "success" ? "bg-success" : next.tone === "danger" ? "bg-danger" : "pulse-soft bg-info")} aria-hidden />
                <span aria-live="polite">{next.text}</span>
              </div>
            ) : null}
          </m.div>

          {verdict && verdict.stage ? (
            <m.div className="order-3" variants={mo.enterUp} initial={verdictArrivedLive ? "hidden" : false} animate="show">
              <VerdictCard verdict={verdict} chainId={job.chainId} entrance={verdictArrivedLive} settled={paid} />
            </m.div>
          ) : null}

          {showDeliver ? <div className="order-3"><DeliverForm job={job} onDone={onChange} /></div> : null}
          {showResubmit ? <div className="order-3"><DeliverForm job={job} resubmit onDone={onChange} /></div> : null}

          <Card flush className="order-4">
            <PanelHeader title="Scope" meta="What the delivery is checked against. Fixed when the job was created." />
            <div className="px-5 py-4">
              <ScopeView md={job.scopeMd} />
            </div>
          </Card>

          <Card flush className="order-6">
            <PanelHeader title="Activity" meta="Every step, with its on-chain record." />
            <Activity events={timeline} />
          </Card>
        </div>

        {/* Right rail */}
        <aside className="contents lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-4">
          {job.status === "Open" && job.role !== "worker" ? <div className="order-2"><PayPanel job={job} onFunded={onChange} /></div> : null}
          <div className="order-2 empty:hidden">
            <JobActions job={job} onChange={onChange} />
          </div>

          <Card className="order-5">
            <Eyebrow>Details</Eyebrow>
            <KV
              className="mt-3"
              rows={[
                ["Payer", <span key="p" className="mono">{job.payer ? shortAddress(job.payer) : "Not yet"}</span>],
                ["Worker", <span key="w" className={job.worker ? "mono" : undefined}>{job.worker ? shortAddress(job.worker) : job.workerHint ?? "First to deliver"}</span>],
                ["Release", job.policy.autoRelease === 0 ? "When the payer approves" : `Auto at ≥ ${Math.round(job.policy.minConfidenceBps / 100)}% after ${Math.round(job.policy.reviewWindow / 3600)} h`],
                job.submitDeadlineAt ? ["Deliver by", new Date(job.submitDeadlineAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })] : null,
                ["Network", chainMeta(job.chainId).name],
                ["Fee", `${job.feeBps / 100}% of the payout`],
                earnsWhileLocked(job.policy) ? ["Earning", locked && !paid ? "Yield to the payer" : "Principal returned in full"] : null,
              ]}
            />
          </Card>

          <Card className="order-7">
            <Eyebrow>How you are protected</Eyebrow>
            <ul className="mt-3 space-y-3">
              {[
                { Icon: FileCheck2, t: "Files are fingerprinted the moment they are delivered. What is sent is what gets judged." },
                { Icon: ShieldCheck, t: "Money moves only under the payer's rules or on their approval. The verifier cannot move it." },
                { Icon: Scale, t: "Either side can dispute. An arbiter sees the same evidence." },
              ].map(({ Icon, t }) => (
                <li key={t} className="flex gap-3 text-[13px] leading-5 text-muted">
                  <Icon className="mt-0.5 size-4 shrink-0 text-faint" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}
