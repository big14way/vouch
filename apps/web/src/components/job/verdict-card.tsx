"use client";
import { m } from "framer-motion";
import type { VerdictDto } from "@vouch/shared";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { TxLink } from "@/components/ui/tx-link";
import { dur, ease, useMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

const STAGE_COPY: Record<string, string> = {
  queued: "Reading scope",
  reading_scope: "Reading scope",
  checking_files: "Checking files",
  writing_report: "Writing report",
  attesting: "Recording the result",
  failed: "Verification hit a problem. It retries automatically.",
};

const ITEM_TONE: Record<string, string> = { met: "text-success", partial: "text-warn", missing: "text-danger", unverifiable: "text-muted" };
const ITEM_MARK: Record<string, string> = { met: "✓", partial: "◐", missing: "✕", unverifiable: "?" };

/** Verifying state: real stages, thin indeterminate sweep. Verdict reveal: confidence bar grows, items stagger in. */
export function VerdictCard({ verdict, chainId }: { verdict: VerdictDto | null; chainId: number }) {
  const mo = useMotion();
  if (!verdict || verdict.stage === null) return null;
  const running = verdict.stage !== "done";
  if (running) {
    return (
      <Card aria-live="polite">
        <CardTitle>Verifying</CardTitle>
        <Muted className="mt-1">{STAGE_COPY[verdict.stage ?? "queued"] ?? "Working"}</Muted>
        <div className="relative mt-3 h-1 overflow-hidden rounded bg-surface" aria-hidden>
          {!mo.reduced ? <m.div className="absolute inset-y-0 w-1/3 rounded bg-primary" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} /> : <div className="absolute inset-y-0 w-full bg-primary/40" />}
        </div>
      </Card>
    );
  }
  const v = verdict.verdict ?? "NEEDS_REVIEW";
  const pct = Math.round((verdict.confidence ?? 0) * 100);
  const tone = v === "PASS" ? "text-success" : v === "FAIL" ? "text-danger" : "text-warn";
  const label = v === "PASS" ? "Verified" : v === "FAIL" ? "Not delivered as scoped" : "Needs your review";
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className={cn("flex items-center gap-2", tone)}>
            {v === "PASS" && !mo.reduced ? (
              <m.svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <m.path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur.slow, ease: ease.out }} />
              </m.svg>
            ) : null}
            {label}
          </CardTitle>
          <Muted className="mt-0.5">Independent check of the delivery against the scope.</Muted>
        </div>
        <span className={cn("mono text-[22px] font-semibold", tone)}>{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded bg-surface" aria-label={`Confidence ${pct}%`} role="img">
        <m.div className={cn("h-full rounded", v === "PASS" ? "bg-success" : v === "FAIL" ? "bg-danger" : "bg-accent")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={mo.reduced ? { duration: dur.fast } : { duration: dur.slow, ease: ease.out }} />
      </div>
      {v === "NEEDS_REVIEW" && !mo.reduced ? <m.div className="mt-1 h-0.5 rounded bg-accent" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: dur.slow, ease: ease.out }} aria-hidden /> : null}

      <m.ul className="mt-4 space-y-2" variants={v === "FAIL" ? undefined : mo.stagger} initial="hidden" animate="show" aria-label="Scope checklist">
        {(verdict.scope_items ?? []).map((it, i) => (
          <m.li key={i} variants={v === "FAIL" ? undefined : mo.enterUp} className="rounded-[var(--r-md)] border border-border p-3">
            <div className="flex items-start gap-2">
              <span className={cn("mono mt-0.5 w-4 shrink-0 text-center", ITEM_TONE[it.status])} aria-label={it.status}>{ITEM_MARK[it.status]}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{it.item}</p>
                {it.evidence ? <p className="mt-0.5 text-[13px] text-muted">{it.evidence}</p> : null}
              </div>
            </div>
          </m.li>
        ))}
      </m.ul>

      {verdict.summary ? <p className="mt-4 text-[15px]">{verdict.summary}</p> : null}

      {verdict.red_flags.length ? (
        <div className="mt-3 rounded-[var(--r-md)] border border-danger/30 bg-danger/5 p-3">
          <p className="text-[13px] font-medium text-danger">Flags</p>
          <ul className="mt-1 list-disc pl-5 text-[13px]">{verdict.red_flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      ) : null}
      {verdict.questions_for_worker.length ? (
        <div className="mt-3">
          <p className="text-[13px] font-medium">Questions for the worker</p>
          <ul className="mt-1 list-disc pl-5 text-[13px] text-muted">{verdict.questions_for_worker.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
        {verdict.attestationTx ? <TxLink chainId={chainId} hash={verdict.attestationTx} label="Recorded on chain" /> : null}
        {verdict.reportUrl ? <a className="text-info hover:underline" href={verdict.reportUrl} target="_blank" rel="noreferrer">Full report</a> : null}
      </div>
    </Card>
  );
}
