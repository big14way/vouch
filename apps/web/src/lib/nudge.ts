import { after } from "next/server";
import { db } from "./db";
import { pollAll } from "./indexer";
import { runTimelock } from "./timelock";

/** Minimum gap between opportunistic ticks, per instance and (via IndexerCursor.updatedAt) across instances. */
const MIN_GAP_MS = 20_000;
/** A nudge polls for at most this long so the request's function budget is not consumed by a backfill. */
const NUDGE_POLL_BUDGET_MS = 15_000;

let last = 0;
let inflight = false;

/**
 * Opportunistic chain → DB sync. Called from routes a waiting client polls (job GET, health): if no tick ran in the last
 * MIN_GAP_MS, run the indexer and the timelock after the response is sent. Hosts with coarse crons (Vercel Hobby runs
 * them twice a day; the GitHub schedule is best-effort) still converge within seconds while someone is watching.
 */
export function nudge(): void {
  const now = Date.now();
  if (inflight || now - last < MIN_GAP_MS) return;
  last = now;
  after(async () => {
    if (inflight) return;
    inflight = true;
    try {
      const recent = await db.indexerCursor.findFirst({ where: { updatedAt: { gt: new Date(now - MIN_GAP_MS) } } });
      if (recent) return;
      await pollAll(NUDGE_POLL_BUDGET_MS);
      await runTimelock();
    } catch {
      // best effort; the cron routes are the source of truth
    } finally {
      inflight = false;
    }
  });
}
