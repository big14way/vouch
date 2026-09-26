"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, Muted } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/field";
import { me } from "@/lib/client/api";

function Inner() {
  const { ready, authenticated, email, address, login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [name, setName] = useState("");
  const [role, setRole] = useState<"payer" | "worker" | "both">("both");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) return login();
    me.get().then((m) => {
      if (m.onboarded && m.address) router.replace(next);
      if (m.name) setName(m.name);
    }).catch(() => undefined);
  }, [ready, authenticated, router, next, login]);

  const save = async () => {
    if (name.trim().length < 1) return setErr("Tell us what to call you.");
    setBusy(true);
    try {
      await me.update({ name: name.trim(), role, email: email ?? undefined, address: address ?? undefined });
      router.replace(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Almost there</h1>
      <Muted className="mt-1">Two questions, then you are in.</Muted>
      <Field className="mt-4" error={err}>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[13px] font-medium">You mostly</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["payer", "worker", "both"] as const).map((r) => (
            <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`h-10 rounded-[var(--r-md)] border px-3 text-[13px] transition-colors ${role === r ? "border-primary/60 bg-primary/[0.06] text-text" : "border-border-strong text-muted hover:text-text"}`}>
              {r === "payer" ? "Pay for work" : r === "worker" ? "Do work" : "Both"}
            </button>
          ))}
        </div>
      </fieldset>
      <Button full size="lg" loading={busy} onClick={save} disabled={!address}>{address ? "Continue" : "Creating your wallet…"}</Button>
    </Card>
  );
}

export default function Onboarding() {
  return (
    <Shell narrow>
      <Suspense>
        <Inner />
      </Suspense>
    </Shell>
  );
}
