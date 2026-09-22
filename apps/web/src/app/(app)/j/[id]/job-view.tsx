"use client";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import type { JobDto } from "@vouch/shared";
import { chainMeta, earnsWhileLocked, shortAddress } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Timeline } from "@/components/ui/timeline";
import { TxLink } from "@/components/ui/tx-link";
import { AmountDisplay } from "@/components/ui/amount-display";
import dynamic from "next/dynamic";
import { VerdictCard } from "@/components/job/verdict-card";
import { CountdownRing } from "@/components/job/countdown-ring";
import { Padlock } from "@/components/job/padlock";
import { dur, ease, useMotion } from "@/components/motion";
import { useJob, type JobSnapshot } from "@/lib/client/hooks";

export type JobInitial = JobSnapshot;

// Wallet-touching panels load only when the viewer can act, keeping the public job page light.
const PayPanel = dynamic(() => import("@/components/job/pay-panel").then((m) => m.PayPanel), { ssr: false, loading: () => <Skeleton className="h-40" /> });
const DeliverForm = dynamic(() => import("@/components/job/deliver-form").then((m) => m.DeliverForm), { ssr: false, loading: () => <Skeleton className="h-64" /> });
const JobActions = dynamic(() => import("@/components/job/actions").then((m) => m.JobActions), { ssr: false });

export function JobView({ id, initial }: { id: string; initial?: JobInitial | null }) {
  const { job, verdict, timeline, loading, error } = useJob(id, initial);
  const qc = useQueryClient();
  const mo = useMotion();
  const [justLocked, setJustLocked] = useState(false);
  const onChange = (j: JobDto) => {
    if (job && job.status === "Open" && j.status === "Funded") setJustLocked(true);
    qc.setQueryData(["job", id], { job: j });
  };
  useEffect(() => {
    if (justLocked) {
      const t = setTimeout(() => setJustLocked(false), 2000);
      return () => clearTimeout(t);
    }
  }, [justLocked]);

  if (loading) {
    return (
      <Shell narrow>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-3 h-24 w-full" />
        <Skeleton className="mt-3 h-40 w-full" />
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
  const disputed = job.status === "Disputed";
  const showDeliver = (job.role === "worker" || (job.role === "public" && !job.worker)) && job.status === "Funded";
  const showResubmit = job.role === "worker" && job.status === "Attested" && job.verdict === "FAIL" && job.resubmits < 2;

  return (
    <Shell narrow>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">{job.title}</h1>
          <Muted className="mt-1">{chainMeta(job.chainId).shortName} · {job.shortId}</Muted>
        </div>
        <StatusPill pill={job.pill} />
      </div>

      <m.div
        className="mt-4 rounded-[var(--r-lg)] border p-4 shadow-[var(--shadow)]"
        animate={{ borderColor: locked ? "var(--primary)" : "var(--border)" }}
        transition={mo.reduced ? { duration: dur.fast } : { duration: dur.slow, ease: ease.out, delay: justLocked ? 0.3 : 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <Muted>{job.status === "Settled" || job.status === "Resolved" ? "Paid" : locked ? "Locked" : "Amount"}</Muted>
            <AmountDisplay amount={job.amount} symbol={job.tokenSymbol} countUp={justLocked} />
          </div>
          <Padlock locked={locked} />
        </div>
        <div className="mt-4">
          <Timeline status={job.status} disputed={disputed} />
        </div>
        {job.autoSettleAt && job.status === "Attested" ? (
          <div className="mt-4">
            <CountdownRing at={job.autoSettleAt} from={job.attestedAt} />
          </div>
        ) : null}
      </m.div>

      {job.status === "Open" ? <div className="mt-4"><PayPanel job={job} onFunded={onChange} /></div> : null}

      {showDeliver ? <div className="mt-4"><DeliverForm job={job} onDone={onChange} /></div> : null}
      {showResubmit ? <div className="mt-4"><DeliverForm job={job} resubmit onDone={onChange} /></div> : null}

      {verdict && verdict.stage ? (
        <m.div className="mt-4" variants={mo.enterUp} initial="hidden" animate="show">
          <VerdictCard verdict={verdict} chainId={job.chainId} entrance={!(initial?.verdict?.stage === "done" && verdict?.attestationHash === initial.verdict.attestationHash)} />
        </m.div>
      ) : null}

      <div className="mt-4">
        <JobActions job={job} onChange={onChange} />
      </div>

      <Card className="mt-4">
        <CardTitle>Scope</CardTitle>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[15px] leading-relaxed">{job.scopeMd}</pre>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-muted">Payer</dt>
          <dd className="mono">{job.payer ? shortAddress(job.payer) : "Not yet"}</dd>
          <dt className="text-muted">Worker</dt>
          <dd className="mono">{job.worker ? shortAddress(job.worker) : job.workerHint ?? "First to deliver"}</dd>
          {job.submitDeadlineAt ? (<><dt className="text-muted">Deliver by</dt><dd>{new Date(job.submitDeadlineAt).toLocaleString()}</dd></>) : null}
          <dt className="text-muted">Release</dt>
          <dd>{job.policy.autoRelease === 0 ? "When the payer approves" : `Automatically at ≥ ${Math.round(job.policy.minConfidenceBps / 100)}% after ${Math.round(job.policy.reviewWindow / 3600)} h`}</dd>
          {earnsWhileLocked(job.policy) ? (<><dt className="text-muted">Earning</dt><dd>{locked && job.status !== "Settled" && job.status !== "Resolved" && job.status !== "Refunded" ? "Locked money is earning for the payer in a Tempo Earn vault" : "Earned for the payer while locked; principal returned in full at settlement"}</dd></>) : null}
        </dl>
      </Card>

      <Card className="mt-4">
        <CardTitle>How you&rsquo;re protected</CardTitle>
        <ul className="mt-2 space-y-1 text-[13px] text-muted">
          <li>Files are fingerprinted the moment they are delivered.</li>
          <li>Payment only moves under the rules the payer set, or on their approval.</li>
          <li>Either side can dispute; an arbiter sees the same evidence.</li>
        </ul>
      </Card>

      <Card className="mt-4">
        <CardTitle>Activity</CardTitle>
        {timeline.length === 0 ? <Muted className="mt-2">Nothing yet.</Muted> : (
          <ol className="mt-2 space-y-2">
            {timeline.map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
                <div>
                  <span className="font-medium">{e.kind.replace(/_/g, " ")}</span>
                  {e.detail ? <span className="text-muted"> · {e.detail}</span> : null}
                  <div className="text-muted">{new Date(e.at).toLocaleString()}</div>
                </div>
                {e.txHash && e.chainId ? <TxLink chainId={e.chainId} hash={e.txHash} /> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </Shell>
  );
}
