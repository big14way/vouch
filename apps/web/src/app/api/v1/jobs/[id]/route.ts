import { principal } from "@/lib/auth";
import { withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { getJobOrThrow } from "@/lib/jobs/service";
import { nudge } from "@/lib/nudge";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;
/** Room for the opportunistic indexer tick that runs after the response (see lib/nudge). */
export const maxDuration = 60;

/** GET /api/v1/jobs/:id — role-scoped view. Public sees everything except the amount and private hints. */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  nudge();
  return json({ job: await toDto(job, p) });
});
