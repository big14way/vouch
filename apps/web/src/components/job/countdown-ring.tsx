"use client";
import { formatDuration } from "@vouch/shared";
import { useNow } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

/** Live ring that depletes toward auto-settle; amber inside the last 24 h. */
export function CountdownRing({ at, from, label = "Pays automatically" }: { at: string; from: string | null; label?: string }) {
  const now = useNow();
  const end = new Date(at).getTime();
  const start = from ? new Date(from).getTime() : end - 86_400_000;
  const total = Math.max(end - start, 1);
  const left = Math.max(end - now, 0);
  const frac = Math.min(Math.max(left / total, 0), 1);
  const amber = left < 86_400_000;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} stroke="var(--border)" strokeWidth="4" fill="none" />
        <circle cx="22" cy="22" r={r} stroke={amber ? "var(--warn)" : "var(--primary)"} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 22 22)" style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <p className={cn("text-[15px]", amber && "text-warn")}>
        {left === 0 ? "Paying now" : `${label} in ${formatDuration(Math.round(left / 1000))} unless you review.`}
      </p>
    </div>
  );
}
