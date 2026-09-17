import * as Bytes from "ox/Bytes";
import * as Hex from "ox/Hex";
import * as PublicKey from "ox/PublicKey";
import * as Secp256k1 from "ox/Secp256k1";
import type { Address, Hex as HexType } from "viem";

/** ZonePortal `EncryptedPayload` fields (ECIES secp256k1 + HKDF-SHA256 + AES-256-GCM to the sequencer key). */
export type EncryptedRecipient = {
  ephemeralPubkeyX: HexType;
  /** SEC1 compressed prefix of the ephemeral key (2 or 3), as the portal's `ephemeralPubkeyYParity` uint8. */
  ephemeralPubkeyYParity: number;
  ciphertext: HexType;
  nonce: HexType;
  tag: HexType;
};

export type SequencerKey = { prefix: number; x: HexType };

const ZERO_MEMO = `0x${"00".repeat(32)}` as HexType;
/** WebCrypto wants `Uint8Array<ArrayBuffer>`; ox returns `Uint8Array<ArrayBufferLike>`. */
const ab = (b: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(b);

/**
 * Encrypts `recipient` + `memo` for a Tempo Zone sequencer, mirroring viem's `zone.encryptedDeposit.prepareRecipient`.
 *
 * Two portal generations exist on testnet:
 *  - current (viem ≥ 2.55.19): the HKDF info binds the portal *caller* (`sender`) and `depositEncrypted` takes a
 *    `tempoRefundRecipient`;
 *  - legacy (Moderato Zone A, portal 0x7069…, sequencer built before Aug 2026): no sender in the HKDF info and a
 *    4-argument `depositEncrypted`. A payload built for the wrong generation cannot be decrypted, so the deposit
 *    is never credited. The Vault's `legacyZonePortal(portal)` flag says which one to build.
 */
export async function encryptZoneRecipient(p: {
  sequencerKey: SequencerKey;
  recipient: Address;
  /** Account that calls the portal (the Vouch Vault). Ignored for legacy portals. */
  sender: Address;
  portal: Address;
  keyIndex: bigint;
  memo?: HexType;
  legacy?: boolean;
}): Promise<EncryptedRecipient> {
  const sequencerPublicKey = PublicKey.from({ prefix: p.sequencerKey.prefix, x: Hex.toBigInt(p.sequencerKey.x) });
  const { privateKey: ephemeralPrivateKey, publicKey: ephemeralPublicKey } = Secp256k1.createKeyPair();
  const compressed = PublicKey.compress(ephemeralPublicKey);
  const ephemeralPubkeyX = Hex.fromNumber(compressed.x, { size: 32 });
  const sharedSecret = Secp256k1.getSharedSecret({ privateKey: ephemeralPrivateKey, publicKey: sequencerPublicKey, as: "Bytes" });
  const aesKey = await deriveAesKey(sharedSecret, hkdfInfo(p.portal, p.keyIndex, ephemeralPubkeyX, p.legacy ? undefined : p.sender), ["encrypt"]);
  const nonce = Bytes.random(12);
  const plaintext = Bytes.concat(Bytes.from(p.recipient), Bytes.from(p.memo ?? ZERO_MEMO), new Uint8Array(12));
  const sealed = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(nonce), tagLength: 128 }, aesKey, ab(plaintext)));
  return {
    ciphertext: Hex.fromBytes(sealed.slice(0, -16)),
    ephemeralPubkeyX,
    ephemeralPubkeyYParity: compressed.prefix,
    nonce: Hex.fromBytes(nonce),
    tag: Hex.fromBytes(sealed.slice(-16)),
  };
}

/** Sequencer-side inverse, used by tests to prove which generation a payload was built for. */
export async function decryptZoneRecipient(p: {
  sequencerPrivateKey: HexType;
  payload: EncryptedRecipient;
  portal: Address;
  keyIndex: bigint;
  sender?: Address;
}): Promise<{ recipient: Address; memo: HexType }> {
  const ephemeral = PublicKey.from({ prefix: p.payload.ephemeralPubkeyYParity, x: Hex.toBigInt(p.payload.ephemeralPubkeyX) });
  const sharedSecret = Secp256k1.getSharedSecret({ privateKey: p.sequencerPrivateKey, publicKey: ephemeral, as: "Bytes" });
  const aesKey = await deriveAesKey(sharedSecret, hkdfInfo(p.portal, p.keyIndex, p.payload.ephemeralPubkeyX, p.sender), ["decrypt"]);
  const sealed = Bytes.concat(Bytes.from(p.payload.ciphertext), Bytes.from(p.payload.tag));
  const plain = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(Bytes.from(p.payload.nonce)), tagLength: 128 }, aesKey, ab(sealed)));
  return { recipient: Hex.fromBytes(plain.slice(0, 20)) as Address, memo: Hex.fromBytes(plain.slice(20, 52)) };
}

function hkdfInfo(portal: Address, keyIndex: bigint, ephemeralPubkeyX: HexType, sender?: Address): Uint8Array {
  const parts = [Bytes.from(portal), Bytes.fromNumber(keyIndex, { size: 32 }), Bytes.from(ephemeralPubkeyX)];
  if (sender) parts.push(Bytes.from(sender));
  return Bytes.concat(...parts);
}

async function deriveAesKey(sharedSecret: Uint8Array, info: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const hkdfKey = await globalThis.crypto.subtle.importKey("raw", ab(sharedSecret.slice(1)), "HKDF", false, ["deriveKey"]);
  return globalThis.crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("ecies-aes-key"), info: ab(info) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}
