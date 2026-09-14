import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errors, withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { toDto, verdictDto } from "@/lib/jobs/dto";
import { objectUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /api/v1/arbiter/jobs — disputed + stuck jobs with both sides' evidence (allow-listed arbiters only). */
export const GET = withErrors(async (req) => {
  const p = await requireAuth(req);
  if (!p.isArbiter) throw errors.forbidden("view the arbiter queue");
  const stuckBefore = new Date(Date.now() - 7 * 86_400_000);
  const jobs = await db.job.findMany({
    where: { OR: [{ status: "Disputed" }, { status: "Submitted", submittedAt: { lt: stuckBefore } }] },
    orderBy: { updatedAt: "asc" },
    include: { disputes: { orderBy: { createdAt: "desc" } }, deliveries: { orderBy: { createdAt: "desc" }, take: 1 }, verdicts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const out = [];
  for (const j of jobs) {
    const delivery = j.deliveries[0] ?? null;
    const manifest = (delivery?.manifest as { files?: { name: string; url: string; sha256: string }[]; links?: string[]; note?: string } | undefined) ?? {};
    const files = await Promise.all((manifest.files ?? []).map(async (f) => ({ name: f.name, sha256: f.sha256, url: await objectUrl(f.url) })));
    out.push({
      job: await toDto(j, p),
      verdict: await verdictDto(j, j.verdicts[0] ?? null, delivery),
      disputes: j.disputes,
      evidence: { files, links: manifest.links ?? [], note: manifest.note ?? "" },
    });
  }
  return json({ items: out });
});
