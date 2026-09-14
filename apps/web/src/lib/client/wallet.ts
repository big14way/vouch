"use client";
import { createWalletClient, custom, type Address, type Hex, type EIP1193Provider } from "viem";
import type { TypedData } from "./api";

/** Wrap any EIP-1193 provider (Privy embedded wallet, injected wallet) for signing. */
export function walletFromProvider(provider: EIP1193Provider, address: Address) {
  return createWalletClient({ account: address, transport: custom(provider) });
}

/** Sign Vouch typed data (nonce/deadline arrive as decimal strings; viem needs bigints). */
export async function signTypedData(provider: EIP1193Provider, address: Address, td: TypedData): Promise<{ signer: Address; deadline: string; signature: Hex }> {
  const wallet = walletFromProvider(provider, address);
  const message = Object.fromEntries(Object.entries(td.message).map(([k, v]) => [k, k === "nonce" || k === "deadline" || k === "amount" || k === "value" || k === "validAfter" || k === "validBefore" ? BigInt(v) : v]));
  const signature = await wallet.signTypedData({
    account: address, domain: td.domain, types: td.types, primaryType: td.primaryType, message,
  } as unknown as Parameters<typeof wallet.signTypedData>[0]);
  return { signer: address, deadline: td.message.deadline ?? "0", signature };
}

/** Circle USDC EIP-3009 ReceiveWithAuthorization (to = Vault). Domain differs on Base Sepolia ("USDC"). */
export async function signReceiveWithAuthorization(provider: EIP1193Provider, p: { from: Address; to: Address; value: bigint; token: Address; chainId: number }) {
  const wallet = walletFromProvider(provider, p.from);
  const nonce = (`0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("")}`) as Hex;
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const name = p.chainId === 84532 ? "USDC" : "USD Coin";
  const signature = await wallet.signTypedData({
    account: p.from,
    domain: { name, version: "2", chainId: p.chainId, verifyingContract: p.token },
    types: {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "ReceiveWithAuthorization",
    message: { from: p.from, to: p.to, value: p.value, validAfter, validBefore, nonce },
  });
  const r = `0x${signature.slice(2, 66)}` as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  const v = parseInt(signature.slice(130, 132), 16);
  return { from: p.from, value: p.value.toString(), validAfter: validAfter.toString(), validBefore: validBefore.toString(), nonce, v, r, s };
}
