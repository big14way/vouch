"use client";
import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { AnimatePresence, m } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { buttonVariants as button } from "./button-variants";
import { dur, ease } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, full, loading, children, disabled, ...props }, ref) => (
  <button ref={ref} className={cn(button({ variant, size, full }), className)} disabled={disabled || loading} aria-busy={loading} {...props}>
    {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
    {children}
  </button>
));
Button.displayName = "Button";

export type ActionPhase = "idle" | "pending" | "done";

/**
 * One button that carries a money action through its states without being replaced
 * (idle label → pending label… → done label with a check). The label cross-fades in place.
 */
export function ActionButton({ phase, idle, pending, done, className, variant, size = "lg", full = true, ...props }: Omit<ButtonProps, "children" | "loading"> & { phase: ActionPhase; idle: React.ReactNode; pending: string; done: string }) {
  const label = phase === "idle" ? idle : phase === "pending" ? pending : done;
  return (
    <button
      className={cn(button({ variant: phase === "done" ? "secondary" : variant, size, full }), phase === "done" && "border-primary/40 text-primary", className)}
      disabled={phase !== "idle" || props.disabled}
      aria-busy={phase === "pending"}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={phase}
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
          transition={{ duration: dur.fast, ease: ease.out }}
        >
          {phase === "pending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : phase === "done" ? <Check className="size-4" aria-hidden /> : null}
          {label}
        </m.span>
      </AnimatePresence>
    </button>
  );
}
