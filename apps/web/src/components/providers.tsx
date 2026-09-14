"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "framer-motion";
import { ToastProvider } from "@/components/ui/toast";

/** Privy is heavy; it loads only on routes that need identity (login, dashboard, job actions). */
const PrivyShell = dynamic(() => import("./privy-shell").then((m) => m.PrivyShell), { ssr: false });

export function Providers({ children, withAuth = true }: { children: ReactNode; withAuth?: boolean }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }));
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const body = useMemo(() => <LazyMotion features={domAnimation} strict><ToastProvider>{children}</ToastProvider></LazyMotion>, [children]);
  return <QueryClientProvider client={qc}>{withAuth && appId ? <PrivyShell appId={appId}>{body}</PrivyShell> : body}</QueryClientProvider>;
}

/** Register the PWA service worker once. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
