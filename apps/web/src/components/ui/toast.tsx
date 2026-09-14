"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { dur, ease } from "@/components/motion";

type Toast = { id: number; title: string; body?: string; tone?: "info" | "success" | "danger" };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => undefined);

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 sm:items-end" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.in } }}
              className={`pointer-events-auto w-full max-w-sm rounded-[var(--r-md)] border bg-bg p-3 shadow-[var(--shadow)] ${t.tone === "danger" ? "border-danger/40" : t.tone === "success" ? "border-success/40" : "border-border"}`}
            >
              <p className="text-[15px] font-medium">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[13px] text-muted">{t.body}</p> : null}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
