"use client";
import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "framer-motion";
import { ToastProvider } from "@/components/ui/toast";

/** Query, motion and toasts for every route. Identity (Privy, heavy) is added by the `(app)` route group's layout only. */
export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <LazyMotion features={domAnimation} strict>
        <ToastProvider>{children}</ToastProvider>
      </LazyMotion>
    </QueryClientProvider>
  );
}

/** Register the PWA service worker once. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
