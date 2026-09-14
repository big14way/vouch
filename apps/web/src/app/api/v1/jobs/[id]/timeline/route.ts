import { withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { getJobOrThrow, timeline } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** GET /api/v1/jobs/:id/timeline — merged chain + service events. */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const job = await getJobOrThrow(id);
  return json({ events: await timeline(job) });
});
