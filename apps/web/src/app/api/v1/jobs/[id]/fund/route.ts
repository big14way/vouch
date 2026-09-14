import { formatUnits, type Address, type Hex } from "viem";
import { isTempo, type ChainId } from "@vouch/shared";
import { principal, principalAddress } from "@/lib/auth";
import { db } from "@/lib/db";
import { errors, withErrors } from "@/lib/errors";
import { json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { decryptSecret } from "@/lib/jobs/secrets";
import { attributeAndFund, fundFromBalance, getJobOrThrow } from "@/lib/jobs/service";
import { chargeHandler, receiptFromResponse } from "@/lib/mpp";
import { publicClient } from "@/lib/chain/clients";
import { readBalance, transfersToVault } from "@/lib/chain/vault";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/**
 * POST /api/v1/jobs/:id/fund
 *
 * 1. If the caller already holds enough Vouch balance on the job's chain, lock it directly (no payment).
 * 2. Otherwise the route is payment-gated:
 *    - Tempo: `mppx` tempo/charge → 402 challenge → client pays a TIP-20 transfer to the Vault with memo = jobId
 *      → 200 { status: "Funded", tx }. One HTTP round-trip. Pull-mode clients are fee-sponsored.
 *    - Base: `mppx` evm/charge (x402-compatible) → 402 → EIP-3009 authorisation settled by the facilitator → 200.
 * Idempotent: a job that is already funded returns 200 without charging.
 */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "fund");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  if (job.status !== "Open" && job.status !== "Draft") {
    return json({ status: job.status, job: await toDto(job, p), note: "Already funded; no payment taken." });
  }
  const chainId = job.chainId as ChainId;
  const { amount } = await decryptSecret(job.id);
  const caller = principalAddress(p);

  // (1) balance path
  if (caller) {
    if (job.payer && job.payer !== caller.toLowerCase()) throw errors.forbidden("fund a job that belongs to another payer");
    const bal = await readBalance(chainId, job.token as Address, caller).catch(() => 0n);
    if (bal >= amount) {
      const funded = await fundFromBalance(job, caller, p);
      return json({ status: "Funded", route: "balance", tx: (funded.txs as Record<string, string>).funded, job: await toDto(funded, p) });
    }
  }

  // (2) payment-gated path
  const handler = chargeHandler({
    chainId, token: job.token as Address, amount: formatUnits(amount, 6),
    description: `Vouch job ${job.shortId}: ${job.title}`.slice(0, 120), jobId: job.id as Hex,
  });
  const result = await handler(req.clone());
  if (result.status === 402) {
    return result.challenge;
  }
  const receipted = result.withReceipt(new Response(null, { status: 200 }));
  const receipt = receiptFromResponse(receipted);
  if (!receipt) throw errors.chain("Payment verified but no receipt was returned.");

  // Resolve payer + value from chain so we never trust headers for money.
  const ref = receipt.reference as Hex;
  let payer: Address | null = caller;
  let value = amount;
  let sourceTx: string | undefined;
  if (/^0x[0-9a-fA-F]{64}$/.test(ref)) {
    const r = await publicClient(chainId).waitForTransactionReceipt({ hash: ref, timeout: 60_000 });
    const transfers = transfersToVault(chainId, r).filter((t) => t.token.toLowerCase() === job.token.toLowerCase());
    const match = transfers.find((t) => !isTempo(chainId) || !t.memo || t.memo.toLowerCase() === job.id.toLowerCase()) ?? transfers[0];
    if (!match) throw errors.chain("Payment transaction did not transfer tokens to the vault.");
    payer = match.from;
    value = match.value;
    sourceTx = ref;
  }
  if (!payer) throw errors.badRequest("Could not determine the paying wallet.", "Send the request with an API key bound to your wallet, or pay in push mode.");

  const funded = await attributeAndFund(job, { token: job.token as Address, from: payer, value, ref, sourceTx, memo: job.id });
  const dto = await toDto(funded, p);
  const res = json({ status: funded.status, route: isTempo(chainId) ? "mpp" : "x402", tx: (funded.txs as Record<string, string>).funded, paymentTx: sourceTx ?? ref, job: dto });
  const withReceipt = result.withReceipt(res);
  return withReceipt;
});

/** GET — what a client needs to fund without paying twice: chain, token, amount, routes. */
export const GET = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  const dto = await toDto(job, p);
  const { amount } = await decryptSecret(job.id);
  const attributions = await db.attribution.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return json({ chainId: job.chainId, token: job.token, tokenSymbol: job.tokenSymbol, amount: amount.toString(), status: job.status, fundRoutes: dto.fundRoutes, attributions });
});
