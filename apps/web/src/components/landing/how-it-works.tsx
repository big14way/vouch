"use client";
import { useRef } from "react";
import { m, useInView } from "framer-motion";
import { dur, ease, stagger, useMotion } from "@/components/motion";
import { DeliverGlyph, DisputeGlyph, LockGlyph, SettleGlyph, VerifyGlyph } from "./glyphs";

const STEPS = [
  { t: "Lock", b: "Write the scope in plain words. Lock the amount against it.", G: LockGlyph },
  { t: "Deliver", b: "The worker submits. Every file is fingerprinted as it lands.", G: DeliverGlyph },
  { t: "Verify", b: "An independent check reads the scope and the files, then records the result.", G: VerifyGlyph },
  { t: "Settle", b: "You approve, or it pays itself under the limits you set.", G: SettleGlyph },
  { t: "Dispute", b: "Either side can object. An arbiter sees the same evidence and splits.", G: DisputeGlyph },
];

/** Five steps on a rail. The rail draws and the steps stagger in, once, when scrolled into view (spec §8.4 S0). */
export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mo = useMotion();
  return (
    <m.ol ref={ref} className="relative grid gap-7 sm:grid-cols-5 sm:gap-4" variants={mo.reduced ? stagger(0) : stagger(0.09)} initial="hidden" animate={inView ? "show" : "hidden"} aria-label="The five steps">
      <div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-border sm:block" aria-hidden>
        <m.div className="h-full origin-left bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: inView ? 1 : 0 }} transition={mo.reduced ? { duration: dur.fast } : { duration: 0.9, ease: ease.out, delay: 0.15 }} />
      </div>
      {STEPS.map(({ t, b, G }, i) => (
        <m.li key={t} variants={mo.enterUp} className="relative flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
          {i < STEPS.length - 1 ? <span className="absolute -bottom-7 left-6 top-12 w-px bg-border sm:hidden" aria-hidden /> : null}
          <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full border border-border bg-bg text-primary shadow-[var(--shadow)]">
            <G width={24} height={24} />
          </span>
          <div className="pt-1 sm:pt-0">
            <p className="mono text-[13px] text-muted">0{i + 1}</p>
            <p className="text-[17px] font-semibold leading-tight">{t}</p>
            <p className="mt-1 text-[15px] text-muted sm:text-[13px]">{b}</p>
          </div>
        </m.li>
      ))}
    </m.ol>
  );
}
