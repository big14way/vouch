"use client";
import { useState } from "react";
import { useAuth } from "@/lib/client/auth";
import type { Address } from "viem";
import { hashManifest, type JobDto } from "@vouch/shared";
import { Button } from "@/components/ui/button";
import { Card, PanelHeader } from "@/components/ui/card";
import { Field, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { FileDrop, type PickedFile } from "./file-drop";
import { jobs, ClientError } from "@/lib/client/api";
import { signTypedData } from "@/lib/client/wallet";

/** Worker delivery (S5): files + links + note. Hash computed locally, Submit signed by the worker's wallet, relayed by Vouch. */
export function DeliverForm({ job, resubmit = false, onDone }: { job: JobDto; resubmit?: boolean; onDone: (j: JobDto) => void }) {
  const toast = useToast();
  const { authenticated, login, address, getProvider } = useAuth();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [links, setLinks] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!authenticated) return login();
    if (!address) return setErr("Your wallet is still loading. Try again in a moment.");
    const linkList = links.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (files.length === 0 && linkList.length === 0 && !note.trim()) return setErr("Add at least one file, link or note.");
    for (const l of linkList) if (!/^https?:\/\//.test(l)) return setErr(`"${l}" is not a full URL (start with https://).`);
    setBusy(true);
    try {
      const signer = address as Address;
      const deliverableHash = hashManifest({ jobId: job.id as `0x${string}`, submittedBy: signer, files: files.map((f) => ({ name: f.name, sha256: f.sha256, size: f.size, contentType: f.contentType })), links: linkList, note });
      const { typedData } = await jobs.sign(job.id, { action: resubmit ? "Resubmit" : "Submit", signer, deliverableHash });
      const provider = await getProvider();
      if (!provider) throw new Error("Your wallet is not ready yet.");
      const signature = await signTypedData(provider, signer, typedData);
      const r = await jobs.submit(job.id, { files: files.map((f) => ({ name: f.name, contentType: f.contentType, base64: f.base64 })), links: linkList, note, worker: signer, signature }, resubmit);
      onDone(r.job);
      toast({ title: "Delivered", body: "Verification is running. You will see the result here.", tone: "success" });
    } catch (e) {
      const ce = e instanceof ClientError ? e : null;
      setErr(ce ? `${ce.message} ${ce.next ?? ""}` : e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  };

  const walletLoading = authenticated && !address;
  return (
    <Card flush>
      <PanelHeader
        title={resubmit ? "Resubmit your work" : "Deliver your work"}
        meta={resubmit ? `Attempt ${job.resubmits + 1} of 2. Address the questions from the last review.` : "Files are fingerprinted before anyone reviews them, so what you send is what gets judged."}
      />
      <div className="space-y-4 px-5 py-5">
        <FileDrop files={files} onChange={setFiles} />
        <Field className="mb-0">
          <Label htmlFor="links" hint="optional, one per line">Links</Label>
          <Textarea id="links" className="min-h-[72px]" placeholder="https://github.com/…  https://figma.com/…" value={links} onChange={(e) => setLinks(e.target.value)} />
        </Field>
        <Field error={err} className="mb-0">
          <Label htmlFor="note">Note to the payer</Label>
          <Textarea id="note" className="min-h-24" placeholder="What you did, and anything the check should know." value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-bg/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-faint">You sign once. No network fee.</p>
        <Button size="lg" className="sm:min-w-52" loading={busy || walletLoading} onClick={submit}>
          {!authenticated ? "Sign in to deliver" : walletLoading ? "Preparing your wallet…" : resubmit ? "Sign and resubmit" : "Sign and deliver"}
        </Button>
      </div>
    </Card>
  );
}
