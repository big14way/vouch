import { after } from "next/server";
import { SubmitInputSchema } from "@vouch/shared";
import { principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { getJobOrThrow, submit } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";
import { runVerifier } from "@/lib/verifier/run";

export const OPTIONS = options;
export const maxDuration = 60;

/** POST /api/v1/jobs/:id/submit — pin files (sha256 each), relay the signed Submit, queue the verifier. */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "submit");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const input = await body(req, SubmitInputSchema);
  const { job: updated, deliveryId } = await submit(job, p, input);
  const verdict = await db.verdict.findFirst({ where: { deliveryId }, orderBy: { createdAt: "desc" } });
  if (verdict) after(() => runVerifier(verdict.id).catch(() => undefined));
  return json({ status: updated.status, tx: (updated.txs as Record<string, string>)[updated.resubmits ? `resubmitted${updated.resubmits}` : "submitted"], deliverableHash: updated.deliverableHash, verifier: { id: verdict?.id, stage: "queued" }, job: await toDto(updated, p) });
});
