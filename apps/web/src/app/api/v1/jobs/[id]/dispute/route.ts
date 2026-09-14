import { DisputeInputSchema } from "@vouch/shared";
import { requireAuth } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { dispute, getJobOrThrow } from "@/lib/jobs/service";
import { sigFromInput } from "@/lib/jobs/sign";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** POST /api/v1/jobs/:id/dispute — either party objects (signed Dispute, relayed). */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "post");
  const { id } = await ctx.params;
  const p = await requireAuth(req);
  const job = await getJobOrThrow(id);
  const input = await body(req, DisputeInputSchema);
  if (!input.signature) throw errors.badRequest("A signed Dispute authorisation is required.", "GET /sign?action=Dispute&reason=…, sign it, and resend.");
  const updated = await dispute(job, p, input.reason, sigFromInput(input.signature));
  return json({ status: updated.status, tx: (updated.txs as Record<string, string>).disputed, job: await toDto(updated, p) });
});
