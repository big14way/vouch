"use client";
import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/** Motion tokens (spec §8.3). Every animation maps to a state change; nothing decorative. */
export const dur = { fast: 0.12, base: 0.2, slow: 0.32 } as const;
export const ease = { out: [0.2, 0.8, 0.2, 1] as const, in: [0.4, 0, 1, 1] as const };
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 32 } as const satisfies Transition,
  soft: { type: "spring", stiffness: 220, damping: 26 } as const satisfies Transition,
};

export const enterUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};

export const stagger = (interval = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: interval } },
});

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.fast } },
  exit: { opacity: 0, transition: { duration: dur.fast, ease: ease.in } },
};

/** Returns variants that honour prefers-reduced-motion by collapsing to a 120 ms opacity fade. */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    enterUp: reduced ? fade : enterUp,
    stagger: reduced ? stagger(0) : stagger(),
    t: reduced ? { duration: dur.fast } : undefined,
  };
}
