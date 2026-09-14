import { principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/errors";
import { type Ctx } from "@/lib/http";
import { toDto, verdictDto } from "@/lib/jobs/dto";
import { getJobOrThrow } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/v1/jobs/:id/events — Server-Sent Events. Emits `job` and `verdict` snapshots whenever they change
 * (polled server-side every 2 s, so the client sees chain events within the indexer's 30 s window or sooner
 * when the service itself wrote the change). Closes after ~55 s; clients reconnect.
 */
export const GET = withErrors(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await principal(req);
  const job0 = await getJobOrThrow(id);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let last = "";
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const deadline = Date.now() + 55_000;
      try {
        while (Date.now() < deadline && !req.signal.aborted) {
          const job = await db.job.findUnique({ where: { id: job0.id } });
          if (!job) break;
          const [v, d] = await Promise.all([
            db.verdict.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
            db.delivery.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
          ]);
          const dto = await toDto(job, p);
          const vd = await verdictDto(job, v, d);
          const sig = `${job.updatedAt.toISOString()}:${v?.updatedAt.toISOString() ?? ""}:${v?.stage ?? ""}`;
          if (sig !== last) {
            last = sig;
            send("job", dto);
            send("verdict", vd);
          } else {
            controller.enqueue(enc.encode(`: ping\n\n`));
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch {
        // client went away
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
});
