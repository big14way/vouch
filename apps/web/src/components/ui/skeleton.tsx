import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--r-sm)] bg-overlay", className)} aria-hidden />;
}

export function EmptyState({ title, body, action, preview }: { title: string; body?: string; action?: React.ReactNode; preview?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-border bg-surface px-6 py-10 text-center">
      {preview ? <div className="pointer-events-none mx-auto mb-6 max-w-md opacity-60 [mask-image:linear-gradient(180deg,black,transparent)]" aria-hidden>{preview}</div> : null}
      <p className="text-[15px] font-medium">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
