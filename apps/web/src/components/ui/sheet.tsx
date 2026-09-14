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
          <m.button aria-label="Close" className="absolute inset-0 bg-text/40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }} />
          <m.div
            className="relative w-full max-w-lg rounded-t-[var(--r-lg)] bg-bg p-4 shadow-[var(--shadow)] sm:rounded-[var(--r-lg)] sm:p-6 max-h-[90dvh] overflow-y-auto"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0, transition: { duration: dur.fast } }}
            transition={spring.soft}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-md hover:bg-surface">
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
