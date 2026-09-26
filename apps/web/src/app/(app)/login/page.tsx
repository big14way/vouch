"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Logo, Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";

import { Suspense } from "react";

function LoginInner() {
  const { ready, authenticated, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  useEffect(() => {
    if (ready && authenticated) router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
  }, [ready, authenticated, router, next]);
  return (
    <div className="text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-[var(--r-lg)] border border-border bg-surface shadow-[var(--shadow)]">
        <Logo markOnly size={28} />
      </div>
      <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.025em]">Sign in to Vouch</h1>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-6 text-muted">Email or Google. A wallet is created for you. You never handle keys or network fees.</p>
      <Button className="mt-8" full size="lg" onClick={login} loading={!ready}>{ready ? "Continue" : "Loading…"}</Button>
      <div className="mt-8 grid grid-cols-3 gap-2 text-[11px] text-faint">
        {["Money held until verified", "No gas, no seed phrase", "Dispute to an arbiter"].map((t) => (
          <span key={t} className="rounded-[var(--r-md)] border border-border px-2 py-2.5 leading-4">{t}</span>
        ))}
      </div>
    </div>
  );
}

/** S1 Login. */
export default function LoginPage() {
  return (
    <Shell narrow>
      <Suspense>
        <LoginInner />
      </Suspense>
    </Shell>
  );
}
