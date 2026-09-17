import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import type { Prisma } from "@prisma/client";
import { keccak256, toHex, type Hex } from "viem";
import { hashReport, VerdictOutputSchema, verdictFromName, type DeliveryManifest, type VerdictReport } from "@vouch/shared";
import { db } from "../db";
import { env } from "../env";
import { notify } from "../email";
import * as vaultChain from "../chain/vault";
import { keys, putObject } from "../storage";
import { loadArtifacts, type Artifact } from "./content";
import { buildUserContent, SYSTEM_PROMPT, VERDICT_TOOL } from "./prompt";
import { applyRules, detectInjection } from "./rules";

type Stage = "reading_scope" | "checking_files" | "writing_report" | "attesting" | "done" | "failed";

async function stage(verdictId: string, s: Stage, extra: Prisma.VerdictUpdateInput = {}) {
  await db.verdict.update({ where: { id: verdictId }, data: { stage: s, ...extra } });
}

/** Model call with structured output via forced tool use. Temperature 0, JSON only, 60 s budget. */
async function callModel(system: string, content: ReturnType<typeof buildUserContent>): Promise<{ raw: unknown; responseText: string; model: string }> {
  const e = env();
  if (!e.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, timeout: e.VERIFIER_TIMEOUT_MS, maxRetries: 1 });
  const res = await client.messages.create({
    model: e.VERIFIER_MODEL,
    max_tokens: 4000,
    temperature: 0,
    system,
    messages: [{ role: "user", content }],
    tools: [VERDICT_TOOL],
    tool_choice: { type: "tool", name: VERDICT_TOOL.name },
  });
  const tool = res.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("model returned no verdict");
  return { raw: tool.input, responseText: JSON.stringify(tool.input), model: res.model };
}

export interface RunOutcome {
  verdict: "PASS" | "NEEDS_REVIEW" | "FAIL";
  confidenceBps: number;
  attestTx: Hex;
  reportHash: Hex;
}

/** Run the verifier for one queued Verdict row end-to-end: fetch → judge → rules → report → attest. */
export async function runVerifier(verdictId: string): Promise<RunOutcome> {
  const v = await db.verdict.findUniqueOrThrow({ where: { id: verdictId }, include: { job: true, delivery: true } });
  const { job, delivery } = v;
  if (v.stage === "done") throw new Error("already attested");
  await db.verdict.update({ where: { id: verdictId }, data: { attempts: { increment: 1 } } });
  try {
    await stage(verdictId, "reading_scope");
    const manifest = delivery.manifest as unknown as DeliveryManifest;
    const previous = delivery.resubmission > 0
      ? await db.verdict.findFirst({ where: { jobId: job.id, stage: "done", id: { not: verdictId } }, orderBy: { createdAt: "desc" } })
      : null;

    await stage(verdictId, "checking_files");
    const artifacts: Artifact[] = await loadArtifacts(manifest);
    const accessible = artifacts.some((a) => a.kind !== "error") || manifest.note.trim().length > 0;
    const textCorpus = [manifest.note, ...artifacts.map((a) => (a.kind === "text" ? a.text : ""))].join("\n");
    const heuristicFlags = detectInjection(textCorpus);

    await stage(verdictId, "writing_report");
    const content = buildUserContent({
      title: job.title, scopeMd: job.scopeMd,
      policy: { autoRelease: job.autoRelease as 0 | 1 | 2, minConfidenceBps: job.minConfidenceBps, maxAutoAmount: BigInt(job.maxAutoAmount), reviewWindow: job.reviewWindow, submitDeadline: job.submitDeadline, earnVault: (job.earnVault ?? "0x0000000000000000000000000000000000000000") as `0x${string}` },
      manifest, artifacts, previousVerdict: previous?.report ?? null,
    });
    const promptHash = keccak256(toHex(SYSTEM_PROMPT + JSON.stringify(content.map((b) => (b.type === "text" ? b.text : `[image ${b.source.media_type}]`)))));
    const { raw, responseText, model } = await callModel(SYSTEM_PROMPT, content);
    const responseHash = keccak256(toHex(responseText));
    const parsed = VerdictOutputSchema.parse(raw);
    const { output, adjustments } = applyRules(parsed, heuristicFlags, accessible);

    const contentHashes = artifacts.map((a) => a.sha256).filter((h): h is string => Boolean(h)) as Hex[];
    const report: VerdictReport = {
      ...output,
      version: 1,
      jobId: job.id as Hex,
      deliverableHash: delivery.manifestHash as Hex,
      scopeHash: job.scopeHash as Hex,
      model,
      promptHash,
      responseHash,
      contentHashes,
      resubmission: delivery.resubmission,
      createdAt: new Date().toISOString(),
      adjustments,
    };
    const reportHash = hashReport(report);
    const reportKey = keys.verdict(job.id, reportHash.slice(2));
    await putObject(reportKey, JSON.stringify(report, null, 2), "application/json");
    const confidenceBps = Math.round(output.confidence * 10_000);

    await stage(verdictId, "attesting", {
      verdict: output.verdict, confidenceBps, report: report as unknown as Prisma.InputJsonValue, reportHash, reportKey, model, promptHash, responseHash,
    });
    const { hash } = await vaultChain.attest(job.chainId, job.id as Hex, verdictFromName[output.verdict] as 1 | 2 | 3, confidenceBps, reportHash);
    await stage(verdictId, "done", { attestTx: hash, error: null });

    const txs = { ...((job.txs as Record<string, string>) ?? {}), attested: hash };
    const updated = await db.job.update({
      where: { id: job.id },
      data: { status: "Attested", verdict: output.verdict, confidenceBps, attestedAt: new Date(), attestationHash: reportHash, txs },
    });
    await db.funnelEvent.create({ data: { jobId: job.id, kind: "verified", chainId: job.chainId, actor: null } }).catch(() => undefined);
    const ids = [updated.payerUserId, updated.workerUserId].filter((x): x is string => Boolean(x));
    const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } } }) : [];
    await Promise.all(users.map((u) => notify(job.id, u.email, "verdict", job.title)));
    return { verdict: output.verdict, confidenceBps, attestTx: hash, reportHash };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, { tags: { area: "verifier", jobId: job.id } });
    await stage(verdictId, "failed", { error: message.slice(0, 2000) });
    throw e;
  }
}

/** Cron entry: pick up queued/failed verdicts (≤ 3 attempts) and run them one at a time. */
export async function drainVerifierQueue(limit = 5): Promise<{ ran: string[]; failed: string[] }> {
  const rows = await db.verdict.findMany({
    where: { OR: [{ stage: "queued" }, { stage: "failed", attempts: { lt: 3 } }], job: { status: "Submitted" } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const ran: string[] = [];
  const failed: string[] = [];
  for (const r of rows) {
    try {
      await runVerifier(r.id);
      ran.push(r.id);
    } catch {
      failed.push(r.id);
    }
  }
  return { ran, failed };
}
