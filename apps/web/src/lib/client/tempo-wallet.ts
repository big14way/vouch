"use client";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { tempo, tempoModerato } from "viem/chains";
import { vaultAbi, tip20Abi } from "@vouch/abi";
import { computeCommit, policyToStruct, type Policy } from "@vouch/shared";

/**
 * "Pay with a Tempo wallet": one atomic, fee-sponsored Tempo transaction:
 *   approve(vault, amount) → deposit(token, amount) → createJob(...) → fund(jobId, amount, scopeHash, salt)
 * Uses the Tempo Wallet connector from wagmi/tempo with a fee-payer service as sponsor.
 * Loaded lazily — this module pulls in wagmi + the Tempo connectors.
 */
export interface BatchParams {
  chainId: 4217 | 42431;
  vault: Address;
  token: Address;
  jobId: Hex;
  amount: bigint;
  scopeHash: Hex;
  salt: Hex;
  worker: Address;
  policy: Policy;
}

export function buildFundCalls(payer: Address, p: BatchParams) {
  const commit = computeCommit({ jobId: p.jobId, payer, worker: p.worker, token: p.token, amount: p.amount, scopeHash: p.scopeHash, salt: p.salt });
  return [
    { to: p.token, data: encodeFunctionData({ abi: tip20Abi, functionName: "approve", args: [p.vault, p.amount] }) },
    { to: p.vault, data: encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [p.token, p.amount] }) },
    { to: p.vault, data: encodeFunctionData({ abi: vaultAbi, functionName: "createJob", args: [p.jobId, commit, payer, p.worker, p.token, policyToStruct(p.policy)] }) },
    { to: p.vault, data: encodeFunctionData({ abi: vaultAbi, functionName: "fund", args: [p.jobId, p.amount, p.scopeHash, p.salt] }) },
  ] as const;
}

/** Fee sponsor endpoint: Tempo's public testnet sponsor by default; set NEXT_PUBLIC_TEMPO_SPONSOR_URL to a Fee Payer API (mainnet) or a self-hosted relay. */
export function sponsorUrl(chainId: number): string {
  const configured = process.env.NEXT_PUBLIC_TEMPO_SPONSOR_URL;
  if (configured) return configured;
  return chainId === 42431 ? "https://sponsor.moderato.tempo.xyz" : "";
}

export async function payWithTempoWallet(p: BatchParams, relayUrl = sponsorUrl(p.chainId)): Promise<{ hash: Hex; payer: Address }> {
  const [{ createConfig, connect, getConnectorClient, http }, { tempoWallet }, { withRelay }] = await Promise.all([
    import("@wagmi/core"),
    import("@wagmi/core/tempo"),
    import("viem/tempo"),
  ]);
  const chain = p.chainId === 4217 ? tempo : tempoModerato;
  const sponsored = Boolean(relayUrl);
  const config = createConfig({
    chains: [chain],
    connectors: [tempoWallet(sponsored ? { feePayer: relayUrl } : {})],
    multiInjectedProviderDiscovery: false,
    transports: { [chain.id]: sponsored ? withRelay(http(), http(relayUrl)) : http() } as never,
  });
  const connector = config.connectors[0]!;
  const { accounts } = await connect(config, { connector, chainId: chain.id });
  const payer = accounts[0]!;
  const client = await getConnectorClient(config, { connector, chainId: chain.id });
  const calls = buildFundCalls(payer, p);
  const hash = await (client as unknown as { sendTransaction: (a: unknown) => Promise<Hex> }).sendTransaction({ account: payer, chain, calls, ...(sponsored ? { feePayer: true } : {}) });
  return { hash, payer };
}
