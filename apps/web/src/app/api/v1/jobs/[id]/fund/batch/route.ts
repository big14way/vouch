import { principal, principalAddress } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { decryptSecret } from "@/lib/jobs/secrets";
import { getJobOrThrow } from "@/lib/jobs/service";
import { vaultAddress } from "@/lib/chain/clients";
import { rateLimit } from "@/lib/ratelimit";
import { ZERO_ADDRESS, isTempo } from "@vouch/shared";

export const OPTIONS = options;

/**
 * GET /api/v1/jobs/:id/fund/batch — everything a Tempo wallet needs to fund in one sponsored batched
 * transaction (approve → deposit → createJob → fund). Available to the payer or, for jobs that don't have a
 * payer yet, to anyone holding the pay link while the job is still open. The salt is revealed to the payer
 * only; it is what hides the amount on-chain until settlement.
 */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  if (!isTempo(job.chainId)) throw errors.badRequest("Batched funding is a Tempo feature.", "On Base, sign a USDC authorisation instead.");
  if (job.status !== "Open") throw errors.wrongState(job.status.toLowerCase(), "awaiting payment");
  const caller = principalAddress(p)?.toLowerCase();
  const isCreator = p.kind === "user" && job.payerUserId === p.userId;
  if (job.payer && job.payer !== caller && !isCreator) throw errors.forbidden("fund a job that belongs to another payer");
  const { amount, salt } = await decryptSecret(job.id);
  return json({
    chainId: job.chainId, vault: vaultAddress(job.chainId), token: job.token, jobId: job.id, amount: amount.toString(), scopeHash: job.scopeHash, salt,
    worker: job.worker ?? ZERO_ADDRESS,
    policy: { autoRelease: job.autoRelease, minConfidenceBps: job.minConfidenceBps, maxAutoAmount: job.maxAutoAmount, reviewWindow: job.reviewWindow, submitDeadline: job.submitDeadline, earnVault: job.earnVault ?? ZERO_ADDRESS },
  });
});
