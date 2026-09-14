"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { formatAmount, chainMeta } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { jobs, me } from "@/lib/client/api";

/** S4 Dashboard: balances (Available / Locked), jobs list, FAB. */
export default function Dashboard() {
  const { ready, authenticated, login } = useAuth();
  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);
  const list = useQuery({ queryKey: ["jobs"], queryFn: jobs.list, enabled: ready && authenticated });
  const bal = useQuery({ queryKey: ["balances"], queryFn: me.balances, enabled: ready && authenticated });

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold">Your jobs</h1>
        <Link href="/withdraw" className="text-[15px] text-primary hover:underline">Withdraw</Link>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {bal.isLoading ? <Skeleton className="h-16" /> : bal.data?.balances.length ? bal.data.balances.map((b) => (
          <Card key={`${b.chainId}:${b.token}`} className="py-3">
            <Muted>{b.symbol} · {chainMeta(b.chainId).shortName}</Muted>
            <div className="mt-1 flex items-baseline gap-4">
              <div><span className="mono text-[22px] font-semibold">{formatAmount(b.available)}</span><Muted className="inline ml-1">available</Muted></div>
              <div><span className="mono text-[17px]">{formatAmount(b.locked)}</span><Muted className="inline ml-1">locked</Muted></div>
            </div>
          </Card>
        )) : null}
      </div>

      <div className="mt-6 space-y-2">
        {list.isLoading ? <><Skeleton className="h-20" /><Skeleton className="h-20" /></> : list.data?.jobs.length ? list.data.jobs.map((j) => (
          <Link key={j.id} href={`/j/${j.id}`} className="block">
            <Card className="flex items-center justify-between gap-3 py-3 hover:bg-surface">
              <div className="min-w-0">
                <CardTitle className="truncate text-[15px]">{j.title}</CardTitle>
                <Muted className="mt-0.5">{j.role === "payer" ? "You pay" : j.role === "worker" ? "You deliver" : ""} · {j.amount ? formatAmount(j.amount, { symbol: j.tokenSymbol }) : "—"} · {new Date(j.updatedAt).toLocaleDateString()}</Muted>
              </div>
              <StatusPill pill={j.pill} />
            </Card>
          </Link>
        )) : (
          <EmptyState title="No jobs yet" body="Create a job link and share it, or open a link someone sent you." action={<Link href="/new"><Button>Create a job</Button></Link>} />
        )}
      </div>
      <Link href="/new" aria-label="New job" className="fixed bottom-5 right-5 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow)] sm:hidden">
        <Plus className="size-6" />
      </Link>
    </Shell>
  );
}
