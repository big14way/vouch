import { z } from "zod";
import { createHash } from "node:crypto";
import type { Address, Hex } from "viem";
import { AddressSchema, Bytes32Schema, ChainIdSchema } from "@vouch/shared";
import { cronAuthorized } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { attributeAndFund, getJobOrThrow } from "@/lib/jobs/service";
import { publicClient } from "@/lib/chain/clients";
import { transfersToVault } from "@/lib/chain/vault";

const Input = z.object({ chainId: ChainIdSchema, txHash: Bytes32Schema, jobId: Bytes32Schema.optional(), to: AddressSchema.optional() });

export const OPTIONS = options;

/**
 * POST /api/v1/deposits/attribute — internal (CRON_SECRET). Given a transaction that moved tokens into the vault,
 * attribute it to the sender and fund the job named by the memo (or `jobId`). Idempotent per (tx, logIndex).
 */
export const POST = withErrors(async (req) => {
  if (!cronAuthorized(req)) throw errors.unauthorized("Internal route; send the CRON_SECRET bearer token.");
  const input = await body(req, Input);
  const receipt = await publicClient(input.chainId).getTransactionReceipt({ hash: input.txHash as Hex });
  const transfers = transfersToVault(input.chainId, receipt);
  const results = [];
  for (const t of transfers) {
    const jobId = input.jobId ?? t.memo;
    if (!jobId) continue;
    const job = await getJobOrThrow(jobId);
    const ref = `0x${createHash("sha256").update(`${input.txHash}:${t.logIndex}`).digest("hex")}` as Hex;
    const funded = await attributeAndFund(job, { token: t.token as Address, from: (input.to ?? t.from) as Address, value: t.value, ref, sourceTx: input.txHash, memo: t.memo });
    results.push({ jobId: job.id, status: funded.status });
  }
  return json({ results });
});
