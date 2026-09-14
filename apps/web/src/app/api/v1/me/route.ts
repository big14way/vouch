import { z } from "zod";
import { getAddress } from "viem";
import { AddressSchema } from "@vouch/shared";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errors, withErrors } from "@/lib/errors";
import { body, json, options } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

const Profile = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["payer", "worker", "both"]).optional(),
  address: AddressSchema.optional(),
});

/** GET /api/v1/me */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  if (p.kind === "agent") return json({ kind: "agent", address: p.address, label: p.label, isArbiter: p.isArbiter });
  const u = await db.user.findUniqueOrThrow({ where: { id: p.userId } });
  return json({ kind: "user", id: u.id, email: u.email, name: u.name, role: u.role, address: u.address, isArbiter: p.isArbiter, onboarded: Boolean(u.name && u.role) });
});

/** POST /api/v1/me — complete onboarding / link the embedded wallet. */
export const POST = withErrors(async (req) => {
  rateLimit(req, "post");
  const p = await requireAuth(req);
  if (p.kind !== "user") throw errors.forbidden("edit a profile with an API key");
  const input = await body(req, Profile);
  const u = await db.user.update({
    where: { id: p.userId },
    data: { ...input, address: input.address ? getAddress(input.address).toLowerCase() : undefined },
  });
  // Link jobs created before the wallet was known (e.g. worker hint = email).
  if (u.email) await db.job.updateMany({ where: { workerHint: u.email, workerUserId: null }, data: { workerUserId: u.id } });
  return json({ id: u.id, email: u.email, name: u.name, role: u.role, address: u.address, onboarded: Boolean(u.name && u.role) });
});
