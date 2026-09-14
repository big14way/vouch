import { cronAuthorized } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { drainVerifierQueue } from "@/lib/verifier/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Every minute: run queued verifications that the inline `after()` hook did not finish (retries ≤ 3). */
export const GET = withErrors(async (req) => {
  if (!cronAuthorized(req)) throw errors.unauthorized("Cron route.");
  return json(await drainVerifierQueue());
});
