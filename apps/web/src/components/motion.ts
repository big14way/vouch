"use client";
import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * Motion tokens. Every animation maps to a state change of the money or the verdict; nothing decorative.
 * UI motion stays under 300 ms, ease-out, transform and opacity only; reduced motion collapses to a short fade.
 */
export const dur = { fast: 0.15, base: 0.24, slow: 0.4 } as const;
export const ease = { out: [0.23, 1, 0.32, 1] as const, in: [0.4, 0, 1, 1] as const, inOut: [0.65, 0, 0.35, 1] as const };
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 34 } as const satisfies Transition,
  soft: { type: "spring", stiffness: 400, damping: 35 } as const satisfies Transition,
};

export const enterUp: Variants = {
  hidden: { opacity: 0, y: 8 },
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

/** Returns variants that honour prefers-reduced-motion by collapsing to a 150 ms opacity fade. */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    enterUp: reduced ? fade : enterUp,
    stagger: reduced ? stagger(0) : stagger(),
    t: reduced ? { duration: dur.fast } : undefined,
  };
}
