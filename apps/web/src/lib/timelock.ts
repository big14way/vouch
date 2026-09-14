import { db } from "./db";
import { autoSettle, refundExpired } from "./jobs/service";

/** Cron every 5 min: auto-settle eligible jobs, refund expired ones. Each job is independent; failures don't block others. */
export async function runTimelock(): Promise<{ settled: string[]; refunded: string[]; errors: Record<string, string> }> {
  const settled: string[] = [];
  const refunded: string[] = [];
  const errs: Record<string, string> = {};
  const now = Date.now();

  const attested = await db.job.findMany({ where: { status: "Attested", autoRelease: { gt: 0 }, attestedAt: { not: null } }, take: 50 });
  for (const j of attested) {
    if (!j.attestedAt || j.attestedAt.getTime() + j.reviewWindow * 1000 > now) continue;
    try {
      const r = await autoSettle(j);
      if (r) settled.push(j.id);
    } catch (e) {
      errs[j.id] = e instanceof Error ? e.message : String(e);
    }
  }

  const funded = await db.job.findMany({ where: { status: "Funded", submitDeadline: { gt: 0 }, fundedAt: { not: null } }, take: 50 });
  for (const j of funded) {
    if (!j.fundedAt || j.fundedAt.getTime() + j.submitDeadline * 1000 > now) continue;
    try {
      await refundExpired(j);
      refunded.push(j.id);
    } catch (e) {
      errs[j.id] = e instanceof Error ? e.message : String(e);
    }
  }
  return { settled, refunded, errors: errs };
}
