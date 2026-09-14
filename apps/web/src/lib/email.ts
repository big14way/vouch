import { Resend } from "resend";
import { db } from "./db";
import { appUrl, env } from "./env";

/** Humans only (spec §7.7). Idempotent per (job, recipient, kind). Failures are logged, never thrown. */
export type NotificationKind = "created" | "funded" | "delivered" | "verdict" | "settled" | "disputed" | "refunded" | "resolved";

const COPY: Record<NotificationKind, { subject: (title: string) => string; body: (title: string, url: string) => string }> = {
  created: { subject: (t) => `Your job link is ready: ${t}`, body: (t, u) => `Your job "${t}" is ready to share. Payment is not locked yet.\n\n${u}` },
  funded: { subject: (t) => `Payment locked for ${t}`, body: (t, u) => `Funds for "${t}" are locked and waiting for delivery.\n\n${u}` },
  delivered: { subject: (t) => `Delivery received: ${t}`, body: (t, u) => `The worker delivered "${t}". Verification is running.\n\n${u}` },
  verdict: { subject: (t) => `Verification result for ${t}`, body: (t, u) => `The verifier finished reviewing "${t}". Open the job to see the checklist and decide.\n\n${u}` },
  settled: { subject: (t) => `Paid: ${t}`, body: (t, u) => `"${t}" is settled. Funds are available to withdraw.\n\n${u}` },
  disputed: { subject: (t) => `Dispute opened on ${t}`, body: (t, u) => `A dispute was opened on "${t}". An arbiter will review the same evidence.\n\n${u}` },
  refunded: { subject: (t) => `Refunded: ${t}`, body: (t, u) => `"${t}" expired without a delivery. The locked amount is back in your balance.\n\n${u}` },
  resolved: { subject: (t) => `Dispute resolved: ${t}`, body: (t, u) => `The arbiter resolved "${t}". Funds are available to withdraw.\n\n${u}` },
};

export async function notify(jobId: string, to: string | null | undefined, kind: NotificationKind, title: string): Promise<void> {
  if (!to || !to.includes("@")) return;
  const e = env();
  const existing = await db.notification.findUnique({ where: { jobId_to_kind: { jobId, to, kind } } }).catch(() => null);
  if (existing) return;
  const url = appUrl(`/j/${jobId}`);
  const copy = COPY[kind];
  let error: string | undefined;
  if (e.RESEND_API_KEY) {
    try {
      const resend = new Resend(e.RESEND_API_KEY);
      await resend.emails.send({ from: e.EMAIL_FROM, to, subject: copy.subject(title), text: copy.body(title, url) });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  } else {
    error = "RESEND_API_KEY not set";
  }
  await db.notification.create({ data: { jobId, to, kind, error } }).catch(() => undefined);
}
