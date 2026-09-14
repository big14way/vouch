import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./secrets";

const KEY = `0x${"ab".repeat(32)}`;

describe("secrets", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = encrypt("5000000", KEY);
    const b = encrypt("5000000", KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, KEY)).toBe("5000000");
    expect(decrypt(b, KEY)).toBe("5000000");
  });
  it("fails on tampering", () => {
    const blob = Buffer.from(encrypt("x", KEY), "base64");
    blob[blob.length - 1] = (blob[blob.length - 1] ?? 0) ^ 1;
    expect(() => decrypt(blob.toString("base64"), KEY)).toThrow();
  });
});
