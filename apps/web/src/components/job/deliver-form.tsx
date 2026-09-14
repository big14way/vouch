"use client";
import { useState } from "react";
import { useAuth } from "@/lib/client/auth";
import type { Address } from "viem";
import { hashManifest, type JobDto } from "@vouch/shared";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Field, Label, Textarea, Input } from "@/components/ui/field";
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
    if (!address) return setErr("Your wallet is still being created. Try again in a moment.");
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

  return (
    <Card>
      <CardTitle>{resubmit ? "Resubmit your work" : "Deliver your work"}</CardTitle>
      <Muted className="mt-1">{resubmit ? `Attempt ${job.resubmits + 1} of 2. Address the questions from the last review.` : "Files are fingerprinted before anyone reviews them, so what you send is what gets judged."}</Muted>
      <div className="mt-4">
        <FileDrop files={files} onChange={setFiles} />
      </div>
      <Field className="mt-4">
        <Label htmlFor="links" hint="one per line">Links</Label>
        <Textarea id="links" className="min-h-20" placeholder="https://github.com/… https://figma.com/…" value={links} onChange={(e) => setLinks(e.target.value)} />
      </Field>
      <Field error={err}>
        <Label htmlFor="note">Note to the payer</Label>
        <Textarea id="note" className="min-h-24" placeholder="What you did, and anything the checklist should know." value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Input type="hidden" value={job.id} readOnly />
      <Button full size="lg" loading={busy} onClick={submit}>{authenticated ? (resubmit ? "Resubmit" : "Submit delivery") : "Sign in to deliver"}</Button>
    </Card>
  );
}
