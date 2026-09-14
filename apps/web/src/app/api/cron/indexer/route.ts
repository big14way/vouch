import { cronAuthorized } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { pollAll } from "@/lib/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fallback polling every 30 s (spec §7.2). Webhooks/TIDX are faster; this guarantees nothing is missed. */
export const GET = withErrors(async (req) => {
  if (!cronAuthorized(req)) throw errors.unauthorized("Cron route.");
  return json({ chains: await pollAll() });
});
