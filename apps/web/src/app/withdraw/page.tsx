"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/client/auth";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { isAddress } from "viem";
import { chainMeta, formatAmount, isTempo, parseAmount } from "@vouch/shared";
import { Shell } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { TxLink } from "@/components/ui/tx-link";
import { useToast } from "@/components/ui/toast";
import { me, ClientError } from "@/lib/client/api";
import { signTypedData } from "@/lib/client/wallet";
import { ZonePayout } from "@/components/job/zone-payout";

/** S6 Withdraw: balance → any address. Fee sponsored on Tempo. */
export default function Withdraw() {
  const { ready, authenticated, login, address, getProvider } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);
  const bal = useQuery({ queryKey: ["balances"], queryFn: me.balances, enabled: ready && authenticated });
  const [sel, setSel] = useState("");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ tx: string; chainId: number; sponsored: boolean } | null>(null);
  const rows = bal.data?.balances.filter((b) => BigInt(b.available) > 0n) ?? [];
  const row = rows.find((r) => `${r.chainId}:${r.token}` === sel) ?? rows[0];

  const go = async () => {
    setErr(null);
    if (!row) return;
    if (!isAddress(to)) return setErr("Enter a valid wallet address (0x…).");
    let base: bigint;
    try { base = parseAmount(amount); } catch (e) { return setErr(e instanceof Error ? e.message : "Enter an amount."); }
    if (base <= 0n || base > BigInt(row.available)) return setErr(`Enter up to ${formatAmount(row.available)}.`);
    if (!address) return setErr("Your wallet is still being created.");
    setBusy(true);
    try {
      const qs = { chainId: String(row.chainId), token: row.token, amount: base.toString(), to };
      const { typedData } = await me.withdrawTyped(qs);
      const provider = await getProvider();
      if (!provider) throw new Error("Your wallet is not ready yet.");
      const signature = await signTypedData(provider, address as Address, typedData);
      const r = await me.withdraw({ ...qs, chainId: row.chainId, signature });
      setDone({ tx: r.tx, chainId: row.chainId, sponsored: r.feeSponsored });
      toast({ title: "Sent", body: "Your withdrawal is on its way.", tone: "success" });
      void bal.refetch();
    } catch (e) {
      const ce = e instanceof ClientError ? e : null;
      setErr(ce ? `${ce.message} ${ce.next ?? ""}` : e instanceof Error ? e.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell narrow>
      <h1 className="text-[22px] font-semibold">Withdraw</h1>
      <Card className="mt-4">
        {rows.length === 0 ? <Muted>Nothing to withdraw yet. Balances appear here after you are paid or refunded.</Muted> : (
          <>
            <Field>
              <Label htmlFor="bal">From</Label>
              <Select id="bal" value={row ? `${row.chainId}:${row.token}` : ""} onChange={(e) => setSel(e.target.value)}>
                {rows.map((r) => <option key={`${r.chainId}:${r.token}`} value={`${r.chainId}:${r.token}`}>{formatAmount(r.available)} {r.symbol} · {chainMeta(r.chainId).shortName}</option>)}
              </Select>
            </Field>
            <Field>
              <Label htmlFor="amt">Amount</Label>
              <div className="flex gap-2">
                <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                <Button type="button" variant="secondary" onClick={() => row && setAmount(formatAmount(row.available).replace("$", ""))}>Max</Button>
              </div>
            </Field>
            <Field error={err}>
              <Label htmlFor="to">To address</Label>
              <Input id="to" className="mono" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
            </Field>
            <Button full size="lg" loading={busy} onClick={go}>Withdraw</Button>
            {row ? <Muted className="mt-2">{isTempo(row.chainId) ? "Network fee sponsored by Vouch." : "Vouch pays the network fee for you."}</Muted> : null}
          </>
        )}
        {done ? (
          <div className="mt-4 rounded-[var(--r-md)] border border-success/40 p-3">
            <CardTitle className="text-[15px] text-success">Sent</CardTitle>
            <div className="mt-1"><TxLink chainId={done.chainId} hash={done.tx} /></div>
          </div>
        ) : null}
      </Card>
      {row && process.env.NEXT_PUBLIC_ZONES_ENABLED === "1" ? <ZonePayout chainId={row.chainId} token={row.token as Address} symbol={row.symbol} available={row.available} /> : null}
    </Shell>
  );
}
