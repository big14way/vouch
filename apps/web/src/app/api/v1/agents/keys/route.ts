import { z } from "zod";
import { getAddress, verifyMessage, type Hex } from "viem";
import { agentKeyChallenge, CreateAgentKeyInputSchema } from "@vouch/shared";
import { generateApiKey, principal, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/**
 * POST /api/v1/agents/keys — issue an API key bound to a wallet. The wallet signs
 * `Vouch API key for <address> at <timestamp>` (timestamp within 10 minutes). No login needed: the wallet is the identity.
 */
export const POST = withErrors(async (req) => {
  rateLimit(req, "keys");
  const p = await principal(req);
  const input = await body(req, CreateAgentKeyInputSchema);
  const address = getAddress(input.address);
  if (Math.abs(Date.now() / 1000 - input.timestamp) > 600) throw errors.badRequest("Timestamp is too old.", "Sign a fresh challenge with the current unix time.");
  const ok = await verifyMessage({ address, message: agentKeyChallenge(address, input.timestamp), signature: input.signature as Hex });
  if (!ok) throw errors.badRequest("The signature does not match the wallet.", "Sign exactly: " + agentKeyChallenge(address, input.timestamp));
  const { key, prefix, hash } = generateApiKey();
  const row = await db.agentKey.create({ data: { keyHash: hash, prefix, label: input.label, address: address.toLowerCase(), userId: p.kind === "user" ? p.userId : null } });
  return json({ id: row.id, key, prefix, address, label: row.label, note: "Store this key now; it is not shown again." }, { status: 201 });
});

/** GET /api/v1/agents/keys — keys for the caller's wallet / account. */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  const where = p.kind === "agent" ? { address: p.address.toLowerCase() } : { OR: [{ userId: p.userId }, ...(p.address ? [{ address: p.address.toLowerCase() }] : [])] };
  const keys = await db.agentKey.findMany({ where, orderBy: { createdAt: "desc" } });
  return json({ keys: keys.map((k) => ({ id: k.id, prefix: k.prefix, label: k.label, address: k.address, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt })) });
});

/** DELETE /api/v1/agents/keys { id } — revoke. */
export const DELETE = withErrors(async (req) => {
  rateLimit(req, "keys");
  const p = await requireAuth(req);
  const { id } = await body(req, z.object({ id: z.string() }));
  const k = await db.agentKey.findUnique({ where: { id } });
  if (!k) throw errors.notFound("key");
  const mine = p.kind === "agent" ? k.address === p.address.toLowerCase() : k.userId === p.userId || (p.address && k.address === p.address.toLowerCase());
  if (!mine) throw errors.forbidden("revoke that key");
  await db.agentKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return json({ ok: true });
});
