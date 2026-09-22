"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
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
    <Card>
      <CardTitle>Sign in</CardTitle>
      <Muted className="mt-1">Email or Google. A wallet is created for you; you never handle keys or network fees.</Muted>
      <Button className="mt-4" full size="lg" onClick={login} disabled={!ready}>Continue</Button>
    </Card>
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
