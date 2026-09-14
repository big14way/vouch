import type { Address, Chain } from "viem";

export const TEMPO_MAINNET_ID = 4217;
export const TEMPO_MODERATO_ID = 42431;
export const BASE_MAINNET_ID = 8453;
export const BASE_SEPOLIA_ID = 84532;

export type ChainId = typeof TEMPO_MAINNET_ID | typeof TEMPO_MODERATO_ID | typeof BASE_MAINNET_ID | typeof BASE_SEPOLIA_ID;

export const TEMPO_CHAIN_IDS: readonly ChainId[] = [TEMPO_MAINNET_ID, TEMPO_MODERATO_ID];
export const BASE_CHAIN_IDS: readonly ChainId[] = [BASE_MAINNET_ID, BASE_SEPOLIA_ID];

export const isTempo = (chainId: number): boolean => TEMPO_CHAIN_IDS.includes(chainId as ChainId);
export const isBase = (chainId: number): boolean => BASE_CHAIN_IDS.includes(chainId as ChainId);
export const isSupportedChain = (chainId: number): chainId is ChainId => isTempo(chainId) || isBase(chainId);

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: 6;
  /** Supports EIP-3009 receiveWithAuthorization (Circle USDC). */
  eip3009: boolean;
  /** TIP-20 precompile (Tempo) — supports transferWithMemo. */
  tip20: boolean;
}

/** Token allow-list per chain. Tempo addresses are [VERIFY]-flagged in the spec; override via env if they move. */
export const TOKENS: Record<ChainId, readonly TokenInfo[]> = {
  [TEMPO_MAINNET_ID]: [
    { address: "0x20C0000000000000000000000000000000000000", symbol: "pathUSD", name: "pathUSD", decimals: 6, eip3009: false, tip20: true },
    { address: "0x20C000000000000000000000b9537d11c60E8b50", symbol: "USDC.e", name: "Bridged USDC", decimals: 6, eip3009: false, tip20: true },
  ],
  [TEMPO_MODERATO_ID]: [
    { address: "0x20C0000000000000000000000000000000000000", symbol: "pathUSD", name: "pathUSD (testnet)", decimals: 6, eip3009: false, tip20: true },
    { address: "0x20C000000000000000000000b9537d11c60E8b50", symbol: "USDC.e", name: "Bridged USDC (testnet)", decimals: 6, eip3009: false, tip20: true },
  ],
  [BASE_MAINNET_ID]: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6, eip3009: true, tip20: false },
  ],
  [BASE_SEPOLIA_ID]: [
    { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC", name: "USD Coin (testnet)", decimals: 6, eip3009: true, tip20: false },
  ],
};

export function findToken(chainId: number, address: string): TokenInfo | undefined {
  if (!isSupportedChain(chainId)) return undefined;
  return TOKENS[chainId].find((t) => t.address.toLowerCase() === address.toLowerCase());
}

export function defaultToken(chainId: ChainId): TokenInfo {
  const t = TOKENS[chainId][0];
  if (!t) throw new Error(`no tokens for chain ${chainId}`);
  return t;
}

interface ChainMeta {
  id: ChainId;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorer: string;
  testnet: boolean;
  /** Tempo native fee sponsorship available. */
  feeSponsorship: boolean;
}

export const CHAINS: Record<ChainId, ChainMeta> = {
  [TEMPO_MAINNET_ID]: { id: TEMPO_MAINNET_ID, name: "Tempo", shortName: "Tempo", rpcUrl: "https://rpc.tempo.xyz", explorer: "https://explore.mainnet.tempo.xyz", testnet: false, feeSponsorship: true },
  [TEMPO_MODERATO_ID]: { id: TEMPO_MODERATO_ID, name: "Tempo Moderato", shortName: "Tempo testnet", rpcUrl: "https://rpc.moderato.tempo.xyz", explorer: "https://explore.moderato.tempo.xyz", testnet: true, feeSponsorship: true },
  [BASE_MAINNET_ID]: { id: BASE_MAINNET_ID, name: "Base", shortName: "Base", rpcUrl: "https://mainnet.base.org", explorer: "https://basescan.org", testnet: false, feeSponsorship: false },
  [BASE_SEPOLIA_ID]: { id: BASE_SEPOLIA_ID, name: "Base Sepolia", shortName: "Base testnet", rpcUrl: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org", testnet: true, feeSponsorship: false },
};

export function chainMeta(chainId: number): ChainMeta {
  if (!isSupportedChain(chainId)) throw new Error(`Unsupported chain ${chainId}`);
  return CHAINS[chainId];
}

export function txUrl(chainId: number, hash: string): string {
  return `${chainMeta(chainId).explorer}/tx/${hash}`;
}

export function addressUrl(chainId: number, address: string): string {
  return `${chainMeta(chainId).explorer}/address/${address}`;
}

/** viem `Chain` objects for the four networks (Tempo chains are not yet in every viem release, so define them here). */
export function toViemChain(chainId: ChainId, rpcUrl?: string): Chain {
  const m = CHAINS[chainId];
  const url = rpcUrl ?? m.rpcUrl;
  const isTempoChain = isTempo(chainId);
  return {
    id: m.id,
    name: m.name,
    nativeCurrency: isTempoChain
      ? { name: "pathUSD", symbol: "pathUSD", decimals: 6 }
      : { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [url] } },
    blockExplorers: { default: { name: "Explorer", url: m.explorer } },
    testnet: m.testnet,
  };
}
