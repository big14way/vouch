import { cn } from "@/lib/utils";

type Tone = "neutral" | "progress" | "success" | "warn" | "danger";

const PILL_TONE: Record<string, Tone> = {
  "Awaiting payment": "neutral",
  Locked: "progress",
  Delivered: "progress",
  Verifying: "progress",
  Verified: "success",
  "Needs review": "warn",
  Paid: "success",
  Disputed: "danger",
  Refunded: "neutral",
  Expired: "neutral",
};

const TONE: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "border-border-strong bg-overlay text-muted", dot: "bg-faint" },
  progress: { pill: "border-info/25 bg-info/10 text-[color-mix(in_oklab,var(--info)_85%,white)]", dot: "bg-info" },
  success: { pill: "border-success/25 bg-success/10 text-success", dot: "bg-success" },
  warn: { pill: "border-warn/25 bg-warn/10 text-warn", dot: "bg-warn" },
  danger: { pill: "border-danger/25 bg-danger/10 text-danger", dot: "bg-danger" },
};

export function toneOf(pill: string): Tone {
  return PILL_TONE[pill] ?? "progress";
}

export function StatusDot({ pill, live = false, className }: { pill: string; live?: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", TONE[toneOf(pill)].dot, live && "pulse-soft", className)} />;
}

export function StatusPill({ pill, className }: { pill: string; className?: string }) {
  const tone = toneOf(pill);
  const live = tone === "progress";
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-[var(--r-pill)] border px-2.5 text-[12px] font-medium", TONE[tone].pill, className)}>
      <StatusDot pill={pill} live={live} />
      {pill}
    </span>
  );
}
