import { TOKENS, type ChainId } from "@vouch/shared";
import { principalAddress, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enabledChains } from "@/lib/env";
import { errors, withErrors } from "@/lib/errors";
import { json, options } from "@/lib/http";
import { isVaultConfigured } from "@/lib/chain/clients";
import { readBalance } from "@/lib/chain/vault";
import { decryptSecret } from "@/lib/jobs/secrets";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;

/** GET /api/v1/balances — Available (vault credit) and Locked (your live jobs) per chain and token. */
export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const p = await requireAuth(req);
  const addr = principalAddress(p);
  if (!addr) throw errors.badRequest("No wallet linked to this account yet.", "Finish onboarding so your wallet is created.");
  const out = [];
  for (const chainId of enabledChains()) {
    if (!isVaultConfigured(chainId)) continue;
    for (const t of TOKENS[chainId as ChainId]) {
      const available = await readBalance(chainId, t.address, addr).catch(() => 0n);
      const live = await db.job.findMany({ where: { chainId, payer: addr.toLowerCase(), token: t.address, status: { in: ["Funded", "Submitted", "Attested", "Disputed"] } }, select: { id: true } });
      let locked = 0n;
      for (const j of live) locked += (await decryptSecret(j.id).catch(() => ({ amount: 0n }))).amount;
      out.push({ chainId, token: t.address, symbol: t.symbol, available: available.toString(), locked: locked.toString() });
    }
  }
  return json({ address: addr, balances: out });
});
