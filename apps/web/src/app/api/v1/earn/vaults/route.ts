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

export const GET = withErrors(async (req) => {
  rateLimit(req, "read");
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId") ?? defaultChainId());
  if (!isSupportedChain(chainId)) throw errors.badRequest("Unsupported chain.");
  if (!isTempo(chainId)) return json({ chainId, vaults: [], note: "Earn while locked is a Tempo feature." });
  if (cache && cache.chainId === chainId && Date.now() - cache.at < 60_000) return json({ chainId, vaults: cache.data });

  const network = chainId === 4217 ? "mainnet" : "testnet";
  const res = await fetch(`https://api.tempo.xyz/v1/earn/vaults?chainId=${network}&include=apy,tvl,capabilities,access&limit=50`, {
    headers: { accept: "application/json" }, cache: "no-store",
  });
  if (!res.ok) throw errors.chain(`Tempo API returned ${res.status} for Earn vaults.`);
  const body = (await res.json()) as { data: ApiVault[] };
  const tokens = new Map(TOKENS[chainId as ChainId].map((t) => [t.address.toLowerCase(), t.symbol]));
  const candidates = body.data.filter(
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
