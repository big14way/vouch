"use client";
import { useEffect, useState } from "react";
import { formatDuration } from "@vouch/shared";
import { me, type Stats } from "@/lib/client/api";

/** Real numbers from the chain-backed funnel; renders nothing until they load (no invented metrics). */
export function LiveCounter({ className }: { className?: string }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    me.stats().then(setS).catch(() => undefined);
  }, []);
  if (!s) return null;
  const items: [string, string][] = [[String(s.settled), s.settled === 1 ? "job settled" : "jobs settled"]];
  if (s.autoSettledPct != null) items.push([`${s.autoSettledPct}%`, "paid automatically"]);
  if (s.medianTimeToSettleSeconds != null) items.push([formatDuration(Math.round(s.medianTimeToSettleSeconds)), "median, lock to paid"]);
  return (
    <ul className={className} aria-live="polite" aria-label="Live numbers">
      {items.map(([v, l]) => (
        <li key={l} className="flex items-baseline gap-1.5">
          <span className="mono text-[15px] font-semibold text-text">{v}</span>
          <span className="text-[13px] text-muted">{l}</span>
        </li>
      ))}
    </ul>
  );
}
