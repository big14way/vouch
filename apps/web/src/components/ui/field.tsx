"use client";
import * as React from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

const base = "w-full rounded-[var(--r-md)] border border-border bg-bg px-3 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-primary min-h-11";

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text mb-1.5">
      {children}
      {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

/** Field wrapper: shakes 4 px twice on error (spec §8.3), shows the error under the control. */
export function Field({ error, children, className }: { error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <m.div
      className={cn("mb-4", className)}
      animate={error ? { x: [0, -4, 4, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.24 }}
      key={error ? "err" : "ok"}
    >
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
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
