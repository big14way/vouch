import type { VerdictOutput } from "@vouch/shared";

/**
 * Post-model rules (spec §7.6). Applied after the model answers, before anything is written on-chain:
 *  - any `unverifiable` scope item      → NEEDS_REVIEW, confidence ≤ 0.60
 *  - instruction-like text in a deliverable (heuristic or model-flagged) → red_flags, confidence ≤ 0.50, never PASS
 *  - FAIL only when the delivery is empty/unrelated/inaccessible or clear fraud; otherwise FAIL → NEEDS_REVIEW
 */
export const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|the|previous|prior|above)?\s*(scope|instructions?|rules|prompt)/i,
  /disregard (the|all|any|previous)?\s*(scope|instructions?|rules)/i,
  /(output|return|respond with|say|write|give)\s*["']?(pass|verdict\s*[:=]\s*pass)["']?/i,
  /\bverdict\s*[:=]\s*["']?pass\b/i,
  /confidence\s*[:=]\s*(1(\.0+)?|0?\.9\d*)/i,
  /\bsystem prompt\b/i,
  /\byou are (an? )?(ai|assistant|verifier|llm|language model)\b/i,
  /\bas an ai\b/i,
  /\b(this|the) (deliverable|submission|work) (fully )?(meets|satisfies) (all|every) (requirement|scope item)s?\b.*\b(mark|rate|score)\b/i,
  /<\/?(system|instruction|assistant)>/i,
  /\[\s*(system|inst)\s*\]/i,
];

export function detectInjection(text: string): string[] {
  const hits: string[] = [];
  for (const re of INJECTION_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0].slice(0, 120));
  }
  return [...new Set(hits)];
}

export interface RuleResult {
  output: VerdictOutput;
  adjustments: string[];
}

export function applyRules(raw: VerdictOutput, heuristicFlags: string[], accessible: boolean): RuleResult {
  const adjustments: string[] = [];
  const out: VerdictOutput = { ...raw, red_flags: [...raw.red_flags], questions_for_worker: [...raw.questions_for_worker] };
  let cap = 1;

  if (heuristicFlags.length) {
    for (const f of heuristicFlags) if (!out.red_flags.includes(f)) out.red_flags.push(`Instruction-like text in deliverable: "${f}"`);
    adjustments.push("heuristic_injection_flag");
  }
  if (out.red_flags.length) {
    cap = Math.min(cap, 0.5);
    if (out.verdict === "PASS") {
      out.verdict = "NEEDS_REVIEW";
      adjustments.push("pass_downgraded_red_flags");
    }
    adjustments.push("confidence_capped_0.50_red_flags");
  }
  if (out.scope_items.some((s) => s.status === "unverifiable")) {
    cap = Math.min(cap, 0.6);
    if (out.verdict === "PASS") {
      out.verdict = "NEEDS_REVIEW";
      adjustments.push("pass_downgraded_unverifiable");
    }
    adjustments.push("confidence_capped_0.60_unverifiable");
  }
  if (out.verdict === "FAIL") {
    const allMissing = out.scope_items.every((s) => s.status === "missing");
    const fraud = out.red_flags.some((f) => /fraud|fabricat|plagiar|copied|fake/i.test(f));
    if (accessible && !allMissing && !fraud) {
      out.verdict = "NEEDS_REVIEW";
      adjustments.push("fail_downgraded_partial_delivery");
    }
  }
  if (out.confidence > cap) {
    out.confidence = cap;
  }
  out.confidence = Math.max(0, Math.min(1, Math.round(out.confidence * 10_000) / 10_000));
  return { output: out, adjustments };
}
