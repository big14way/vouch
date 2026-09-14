import { z } from "zod";

/** Mirrors `Vault.Policy`. Amounts are base units (6 decimals); durations are seconds. */
export const PolicySchema = z.object({
  autoRelease: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  minConfidenceBps: z.number().int().min(0).max(10_000),
  maxAutoAmount: z.bigint().nonnegative(),
  reviewWindow: z.number().int().min(0).max(2 ** 32 - 1),
  submitDeadline: z.number().int().min(0).max(2 ** 32 - 1),
});
export type Policy = z.infer<typeof PolicySchema>;

/** JSON-safe form (bigint as string) used over the wire. */
export const PolicyWireSchema = z.object({
  autoRelease: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  minConfidenceBps: z.number().int().min(0).max(10_000),
  maxAutoAmount: z.string().regex(/^\d+$/),
  reviewWindow: z.number().int().min(0),
  submitDeadline: z.number().int().min(0),
});
export type PolicyWire = z.infer<typeof PolicyWireSchema>;

export const POLICY_PRESET_NAMES = ["manual", "trusted", "autopilot", "custom"] as const;
export type PolicyPreset = (typeof POLICY_PRESET_NAMES)[number];

const DAY = 86_400;

/**
 * Presets (spec §8.4):
 *  manual    — never auto-settles; payer clicks Approve.
 *  trusted   — PASS ≥ 85 %, 3-day review window, ≤ $200.
 *  autopilot — PASS ≥ 90 %, 1-day review window, ≤ $50.
 */
export const POLICY_PRESETS: Record<Exclude<PolicyPreset, "custom">, Policy> = {
  manual: { autoRelease: 0, minConfidenceBps: 0, maxAutoAmount: 0n, reviewWindow: 0, submitDeadline: 14 * DAY },
  trusted: { autoRelease: 1, minConfidenceBps: 8500, maxAutoAmount: 200_000_000n, reviewWindow: 3 * DAY, submitDeadline: 14 * DAY },
  autopilot: { autoRelease: 1, minConfidenceBps: 9000, maxAutoAmount: 50_000_000n, reviewWindow: 1 * DAY, submitDeadline: 7 * DAY },
};

export const POLICY_PRESET_COPY: Record<PolicyPreset, { title: string; blurb: string }> = {
  manual: { title: "Manual", blurb: "You review every delivery and release payment yourself." },
  trusted: { title: "Trusted", blurb: "Pays automatically when verified at 85% or higher, after 3 days, up to $200." },
  autopilot: { title: "Autopilot", blurb: "Pays automatically when verified at 90% or higher, after 1 day, up to $50." },
  custom: { title: "Custom", blurb: "Set your own threshold, review window and cap." },
};

export function policyToWire(p: Policy): PolicyWire {
  return { ...p, maxAutoAmount: p.maxAutoAmount.toString() };
}

export function policyFromWire(p: PolicyWire): Policy {
  return { ...p, maxAutoAmount: BigInt(p.maxAutoAmount) };
}

/** Tuple in the exact order `Vault.Policy` expects for viem `writeContract`. */
export function policyToStruct(p: Policy) {
  return {
    autoRelease: p.autoRelease,
    minConfidenceBps: p.minConfidenceBps,
    maxAutoAmount: p.maxAutoAmount,
    reviewWindow: p.reviewWindow,
    submitDeadline: p.submitDeadline,
  } as const;
}

export function resolvePolicy(input: { policyPreset?: PolicyPreset; policy?: PolicyWire }): Policy {
  if (input.policy) return PolicySchema.parse(policyFromWire(input.policy));
  const preset = input.policyPreset ?? "manual";
  if (preset === "custom") throw new Error("policy is required when policyPreset is custom");
  return POLICY_PRESETS[preset];
}

/** Would this (verdict, confidence, amount) be eligible under the policy once the review window has elapsed? */
export function policyPermits(p: Policy, verdict: 1 | 2 | 3, confidenceBps: number, amount: bigint): boolean {
  if (p.autoRelease === 0) return false;
  const verdictOk = verdict === 1 || (p.autoRelease === 2 && verdict === 2);
  return verdictOk && confidenceBps >= p.minConfidenceBps && amount <= p.maxAutoAmount;
}
