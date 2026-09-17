import { z } from "zod";
import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";
import { AddressSchema, Bytes32Schema, ChainIdSchema, ENCRYPTED_PAYLOAD_ABI, HexSchema, isTempo, zonesFor } from "@vouch/shared";
import { principalAddress, requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { typedDataFor, sigFromInput } from "@/lib/jobs/sign";
import { vaultAddress } from "@/lib/chain/clients";
import { readZonePortalAllowed, readZonePortalLegacy, withdrawToZoneWithSig } from "@/lib/chain/vault";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

const Payload = z.object({
  ephemeralPubkeyX: Bytes32Schema,
  ephemeralPubkeyYParity: z.number().int().min(0).max(3), // SEC1 compressed prefix (2 or 3) as emitted by viem/ox
  ciphertext: HexSchema,
  nonce: z.string().regex(/^0x[0-9a-fA-F]{24}$/),
  tag: z.string().regex(/^0x[0-9a-fA-F]{32}$/),
});

const Input = z.object({
  chainId: ChainIdSchema,
  zoneId: z.number().int(),
  token: AddressSchema,
  amount: z.string().regex(/^\d+$/),
  keyIndex: z.string().regex(/^\d+$/),
  encrypted: Payload,
  signature: z.object({ signer: AddressSchema, deadline: z.string(), signature: HexSchema }).optional(),
});

function zoneOrThrow(chainId: number, zoneId: number) {
  if (env().ZONES_ENABLED !== "1") throw errors.badRequest("Private payouts are not enabled on this server.", "Set ZONES_ENABLED=1 (testnet only).");
  if (!isTempo(chainId)) throw errors.badRequest("Tempo Zones exist on Tempo only.");
  const zone = zonesFor(chainId).find((z) => z.zoneId === zoneId);
  if (!zone) throw errors.badRequest("Unknown zone.", "Use Zone A (6) or Zone B (7) on Moderato.");
  const override = process.env[`ZONE_PORTAL_${chainId}`];
  return { ...zone, portal: (override ? getAddress(override) : zone.portal) as Address };
}

export function payloadHash(p: z.infer<typeof Payload>): Hex {
  return keccak256(
    encodeAbiParameters(ENCRYPTED_PAYLOAD_ABI, [
      { ephemeralPubkeyX: p.ephemeralPubkeyX as Hex, ephemeralPubkeyYParity: p.ephemeralPubkeyYParity, ciphertext: p.ciphertext as Hex, nonce: p.nonce as Hex, tag: p.tag as Hex },
    ]),
  );
}

/**
 * GET /api/v1/withdraw/zone?chainId&zoneId&token&amount&keyIndex&encrypted=<json>
 * Returns the vault + portal + `legacy` flag (the client encrypts the recipient with `sender = vault`, or with the
 * legacy scheme when the portal predates the sender binding) and the typed data.
 * With no `encrypted` yet, returns just vault + portal so the client can prepare the payload first.
 */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  const signer = principalAddress(p);
  if (!signer) throw errors.badRequest("No wallet linked.");
  const u = new URL(req.url);
  const chainId = Number(u.searchParams.get("chainId"));
  const zone = zoneOrThrow(chainId, Number(u.searchParams.get("zoneId") ?? 6));
  const [allowed, legacy] = await Promise.all([readZonePortalAllowed(chainId, zone.portal), readZonePortalLegacy(chainId, zone.portal)]);
  const base = { chainId, zone: { ...zone, allowed, legacy }, vault: vaultAddress(chainId), testnetOnly: true };
  const enc = u.searchParams.get("encrypted");
  if (!enc) return json(base);
  const input = Input.parse({
    chainId, zoneId: zone.zoneId, token: u.searchParams.get("token"), amount: u.searchParams.get("amount"), keyIndex: u.searchParams.get("keyIndex") ?? "0", encrypted: JSON.parse(enc),
  });
  const typedData = await typedDataFor(chainId, "ZoneWithdraw", signer, {
    portal: zone.portal, token: getAddress(input.token), amount: input.amount, keyIndex: input.keyIndex, payloadHash: payloadHash(input.encrypted),
  });
  return json({ ...base, typedData });
});

/** POST /api/v1/withdraw/zone — relay `withdrawToZoneWithSig`; the relayer pays gas, the user is the refund recipient. */
export const POST = withErrors(async (req) => {
  rateLimit(req, "post");
  const p = await requireAuth(req);
  const input = await body(req, Input);
  const zone = zoneOrThrow(input.chainId, input.zoneId);
  if (!input.signature) throw errors.badRequest("A signed ZoneWithdraw authorisation is required.", "GET /api/v1/withdraw/zone with the encrypted payload, sign the typed data, and resend.");
  const signer = principalAddress(p);
  if (!signer || signer.toLowerCase() !== input.signature.signer.toLowerCase()) throw errors.forbidden("withdraw for another wallet");
  if (!(await readZonePortalAllowed(input.chainId, zone.portal))) throw errors.badRequest("This zone portal is not enabled on the vault yet.");
  const { hash } = await withdrawToZoneWithSig(input.chainId, {
    portal: zone.portal, token: getAddress(input.token) as Address, amount: BigInt(input.amount), keyIndex: BigInt(input.keyIndex),
    encrypted: { ...input.encrypted, ephemeralPubkeyX: input.encrypted.ephemeralPubkeyX as Hex, ciphertext: input.encrypted.ciphertext as Hex, nonce: input.encrypted.nonce as Hex, tag: input.encrypted.tag as Hex },
    sig: sigFromInput(input.signature),
  });
  return json({ tx: hash, zone: zone.name, zoneChainId: zone.chainId, feeSponsored: true, note: "Recipient and memo are encrypted to the zone sequencer; the zone balance updates after the deposit is processed." });
});
