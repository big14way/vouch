import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  "Awaiting payment": "bg-surface text-muted border-border",
  Locked: "bg-primary/10 text-primary border-primary/20",
  Delivered: "bg-info/5 text-info border-info/20",
  Verified: "bg-success/5 text-success border-success/20",
  "Needs review": "bg-accent/15 text-warn border-accent/30",
  Paid: "bg-success/5 text-success border-success/20",
  Disputed: "bg-danger/10 text-danger border-danger/20",
  Refunded: "bg-surface text-muted border-border",
  Expired: "bg-surface text-muted border-border",
};

export function StatusPill({ pill, className }: { pill: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border px-2.5 py-0.5 text-[13px] font-medium", TONE[pill] ?? TONE.Locked, className)}>
      {pill === "Verified" || pill === "Paid" ? <span aria-hidden>✓</span> : null}
      {pill}
    </span>
  );
}
