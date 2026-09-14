import { CreateJobInputSchema } from "@vouch/shared";
import { principal, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { fundRoutes, mcpHint, payUrl, toDto } from "@/lib/jobs/dto";
import { createJob } from "@/lib/jobs/service";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** POST /api/v1/jobs — create a job (human via Privy token, agent via API key, or anonymous pay-link). */
export const POST = withErrors(async (req) => {
  rateLimit(req, "post");
  const p = await principal(req);
  const input = await body(req, CreateJobInputSchema);
  const job = await createJob(input, p);
  return json(
    { jobId: job.id, shortId: job.shortId, commit: job.commit, payUrl: payUrl(job.id), mcpHint: mcpHint(job.id), fundRoutes: fundRoutes(job), job: await toDto(job, p) },
    { status: 201 },
  );
});

/** GET /api/v1/jobs — jobs where the caller is payer or worker. */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  const addr = p.kind === "agent" ? p.address : p.address;
  const where = p.kind === "user"
    ? { OR: [{ payerUserId: p.userId }, { workerUserId: p.userId }, ...(addr ? [{ payer: addr.toLowerCase() }, { worker: addr.toLowerCase() }] : [])] }
    : { OR: [{ payer: addr!.toLowerCase() }, { worker: addr!.toLowerCase() }] };
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const jobs = await db.job.findMany({ where: { ...where, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
  return json({ jobs: await Promise.all(jobs.map((j) => toDto(j, p))) });
});
