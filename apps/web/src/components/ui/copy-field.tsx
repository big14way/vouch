"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyField({ value, label, mono = true, className }: { value: string; label?: string; mono?: boolean; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className={cn("flex h-10 items-center gap-2 rounded-[var(--r-md)] border border-border-strong bg-bg pl-3 pr-1", className)}>
      {label ? <span className="text-[13px] text-muted shrink-0">{label}</span> : null}
      <span className={cn("flex-1 truncate text-[13px]", mono && "mono")} title={value}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`Copy ${label ?? "value"}`}
        className="grid size-8 place-items-center rounded-[var(--r-sm)] text-muted hover:bg-surface hover:text-text"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
