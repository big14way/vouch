import raw from "../addresses.json" with { type: "json" };

export type SupportedChainId = 4217 | 42431 | 8453 | 84532;

export interface ChainAddresses {
  name: string;
  Vault: `0x${string}` | "";
  VerifierRegistry: `0x${string}` | "";
  explorer: string;
}

export const addresses = raw as Record<`${SupportedChainId}`, ChainAddresses>;

/** Resolve addresses for a chain, letting `VAULT_ADDRESS_<chainId>` env override the committed file. */
export function getAddresses(chainId: number, env: Record<string, string | undefined> = {}): ChainAddresses {
  const key = String(chainId) as `${SupportedChainId}`;
  const base = addresses[key];
  if (!base) throw new Error(`Unsupported chain ${chainId}`);
  const vaultOverride = env[`VAULT_ADDRESS_${chainId}`];
  const registryOverride = env[`REGISTRY_ADDRESS_${chainId}`];
  return {
    ...base,
    Vault: (vaultOverride as `0x${string}` | undefined) ?? base.Vault,
    VerifierRegistry: (registryOverride as `0x${string}` | undefined) ?? base.VerifierRegistry,
  };
}
