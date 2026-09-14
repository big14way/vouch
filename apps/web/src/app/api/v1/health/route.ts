import { formatUnits } from "viem";
import { TOKENS, type ChainId } from "@vouch/shared";
import { db } from "@/lib/db";
import { enabledChains, env } from "@/lib/env";
import { withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { accountFor, hasRole, isVaultConfigured, publicClient } from "@/lib/chain/clients";
import { readTokenBalance } from "@/lib/chain/vault";

export const dynamic = "force-dynamic";

/** GET /api/v1/health — chain heads, relayer balances (with low-balance flag), verifier queue depth, indexer lag. */
export const GET = withErrors(async () => {
  const e = env();
  const chains: Record<string, unknown> = {};
  for (const chainId of enabledChains()) {
    const entry: Record<string, unknown> = { vault: isVaultConfigured(chainId) };
    try {
      const pub = publicClient(chainId);
      const head = await pub.getBlockNumber();
      const cursor = await db.indexerCursor.findUnique({ where: { chainId } });
      entry.head = head.toString();
      entry.indexed = cursor?.lastBlock.toString() ?? null;
      entry.lagBlocks = cursor ? (head - cursor.lastBlock).toString() : null;
      const relayers: Record<string, unknown> = {};
      for (const role of ["relayer", "intake", "verifier", "feePayer"] as const) {
        if (!hasRole(role)) continue;
        const a = accountFor(role);
        if (chainId === 4217 || chainId === 42431) {
          const t = TOKENS[chainId as ChainId][0]!;
          const bal = await readTokenBalance(chainId, t.address, a.address).catch(() => null);
          relayers[role] = { address: a.address, balance: bal == null ? null : `${formatUnits(bal, 6)} ${t.symbol}`, low: bal != null && bal < BigInt(e.RELAYER_MIN_BALANCE) };
        } else {
          const bal = await pub.getBalance({ address: a.address }).catch(() => null);
          relayers[role] = { address: a.address, balance: bal == null ? null : `${formatUnits(bal, 18)} ETH`, low: bal != null && bal < 2_000_000_000_000_000n };
        }
      }
      entry.relayers = relayers;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    chains[chainId] = entry;
  }
  const [queued, failed, stuck] = await Promise.all([
    db.verdict.count({ where: { stage: "queued" } }),
    db.verdict.count({ where: { stage: "failed" } }),
    db.txLog.count({ where: { status: "pending", createdAt: { lt: new Date(Date.now() - 10 * 60_000) } } }),
  ]);
  const ok = Object.values(chains).every((c) => !(c as { error?: string }).error);
  return json({ ok, time: new Date().toISOString(), chains, verifier: { queued, failed, model: e.VERIFIER_MODEL, configured: Boolean(e.ANTHROPIC_API_KEY) }, txs: { stuckPending: stuck } }, { status: ok ? 200 : 503 });
});
