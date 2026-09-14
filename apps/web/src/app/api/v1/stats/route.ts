import { db } from "@/lib/db";
import { withErrors } from "@/lib/errors";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/stats — public funnel counters (the landing page's live "settled jobs" number). Real numbers only. */
export const GET = withErrors(async () => {
  const [created, funded, delivered, verified, settled, autoSettled, disputed, byActor] = await Promise.all([
    db.funnelEvent.count({ where: { kind: "created" } }),
    db.funnelEvent.count({ where: { kind: "funded" } }),
    db.funnelEvent.count({ where: { kind: "delivered" } }),
    db.funnelEvent.count({ where: { kind: "verified" } }),
    db.job.count({ where: { status: { in: ["Settled", "Resolved"] } } }),
    db.funnelEvent.count({ where: { kind: "auto_settled" } }),
    db.funnelEvent.count({ where: { kind: "disputed" } }),
    db.funnelEvent.groupBy({ by: ["actor"], where: { kind: "funded" }, _count: { _all: true } }),
  ]);
  const settledJobs = await db.job.findMany({ where: { status: { in: ["Settled", "Resolved"] }, fundedAt: { not: null }, settledAt: { not: null } }, select: { fundedAt: true, settledAt: true } });
  const secs = settledJobs.map((j) => (j.settledAt!.getTime() - j.fundedAt!.getTime()) / 1000).sort((a, b) => a - b);
  const median = secs.length ? secs[Math.floor(secs.length / 2)]! : null;
  const returning = await db.job.groupBy({ by: ["payer"], where: { payer: { not: null }, status: { in: ["Settled", "Resolved", "Funded", "Submitted", "Attested"] } }, _count: { _all: true } });
  return json({
    created, funded, delivered, verified, settled, autoSettled, disputed,
    autoSettledPct: settled ? Math.round((autoSettled / settled) * 100) : null,
    medianTimeToSettleSeconds: median,
    returningPayers: returning.filter((r) => r._count._all > 1).length,
    fundedByActor: Object.fromEntries(byActor.map((r) => [r.actor ?? "unknown", r._count._all])),
  });
});
