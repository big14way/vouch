import * as React from "react";
import { cn } from "@/lib/utils";

/** Raised surface. `flush` drops the padding for panels that manage their own rows. */
export function Card({ className, flush = false, ...p }: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn("rounded-[var(--r-lg)] border border-border bg-surface shadow-[var(--shadow)]", !flush && "p-5", className)} {...p} />;
}

export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[15px] font-semibold leading-tight tracking-[-0.01em]", className)} {...p} />;
}

/** Panel header row: title (+ optional meta) left, an action right, hairline below. */
export function PanelHeader({ title, meta, action, className }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border px-5 py-3.5", className)}>
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {meta ? <p className="mt-0.5 text-[12px] text-muted">{meta}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Muted({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] leading-5 text-muted", className)} {...p} />;
}

/** Small uppercase label used above values and section groups. */
export function Eyebrow({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.08em] text-faint", className)} {...p} />;
}

/** Key/value grid (Stripe/Vercel metadata style). */
export function KV({ rows, className }: { rows: Array<[React.ReactNode, React.ReactNode] | null | false>; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(92px,auto)_1fr] gap-x-4 gap-y-2.5 text-[13px]", className)}>
      {rows.filter(Boolean).map((r, i) => {
        const [k, v] = r as [React.ReactNode, React.ReactNode];
        return (
          <React.Fragment key={i}>
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 text-right text-text">{v}</dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}
