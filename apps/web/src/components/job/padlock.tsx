"use client";
import { m } from "framer-motion";
import { dur, ease, useMotion } from "@/components/motion";

/** Draws itself (SVG stroke, 320 ms) when a job becomes Locked — the "money is safe" moment. */
export function Padlock({ locked }: { locked: boolean }) {
  const mo = useMotion();
  const t = mo.reduced ? { duration: dur.fast } : { duration: dur.slow, ease: ease.out };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className={locked ? "text-primary" : "text-faint"}>
      <m.rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" initial={{ pathLength: 0, opacity: 0.4 }} animate={{ pathLength: locked ? 1 : 0, opacity: locked ? 1 : 0.4 }} transition={t} />
      <m.path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.4 }} animate={{ pathLength: locked ? 1 : 0, opacity: locked ? 1 : 0.4 }} transition={{ ...t, delay: mo.reduced ? 0 : 0.1 }} />
    </svg>
  );
}
