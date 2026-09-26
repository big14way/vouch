"use client";
import { m } from "framer-motion";
import { AlertTriangle, Check, CircleHelp, Loader2, ShieldAlert, X } from "lucide-react";
import type { VerdictDto } from "@vouch/shared";
import { Card } from "@/components/ui/card";
import { TxLink } from "@/components/ui/tx-link";
import { dur, ease, useMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "reading_scope", label: "Reading the scope" },
  { key: "checking_files", label: "Checking the delivered files" },
  { key: "writing_report", label: "Comparing item by item" },
  { key: "attesting", label: "Recording the verdict on-chain" },
] as const;

function stageIndex(stage: string | null) {
  if (stage === "queued" || stage === null) return 0;
  const i = STAGES.findIndex((s) => s.key === stage);
  return i < 0 ? 0 : i;
}

type Item = { item: string; status: string; evidence?: string | null };

const GROUPS = [
  { key: "missing", title: "Not met", match: (s: string) => s === "missing", icon: X, tone: "text-danger", ring: "bg-danger/12" },
  { key: "unclear", title: "Unclear", match: (s: string) => s === "partial" || s === "unverifiable", icon: CircleHelp, tone: "text-warn", ring: "bg-warn/12" },
  { key: "met", title: "Met", match: (s: string) => s === "met", icon: Check, tone: "text-success", ring: "bg-success/12" },
] as const;

/**
 * Verifying: the real stages as a checklist (Vercel build-step style). Verdict: one sentence, a confidence figure,
 * then the scope items grouped Not met → Unclear → Met (empty groups hidden), each with its evidence.
 * `entrance={false}` renders the final state at once, for a page that arrives with the verdict already recorded.
 */
export function VerdictCard({ verdict, chainId, entrance = true, settled = false }: { verdict: VerdictDto | null; chainId: number; entrance?: boolean; settled?: boolean }) {
  const mo = useMotion();
  if (!verdict || verdict.stage === null) return null;

  if (verdict.stage !== "done") {
    const cur = stageIndex(verdict.stage);
    const failed = verdict.stage === "failed";
    return (
      <Card flush aria-live="polite" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-info/12 text-info">
              {failed ? <AlertTriangle className="size-3.5 text-warn" /> : <Loader2 className="size-3.5 animate-spin" />}
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{failed ? "Verification paused" : "Verifying the delivery"}</p>
              <p className="text-[12px] text-muted">{failed ? "It retries automatically. Nothing moves until it finishes." : "An independent check against the written scope. It cannot move money."}</p>
            </div>
          </div>
        </div>
        <ol className="space-y-3 px-5 py-4">
          {STAGES.map((s, i) => {
            const done = i < cur;
            const active = i === cur && !failed;
            return (
              <li key={s.key} className="flex items-center gap-3 text-[13px]">
                <span className={cn("grid size-5 place-items-center rounded-full border", done ? "border-primary bg-primary text-primary-fg" : active ? "border-info/60 text-info" : "border-border-strong text-faint")}>
                  {done ? <Check className="size-3" strokeWidth={3} /> : active ? <span className="pulse-soft size-1.5 rounded-full bg-info" /> : null}
                </span>
                <span className={cn(done ? "text-muted" : active ? "font-medium text-text" : "text-faint")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        {!mo.reduced && !failed ? (
          <div className="relative h-[2px] overflow-hidden bg-border" aria-hidden>
            <m.div className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-info to-transparent" animate={{ x: ["-100%", "400%"] }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }} />
          </div>
        ) : null}
      </Card>
    );
  }

  const v = verdict.verdict ?? "NEEDS_REVIEW";
  const pct = Math.round((verdict.confidence ?? 0) * 100);
  const items = (verdict.scope_items ?? []) as Item[];
  const met = items.filter((i) => i.status === "met").length;
  const look =
    v === "PASS"
      ? { title: "Verified against the scope", tone: "text-success", bar: "bg-success", badge: "bg-success/12 text-success", Icon: Check }
      : v === "FAIL"
        ? { title: "Not delivered as scoped", tone: "text-danger", bar: "bg-danger", badge: "bg-danger/12 text-danger", Icon: X }
        : settled
          ? { title: "Reviewed and released by the payer", tone: "text-text", bar: "bg-warn", badge: "bg-warn/12 text-warn", Icon: CircleHelp }
          : { title: "Needs your review", tone: "text-warn", bar: "bg-warn", badge: "bg-warn/12 text-warn", Icon: CircleHelp };
  const t = (delay = 0) => (mo.reduced ? { duration: dur.fast } : { duration: dur.base, ease: ease.out, delay });

  return (
    <Card flush className="overflow-hidden">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <m.span className={cn("grid size-9 shrink-0 place-items-center rounded-full", look.badge)} initial={entrance ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={mo.reduced ? { duration: dur.fast } : { type: "spring", stiffness: 420, damping: 22 }}>
              <look.Icon className="size-[18px]" strokeWidth={2.5} />
            </m.span>
            <div className="min-w-0">
              <h2 className={cn("text-[17px] font-semibold tracking-[-0.015em]", look.tone)}>{look.title}</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {items.length ? `${met} of ${items.length} scope items met` : "Independent check of the delivery"} · checked by the Vouch verifier
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("tnum text-[28px] font-semibold leading-none tracking-[-0.03em]", look.tone)}>{pct}%</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-faint">confidence</p>
          </div>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-border" role="img" aria-label={`Confidence ${pct}%`}>
          <m.div className={cn("h-full rounded-full", look.bar)} initial={entrance ? { width: 0 } : false} animate={{ width: `${pct}%` }} transition={mo.reduced ? { duration: dur.fast } : { duration: 0.3, ease: ease.out, delay: 0.1 }} />
        </div>
        {verdict.summary ? <p className="mt-4 text-[14px] leading-6 text-text/90">{verdict.summary}</p> : null}
      </div>

      {verdict.red_flags.length ? (
        <m.div className="mx-5 mb-4 rounded-[var(--r-md)] border border-danger/30 bg-danger/[0.07] p-4" initial={entrance ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={t(0.15)}>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-danger">
            <ShieldAlert className="size-4" /> Manipulation attempt flagged · automatic release blocked
          </p>
          <ul className="mt-2 space-y-1.5">
            {verdict.red_flags.map((f, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-5 text-text/85">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-danger" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </m.div>
      ) : null}

      <m.div className="border-t border-border" variants={mo.stagger} initial={entrance ? "hidden" : false} animate="show">
        {GROUPS.map((g) => {
          const rows = items.filter((i) => g.match(i.status));
          if (!rows.length) return null;
          return (
            <section key={g.key} aria-label={g.title}>
              <p className="flex items-center justify-between bg-bg/40 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                {g.title}
                <span className="tnum">{rows.length}</span>
              </p>
              <ul>
                {rows.map((it, i) => (
                  <m.li key={i} variants={mo.enterUp} className="flex gap-3 border-t border-border/70 px-5 py-3.5">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", g.ring, g.tone)} aria-label={it.status}>
                      <g.icon className="size-3" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium leading-5">{it.item}</p>
                      {it.evidence ? <p className="mt-1 text-[13px] leading-5 text-muted">{it.evidence}</p> : null}
                    </div>
                  </m.li>
                ))}
              </ul>
            </section>
          );
        })}
      </m.div>

      {verdict.questions_for_worker.length ? (
        <div className="border-t border-border px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Questions for the worker</p>
          <ul className="mt-2 space-y-1.5">
            {verdict.questions_for_worker.map((q, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-5 text-muted">
                <span className="text-faint">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-border bg-bg/40 px-5 py-3">
        {verdict.attestationTx ? <TxLink chainId={chainId} hash={verdict.attestationTx} label="Verdict recorded on-chain" /> : null}
        {verdict.reportUrl ? (
          <a className="group inline-flex items-center gap-0.5 text-[12px] text-muted hover:text-text" href={verdict.reportUrl} target="_blank" rel="noreferrer">
            Full report
          </a>
        ) : null}
        <span className="ml-auto text-[12px] text-faint">The verifier can never move money</span>
      </div>
    </Card>
  );
}
