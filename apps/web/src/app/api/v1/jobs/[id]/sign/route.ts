import { getAddress, type Address } from "viem";
import { hashReason, type VaultAction } from "@vouch/shared";
import { principal, principalAddress } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { getJobOrThrow } from "@/lib/jobs/service";
import { typedDataFor } from "@/lib/jobs/sign";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/**
 * GET /api/v1/jobs/:id/sign?action=Submit|Resubmit|Settle|Dispute&signer=0x…&deliverableHash=0x…&reason=…
 * Returns EIP-712 typed data (with the signer's current nonce and a 1 h deadline) for the client to sign.
 */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") as VaultAction | null;
  const signerRaw = url.searchParams.get("signer") ?? principalAddress(p);
  if (!signerRaw) throw errors.badRequest("signer is required.", "Pass ?signer=0x… or authenticate with a wallet-bound key.");
  const signer = getAddress(signerRaw) as Address;
  const jobId = job.id;
  switch (action) {
    case "Submit":
    case "Resubmit": {
      const deliverableHash = url.searchParams.get("deliverableHash");
      if (!deliverableHash) throw errors.badRequest("deliverableHash is required for Submit.", "Compute keccak256(canonical manifest JSON) — @vouch/shared hashManifest — and pass it.");
      return json({ typedData: await typedDataFor(job.chainId, action, signer, { jobId, deliverableHash }) });
    }
    case "Settle":
      return json({ typedData: await typedDataFor(job.chainId, "Settle", signer, { jobId }) });
    case "Dispute": {
      const reason = url.searchParams.get("reason") ?? "";
      if (reason.length < 10) throw errors.badRequest("reason (≥ 10 chars) is required for Dispute.");
      return json({ typedData: await typedDataFor(job.chainId, "Dispute", signer, { jobId, reasonHash: hashReason(reason) }), reasonHash: hashReason(reason) });
    }
    default:
      throw errors.badRequest("Unknown action.", "Use Submit, Resubmit, Settle or Dispute.");
  }
});
