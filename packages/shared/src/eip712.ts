import type { Address, Hex, TypedDataDomain } from "viem";

export const VAULT_DOMAIN_NAME = "Vouch Vault";
export const VAULT_DOMAIN_VERSION = "1";

export function vaultDomain(chainId: number, verifyingContract: Address): TypedDataDomain {
  return { name: VAULT_DOMAIN_NAME, version: VAULT_DOMAIN_VERSION, chainId, verifyingContract };
}

/** Typed-data definitions matching the `*_TYPEHASH` constants in Vault.sol. */
export const VaultTypes = {
  Submit: [
    { name: "jobId", type: "bytes32" },
    { name: "deliverableHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  Resubmit: [
    { name: "jobId", type: "bytes32" },
    { name: "deliverableHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  Settle: [
    { name: "jobId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  Dispute: [
    { name: "jobId", type: "bytes32" },
    { name: "reasonHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  Withdraw: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "to", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  EarnDeposit: [
    { name: "earnVault", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  EarnRedeem: [
    { name: "earnVault", type: "address" },
    { name: "shares", type: "uint256" },
    { name: "minAssets", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  /** Private payout into a Tempo Zone; `payloadHash = keccak256(abi.encode(EncryptedPayload))`. */
  ZoneWithdraw: [
    { name: "portal", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "keyIndex", type: "uint256" },
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** ABI shape of a Zone Portal encrypted payload, for hashing exactly as the Vault does. */
export const ENCRYPTED_PAYLOAD_ABI = [
  {
    type: "tuple",
    components: [
      { name: "ephemeralPubkeyX", type: "bytes32" },
      { name: "ephemeralPubkeyYParity", type: "uint8" },
      { name: "ciphertext", type: "bytes" },
      { name: "nonce", type: "bytes12" },
      { name: "tag", type: "bytes16" },
    ],
  },
] as const;

export type VaultAction = keyof typeof VaultTypes;

export interface SignedAction {
  action: VaultAction;
  signer: Address;
  deadline: bigint;
  signature: Hex;
}

/** USDC EIP-3009 typed data (Circle: domain name "USD Coin", version "2" on Base). */
export const Erc3009Types = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function usdcDomain(chainId: number, verifyingContract: Address, name = "USD Coin", version = "2"): TypedDataDomain {
  return { name, version, chainId, verifyingContract };
}
