import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, tempo, tempoModerato } from "viem/chains";
import { createClient as createTempoClient } from "viem/tempo";
import { getAddresses } from "@vouch/abi";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID, TEMPO_MAINNET_ID, TEMPO_MODERATO_ID, isTempo } from "@vouch/shared";
import { env } from "../env";

export type Role = "intake" | "verifier" | "relayer" | "arbiter" | "feePayer";

export function chainFor(chainId: number): Chain {
  switch (chainId) {
    case TEMPO_MAINNET_ID:
      return tempo;
    case TEMPO_MODERATO_ID:
      return tempoModerato;
    case BASE_MAINNET_ID:
      return base;
    case BASE_SEPOLIA_ID:
      return baseSepolia;
    default:
      throw new Error(`Unsupported chain ${chainId}`);
  }
}

export function rpcUrl(chainId: number): string {
  const e = env();
  switch (chainId) {
    case TEMPO_MAINNET_ID:
      return e.TEMPO_RPC_URL;
    case TEMPO_MODERATO_ID:
      return e.TEMPO_TESTNET_RPC_URL;
    case BASE_MAINNET_ID:
      return e.BASE_RPC_URL;
    case BASE_SEPOLIA_ID:
      return e.BASE_SEPOLIA_RPC_URL;
    default:
      throw new Error(`Unsupported chain ${chainId}`);
  }
}

export function vaultAddress(chainId: number): Address {
  const a = getAddresses(chainId, process.env).Vault;
  if (!a) throw new Error(`Vault not deployed on chain ${chainId} (set VAULT_ADDRESS_${chainId})`);
  return a;
}

export function isVaultConfigured(chainId: number): boolean {
  try {
    vaultAddress(chainId);
    return true;
  } catch {
    return false;
  }
}

const publicClients = new Map<number, PublicClient>();

export function publicClient(chainId: number): PublicClient {
  let c = publicClients.get(chainId);
  if (!c) {
    c = createPublicClient({ chain: chainFor(chainId), transport: http(rpcUrl(chainId), { batch: true }) });
    publicClients.set(chainId, c);
  }
  return c;
}

function keyFor(role: Role): Hex | undefined {
  const e = env() as unknown as Record<string, Hex | undefined>;
  switch (role) {
    case "intake":
      return e.INTAKE_PRIVATE_KEY ?? e.RELAYER_PRIVATE_KEY;
    case "verifier":
      return e.VERIFIER_PRIVATE_KEY;
    case "relayer":
      return e.RELAYER_PRIVATE_KEY;
    case "arbiter":
      return e.ARBITER_PRIVATE_KEY;
    case "feePayer":
      return e.TEMPO_FEEPAYER_PRIVATE_KEY ?? e.RELAYER_PRIVATE_KEY;
  }
}

export function accountFor(role: Role): Account {
  const k = keyFor(role);
  if (!k) throw new Error(`No private key configured for role "${role}"`);
  return privateKeyToAccount(k);
}

export function hasRole(role: Role): boolean {
  return Boolean(keyFor(role));
}

/**
 * Wallet client for a server role. On Tempo we use the Tempo-aware client so transactions are
 * serialised as Tempo transactions (fees paid in a stablecoin, `feePayer` supported).
 */
export function walletClient(chainId: number, role: Role): WalletClient {
  const account = accountFor(role);
  const chain = chainFor(chainId);
  const transport = http(rpcUrl(chainId));
  if (isTempo(chainId)) {
    return createTempoClient({ account, chain, transport }) as unknown as WalletClient;
  }
  return createWalletClient({ account, chain, transport });
}
