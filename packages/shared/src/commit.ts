import { encodeAbiParameters, keccak256, toHex, stringToHex, pad, type Address, type Hex } from "viem";

/** `keccak256(abi.encode(jobId, payer, worker, token, amount, scopeHash, salt))` — must match `Vault.computeCommit`. */
export function computeCommit(args: {
  jobId: Hex;
  payer: Address;
  worker: Address;
  token: Address;
  amount: bigint;
  scopeHash: Hex;
  salt: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "address" },
        { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" },
      ],
      [args.jobId, args.payer, args.worker, args.token, args.amount, args.scopeHash, args.salt],
    ),
  );
}

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
export const ZERO_BYTES32: Hex = `0x${"0".repeat(64)}`;

/** Scope hash = keccak256 of the scope markdown, UTF-8, normalised line endings, trimmed. */
export function hashScope(scopeMd: string): Hex {
  return keccak256(toHex(normaliseText(scopeMd)));
}

export function normaliseText(s: string): string {
  return s.replace(/\r\n?/g, "\n").trim();
}

/** Random 32-byte hex (job ids, salts, request nonces). */
export function randomBytes32(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** Short, URL-safe job reference derived from the on-chain id (first 8 bytes, base32-ish). */
export function shortId(jobId: Hex): string {
  return jobId.slice(2, 18);
}

/** Memo for a TIP-20 transfer that funds a job: the jobId itself (already 32 bytes). */
export function jobMemo(jobId: Hex): Hex {
  return pad(jobId, { size: 32 });
}

/** A string memo (≤ 32 bytes) → bytes32, padded right like the Tempo docs' `toHex(str, { size: 32 })`. */
export function stringMemo(s: string): Hex {
  return pad(stringToHex(s), { size: 32, dir: "right" });
}

export interface ManifestFile {
  name: string;
  sha256: Hex;
  size: number;
  contentType: string;
  /** Storage key or external URL. */
  url: string;
}

export interface DeliveryManifest {
  version: 1;
  jobId: Hex;
  submittedBy: Address;
  files: ManifestFile[];
  links: string[];
  note: string;
  createdAt: string; // ISO
}

/** Canonical JSON (sorted keys) so the same manifest always hashes identically. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/**
 * The part of a delivery that both the worker (client) and Vouch (server) can compute independently:
 * no storage keys, no timestamps. `deliverableHash` on-chain = keccak256(canonicalJson(DeliveryCore)).
 */
export interface DeliveryCore {
  jobId: Hex;
  submittedBy: Address;
  files: { name: string; sha256: Hex; size: number; contentType: string }[];
  links: string[];
  note: string;
}

export function deliveryCore(m: DeliveryManifest | DeliveryCore): DeliveryCore {
  return {
    jobId: m.jobId.toLowerCase() as Hex,
    submittedBy: m.submittedBy.toLowerCase() as Address,
    files: m.files.map((f) => ({ name: f.name, sha256: f.sha256.toLowerCase() as Hex, size: f.size, contentType: f.contentType })),
    links: [...m.links],
    note: normaliseText(m.note),
  };
}

/** deliverableHash written on-chain. Works on a full manifest or on the core alone. */
export function hashManifest(m: DeliveryManifest | DeliveryCore): Hex {
  return keccak256(toHex(canonicalJson(deliveryCore(m))));
}

/** attestationHash written on-chain = keccak256(canonical verdict report JSON). */
export function hashReport(report: unknown): Hex {
  return keccak256(toHex(canonicalJson(report)));
}

export function hashReason(reason: string): Hex {
  return keccak256(toHex(normaliseText(reason)));
}
