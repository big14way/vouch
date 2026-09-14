import { principal } from "@/lib/auth";
import { withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { getJobOrThrow, refundExpired } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** POST /api/v1/jobs/:id/refund — anyone may trigger `refundExpired` once the delivery deadline passed. */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "post");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const updated = await refundExpired(job);
  return json({ status: updated.status, tx: (updated.txs as Record<string, string>).refunded, job: await toDto(updated, p) });
});
