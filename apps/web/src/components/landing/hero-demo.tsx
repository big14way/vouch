"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useInView } from "framer-motion";
import type { VerdictDto } from "@vouch/shared";
import { Card, Muted } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Timeline } from "@/components/ui/timeline";
import { AmountDisplay } from "@/components/ui/amount-display";
import { Padlock } from "@/components/job/padlock";
import { VerdictCard } from "@/components/job/verdict-card";
import { Button } from "@/components/ui/button";
import { dur, ease, spring, useMotion } from "@/components/motion";
import { FileGlyph } from "./glyphs";

type Phase = "open" | "locked" | "delivered" | "verifying" | "verified" | "paid";
const ORDER: Phase[] = ["open", "locked", "delivered", "verifying", "verified", "paid"];
const HOLD: Record<Phase, number> = { open: 1700, locked: 2000, delivered: 2000, verifying: 2700, verified: 3600, paid: 3400 };
const STATUS: Record<Phase, string> = { open: "Open", locked: "Funded", delivered: "Submitted", verifying: "Submitted", verified: "Attested", paid: "Settled" };
const PILL: Record<Phase, string> = { open: "Awaiting payment", locked: "Locked", delivered: "Delivered", verifying: "Delivered", verified: "Verified", paid: "Paid" };
const AMOUNT = "50000000"; // $50.00 in 6-decimal units

const VERDICT: VerdictDto = {
  jobId: `0x${"0".repeat(64)}`,
  verdict: "PASS",
  confidence: 0.94,
  confidenceBps: 9400,
  scope_items: [
    { item: "One-page brief, under 400 words", status: "met", evidence: "brief.pdf · 1 page · 362 words" },
    { item: "Every claim cites one of the three source PDFs", status: "met", evidence: "9 citations, all resolve to the sources" },
  ],
  summary: null,
  questions_for_worker: [],
  red_flags: [],
  attestationTx: null,
  attestationHash: null,
  reportUrl: null,
  stage: "done",
  autoSettleAt: null,
};

const panel = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: dur.fast, ease: ease.in } },
};

/**
 * The real job card, playing its five states on a loop: lock (amount counts up, padlock draws), deliver
 * (evidence slides up), verify (real stage copy under a sweep), verdict reveal, settle (button becomes a receipt).
 * Pauses while hovered or focused; under reduced motion it shows the verified state and stays still.
 */
export function HeroDemo() {
  const mo = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [phase, setPhase] = useState<Phase>(mo.reduced ? "verified" : "open");
  const [stage, setStage] = useState<NonNullable<VerdictDto["stage"]>>("reading_scope");
  const [pressed, setPressed] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    if (mo.reduced || !inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = () => {
      if (paused.current) {
        timers.push(setTimeout(advance, 400));
        return;
      }
      setPhase((p) => ORDER[(ORDER.indexOf(p) + 1) % ORDER.length] ?? "open");
    };
    if (phase === "open") timers.push(setTimeout(() => setPressed(true), HOLD.open - 360), setTimeout(() => setPressed(false), HOLD.open - 200));
    if (phase === "verifying") {
      setStage("reading_scope");
      timers.push(setTimeout(() => setStage("checking_files"), 900), setTimeout(() => setStage("writing_report"), 1800));
    }
    timers.push(setTimeout(advance, HOLD[phase]));
    return () => timers.forEach(clearTimeout);
  }, [phase, inView, mo.reduced]);

  const locked = phase !== "open";
  const amountLabel = phase === "paid" ? "Paid" : locked ? "Locked" : "Amount";

  return (
    <div ref={ref} className="relative" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)} onFocus={() => (paused.current = true)} onBlur={() => (paused.current = false)}>
      <p className="sr-only">A job card moving through its states: awaiting payment, locked, delivered, verified, then paid.</p>
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(60%_60%_at_30%_20%,rgba(10,108,78,0.14),transparent_70%),radial-gradient(50%_50%_at_90%_90%,rgba(242,183,5,0.16),transparent_70%)]" />
      <Card aria-hidden className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Job</p>
            <p className="truncate text-[15px] font-medium">One-page brief from three PDFs</p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span key={PILL[phase]} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.snappy}>
              <StatusPill pill={PILL[phase]} />
            </m.span>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted">{amountLabel}</p>
            <AmountDisplay key={locked ? "locked" : "open"} amount={AMOUNT} symbol="USDC" size="lg" countUp={locked} />
          </div>
          <Padlock locked={locked} />
        </div>

        <div className="mt-4">
          <Timeline status={STATUS[phase]} />
        </div>

        <div className="mt-4 min-h-[196px] sm:min-h-[212px]">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "open" ? (
              <m.div key="open" {...panel}>
                <m.div animate={{ scale: pressed ? 0.97 : 1 }} transition={spring.snappy}>
                  <Button full size="lg" tabIndex={-1}>Pay $50.00</Button>
                </m.div>
                <Muted className="mt-3 text-center">Held against the written scope. Released only under your rules.</Muted>
              </m.div>
            ) : null}

            {phase === "locked" ? (
              <m.div key="locked" {...panel} className="rounded-[var(--r-lg)] border border-dashed border-border p-4">
                <p className="text-[15px] font-medium">Waiting for delivery</p>
                <Muted className="mt-1">The worker submits here. Each file is fingerprinted the moment it lands.</Muted>
                <Muted className="mt-3">Pays automatically within 1 day of a verified delivery, unless you review.</Muted>
              </m.div>
            ) : null}

            {phase === "delivered" ? (
              <m.div key="delivered" {...panel} className="rounded-[var(--r-lg)] border border-border p-4">
                <p className="text-[13px] text-muted">Delivered · 2 days early</p>
                <div className="mt-2 flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-md)] bg-surface text-primary"><FileGlyph width={22} height={22} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">brief.pdf</p>
                    <p className="text-[13px] text-muted">1 page · 48 KB</p>
                    <p className="mono mt-1 truncate text-[12px] text-muted">sha256 4f1c9b0e…7a2e</p>
                  </div>
                </div>
                <Muted className="mt-3">Pinned. Nothing can be swapped after this point.</Muted>
              </m.div>
            ) : null}

            {phase === "verifying" ? (
              <m.div key="verifying" {...panel}>
                <VerdictCard verdict={{ ...VERDICT, verdict: null, confidence: null, scope_items: null, stage }} chainId={4217} />
              </m.div>
            ) : null}

            {phase === "verified" ? (
              <m.div key="verified" {...panel}>
                <VerdictCard verdict={VERDICT} chainId={4217} />
                <Muted className="mt-3 text-center">Pays automatically in 23h unless you review.</Muted>
              </m.div>
            ) : null}

            {phase === "paid" ? (
              <m.div key="paid" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.soft} className="rounded-[var(--r-lg)] border border-success/30 bg-success/5 p-4">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-success"><span aria-hidden>✓</span> Paid</p>
                <dl className="mt-3 space-y-1.5 text-[15px]">
                  <div className="flex justify-between gap-3"><dt className="text-muted">To the worker</dt><dd className="mono font-medium">$49.50</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Fee (1%)</dt><dd className="mono font-medium">$0.50</dd></div>
                  <div className="flex justify-between gap-3 border-t border-border pt-1.5"><dt className="text-muted">Recorded on chain</dt><dd className="mono text-[13px] text-muted">block 35 731 402</dd></div>
                </dl>
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}
