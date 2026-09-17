import { describe, expect, it } from "vitest";
import { computeCommit, hashScope, hashManifest, canonicalJson, jobMemo, stringMemo, type DeliveryManifest } from "./commit.js";
import { POLICY_PRESETS, policyPermits, resolvePolicy, policyToWire, policyToStruct } from "./policy.js";
import { pillFor, Verdict } from "./status.js";
import { formatAmount, parseAmount, formatDuration } from "./format.js";

describe("computeCommit", () => {
  it("matches Vault.computeCommit (vector from `cast abi-encode` + keccak)", () => {
    const c = computeCommit({
      jobId: "0x1111111111111111111111111111111111111111111111111111111111111111",
      payer: "0x00000000000000000000000000000000000000a1",
      worker: "0x00000000000000000000000000000000000000b2",
      token: "0x20c0000000000000000000000000000000000000",
      amount: 5_000_000n,
      scopeHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      salt: "0x3333333333333333333333333333333333333333333333333333333333333333",
    });
    expect(c).toBe("0x7ac116fde8b186e53e16184d607472453e3e6af9142045ca6b46ae6f173342eb");
  });
});

describe("hashing", () => {
  it("scope hash is stable across CRLF and trailing whitespace", () => {
    expect(hashScope("a\r\nb\n")).toBe(hashScope("a\nb"));
  });
  it("canonical JSON sorts keys recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
  });
  it("manifest hash ignores storage keys and timestamps (client and server agree)", () => {
    const full: DeliveryManifest = {
      version: 1, jobId: `0x${"1".repeat(64)}`, submittedBy: "0x00000000000000000000000000000000000000b2",
      files: [{ name: "a.md", sha256: `0x${"a".repeat(64)}`, size: 3, contentType: "text/markdown", url: "jobs/x/aaa" }],
      links: [], note: "hi\r\n", createdAt: "2026-09-14T00:00:00Z",
    };
    const core = { jobId: full.jobId, submittedBy: full.submittedBy, files: [{ name: "a.md", sha256: `0x${"A".repeat(64)}` as `0x${string}`, size: 3, contentType: "text/markdown" }], links: [], note: "hi" };
    expect(hashManifest(full)).toBe(hashManifest(core));
  });
  it("manifest hash is order independent for keys", () => {
    const m: DeliveryManifest = {
      version: 1, jobId: `0x${"1".repeat(64)}`, submittedBy: "0x00000000000000000000000000000000000000b2",
      files: [], links: ["https://x"], note: "", createdAt: "2026-09-14T00:00:00Z",
    };
    const shuffled = { createdAt: m.createdAt, note: m.note, links: m.links, files: m.files, submittedBy: m.submittedBy, jobId: m.jobId, version: m.version } as DeliveryManifest;
    expect(hashManifest(m)).toBe(hashManifest(shuffled));
  });
  it("memos are 32 bytes", () => {
    expect(jobMemo(`0x${"ab".repeat(32)}`)).toHaveLength(66);
    expect(stringMemo("INV-1")).toMatch(/^0x494e562d31(00){27}$/);
  });
});

describe("policy", () => {
  it("presets match spec §8.4", () => {
    expect(POLICY_PRESETS.trusted).toMatchObject({ autoRelease: 1, minConfidenceBps: 8500, maxAutoAmount: 200_000_000n, reviewWindow: 3 * 86400 });
    expect(POLICY_PRESETS.autopilot).toMatchObject({ autoRelease: 1, minConfidenceBps: 9000, maxAutoAmount: 50_000_000n, reviewWindow: 86400 });
    expect(POLICY_PRESETS.manual.autoRelease).toBe(0);
  });
  it("permits only within threshold, cap and verdict rules", () => {
    const p = POLICY_PRESETS.autopilot;
    expect(policyPermits(p, 1, 9300, 5_000_000n)).toBe(true);
    expect(policyPermits(p, 1, 8999, 5_000_000n)).toBe(false);
    expect(policyPermits(p, 2, 9999, 5_000_000n)).toBe(false);
    expect(policyPermits({ ...p, autoRelease: 2 }, 2, 9999, 5_000_000n)).toBe(true);
    expect(policyPermits(p, 1, 9999, 50_000_001n)).toBe(false);
    expect(policyPermits(POLICY_PRESETS.manual, 1, 10_000, 1n)).toBe(false);
  });
  it("resolves presets and custom wire policies", () => {
    expect(resolvePolicy({ policyPreset: "trusted" })).toEqual(POLICY_PRESETS.trusted);
    expect(resolvePolicy({ policy: policyToWire(POLICY_PRESETS.autopilot) })).toEqual(POLICY_PRESETS.autopilot);
    expect(() => resolvePolicy({ policyPreset: "custom" })).toThrow();
  });
  it("earn while locked is off by default and carried through the wire", () => {
    const ev = "0x0e30ef43cfb7c4cab5ec690a45a6550588325fb0";
    expect(POLICY_PRESETS.trusted.earnVault).toBe("0x0000000000000000000000000000000000000000");
    const p = resolvePolicy({ policyPreset: "trusted", earnVault: ev });
    expect(p.earnVault).toBe(ev);
    expect(policyToWire(p).earnVault).toBe(ev);
    expect(policyToStruct(p).earnVault).toBe(ev);
    // legacy wire payloads without the field still parse
    expect(resolvePolicy({ policy: { autoRelease: 0, minConfidenceBps: 0, maxAutoAmount: "0", reviewWindow: 0, submitDeadline: 0 } as never }).earnVault).toBe("0x0000000000000000000000000000000000000000");
  });
});

describe("status pills", () => {
  it("maps chain state to human copy", () => {
    expect(pillFor("Open", null)).toBe("Awaiting payment");
    expect(pillFor("Funded", null)).toBe("Locked");
    expect(pillFor("Funded", null, true)).toBe("Expired");
    expect(pillFor("Attested", Verdict.Pass)).toBe("Verified");
    expect(pillFor("Attested", Verdict.NeedsReview)).toBe("Needs review");
    expect(pillFor("Settled", Verdict.Pass)).toBe("Paid");
  });
});

describe("format", () => {
  it("formats and parses 6-decimal amounts", () => {
    expect(formatAmount(5_000_000n)).toBe("$5.00");
    expect(formatAmount(1_234_567_890n, { symbol: "pathUSD" })).toBe("1,234.57 pathUSD");
    expect(parseAmount("$5.25")).toBe(5_250_000n);
    expect(parseAmount("1,000")).toBe(1_000_000_000n);
    expect(() => parseAmount("1.1234567")).toThrow();
  });
  it("formats durations", () => {
    expect(formatDuration(2 * 86400 + 4 * 3600)).toBe("2d 4h");
    expect(formatDuration(90)).toBe("1m");
    expect(formatDuration(0)).toBe("now");
  });
});
