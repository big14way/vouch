"use client";
import * as React from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

const base = "w-full min-h-10 rounded-[var(--r-md)] border border-border-strong bg-bg px-3 py-2 text-[14px] text-text shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-faint/50 focus:border-primary/70 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)]";

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-[13px] font-medium text-text">
      {children}
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

/** Field wrapper: shakes 4 px twice on error (spec §8.3), shows the error under the control. */
export function Field({ error, children, className }: { error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <m.div
      className={cn("mb-4", className)}
      animate={error ? { x: [0, -3, 3, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.22 }}
      key={error ? "err" : "ok"}
    >
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </m.div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-32 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, "appearance-none", className)} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";
