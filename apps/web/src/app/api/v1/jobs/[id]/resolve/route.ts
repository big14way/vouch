import { ResolveInputSchema } from "@vouch/shared";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { getJobOrThrow, resolveDispute } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** POST /api/v1/jobs/:id/resolve — arbiter splits a disputed job. */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "post");
  const { id } = await ctx.params;
  const p = await requireAuth(req);
  const job = await getJobOrThrow(id);
  const input = await body(req, ResolveInputSchema);
  const updated = await resolveDispute(job, p, input.workerBps, input.note);
  return json({ status: updated.status, tx: (updated.txs as Record<string, string>).resolved, job: await toDto(updated, p) });
});
