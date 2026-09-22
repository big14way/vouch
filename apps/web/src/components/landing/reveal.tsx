"use client";
import { useRef, type ReactNode } from "react";
import { m, useInView } from "framer-motion";
import { useMotion } from "@/components/motion";

/** Fades a block up 12 px the first time it scrolls into view. Collapses to an opacity fade under reduced motion. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mo = useMotion();
  return (
    <m.div ref={ref} className={className} variants={mo.enterUp} initial="hidden" animate={inView ? "show" : "hidden"} transition={mo.reduced ? undefined : { delay }}>
      {children}
    </m.div>
  );
}
