"use client";
import { useEffect, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { spring, dur } from "@/components/motion";

/** Bottom sheet on mobile, centered dialog on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <m.button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }} />
          <m.div
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--r-xl)] border border-border bg-overlay p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] sm:rounded-[var(--r-xl)] sm:p-6"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0, transition: { duration: dur.fast } }}
            transition={spring.soft}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-[var(--r-sm)] text-muted hover:bg-surface hover:text-text">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
