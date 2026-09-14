import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/** AES-256-GCM with a per-value IV. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string, keyHex = env().JOB_SECRETS_KEY): string {
  const key = Buffer.from(keyHex.slice(2), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(blob: string, keyHex = env().JOB_SECRETS_KEY): string {
  const key = Buffer.from(keyHex.slice(2), "hex");
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
