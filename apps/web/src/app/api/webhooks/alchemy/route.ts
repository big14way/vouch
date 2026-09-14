import { createHmac, timingSafeEqual } from "node:crypto";
import type { Log } from "viem";
import { env } from "@/lib/env";
import { errors, withErrors } from "@/lib/errors";
import { json } from "@/lib/http";
import { processMemoLogs, processVaultLogs } from "@/lib/indexer";
import { vaultAddress } from "@/lib/chain/clients";

export const dynamic = "force-dynamic";

/**
 * Alchemy "Address Activity"/"Custom webhook (GraphQL)" for the Vault on Base. HMAC-SHA256 over the raw body
 * with the signing key, header `x-alchemy-signature`. Logs are fed to the same processor as polling.
 */
export const POST = withErrors(async (req) => {
  const secret = env().ALCHEMY_WEBHOOK_SECRET;
  if (!secret) throw errors.unauthorized("Webhook not configured.");
  const raw = await req.text();
  const sig = req.headers.get("x-alchemy-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw errors.forbidden("call this webhook");
  const payload = JSON.parse(raw) as { event?: { network?: string; data?: { block?: { number: number; logs?: RawLog[] } }; activity?: unknown[] } };
  const network = payload.event?.network ?? "";
  const chainId = /SEPOLIA/i.test(network) ? 84532 : 8453;
  const logs = (payload.event?.data?.block?.logs ?? []).map((l): Log => ({
    address: l.account.address as `0x${string}`,
    topics: l.topics as [`0x${string}`, ...`0x${string}`[]],
    data: l.data as `0x${string}`,
    blockNumber: BigInt(payload.event!.data!.block!.number),
    transactionHash: l.transaction.hash as `0x${string}`,
    logIndex: l.index,
    blockHash: null, transactionIndex: null, removed: false,
  }));
  const vault = vaultAddress(chainId).toLowerCase();
  const vaultLogs = logs.filter((l) => l.address.toLowerCase() === vault);
  const tokenLogs = logs.filter((l) => l.address.toLowerCase() !== vault);
  const n = (await processVaultLogs(chainId, vaultLogs)) + (await processMemoLogs(chainId, tokenLogs));
  return json({ ok: true, processed: n });
});

interface RawLog { account: { address: string }; topics: string[]; data: string; index: number; transaction: { hash: string } }
