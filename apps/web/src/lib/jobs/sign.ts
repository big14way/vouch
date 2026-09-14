import type { Address, Hex } from "viem";
import { vaultDomain, VaultTypes, type VaultAction } from "@vouch/shared";
import { vaultAddress } from "../chain/clients";
import { readNonce } from "../chain/vault";

/** Typed data a party signs so Vouch can relay the action gaslessly (mirrors Vault.sol typehashes). */
export async function typedDataFor(chainId: number, action: VaultAction, signer: Address, message: Record<string, unknown>, ttlSeconds = 3600) {
  const nonce = await readNonce(chainId, signer);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);
  return {
    domain: vaultDomain(chainId, vaultAddress(chainId)),
    types: { [action]: VaultTypes[action] },
    primaryType: action,
    message: { ...message, nonce: nonce.toString(), deadline: deadline.toString() },
  };
}

export function sigFromInput(s: { signer: string; deadline: string; signature: string }) {
  return { signer: s.signer as Address, deadline: BigInt(s.deadline), signature: s.signature as Hex };
}
