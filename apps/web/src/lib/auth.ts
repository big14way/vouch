import { createHash, randomBytes } from "node:crypto";
import { PrivyClient } from "@privy-io/server-auth";
import type { Address } from "viem";
import { db } from "./db";
import { env } from "./env";
import { errors } from "./errors";

export type Principal =
  | { kind: "user"; userId: string; address: Address | null; email: string | null; isArbiter: boolean }
  | { kind: "agent"; keyId: string; address: Address; label: string; isArbiter: boolean }
  | { kind: "anonymous"; isArbiter: false };

let privy: PrivyClient | undefined;
function privyClient(): PrivyClient | undefined {
  const e = env();
  if (!e.NEXT_PUBLIC_PRIVY_APP_ID || !e.PRIVY_APP_SECRET) return undefined;
  privy ??= new PrivyClient(e.NEXT_PUBLIC_PRIVY_APP_ID, e.PRIVY_APP_SECRET);
  return privy;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `vk_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 8), hash: hashApiKey(key) };
}

function arbiterAllowlist(): Set<string> {
  return new Set(env().ARBITER_ALLOWLIST.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

/** Resolve the caller. Never throws for anonymous; throws 401 for a *present but invalid* credential. */
export async function principal(req: Request): Promise<Principal> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const token = bearer || req.headers.get("x-api-key") || "";
  if (!token) return { kind: "anonymous", isArbiter: false };

  if (token.startsWith("vk_")) {
    const key = await db.agentKey.findUnique({ where: { keyHash: hashApiKey(token) } });
    if (!key || key.revokedAt) throw errors.unauthorized("This API key is invalid or revoked. Create a new one at /api/v1/agents/keys.");
    void db.agentKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    const allow = arbiterAllowlist();
    return { kind: "agent", keyId: key.id, address: key.address as Address, label: key.label, isArbiter: allow.has(key.address.toLowerCase()) };
  }

  const p = privyClient();
  if (!p) throw errors.unauthorized("Sign-in is not configured on this server.");
  let claims;
  try {
    claims = await p.verifyAuthToken(token);
  } catch {
    throw errors.unauthorized("Your session expired. Sign in again.");
  }
  const user = await db.user.findUnique({ where: { privyId: claims.userId } });
  if (!user) {
    // First request after login: create a shell record; /me completes it with wallet + email.
    const created = await db.user.create({ data: { privyId: claims.userId } });
    return { kind: "user", userId: created.id, address: null, email: null, isArbiter: false };
  }
  const allow = arbiterAllowlist();
  const isArbiter = Boolean((user.email && allow.has(user.email.toLowerCase())) || (user.address && allow.has(user.address.toLowerCase())));
  return { kind: "user", userId: user.id, address: (user.address as Address | null) ?? null, email: user.email, isArbiter };
}

export async function requireAuth(req: Request): Promise<Exclude<Principal, { kind: "anonymous" }>> {
  const p = await principal(req);
  if (p.kind === "anonymous") throw errors.unauthorized();
  return p;
}

export function principalAddress(p: Principal): Address | null {
  if (p.kind === "agent") return p.address;
  if (p.kind === "user") return p.address;
  return null;
}

export function cronAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return env().NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}
