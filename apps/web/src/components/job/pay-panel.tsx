"use client";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { useAuth } from "@/lib/client/auth";
import type { Address, Hex } from "viem";
import type { JobDto } from "@vouch/shared";
import { chainMeta, formatAmount, isTempo, shortAddress } from "@vouch/shared";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { jobs, api, ClientError } from "@/lib/client/api";
import { signReceiveWithAuthorization } from "@/lib/client/wallet";
import { dur, ease } from "@/components/motion";

type BatchInfo = { chainId: 4217 | 42431; vault: Address; token: Address; jobId: Hex; amount: string; scopeHash: Hex; salt: Hex; worker: Address; policy: { autoRelease: 0 | 1 | 2; minConfidenceBps: number; maxAutoAmount: string; reviewWindow: number; submitDeadline: number } };

/** Pay (S3). Tempo: sponsored batched tx from a Tempo wallet, or pay from any wallet with memo. Base: USDC signature, no ETH. */
export function PayPanel({ job, onFunded }: { job: JobDto; onFunded: (j: JobDto) => void }) {
  const toast = useToast();
  const { authenticated, login, ready, address, getProvider } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [anyWallet, setAnyWallet] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const tempoChain = isTempo(job.chainId);
  const vaultRoute = job.fundRoutes.find((r) => r.kind === "transfer");

  useEffect(() => {
    if (!anyWallet || !vaultRoute?.target || qr) return;
    import("qrcode").then((m) => m.toDataURL(`${vaultRoute.target}?memo=${job.id}`, { margin: 1, width: 192 })).then(setQr).catch(() => undefined);
  }, [anyWallet, vaultRoute, qr, job.id]);

  const fail = (e: unknown) => {
    const err = e instanceof ClientError ? e : null;
    toast({ title: err?.message ?? (e instanceof Error ? e.message : "Payment did not go through."), body: err?.next ?? "Nothing was charged. Try again.", tone: "danger" });
  };

  const payTempoWallet = async () => {
    setBusy("tempo");
    try {
      const info = await api<BatchInfo>(`/jobs/${job.id}/fund/batch`);
      const { payWithTempoWallet } = await import("@/lib/client/tempo-wallet");
      const { hash } = await payWithTempoWallet({ ...info, amount: BigInt(info.amount), policy: { ...info.policy, maxAutoAmount: BigInt(info.policy.maxAutoAmount) } });
      const r = await jobs.fundConfirm(job.id, hash);
      onFunded(r.job);
      toast({ title: "Locked", body: "Your payment is held until the work is verified.", tone: "success" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const payBase = async () => {
    if (!authenticated) return login();
    if (!address) return toast({ title: "No wallet yet", body: "Finish signing in so your wallet is created.", tone: "danger" });
    setBusy("base");
    try {
      const info = await jobs.fundInfo(job.id);
      const provider = await getProvider();
      if (!provider) throw new Error("Your wallet is not ready yet.");
      const from = address as Address;
      const auth = await signReceiveWithAuthorization(provider, { from, to: info.vault as Address, value: BigInt(info.amount), token: info.token as Address, chainId: job.chainId });
      const r = await jobs.fundEip3009(job.id, auth);
      onFunded(r.job);
      toast({ title: "Locked", body: "Your payment is held until the work is verified.", tone: "success" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const payBalance = async () => {
    if (!authenticated) return login();
    setBusy("balance");
    try {
      const r = await jobs.fundFromBalance(job.id);
      if (r.status !== "Funded") throw new ClientError("Your balance is not enough for this job.", "insufficient", "Pay with a wallet instead.");
      onFunded(r.job);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const confirmTx = async () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return toast({ title: "That is not a transaction hash.", body: "Paste the 66-character hash from your wallet.", tone: "danger" });
    setBusy("confirm");
    try {
      const r = await jobs.fundConfirm(job.id, txHash);
      onFunded(r.job);
      setAnyWallet(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardTitle>Pay {job.amount ? formatAmount(job.amount, { symbol: job.tokenSymbol }) : ""}</CardTitle>
      <Muted className="mt-1">Held safely until the work is delivered and verified. Fee {job.feeBps / 100}% is taken from the payout, not from you.</Muted>
      <div className="mt-4 space-y-2">
        {tempoChain ? (
          <Button full size="lg" loading={busy === "tempo"} onClick={payTempoWallet}>Pay with Tempo wallet</Button>
        ) : (
          <Button full size="lg" loading={busy === "base"} onClick={payBase} disabled={!ready}>
            {authenticated ? "Pay with USDC" : "Sign in to pay"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {tempoChain ? <Button variant="secondary" onClick={() => setAnyWallet(true)}>Pay from any wallet</Button> : null}
          <Button variant="secondary" loading={busy === "balance"} onClick={payBalance}>Use my balance</Button>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {tempoChain ? "One confirmation. No network fee for you." : "You sign once. No ETH needed."} Settled on {chainMeta(job.chainId).name}.
      </p>
      <Sheet open={anyWallet} onClose={() => setAnyWallet(false)} title="Pay from any wallet">
        <p className="text-[15px]">Send exactly <span className="mono font-semibold">{job.amount ? formatAmount(job.amount, { symbol: job.tokenSymbol }) : "the job amount"}</span> on {chainMeta(job.chainId).name} to the vault, with the memo below. It is matched to this job automatically.</p>
        {qr ? (
          <m.img src={qr} alt="" className="mx-auto my-4 size-48 rounded-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.base, ease: ease.out }} />
        ) : null}
        <div className="space-y-2">
          <CopyField label="To" value={vaultRoute?.target ?? ""} />
          <CopyField label="Memo" value={job.id} />
          <CopyField label="Token" value={`${job.tokenSymbol} · ${shortAddress(job.token)}`} mono={false} />
        </div>
        <p className="mt-4 text-[13px] text-muted">Already sent? Paste the transaction hash to speed things up.</p>
        <div className="mt-2 flex gap-2">
          <input aria-label="Transaction hash" className="mono min-h-11 flex-1 rounded-[var(--r-md)] border border-border bg-bg px-3 text-[13px]" placeholder="0x…" value={txHash} onChange={(e) => setTxHash(e.target.value.trim())} />
          <Button loading={busy === "confirm"} onClick={confirmTx}>Confirm</Button>
        </div>
      </Sheet>
    </Card>
  );
}
