import { cronAuthorized } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { runTimelock } from "@/lib/timelock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Every 5 min: autoSettle where every predicate holds; refundExpired past the delivery deadline. */
export const GET = withErrors(async (req) => {
  if (!cronAuthorized(req)) throw errors.unauthorized("Cron route.");
  return json(await runTimelock());
});
