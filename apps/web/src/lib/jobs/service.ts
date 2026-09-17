import { createHash } from "node:crypto";
import type { Job as JobRow, Prisma } from "@prisma/client";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import {
  BASE_MAINNET_ID, computeCommit, earnsWhileLocked, hashManifest, hashReason, hashScope, isSupportedChain, isTempo, randomBytes32,
  resolvePolicy, shortId, Status, ZERO_ADDRESS, type CreateJobInput, type DeliveryManifest, type ManifestFile,
  type Policy, type SubmitInput, type TimelineEvent, type ChainId,
} from "@vouch/shared";
import { db } from "../db";
import { env } from "../env";
import { errors } from "../errors";
import { notify, type NotificationKind } from "../email";
import { keys, putObject } from "../storage";
import type { Principal } from "../auth";
import { principalAddress } from "../auth";
import * as vault from "../chain/vault";
import { isVaultConfigured } from "../chain/clients";
import { defaultChainId, roleFor, tokenSymbol } from "./dto";
import { decryptSecret, storeSecret } from "./secrets";
import { tokenForChain } from "../mpp";

type ActionSig = { signer: Address; deadline: bigint; signature: Hex };

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createJob(input: CreateJobInput, p: Principal): Promise<JobRow> {
  const chainId = (input.chainId ?? defaultChainId()) as ChainId;
  if (!isSupportedChain(chainId)) throw errors.badRequest(`Chain ${chainId} is not supported.`, "Use 4217 (Tempo), 42431 (Tempo testnet), 8453 (Base) or 84532 (Base Sepolia).");
  if (!isVaultConfigured(chainId)) throw errors.badRequest(`Vouch is not deployed on chain ${chainId} yet.`, "Pick another chain.");
  const token = tokenForChain(chainId, input.token);
  if (!token) throw errors.badRequest("That token is not accepted on this chain.", "Use pathUSD or USDC.e on Tempo, USDC on Base.");
  const amount = BigInt(input.amount);
  if (amount <= 0n) throw errors.badRequest("Amount must be greater than zero.");
  if (input.earnVault && !isTempo(chainId)) throw errors.badRequest("Earn while locked is a Tempo feature.", "Leave earnVault empty on Base.");
  const policy: Policy = resolvePolicy(input);
  if (policy.autoRelease !== 0 && policy.maxAutoAmount > 0n && amount > policy.maxAutoAmount) {
    // Not an error: the job simply never auto-settles. Surface it in the DTO via autoSettleAt = null.
  }

  const payerAddr = principalAddress(p);
  const workerAddr = input.worker && isAddress(input.worker) ? getAddress(input.worker) : null;
  if (payerAddr && workerAddr && payerAddr.toLowerCase() === workerAddr.toLowerCase()) {
    throw errors.badRequest("The worker cannot be the same wallet as the payer.");
  }
  const jobId = randomBytes32();
  const salt = randomBytes32();
  const scopeHash = hashScope(input.scopeMd);
  const commit = payerAddr
    ? computeCommit({ jobId, payer: payerAddr, worker: workerAddr ?? ZERO_ADDRESS, token: token.address, amount, scopeHash, salt })
    : null;

  const feeBps = await vault.readFeeBps(chainId).catch(() => 100);
  const job = await db.job.create({
    data: {
      id: jobId,
      shortId: shortId(jobId),
      chainId,
      title: input.title.trim(),
      scopeMd: input.scopeMd,
      scopeHash,
      token: token.address,
      tokenSymbol: token.symbol,
      commit,
      payer: payerAddr?.toLowerCase() ?? null,
      payerUserId: p.kind === "user" ? p.userId : null,
      worker: workerAddr?.toLowerCase() ?? null,
      workerHint: input.worker ?? null,
      autoRelease: policy.autoRelease,
      minConfidenceBps: policy.minConfidenceBps,
      maxAutoAmount: policy.maxAutoAmount.toString(),
      reviewWindow: policy.reviewWindow,
      submitDeadline: policy.submitDeadline,
      earnVault: earnsWhileLocked(policy) ? policy.earnVault.toLowerCase() : null,
      status: "Open",
      feeBps,
      paymentDeadlineAt: input.paymentDeadline ? new Date(Date.now() + input.paymentDeadline * 1000) : null,
    },
  });
  await storeSecret(jobId, { amount, salt });
  await funnel(job, "created", p);
  if (p.kind === "user" && p.email) void notify(job.id, p.email, "created", job.title);
  return job;
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

async function setTx(jobId: string, key: string, hash: string): Promise<Record<string, string>> {
  const j = await db.job.findUniqueOrThrow({ where: { id: jobId }, select: { txs: true } });
  const txs = { ...((j.txs as Record<string, string>) ?? {}), [key]: hash };
  await db.job.update({ where: { id: jobId }, data: { txs } });
  return txs;
}

/** Make sure the job exists on-chain for `payer`. Intake creates it on the payer's behalf when needed. */
export async function ensureOnChain(job: JobRow, payer: Address): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  let row = job;
  if (row.payer && row.payer !== payer.toLowerCase()) {
    throw errors.conflict("This job already has a different payer.", "Create a new job or pay from the original wallet.");
  }
  const { amount, salt } = await decryptSecret(row.id);
  const worker = (row.worker ? getAddress(row.worker) : ZERO_ADDRESS) as Address;
  if (!row.commit || !row.payer) {
    const commit = computeCommit({ jobId: row.id as Hex, payer, worker, token: row.token as Address, amount, scopeHash: row.scopeHash as Hex, salt });
    row = await db.job.update({ where: { id: row.id }, data: { payer: payer.toLowerCase(), commit } });
  }
  const onChain = await vault.readJob(chainId, row.id as Hex);
  if (onChain.status === Status.None) {
    const { hash } = await vault.createJobOnChain(chainId, {
      jobId: row.id as Hex, commit: row.commit as Hex, payer, worker, token: row.token as Address,
      policy: { autoRelease: row.autoRelease as 0 | 1 | 2, minConfidenceBps: row.minConfidenceBps, maxAutoAmount: BigInt(row.maxAutoAmount), reviewWindow: row.reviewWindow, submitDeadline: row.submitDeadline, earnVault: (row.earnVault ?? ZERO_ADDRESS) as Address },
    });
    await setTx(row.id, "created", hash);
  }
  return db.job.findUniqueOrThrow({ where: { id: row.id } });
}

/** Lock the amount from the payer's vault balance. Idempotent: returns the job if already funded. */
export async function fundFromBalance(job: JobRow, payer: Address, actor: Principal | "chain" = "chain"): Promise<JobRow> {
  if (job.status !== "Open" && job.status !== "Draft") return job;
  const chainId = job.chainId as ChainId;
  const row = await ensureOnChain(job, payer);
  const { amount, salt } = await decryptSecret(row.id);
  const onChain = await vault.readJob(chainId, row.id as Hex);
  if (onChain.status === Status.Open) {
    const bal = await vault.readBalance(chainId, row.token as Address, payer);
    if (bal < amount) {
      throw errors.badRequest(
        `Your Vouch balance on this chain is ${bal.toString()} base units; this job needs ${amount.toString()}.`,
        "Pay through one of the fund routes, or deposit first.",
      );
    }
    const { hash } = await vault.fundOnChain(chainId, row.id as Hex, amount, row.scopeHash as Hex, salt);
    await setTx(row.id, "funded", hash);
  }
  const updated = await db.job.update({ where: { id: row.id }, data: { status: "Funded", fundedAt: new Date() } });
  await funnel(updated, "funded", actor);
  await notifyParties(updated, "funded");
  return updated;
}

/**
 * A payment landed directly in the vault (MPP charge, x402/EIP-3009 settlement, memo'd transfer).
 * Attribute the surplus to `from`, then fund. Keyed by `ref` so replays are no-ops.
 */
export async function attributeAndFund(job: JobRow, p: { token: Address; from: Address; value: bigint; ref: Hex; sourceTx?: string; memo?: string; alreadyCredited?: boolean }): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  const existing = await db.attribution.findUnique({ where: { ref: p.ref } });
  if (existing?.status === "done") {
    const fresh = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    return fresh.status === "Open" ? fundFromBalance(fresh, p.from) : fresh;
  }
  if (p.token.toLowerCase() !== job.token.toLowerCase()) {
    throw errors.badRequest("Payment was made in a different token than the job requires.", `Pay in ${job.tokenSymbol}.`);
  }
  const { amount } = await decryptSecret(job.id);
  if (p.value < amount) {
    await db.attribution.upsert({
      where: { ref: p.ref },
      create: { ref: p.ref, chainId, token: p.token, to: p.from.toLowerCase(), amount: p.value.toString(), memo: p.memo, jobId: job.id, sourceTx: p.sourceTx, status: "failed", error: "underpaid" },
      update: { status: "failed", error: "underpaid" },
    });
    throw errors.badRequest(`Payment of ${p.value.toString()} is less than the job amount ${amount.toString()}.`, "Send the exact amount. The partial payment is credited to your Vouch balance.");
  }
  await db.attribution.upsert({
    where: { ref: p.ref },
    create: { ref: p.ref, chainId, token: p.token, to: p.from.toLowerCase(), amount: p.value.toString(), memo: p.memo, jobId: job.id, sourceTx: p.sourceTx },
    update: {},
  });
  if (!p.alreadyCredited) {
    const already = await vault.readAttributed(chainId, p.ref);
    if (!already) {
      const { hash } = await vault.attributeDeposit(chainId, p.token, p.from, p.value, p.ref, job.id);
      await db.attribution.update({ where: { ref: p.ref }, data: { txHash: hash } });
    }
  }
  await db.attribution.update({ where: { ref: p.ref }, data: { status: "done" } });
  return fundFromBalance(job, p.from, "chain");
}

/** Attribute a memo'd transfer whose memo is a job id. Called by the indexer. */
export async function attributeMemoTransfer(chainId: number, t: { token: Address; from: Address; value: bigint; memo: Hex; txHash: Hex; logIndex: number }): Promise<void> {
  const job = await db.job.findUnique({ where: { id: t.memo.toLowerCase() } });
  if (!job || job.chainId !== chainId) return;
  const ref = `0x${createHash("sha256").update(`${t.txHash}:${t.logIndex}`).digest("hex")}` as Hex;
  try {
    await attributeAndFund(job, { token: t.token, from: t.from, value: t.value, ref, sourceTx: t.txHash, memo: t.memo });
  } catch (e) {
    console.warn("[attribute] memo transfer not applied", t.txHash, e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// Submit / resubmit
// ---------------------------------------------------------------------------

function sha256(bytes: Uint8Array): Hex {
  return `0x${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function submit(job: JobRow, p: Principal, input: SubmitInput): Promise<{ job: JobRow; deliveryId: string }> {
  const chainId = job.chainId as ChainId;
  const isResubmit = job.status === "Attested" && job.verdict === "FAIL";
  if (job.status !== "Funded" && !isResubmit) throw errors.wrongState(job.status.toLowerCase(), "locked (funded) or verified as FAIL");
  if (isResubmit && job.resubmits >= 2) throw errors.conflict("This job already used both resubmissions.", "Open a dispute if you believe the verdict is wrong.");
  const deadline = job.fundedAt && job.submitDeadline ? job.fundedAt.getTime() + job.submitDeadline * 1000 : null;
  if (!isResubmit && deadline && Date.now() > deadline) throw errors.conflict("The delivery deadline has passed.", "Ask the payer to create a new job.");

  const sig = input.signature;
  if (!sig) throw errors.badRequest("A signed Submit authorisation is required.", "Sign the EIP-712 Submit message with the worker wallet (the web app and @vouch/mcp do this for you).");
  const signer = getAddress(sig.signer);
  const callerAddr = principalAddress(p);
  if (callerAddr && callerAddr.toLowerCase() !== signer.toLowerCase()) throw errors.forbidden("submit for a different wallet");
  if (job.worker && job.worker !== signer.toLowerCase()) throw errors.forbidden("deliver this job; it is assigned to another worker");
  if (job.payer && job.payer === signer.toLowerCase()) throw errors.badRequest("The payer cannot deliver their own job.");
  if (input.files.length === 0 && input.links.length === 0 && !input.note.trim()) throw errors.badRequest("Add at least one file, link or note.");

  // 1. Pin: fingerprint + store every file before anyone reviews it.
  const max = env().VERIFIER_MAX_ARTIFACT_BYTES;
  const files: ManifestFile[] = [];
  for (const f of input.files) {
    const bytes = Buffer.from(f.base64, "base64");
    if (bytes.length === 0) throw errors.badRequest(`File "${f.name}" is empty.`);
    if (bytes.length > max) throw errors.badRequest(`File "${f.name}" is larger than ${Math.round(max / 1024 / 1024)} MB.`, "Compress it or share a link instead.");
    const hash = sha256(bytes);
    const key = keys.deliverable(job.id, hash.slice(2));
    await putObject(key, bytes, f.contentType || "application/octet-stream");
    files.push({ name: f.name, sha256: hash, size: bytes.length, contentType: f.contentType || "application/octet-stream", url: key });
  }
  const manifest: DeliveryManifest = {
    version: 1, jobId: job.id as Hex, submittedBy: signer, files, links: input.links, note: input.note, createdAt: new Date().toISOString(),
  };
  const manifestHash = hashManifest(manifest);
  await putObject(keys.manifest(job.id, manifestHash.slice(2)), JSON.stringify(manifest, null, 2), "application/json");

  // 2. On-chain submit (relayed; signature proves the worker).
  const sigValue: ActionSig = { signer, deadline: BigInt(sig.deadline), signature: sig.signature as Hex };
  const { hash } = isResubmit
    ? await vault.resubmitWithSig(chainId, job.id as Hex, manifestHash, sigValue)
    : await vault.submitWithSig(chainId, job.id as Hex, manifestHash, sigValue);

  const delivery = await db.delivery.create({
    data: { jobId: job.id, manifest: manifest as unknown as Prisma.InputJsonValue, manifestHash, submittedBy: signer.toLowerCase(), resubmission: isResubmit ? job.resubmits + 1 : 0, txHash: hash },
  });
  await setTx(job.id, isResubmit ? `resubmitted${job.resubmits + 1}` : "submitted", hash);
  const updated = await db.job.update({
    where: { id: job.id },
    data: {
      status: "Submitted",
      worker: signer.toLowerCase(),
      workerUserId: p.kind === "user" ? p.userId : job.workerUserId,
      submittedAt: new Date(),
      deliverableHash: manifestHash,
      resubmits: isResubmit ? job.resubmits + 1 : job.resubmits,
      verdict: null, confidenceBps: null, attestedAt: null, attestationHash: null,
    },
  });
  // 3. Queue the verifier.
  await db.verdict.create({ data: { jobId: job.id, deliveryId: delivery.id, stage: "queued" } });
  await funnel(updated, "delivered", p);
  await notifyParties(updated, "delivered");
  return { job: updated, deliveryId: delivery.id };
}

// ---------------------------------------------------------------------------
// Approve / dispute / resolve / refund
// ---------------------------------------------------------------------------

export async function approve(job: JobRow, p: Principal, sig: ActionSig): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  if (job.status !== "Submitted" && job.status !== "Attested") throw errors.wrongState(job.status.toLowerCase(), "delivered or verified");
  if (roleFor(job, p) !== "payer") throw errors.forbidden("approve this job");
  if (job.payer !== sig.signer.toLowerCase()) throw errors.forbidden("approve with a wallet that is not the payer");
  const { amount, salt } = await decryptSecret(job.id);
  const { hash } = await vault.settleWithSig(chainId, job.id as Hex, amount, job.scopeHash as Hex, salt, sig);
  await setTx(job.id, "settled", hash);
  const updated = await db.job.update({ where: { id: job.id }, data: { status: "Settled", settledAt: new Date(), amountPublic: true } });
  await funnel(updated, "settled", p);
  await notifyParties(updated, "settled");
  return updated;
}

export async function dispute(job: JobRow, p: Principal, reason: string, sig: ActionSig): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  if (job.status !== "Submitted" && job.status !== "Attested") throw errors.wrongState(job.status.toLowerCase(), "delivered or verified");
  const role = roleFor(job, p);
  if (role !== "payer" && role !== "worker") throw errors.forbidden("dispute this job");
  const signer = sig.signer.toLowerCase();
  if (signer !== job.payer && signer !== job.worker) throw errors.forbidden("dispute with a wallet that is not a party");
  const reasonHash = hashReason(reason);
  const { hash } = await vault.disputeWithSig(chainId, job.id as Hex, reasonHash, sig);
  await db.dispute.create({ data: { jobId: job.id, by: signer, reason, reasonHash, txHash: hash } });
  await setTx(job.id, "disputed", hash);
  const updated = await db.job.update({ where: { id: job.id }, data: { status: "Disputed" } });
  await funnel(updated, "disputed", p);
  await notifyParties(updated, "disputed");
  return updated;
}

export async function resolveDispute(job: JobRow, p: Principal, workerBps: number, note: string): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  if (!p.isArbiter) throw errors.forbidden("resolve disputes");
  if (job.status !== "Disputed") throw errors.wrongState(job.status.toLowerCase(), "disputed");
  const { amount, salt } = await decryptSecret(job.id);
  const { hash } = await vault.resolve(chainId, job.id as Hex, amount, job.scopeHash as Hex, salt, workerBps);
  const open = await db.dispute.findFirst({ where: { jobId: job.id, resolvedAt: null }, orderBy: { createdAt: "desc" } });
  if (open) await db.dispute.update({ where: { id: open.id }, data: { workerBps, note, resolveTx: hash, resolvedAt: new Date() } });
  await setTx(job.id, "resolved", hash);
  const updated = await db.job.update({ where: { id: job.id }, data: { status: "Resolved", settledAt: new Date(), amountPublic: true } });
  await funnel(updated, "resolved", p);
  await notifyParties(updated, "resolved");
  return updated;
}

export async function refundExpired(job: JobRow): Promise<JobRow> {
  const chainId = job.chainId as ChainId;
  if (job.status !== "Funded") throw errors.wrongState(job.status.toLowerCase(), "locked with no delivery");
  const deadline = job.fundedAt && job.submitDeadline ? job.fundedAt.getTime() + job.submitDeadline * 1000 : null;
  if (!deadline) throw errors.conflict("This job has no delivery deadline.", "Wait for the delivery or open a dispute after it arrives.");
  if (Date.now() <= deadline) throw errors.conflict("The delivery deadline has not passed yet.", `Try again after ${new Date(deadline).toISOString()}.`);
  const { amount, salt } = await decryptSecret(job.id);
  const { hash } = await vault.refundExpired(chainId, job.id as Hex, amount, job.scopeHash as Hex, salt);
  await setTx(job.id, "refunded", hash);
  const updated = await db.job.update({ where: { id: job.id }, data: { status: "Refunded" } });
  await funnel(updated, "refunded", "chain");
  await notifyParties(updated, "refunded");
  return updated;
}

export async function autoSettle(job: JobRow): Promise<JobRow | null> {
  const chainId = job.chainId as ChainId;
  if (job.status !== "Attested") return null;
  const { amount, salt } = await decryptSecret(job.id);
  const { ok } = await vault.readCanAutoSettle(chainId, job.id as Hex, amount);
  if (!ok) return null;
  const { hash } = await vault.autoSettle(chainId, job.id as Hex, amount, job.scopeHash as Hex, salt);
  await setTx(job.id, "settled", hash);
  const updated = await db.job.update({ where: { id: job.id }, data: { status: "Settled", settledAt: new Date(), amountPublic: true } });
  await funnel(updated, "auto_settled", "chain");
  await notifyParties(updated, "settled");
  return updated;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export async function timeline(job: JobRow): Promise<TimelineEvent[]> {
  const chainId = job.chainId as ChainId;
  const [events, deliveries, verdicts, disputes] = await Promise.all([
    db.chainEvent.findMany({ where: { jobId: job.id }, orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] }),
    db.delivery.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" } }),
    db.verdict.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" } }),
    db.dispute.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const out: TimelineEvent[] = [];
  out.push({ kind: "created", at: job.createdAt.toISOString(), txHash: null, chainId: null, detail: job.title, source: "service" });
  for (const e of events) {
    out.push({ kind: e.name, at: e.createdAt.toISOString(), txHash: e.txHash, chainId, detail: null, source: "chain" });
  }
  const txs = (job.txs as Record<string, string>) ?? {};
  const seen = new Set(events.map((e) => e.txHash.toLowerCase()));
  for (const [k, h] of Object.entries(txs)) {
    if (!seen.has(h.toLowerCase())) out.push({ kind: k, at: job.updatedAt.toISOString(), txHash: h, chainId, detail: null, source: "service" });
  }
  for (const d of deliveries) out.push({ kind: d.resubmission ? "resubmitted" : "delivered", at: d.createdAt.toISOString(), txHash: d.txHash, chainId, detail: `${(d.manifest as { files?: unknown[] }).files?.length ?? 0} file(s)`, source: "service" });
  for (const v of verdicts) {
    out.push({ kind: `verifier_${v.stage}`, at: v.updatedAt.toISOString(), txHash: v.attestTx, chainId, detail: v.verdict ? `${v.verdict} · ${((v.confidenceBps ?? 0) / 100).toFixed(0)}%` : v.error, source: "service" });
  }
  for (const d of disputes) {
    out.push({ kind: "dispute_opened", at: d.createdAt.toISOString(), txHash: d.txHash, chainId, detail: d.reason.slice(0, 200), source: "service" });
    if (d.resolvedAt) out.push({ kind: "dispute_resolved", at: d.resolvedAt.toISOString(), txHash: d.resolveTx, chainId, detail: `${(d.workerBps ?? 0) / 100}% to worker`, source: "service" });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function funnel(job: JobRow, kind: string, actor: Principal | "chain"): Promise<void> {
  const who = actor === "chain" ? null : actor.kind === "agent" ? "agent" : actor.kind === "user" ? "human" : null;
  await db.funnelEvent.create({ data: { jobId: job.id, kind, chainId: job.chainId, actor: who } }).catch(() => undefined);
}

async function notifyParties(job: JobRow, kind: NotificationKind): Promise<void> {
  const ids = [job.payerUserId, job.workerUserId].filter((x): x is string => Boolean(x));
  if (ids.length === 0 && !job.workerHint?.includes("@")) return;
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } } }) : [];
  await Promise.all(users.map((u) => notify(job.id, u.email, kind, job.title)));
  if (job.workerHint?.includes("@") && !users.some((u) => u.email === job.workerHint)) {
    await notify(job.id, job.workerHint, kind === "funded" ? "funded" : kind, job.title);
  }
}

export async function getJobOrThrow(idOrShort: string): Promise<JobRow> {
  const id = idOrShort.toLowerCase();
  const job = id.startsWith("0x") && id.length === 66
    ? await db.job.findUnique({ where: { id } })
    : await db.job.findUnique({ where: { shortId: idOrShort } });
  if (!job) throw errors.notFound("job");
  return job;
}

export const BASE_ID = BASE_MAINNET_ID;
export { tokenSymbol };
