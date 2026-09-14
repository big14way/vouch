import { principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { verdictDto, roleFor } from "@/lib/jobs/dto";
import { getJobOrThrow } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** GET /api/v1/jobs/:id/verdict — verdict, confidence, scope checklist with evidence, questions, attestation tx, report URL. */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const [v, d] = await Promise.all([
    db.verdict.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
    db.delivery.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const dto = await verdictDto(job, v, d);
  if (roleFor(job, p) === "public" && !job.amountPublic) dto.reportUrl = null;
  return json(dto);
});
