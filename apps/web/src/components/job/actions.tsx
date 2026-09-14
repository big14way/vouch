"use client";
import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/client/auth";
import type { Address } from "viem";
import { formatAmount, type JobDto } from "@vouch/shared";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Field, Label, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { TxLink } from "@/components/ui/tx-link";
import { useToast } from "@/components/ui/toast";
import { spring } from "@/components/motion";
import { jobs, ClientError } from "@/lib/client/api";
import { signTypedData } from "@/lib/client/wallet";

/** Approve & pay / Dispute (payer), Dispute (worker), Refund (expired). Settled state morphs the button into a receipt card. */
export function JobActions({ job, onChange }: { job: JobDto; onChange: (j: JobDto) => void }) {
  const toast = useToast();
  const { authenticated, login, address, getProvider } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const sign = async (action: "Settle" | "Dispute", extra: Record<string, string> = {}) => {
    if (!authenticated) {
      login();
      throw new ClientError("Sign in first.", "unauthenticated");
    }
    if (!address) throw new ClientError("Your wallet is still being created.", "no_wallet", "Try again in a moment.");
    const signer = address as Address;
    const { typedData } = await jobs.sign(job.id, { action, signer, ...extra });
    const provider = await getProvider();
    if (!provider) throw new ClientError("Your wallet is not ready yet.", "no_wallet", "Try again in a moment.");
    return signTypedData(provider, signer, typedData);
  };

  const fail = (e: unknown) => {
    const ce = e instanceof ClientError ? e : null;
    if (ce?.code === "unauthenticated") return;
    toast({ title: ce?.message ?? (e instanceof Error ? e.message : "That did not work."), body: ce?.next ?? "Try again.", tone: "danger" });
  };

  const approve = async () => {
    setBusy("approve");
    try {
      const sig = await sign("Settle");
      const r = await jobs.approve(job.id, sig);
      onChange(r.job);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const dispute = async () => {
    if (reason.trim().length < 10) return setErr("Say what is wrong in at least a sentence.");
    setErr(null);
    setBusy("dispute");
    try {
      const sig = await sign("Dispute", { reason });
      const r = await jobs.dispute(job.id, reason, sig);
      onChange(r.job);
      setDisputeOpen(false);
      toast({ title: "Dispute opened", body: "An arbiter will review the same evidence and decide.", tone: "info" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const refund = async () => {
    setBusy("refund");
    try {
      const r = await jobs.refund(job.id);
      onChange(r.job);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const settled = job.status === "Settled" || job.status === "Resolved";
  const canAct = job.status === "Submitted" || job.status === "Attested";
  const expired = job.status === "Funded" && job.submitDeadlineAt && new Date(job.submitDeadlineAt).getTime() < Date.now();

  return (
    <AnimatePresence mode="wait">
      {settled ? (
        <m.div key="receipt" layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={spring.soft}>
          <Card className="border-success/40">
            <CardTitle className="text-success">Paid</CardTitle>
            <Muted className="mt-1">{job.amount ? formatAmount(job.amount, { symbol: job.tokenSymbol }) : "The amount"} moved from Locked to Paid{job.status === "Resolved" ? " by the arbiter's decision" : ""}. The worker can withdraw any time.</Muted>
            <div className="mt-3 flex flex-wrap gap-3">
              {job.txs.settled ? <TxLink chainId={job.chainId} hash={job.txs.settled} label="Settlement" /> : null}
              {job.txs.resolved ? <TxLink chainId={job.chainId} hash={job.txs.resolved} label="Resolution" /> : null}
            </div>
          </Card>
        </m.div>
      ) : job.role === "payer" && canAct ? (
        <m.div key="payer" layout className="sticky bottom-3 z-10">
          <Card className="shadow-[var(--shadow)]">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button size="lg" loading={busy === "approve"} onClick={approve}>Approve &amp; pay</Button>
              <Button size="lg" variant="secondary" onClick={() => setDisputeOpen(true)}>Dispute</Button>
            </div>
            {job.status === "Submitted" ? <Muted className="mt-2">You can pay now, or wait for the verification to finish.</Muted> : null}
          </Card>
        </m.div>
      ) : job.role === "worker" && canAct ? (
        <m.div key="worker" layout>
          <Card>
            <Muted>{job.status === "Attested" && job.verdict === "FAIL" ? "You can resubmit above, or dispute the result." : "Waiting on the payer. Dispute only if something is wrong with the review."}</Muted>
            <Button className="mt-3" variant="secondary" onClick={() => setDisputeOpen(true)}>Dispute</Button>
          </Card>
        </m.div>
      ) : expired && job.role === "payer" ? (
        <m.div key="refund" layout>
          <Card>
            <CardTitle>Nothing was delivered in time</CardTitle>
            <Muted className="mt-1">The delivery deadline passed. Move the locked amount back to your balance.</Muted>
            <Button className="mt-3" loading={busy === "refund"} onClick={refund}>Get my money back</Button>
          </Card>
        </m.div>
      ) : null}
      <Sheet open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Open a dispute">
        <p className="text-[15px]">An arbiter sees the same pinned evidence and verification report, then splits the locked amount. Their decision is final for funds in the vault.</p>
        <Field error={err} className="mt-4">
          <Label htmlFor="reason">What is wrong?</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Be specific: which part of the scope, and what you saw." />
        </Field>
        <Button full variant="danger" loading={busy === "dispute"} onClick={dispute}>Open dispute</Button>
      </Sheet>
    </AnimatePresence>
  );
}
