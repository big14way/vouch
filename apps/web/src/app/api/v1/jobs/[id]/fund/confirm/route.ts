import { z } from "zod";
import { createHash } from "node:crypto";
import type { Address, Hex } from "viem";
import { Bytes32Schema, Status, type ChainId } from "@vouch/shared";
import { principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { attributeAndFund, funnel, getJobOrThrow } from "@/lib/jobs/service";
import { publicClient } from "@/lib/chain/clients";
import { readJob, transfersToVault } from "@/lib/chain/vault";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/**
 * POST /api/v1/jobs/:id/fund/confirm { txHash }
 * The client already sent a transaction itself: either the Tempo batched `approve → deposit → createJob → fund`
 * (the job is then Funded on-chain and we just sync), or a plain transfer to the vault (we attribute + fund).
 */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "fund");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const { txHash } = await body(req, z.object({ txHash: Bytes32Schema }));
  const chainId = job.chainId as ChainId;
  const receipt = await publicClient(chainId).waitForTransactionReceipt({ hash: txHash as Hex, timeout: 90_000 });
  if (receipt.status !== "success") throw errors.chain("That transaction reverted.");

  const onChain = await readJob(chainId, job.id as Hex);
  if (onChain.status >= Status.Funded) {
    // Wallet-side batched path: on-chain is source of truth.
    const txs = { ...((job.txs as Record<string, string>) ?? {}), created: txHash, funded: txHash };
    const commit = onChain.commit;
    const updated = await db.job.update({
      where: { id: job.id },
      data: { status: job.status === "Open" ? "Funded" : job.status, fundedAt: job.fundedAt ?? new Date(), payer: onChain.payer.toLowerCase(), commit, txs, payerUserId: p.kind === "user" ? p.userId : job.payerUserId },
    });
    if (job.status === "Open") await funnel(updated, "funded", p);
    return json({ status: updated.status, route: "batched", tx: txHash, job: await toDto(updated, p) });
  }

  const transfers = transfersToVault(chainId, receipt).filter((t) => t.token.toLowerCase() === job.token.toLowerCase());
  const t = transfers.find((x) => x.memo?.toLowerCase() === job.id.toLowerCase()) ?? transfers[0];
  if (!t) throw errors.badRequest("That transaction did not move tokens into the vault.", "Send the exact amount to the vault address with the job memo.");
  const ref = `0x${createHash("sha256").update(`${txHash}:${t.logIndex}`).digest("hex")}` as Hex;
  const funded = await attributeAndFund(job, { token: t.token as Address, from: t.from as Address, value: t.value, ref, sourceTx: txHash, memo: t.memo });
  return json({ status: funded.status, route: "transfer", tx: (funded.txs as Record<string, string>).funded, job: await toDto(funded, p) });
});
