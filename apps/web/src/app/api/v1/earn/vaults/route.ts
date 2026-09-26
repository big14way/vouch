import type { Address } from "viem";
import { vaultAbi } from "@vouch/abi";
import { TOKENS, isSupportedChain, isTempo, type ChainId, type EarnVaultDto } from "@vouch/shared";
import { errors, withErrors } from "@/lib/errors";
import { json, options } from "@/lib/http";
import { isVaultConfigured, publicClient, vaultAddress } from "@/lib/chain/clients";
import { defaultChainId } from "@/lib/jobs/dto";
import { rateLimit } from "@/lib/ratelimit";

export const OPTIONS = options;
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/earn/vaults?chainId=42431
 * Tempo Earn vaults a job may use for "Earn while locked". Discovery + APY come from the Tempo API
 * (public reads); the on-chain allow-list in the Vouch Vault is the authority, reported as `allowed`.
 * Filters: asset is one of the chain's job tokens; deposits not paused; `redeem` + `exactWithdraw` capable.
 */
type ApiVault = {
  vaultAddress: string;
  label: string;
  verified: boolean;
  assetToken: { address: string; symbol: string };
  engine: { type: string | null; venue: string | null };
  apy?: { net: string | null } | null;
  tvl?: { formatted: string } | null;
  access?: { status: string };
  capabilities?: { redeem: boolean; exactWithdraw: boolean; deposit: boolean };
  state?: { depositsPaused: boolean };
};

let cache: { at: number; chainId: number; data: EarnVaultDto[] } | null = null;

/**
 * Venues the Vouch Vault allow-lists that the Tempo API does not list: on Moderato, the clearly labelled demo venue
 * (MockEarnVault) used because both testnet pathUSD Earn vaults revert deposits. Extend with EARN_VAULTS_<chainId>.
 */
const OWN_VENUES: Record<number, Array<{ address: string; label: string; venue: string }>> = {
  42431: [{ address: "0xa2D6b710b92416760a05aD13022b7078e398ff9d", label: "Demo venue (testnet)", venue: "Vouch demo · simulated yield" }],
};

function ownVenues(chainId: number) {
  const extra = (process.env[`EARN_VAULTS_${chainId}`] ?? "").split(",").map((a) => a.trim()).filter(Boolean).map((address) => ({ address, label: "Allow-listed venue", venue: "Earn vault" }));
  return [...(OWN_VENUES[chainId] ?? []), ...extra];
}

export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId") ?? defaultChainId());
  if (!isSupportedChain(chainId)) throw errors.badRequest("Unsupported chain.");
  if (!isTempo(chainId)) return json({ chainId, vaults: [], note: "Earn while locked is a Tempo feature." });
  if (cache && cache.chainId === chainId && Date.now() - cache.at < 60_000) return json({ chainId, vaults: cache.data });

  const network = chainId === 4217 ? "mainnet" : "testnet";
  const tokens = new Map(TOKENS[chainId as ChainId].map((t) => [t.address.toLowerCase(), t.symbol]));
  // The Tempo API is discovery only; if it is down, keep serving the last good list plus the Vault's own venues.
  let listed: ApiVault[] = [];
  try {
    const res = await fetch(`https://api.tempo.xyz/v1/earn/vaults?chainId=${network}&include=apy,tvl,capabilities,access&limit=50`, {
      headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    listed = ((await res.json()) as { data: ApiVault[] }).data;
  } catch {
    if (cache && cache.chainId === chainId) return json({ chainId, vaults: cache.data, note: "Tempo API unavailable; showing the last known list." });
  }
  const known = new Set(listed.map((v) => v.vaultAddress.toLowerCase()));
  for (const o of ownVenues(chainId)) {
    if (known.has(o.address.toLowerCase())) continue;
    const asset = (await publicClient(chainId).readContract({ address: o.address as Address, abi: [{ type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }], functionName: "asset" }).catch(() => null)) as string | null;
    if (!asset) continue;
    listed.push({ vaultAddress: o.address, label: o.label, verified: false, assetToken: { address: asset, symbol: tokens.get(asset.toLowerCase()) ?? "" }, engine: { type: "demo", venue: o.venue }, apy: null, access: { status: "open" }, capabilities: { redeem: true, exactWithdraw: true, deposit: true }, state: { depositsPaused: false } });
  }
  const candidates = listed.filter(
    (v) => tokens.has(v.assetToken.address.toLowerCase()) && !v.state?.depositsPaused && v.capabilities?.deposit && v.capabilities?.redeem && v.capabilities?.exactWithdraw,
  );

  let allowed = new Map<string, boolean>();
  if (isVaultConfigured(chainId) && candidates.length) {
    // Tempo chains have no multicall3 in viem's chain config; a handful of parallel reads is fine here.
    const pub = publicClient(chainId);
    const results = await Promise.all(
      candidates.map((v) =>
        pub.readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "allowedEarnVault", args: [v.vaultAddress as Address] }).catch(() => false),
      ),
    );
    allowed = new Map(candidates.map((v, i) => [v.vaultAddress.toLowerCase(), Boolean(results[i])]));
  }

  const data: EarnVaultDto[] = candidates
    .map((v) => ({
      address: v.vaultAddress as Address,
      chainId: chainId as ChainId,
      label: v.label,
      asset: v.assetToken.address as Address,
      assetSymbol: tokens.get(v.assetToken.address.toLowerCase()) ?? v.assetToken.symbol,
      venue: v.engine?.venue ?? null,
      engineType: v.engine?.type ?? null,
      apy: v.apy?.net ?? null,
      tvl: v.tvl?.formatted ?? null,
      verified: v.verified,
      access: v.access?.status ?? "unknown",
      allowed: allowed.get(v.vaultAddress.toLowerCase()) ?? false,
    }))
    .sort((a, b) => Number(b.allowed) - Number(a.allowed) || Number(b.verified) - Number(a.verified) || Number(b.apy ?? 0) - Number(a.apy ?? 0));
  cache = { at: Date.now(), chainId, data };
  return json({ chainId, vaults: data });
});
