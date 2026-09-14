"use client";
import { m } from "framer-motion";
import { Check } from "lucide-react";
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

/** Five-step horizontal timeline. Dots fill as the state advances (320 ms). */
export function Timeline({ status, disputed }: { status: string; disputed?: boolean }) {
  const idx = stepIndex(status);
  const labels = [...STEPS, disputed ? "Dispute" : status === "Refunded" || status === "Expired" ? "Refund" : "Paid"];
  return (
    <ol className="flex items-center gap-1" aria-label="Progress">
      {labels.map((label, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={label} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <m.span
                className={cn("grid size-6 place-items-center rounded-full border-2 text-[11px] font-semibold", done || active ? "border-primary" : "border-border", done ? "bg-primary text-primary-fg" : "bg-bg text-muted", disputed && i === 4 && "border-danger bg-danger text-white")}
                initial={false}
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ duration: dur.slow, ease: ease.out }}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </m.span>
              <span className={cn("text-[11px] leading-none", done || active ? "text-text" : "text-muted")}>{label}</span>
            </div>
            {i < labels.length - 1 ? (
              <div className="relative mb-4 h-0.5 flex-1 rounded bg-border" aria-hidden>
                <m.div className="absolute inset-y-0 left-0 rounded bg-primary" initial={false} animate={{ width: done ? "100%" : "0%" }} transition={{ duration: dur.slow, ease: ease.out }} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
