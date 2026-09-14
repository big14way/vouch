import { z } from "zod";
import { getAddress, type Address } from "viem";
import { AddressSchema, ChainIdSchema, HexSchema, isTempo } from "@vouch/shared";
import { requireAuth, principalAddress } from "@/lib/auth";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { typedDataFor, sigFromInput } from "@/lib/jobs/sign";
import { withdrawWithSig } from "@/lib/chain/vault";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

const Input = z.object({
  chainId: ChainIdSchema,
  token: AddressSchema,
  amount: z.string().regex(/^\d+$/),
  to: AddressSchema,
  signature: z.object({ signer: AddressSchema, deadline: z.string(), signature: HexSchema }).optional(),
});

/**
 * GET  /api/v1/withdraw?chainId&token&amount&to — typed data to sign.
 * POST /api/v1/withdraw — relay `withdrawWithSig` (fee sponsored on Tempo; relayer pays on Base).
 */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  const signer = principalAddress(p);
  if (!signer) throw errors.badRequest("No wallet linked.");
  const u = new URL(req.url);
  const input = Input.parse({ chainId: Number(u.searchParams.get("chainId")), token: u.searchParams.get("token"), amount: u.searchParams.get("amount"), to: u.searchParams.get("to") });
  return json({ typedData: await typedDataFor(input.chainId, "Withdraw", signer, { token: getAddress(input.token), amount: input.amount, to: getAddress(input.to) }) });
});

export const POST = withErrors(async (req) => {
  rateLimit(req, "post");
  const p = await requireAuth(req);
  const input = await body(req, Input);
  if (!input.signature) throw errors.badRequest("A signed Withdraw authorisation is required.", "GET /api/v1/withdraw with the same parameters, sign the typed data, and resend.");
  const signer = principalAddress(p);
  if (!signer || signer.toLowerCase() !== input.signature.signer.toLowerCase()) throw errors.forbidden("withdraw for another wallet");
  const sig = sigFromInput({ signer: input.signature.signer, deadline: input.signature.deadline, signature: input.signature.signature });
  const { hash } = await withdrawWithSig(input.chainId, getAddress(input.token) as Address, BigInt(input.amount), getAddress(input.to) as Address, sig);
  return json({ tx: hash, feeSponsored: isTempo(input.chainId) });
});
