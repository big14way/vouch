/**
 * Verifier calibration harness.
 *   pnpm calibrate            → rules-only pass over examples/adversarial (no API key needed)
 *   ANTHROPIC_API_KEY=… pnpm calibrate --model   → full model + rules pass, prints the confusion matrix
 *
 * Reads examples/adversarial/manifest.json and examples/calibration/<n>/expected.json.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { VerdictOutputSchema, hashScope, type DeliveryManifest, type VerdictOutput } from "@vouch/shared";
import { bytesToArtifact, type Artifact } from "../src/lib/verifier/content";
import { buildUserContent, modelSampling, SYSTEM_PROMPT, VERDICT_TOOL } from "../src/lib/verifier/prompt";
import { applyRules, detectInjection } from "../src/lib/verifier/rules";

type Label = "PASS" | "NEEDS_REVIEW" | "FAIL";
interface Sample { name: string; scope: string; files: { name: string; bytes: Buffer }[]; expected: Label; flag?: boolean; maxConfidence?: number }

const root = resolve(import.meta.dirname, "../../..");
const useModel = process.argv.includes("--model");
const verbose = process.argv.includes("--verbose");
/** `--only real` / `--only adv` restricts the run to one group (cheaper iteration on the prompt). */
const only = process.argv[process.argv.indexOf("--only") + 1] as string | undefined;
const onlyPrefix = process.argv.includes("--only") && only ? `${only}/` : undefined;
const usage = { input: 0, output: 0 };
/** The model returned a tool input the verdict schema rejects; in production the verdict stage reports `failed` and the job waits for the payer. */
class InvalidVerdict extends Error {}

async function loadAdversarial(): Promise<Sample[]> {
  const dir = join(root, "examples/adversarial");
  const scope = await readFile(join(dir, "scope.md"), "utf8");
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { file: string; expected: Label; flag: boolean; maxConfidence?: number }[];
  return Promise.all(manifest.map(async (m) => ({ name: `adv/${m.file}`, scope, files: [{ name: "brief.md", bytes: await readFile(join(dir, m.file)) }], expected: m.expected, flag: m.flag, maxConfidence: m.maxConfidence })));
}

async function loadReal(): Promise<Sample[]> {
  const dir = join(root, "examples/calibration");
  const out: Sample[] = [];
  for (const entry of await readdir(dir).catch(() => [])) {
    const p = join(dir, entry);
    if (!(await stat(p)).isDirectory()) continue;
    const expected = JSON.parse(await readFile(join(p, "expected.json"), "utf8")) as { expected: Label };
    const scope = await readFile(join(p, "scope.md"), "utf8");
    const files = [];
    for (const f of await readdir(p)) if (f !== "scope.md" && f !== "expected.json") files.push({ name: f, bytes: await readFile(join(p, f)) });
    out.push({ name: `real/${entry}`, scope, files, expected: expected.expected });
  }
  return out;
}

const CONTENT_TYPES: Record<string, string> = { pdf: "application/pdf", md: "text/markdown", txt: "text/plain", csv: "text/csv", py: "text/x-python", ts: "text/typescript", js: "text/javascript", json: "application/json", html: "text/html", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
function contentTypeFor(name: string): string {
  return CONTENT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

async function judge(s: Sample): Promise<{ output: VerdictOutput; adjustments: string[]; heuristic: string[] }> {
  const artifacts: Artifact[] = [];
  for (const f of s.files) artifacts.push(await bytesToArtifact(f.name, contentTypeFor(f.name), f.bytes));
  const text = artifacts.map((a) => (a.kind === "text" ? a.text : "")).join("\n");
  const heuristic = detectInjection(text);
  const accessible = artifacts.some((a) => a.kind === "text" && a.text.trim().length > 0) || artifacts.some((a) => a.kind === "image");
  let raw: VerdictOutput;
  if (useModel) {
    // The manifest must describe the files truthfully (size, type): a verifier that notices "0 bytes" next to a full file is right to flag it.
    const manifest: DeliveryManifest = { version: 1, jobId: `0x${"0".repeat(64)}`, submittedBy: "0x0000000000000000000000000000000000000001", files: s.files.map((f, i) => ({ name: f.name, sha256: (artifacts[i]?.sha256 ?? `0x${"0".repeat(64)}`) as `0x${string}`, size: f.bytes.length, contentType: contentTypeFor(f.name), url: "" })), links: [], note: "", createdAt: new Date().toISOString() };
    const content = buildUserContent({ title: s.name, scopeMd: s.scope, policy: { autoRelease: 1, minConfidenceBps: 9000, maxAutoAmount: 50_000_000n, reviewWindow: 86400, submitDeadline: 0, earnVault: "0x0000000000000000000000000000000000000000" }, manifest, artifacts, previousVerdict: null });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.VERIFIER_MODEL ?? "claude-sonnet-5";
    const res = await client.messages.create({ model, max_tokens: 4000, ...modelSampling(model), system: SYSTEM_PROMPT, messages: [{ role: "user", content }], tools: [VERDICT_TOOL], tool_choice: { type: "tool", name: VERDICT_TOOL.name } });
    usage.input += res.usage.input_tokens; usage.output += res.usage.output_tokens;
    const tool = res.content.find((b) => b.type === "tool_use");
    const parsed = VerdictOutputSchema.safeParse(tool && tool.type === "tool_use" ? tool.input : {});
    if (!parsed.success) throw new InvalidVerdict(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    raw = parsed.data;
  } else {
    // Rules-only stand-in for the model: a naive "everything met at 0.95" judgement, so the run shows exactly what the rules alone guarantee.
    const empty = !accessible || text.trim().length === 0;
    raw = { verdict: empty ? "FAIL" : "PASS", confidence: empty ? 0.99 : 0.95, scope_items: [{ item: "all", status: empty ? "missing" : "met", evidence: "" }], summary: "", questions_for_worker: [], red_flags: [] };
  }
  const { output, adjustments } = applyRules(raw, heuristic, accessible);
  return { output, adjustments, heuristic };
}

async function main() {
  const samples = [...(await loadAdversarial()), ...(await loadReal())].filter((x) => !onlyPrefix || x.name.startsWith(onlyPrefix));
  const labels: Label[] = ["PASS", "NEEDS_REVIEW", "FAIL"];
  const matrix: Record<Label, Record<Label, number>> = { PASS: { PASS: 0, NEEDS_REVIEW: 0, FAIL: 0 }, NEEDS_REVIEW: { PASS: 0, NEEDS_REVIEW: 0, FAIL: 0 }, FAIL: { PASS: 0, NEEDS_REVIEW: 0, FAIL: 0 } };
  let flagOk = 0, flagTotal = 0, capOk = 0, capTotal = 0;
  // Auto-release needs PASS at or above the payer's minConfidence (0.90 in this harness): count it for the samples a human would pass.
  let releaseOk = 0, releaseTotal = 0;
  const nReal = samples.filter((x) => x.name.startsWith("real/")).length;
  console.log(`mode: ${useModel ? "model + rules" : "rules only"} · ${samples.length} samples (${samples.length - nReal} adversarial, ${nReal} calibration) · scope hash ${hashScope(samples[0]?.scope ?? "").slice(0, 10)}…\n`);
  let invalid = 0;
  for (const s of samples) {
    let r: Awaited<ReturnType<typeof judge>>;
    try {
      r = await judge(s);
    } catch (e) {
      if (!(e instanceof InvalidVerdict)) throw e;
      invalid++;
      console.log(`✗ ${s.name.padEnd(34)} expected ${s.expected.padEnd(12)} got INVALID      (schema: ${e.message.slice(0, 80)})`);
      continue;
    }
    matrix[s.expected][r.output.verdict]++;
    const flagged = r.output.red_flags.length > 0;
    if (s.flag !== undefined) { flagTotal++; if (flagged === s.flag) flagOk++; }
    if (s.maxConfidence !== undefined) { capTotal++; if (r.output.confidence <= s.maxConfidence) capOk++; }
    if (s.expected === "PASS") { releaseTotal++; if (r.output.verdict === "PASS" && r.output.confidence >= 0.9) releaseOk++; }
    const ok = r.output.verdict === s.expected;
    console.log(`${ok ? "✓" : "✗"} ${s.name.padEnd(34)} expected ${s.expected.padEnd(12)} got ${r.output.verdict.padEnd(12)} conf ${r.output.confidence.toFixed(2)} ${flagged ? "⚑" : " "} ${r.adjustments.join(",")}`);
    if (verbose) {
      for (const f of r.output.red_flags) console.log(`      red_flag: ${f}`);
      for (const it of r.output.scope_items) if (it.status !== "met") console.log(`      ${it.status}: ${it.item} — ${it.evidence.slice(0, 160)}`);
      for (const q of r.output.questions_for_worker) console.log(`      question: ${q}`);
      console.log(`      summary: ${r.output.summary.slice(0, 240)}`);
    }
  }
  console.log("\nConfusion matrix (rows = expected, cols = got)\n");
  console.log("| expected \\ got | PASS | NEEDS_REVIEW | FAIL |\n|---|---|---|---|");
  for (const e of labels) console.log(`| ${e} | ${matrix[e].PASS} | ${matrix[e].NEEDS_REVIEW} | ${matrix[e].FAIL} |`);
  const correct = labels.reduce((n, l) => n + matrix[l][l], 0);
  console.log(`\naccuracy ${correct}/${samples.length} · invalid verdicts ${invalid} · injection flags ${flagOk}/${flagTotal} · confidence caps ${capOk}/${capTotal} · auto-release eligible (PASS ≥ 0.90) ${releaseOk}/${releaseTotal}`);
  const wrongPass = matrix.NEEDS_REVIEW.PASS + matrix.FAIL.PASS;
  console.log(`wrong PASS (the only outcome that can move money): ${wrongPass}${useModel ? "" : "  (rules-only mode: the naive stand-in says PASS for anything non-empty; unrelated/partial/unverifiable need the model)"}`);
  if (useModel) console.log(`model ${process.env.VERIFIER_MODEL ?? "claude-sonnet-5"} · tokens in ${usage.input} out ${usage.output}`);
  if (useModel && wrongPass > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
