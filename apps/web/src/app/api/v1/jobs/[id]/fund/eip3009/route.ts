import { z } from "zod";
import { getAddress, type Address, type Hex } from "viem";
import { AddressSchema, Bytes32Schema, HexSchema, isBase } from "@vouch/shared";
import { principal } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options, type Ctx } from "@/lib/http";
import { toDto } from "@/lib/jobs/dto";
import { decryptSecret } from "@/lib/jobs/secrets";
import { fundFromBalance, funnel, getJobOrThrow } from "@/lib/jobs/service";
import { depositWithAuthorization } from "@/lib/chain/vault";
import { rateLimit } from "@/lib/ratelimit";

const Input = z.object({
  from: AddressSchema,
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: Bytes32Schema,
  v: z.number().int(),
  r: Bytes32Schema,
  s: Bytes32Schema,
  signature: HexSchema.optional(),
});

export const OPTIONS = options;

/**
 * POST /api/v1/jobs/:id/fund/eip3009 — Base, humans. The payer signs a USDC `ReceiveWithAuthorization`
 * (to = Vault); Vouch relays `depositWithAuthorization` (payer never needs ETH), then creates + funds the job.
 */
export const POST = withErrors(async (req, ctx: Ctx) => {
  rateLimit(req, "fund");
  const { id } = await ctx.params;
  const p = await principal(req);
  const job = await getJobOrThrow(id);
  if (!isBase(job.chainId)) throw errors.badRequest("Signed USDC authorisations are only used on Base.", "On Tempo, pay with your wallet or from any wallet with the memo.");
  if (job.status !== "Open") return json({ status: job.status, job: await toDto(job, p) });
  const input = await body(req, Input);
  const from = getAddress(input.from);
  if (job.payer && job.payer !== from.toLowerCase()) throw errors.forbidden("fund a job that belongs to another payer");
  const { amount } = await decryptSecret(job.id);
  if (BigInt(input.value) < amount) throw errors.badRequest("The authorised value is less than the job amount.", `Authorise at least ${amount.toString()} base units.`);
  const { hash } = await depositWithAuthorization(job.chainId, {
    token: job.token as Address, from, value: BigInt(input.value), validAfter: BigInt(input.validAfter), validBefore: BigInt(input.validBefore),
    nonce: input.nonce as Hex, v: input.v, r: input.r as Hex, s: input.s as Hex, jobId: job.id,
  });
  await funnel(job, "deposited", p);
  const funded = await fundFromBalance(job, from, p);
  return json({ status: funded.status, route: "eip3009", depositTx: hash, tx: (funded.txs as Record<string, string>).funded, job: await toDto(funded, p) });
});
