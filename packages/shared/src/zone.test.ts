import { describe, expect, it } from "vitest";
import * as PublicKey from "ox/PublicKey";
import * as Secp256k1 from "ox/Secp256k1";
import * as Hex from "ox/Hex";
import { decryptZoneRecipient, encryptZoneRecipient } from "./zone.js";

const portal = "0x7069DeC4E64Fd07334A0933eDe836C17259c9B23";
const vault = "0xaD15409d1B7EFA36a9898107fa9757E58a36442D";
const worker = "0x121636cC839Adaf71FCc3f8BE670874747975a10";
const memo = `0x${"ab".repeat(32)}` as const;

function sequencer() {
  const { privateKey, publicKey } = Secp256k1.createKeyPair();
  const c = PublicKey.compress(publicKey);
  return { privateKey, key: { prefix: c.prefix, x: Hex.fromNumber(c.x, { size: 32 }) } };
}

describe("encryptZoneRecipient", () => {
  it("current portals: the sequencer needs the portal caller to decrypt", async () => {
    const s = sequencer();
    const payload = await encryptZoneRecipient({ sequencerKey: s.key, recipient: worker, sender: vault, portal, keyIndex: 0n, memo });
    expect(payload.ciphertext.length).toBe(2 + 64 * 2);
    expect([2, 3]).toContain(payload.ephemeralPubkeyYParity);
    const out = await decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload, portal, keyIndex: 0n, sender: vault });
    expect(out.recipient.toLowerCase()).toBe(worker.toLowerCase());
    expect(out.memo).toBe(memo);
    await expect(decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload, portal, keyIndex: 0n })).rejects.toThrow();
    await expect(decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload, portal, keyIndex: 0n, sender: worker })).rejects.toThrow();
  });

  it("legacy portals: the sequencer decrypts without a sender, and a current-style payload fails", async () => {
    const s = sequencer();
    const legacy = await encryptZoneRecipient({ sequencerKey: s.key, recipient: worker, sender: vault, portal, keyIndex: 0n, legacy: true });
    const out = await decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload: legacy, portal, keyIndex: 0n });
    expect(out.recipient.toLowerCase()).toBe(worker.toLowerCase());
    expect(out.memo).toBe(`0x${"00".repeat(32)}`);
    const current = await encryptZoneRecipient({ sequencerKey: s.key, recipient: worker, sender: vault, portal, keyIndex: 0n });
    await expect(decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload: current, portal, keyIndex: 0n })).rejects.toThrow();
  });

  it("binds the portal and key index", async () => {
    const s = sequencer();
    const payload = await encryptZoneRecipient({ sequencerKey: s.key, recipient: worker, sender: vault, portal, keyIndex: 1n, legacy: true });
    await expect(decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload, portal, keyIndex: 0n })).rejects.toThrow();
    await expect(decryptZoneRecipient({ sequencerPrivateKey: s.privateKey, payload, portal: vault, keyIndex: 1n })).rejects.toThrow();
  });
});
