"use client";
import { useEffect, useRef, useState } from "react";
import { m, useInView } from "framer-motion";
import { formatDuration } from "@vouch/shared";
import { useMotion } from "@/components/motion";
import { me, type Stats } from "@/lib/client/api";

const STEPS: [string, string][] = [
  ["Lock", "You write the scope and lock the amount."],
  ["Deliver", "The worker submits. Files are fingerprinted."],
  ["Verify", "An independent check compares delivery to scope and records the result."],
  ["Settle", "Payment releases on your approval, or automatically under your rules."],
  ["Dispute", "If either side objects, an arbiter sees the same evidence and splits."],
];

/** Plays once on scroll. */
export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mo = useMotion();
  return (
    <section className="mt-10" aria-labelledby="how">
      <h2 id="how" className="text-[22px] font-semibold">How it works</h2>
      <m.ol ref={ref} className="mt-4 grid gap-3 sm:grid-cols-5" variants={mo.stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
        {STEPS.map(([t, b], i) => (
          <m.li key={t} variants={mo.enterUp} className="relative rounded-[var(--r-lg)] border border-border p-4">
            <span className="mono text-[13px] text-muted">{i + 1}</span>
            <p className="mt-1 text-[15px] font-medium">{t}</p>
            <p className="mt-1 text-[13px] text-muted">{b}</p>
          </m.li>
        ))}
      </m.ol>
    </section>
  );
}

/** Real numbers from the chain-backed funnel; renders nothing until they load (no invented metrics). */
export function LiveCounter() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    me.stats().then(setS).catch(() => undefined);
  }, []);
  if (!s) return null;
  return (
    <p className="mt-4 text-[13px] text-muted" aria-live="polite">
      <span className="mono font-semibold text-text">{s.settled}</span> jobs settled
      {s.autoSettledPct != null ? <> · <span className="mono font-semibold text-text">{s.autoSettledPct}%</span> paid automatically</> : null}
      {s.medianTimeToSettleSeconds != null ? <> · median <span className="mono font-semibold text-text">{formatDuration(Math.round(s.medianTimeToSettleSeconds))}</span> from lock to paid</> : null}
    </p>
  );
}
