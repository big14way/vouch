import { ApproveInputSchema } from "@vouch/shared";
import { requireAuth } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { approve, getJobOrThrow } from "@/lib/jobs/service";
import { sigFromInput } from "@/lib/jobs/sign";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** POST /api/v1/jobs/:id/approve — payer releases payment (signed Settle, relayed). */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "post");
  const { id } = await ctx.params;
  const p = await requireAuth(req);
  const job = await getJobOrThrow(id);
  const input = await body(req, ApproveInputSchema);
  if (!input.signature) throw errors.badRequest("A signed Settle authorisation is required.", "GET /sign?action=Settle, sign it with the payer wallet, and resend.");
  const updated = await approve(job, p, sigFromInput(input.signature));
  return json({ status: updated.status, tx: (updated.txs as Record<string, string>).settled, job: await toDto(updated, p) });
});
