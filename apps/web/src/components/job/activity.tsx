"use client";
import { AnimatePresence, m } from "framer-motion";
import type { TimelineEvent } from "@vouch/shared";
import { TxLink } from "@/components/ui/tx-link";
import { dur, ease } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Plain-English titles for service and chain events; chain events read as the proof of the step before them. */
const TITLES: Record<string, string> = {
  created: "Job created",
  JobCreated: "Job registered on-chain",
  funded: "Payment locked",
  Funded: "Payment locked in the vault",
  delivered: "Work delivered",
  Submitted: "Delivery fingerprint recorded",
  resubmitted: "Work resubmitted",
  Resubmitted: "Resubmission recorded",
  verifier_done: "Verified",
  Attested: "Verdict recorded on-chain",
  approved: "Payer approved",
  Settled: "Paid to the worker",
  AutoSettled: "Paid automatically",
  disputed: "Dispute opened",
  Disputed: "Dispute recorded",
  Resolved: "Arbiter decided",
  Refunded: "Refunded to the payer",
  JobEarnSkipped: "Locked without earning",
  EarnDeposited: "Locked money earning",
};

function title(kind: string) {
  return TITLES[kind] ?? kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function when(at: string) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Vertical activity: newest first, chain events drawn as smaller proof rows; new events expand in at the top. */
export function Activity({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (!sorted.length) return <p className="px-5 py-4 text-[13px] text-muted">Nothing yet.</p>;
  return (
    <ol className="relative px-5 py-4">
      <span className="absolute bottom-6 left-[27px] top-6 w-px bg-border" aria-hidden />
      <AnimatePresence initial={false}>
        {sorted.map((e, i) => {
          const chain = e.source === "chain";
          const detail = e.kind === "verifier_done" && e.detail ? e.detail.replace("NEEDS_REVIEW", "Needs review").replace("PASS", "Pass").replace("FAIL", "Fail") : e.detail;
          return (
            <m.li
              key={`${e.kind}-${e.at}-${i}`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: dur.base, ease: ease.out }}
              className="relative flex gap-3.5 pb-4 last:pb-0"
            >
              <span className="relative z-10 mt-1.5 grid size-[15px] shrink-0 place-items-center rounded-full bg-surface" aria-hidden>
                <span className={cn("rounded-full", chain ? "size-[7px] border border-border-strong bg-bg" : "size-2 bg-primary", i === 0 && !chain && "ring-4 ring-primary/15")} />
              </span>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-[13px]", chain ? "text-muted" : "font-medium text-text")}>
                    {title(e.kind)}
                    {detail && e.kind !== "created" ? <span className="font-normal text-muted"> · {detail}</span> : null}
                  </p>
                  <p className="tnum mt-0.5 text-[12px] text-faint">{when(e.at)}</p>
                </div>
                {e.txHash && e.chainId ? <TxLink chainId={e.chainId} hash={e.txHash} className="shrink-0" /> : null}
              </div>
            </m.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

/** Scope markdown, rendered lightly: `## Heading` and `- item` lines, everything else as paragraphs. */
export function ScopeView({ md }: { md: string }) {
  const blocks: Array<{ h?: string; items: string[]; text: string[] }> = [];
  let cur: { h?: string; items: string[]; text: string[] } = { items: [], text: [] };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) {
      if (cur.h || cur.items.length || cur.text.length) blocks.push(cur);
      cur = { h: line.replace(/^#+\s*/, ""), items: [], text: [] };
    } else if (/^[-*]\s+/.test(line)) cur.items.push(line.replace(/^[-*]\s+/, ""));
    else if (line) cur.text.push(line);
  }
  if (cur.h || cur.items.length || cur.text.length) blocks.push(cur);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.h ? <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{b.h}</p> : null}
          {b.text.map((t, j) => <p key={j} className="text-[14px] leading-6 text-text">{t}</p>)}
          {b.items.length ? (
            <ul className="space-y-1.5">
              {b.items.filter((it) => it.trim()).map((it, j) => (
                <li key={j} className="flex gap-2.5 text-[14px] leading-6">
                  <span className="mt-[10px] size-1 shrink-0 rounded-full bg-faint" aria-hidden />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
