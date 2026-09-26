"use client";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { dur, ease } from "@/components/motion";

export const STEPS = ["Lock", "Deliver", "Verify", "Settle"] as const;

/** Index of the current step for a status name; Dispute is shown as a branch under Settle. */
export function stepIndex(status: string): number {
  switch (status) {
    case "Open":
    case "None":
      return 0;
    case "Funded":
      return 1;
    case "Submitted":
      return 2;
    case "Attested":
      return 3;
    case "Settled":
    case "Resolved":
    case "Disputed":
    case "Refunded":
    case "Expired":
      return 4;
    default:
      return 0;
  }
}

const TERMINAL = new Set(["Settled", "Resolved", "Refunded", "Expired"]);

function labelsFor(status: string, disputed?: boolean) {
  return [...STEPS, disputed ? "Dispute" : status === "Refunded" || status === "Expired" ? "Refund" : "Paid"];
}

/**
 * Five-step progress. The connector fills left to right (300 ms) before the next dot lights, so the eye follows
 * the money; only the current step pulses, and nothing pulses once the job is finished.
 */
export function Timeline({ status, disputed, className }: { status: string; disputed?: boolean; className?: string }) {
  const idx = stepIndex(status);
  const finished = TERMINAL.has(status);
  const labels = labelsFor(status, disputed);
  return (
    <ol className={cn("flex items-start", className)} aria-label="Progress">
      {labels.map((label, i) => {
        const done = i < idx || (finished && i === idx);
        const active = i === idx && !finished;
        const danger = disputed && i === 4;
        return (
          <li key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-12 flex-col items-center gap-2">
              <span className="relative grid size-7 place-items-center" aria-current={active ? "step" : undefined}>
                {active ? <span className={cn("pulse-soft absolute inset-0 rounded-full", danger ? "bg-danger/25" : "bg-primary/20")} aria-hidden /> : null}
                <m.span
                  className={cn(
                    "relative grid size-[22px] place-items-center rounded-full border text-[11px] font-semibold tnum",
                    danger ? "border-danger bg-danger text-white" : done ? "border-primary bg-primary text-primary-fg" : active ? "border-primary bg-bg text-primary" : "border-border-strong bg-bg text-faint",
                  )}
                  initial={false}
                  animate={{ scale: active ? 1 : 0.92 }}
                  transition={{ duration: dur.base, ease: ease.out, delay: done ? 0 : 0.28 }}
                >
                  {done && !danger ? (
                    <m.svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <m.path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: 1 }} transition={{ duration: dur.base, ease: ease.out }} />
                    </m.svg>
                  ) : (
                    i + 1
                  )}
                </m.span>
              </span>
              <span className={cn("text-[12px] leading-none", done || active ? "text-text" : "text-faint", active && "font-medium")}>{label}</span>
            </div>
            {i < labels.length - 1 ? (
              <div className="relative mx-[-10px] mt-[13px] h-[2px] flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
                <m.div className="absolute inset-y-0 left-0 rounded-full bg-primary" initial={false} animate={{ width: i < idx || (finished && i < idx) ? "100%" : "0%" }} transition={{ duration: 0.3, ease: ease.out }} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Mobile form of the stepper: "Step 3 of 5 · Verify" over a thin segmented bar. */
export function CompactTimeline({ status, disputed, className }: { status: string; disputed?: boolean; className?: string }) {
  const idx = stepIndex(status);
  const finished = TERMINAL.has(status);
  const labels = labelsFor(status, disputed);
  return (
    <div className={className} aria-label="Progress">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted">{finished ? "Complete" : `Step ${idx + 1} of 5`}</span>
        <span className={cn("font-medium", disputed ? "text-danger" : "text-text")}>{labels[Math.min(idx, 4)]}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden>
        {labels.map((l, i) => (
          <span key={l} className="relative h-1 overflow-hidden rounded-full bg-border">
            <m.span className={cn("absolute inset-0 rounded-full", disputed && i === 4 ? "bg-danger" : "bg-primary", i === idx && !finished && "pulse-soft")} initial={false} animate={{ scaleX: i < idx || i === idx ? 1 : 0 }} style={{ originX: 0 }} transition={{ duration: 0.3, ease: ease.out, delay: i * 0.04 }} />
          </span>
        ))}
      </div>
    </div>
  );
}
