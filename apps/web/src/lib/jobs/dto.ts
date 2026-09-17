import type { Job as JobRow, Delivery, Verdict as VerdictRow } from "@prisma/client";
import type { Address } from "viem";
import {
  chainMeta, formatAmount, isTempo, pillFor, shortId as short, TOKENS, verdictFromName,
  type ChainId, type FundRoute, type JobDto, type PolicyWire, type StatusName, type VerdictDto,
} from "@vouch/shared";
import { appUrl, env } from "../env";
import type { Principal } from "../auth";
import { vaultAddress, isVaultConfigured } from "../chain/clients";
import { objectUrl, keys } from "../storage";
import { decryptSecret } from "./secrets";

export type Role = JobDto["role"];

export function roleFor(job: JobRow, p: Principal): Role {
  const addr = p.kind === "agent" ? p.address : p.kind === "user" ? p.address : null;
  const a = addr?.toLowerCase();
  if (p.kind === "user" && job.payerUserId === p.userId) return "payer";
  if (p.kind === "user" && job.workerUserId === p.userId) return "worker";
  if (a && job.payer && job.payer === a) return "payer";
  if (a && job.worker && job.worker === a) return "worker";
  if (p.isArbiter) return "arbiter";
  return "public";
}

export function policyWire(job: JobRow): PolicyWire {
  return {
    autoRelease: job.autoRelease as 0 | 1 | 2,
    minConfidenceBps: job.minConfidenceBps,
    maxAutoAmount: job.maxAutoAmount,
    reviewWindow: job.reviewWindow,
    submitDeadline: job.submitDeadline,
    earnVault: (job.earnVault ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  };
}

export function payUrl(jobId: string): string {
  return appUrl(`/j/${jobId}`);
}

export function mcpHint(jobId: string): string {
  return `vouch_fund_job({ jobId: "${jobId}" })`;
}

export function fundRoutes(job: JobRow): FundRoute[] {
  const chainId = job.chainId as ChainId;
  const fundUrl = appUrl(`/api/v1/jobs/${job.id}/fund`);
  const routes: FundRoute[] = [];
  const vault = isVaultConfigured(chainId) ? vaultAddress(chainId) : "";
  if (isTempo(chainId)) {
    routes.push({ kind: "mpp", label: "Pay with MPP (agents)", description: "POST returns 402 with a Tempo charge; pay it with any mppx client. One round-trip, fees sponsored.", target: fundUrl });
    routes.push({ kind: "batched", label: "Pay with a Tempo wallet", description: "One sponsored transaction: approve, deposit, create, lock.", target: payUrl(job.id) });
    routes.push({ kind: "transfer", label: "Pay from any wallet", description: `Send the exact amount to the vault with memo = job id.`, target: vault, memo: job.id as `0x${string}` });
  } else {
    routes.push({ kind: "x402", label: "Pay with x402 (agents)", description: "POST returns 402 with an x402 payment requirement; pay it with any x402 client.", target: fundUrl });
    routes.push({ kind: "eip3009", label: "Pay with USDC signature", description: "Sign a USDC transfer authorisation; no ETH needed.", target: payUrl(job.id) });
  }
  routes.push({ kind: "balance", label: "Pay from your Vouch balance", description: "Use funds you already deposited.", target: fundUrl });
  return routes;
}

export function submitDeadlineAt(job: JobRow): Date | null {
  if (!job.fundedAt || !job.submitDeadline) return null;
  return new Date(job.fundedAt.getTime() + job.submitDeadline * 1000);
}

export function autoSettleAt(job: JobRow): Date | null {
  if (!job.attestedAt || job.autoRelease === 0 || job.status !== "Attested") return null;
  const eligible = job.verdict === "PASS" || (job.autoRelease === 2 && job.verdict === "NEEDS_REVIEW");
  if (!eligible) return null;
  if ((job.confidenceBps ?? 0) < job.minConfidenceBps) return null;
  return new Date(job.attestedAt.getTime() + job.reviewWindow * 1000);
}

export async function toDto(job: JobRow, p: Principal): Promise<JobDto> {
  const role = roleFor(job, p);
  const chainId = job.chainId as ChainId;
  const canSeeAmount = role !== "public" || job.amountPublic;
  let amount: string | null = null;
  if (canSeeAmount) {
    const s = await decryptSecret(job.id).catch(() => null);
    amount = s?.amount.toString() ?? null;
  }
  const deadline = submitDeadlineAt(job);
  const deadlinePassed = Boolean(deadline && deadline.getTime() < Date.now() && job.status === "Funded");
  const autoAt = autoSettleAt(job);
  const status = (job.status === "Draft" ? "Open" : job.status) as StatusName;
  const verdictCode = job.verdict ? verdictFromName[job.verdict as "PASS" | "NEEDS_REVIEW" | "FAIL"] : null;
  return {
    id: job.id as `0x${string}`,
    shortId: job.shortId,
    chainId,
    title: job.title,
    scopeMd: job.scopeMd,
    scopeHash: job.scopeHash as `0x${string}`,
    token: job.token as Address,
    tokenSymbol: job.tokenSymbol,
    amount,
    payer: (job.payer as Address | null) ?? null,
    worker: (job.worker as Address | null) ?? null,
    workerHint: role === "public" ? null : job.workerHint,
    status,
    pill: pillFor(status, verdictCode, deadlinePassed),
    verdict: (job.verdict as JobDto["verdict"]) ?? null,
    confidenceBps: job.confidenceBps,
    policy: policyWire(job),
    fundedAt: job.fundedAt?.toISOString() ?? null,
    submittedAt: job.submittedAt?.toISOString() ?? null,
    attestedAt: job.attestedAt?.toISOString() ?? null,
    settledAt: job.settledAt?.toISOString() ?? null,
    submitDeadlineAt: deadline?.toISOString() ?? null,
    autoSettleAt: autoAt?.toISOString() ?? null,
    resubmits: job.resubmits,
    deliverableHash: (job.deliverableHash as `0x${string}` | null) ?? null,
    attestationHash: (job.attestationHash as `0x${string}` | null) ?? null,
    txs: (job.txs as Record<string, string>) ?? {},
    payUrl: payUrl(job.id),
    fundRoutes: fundRoutes(job),
    feeBps: job.feeBps,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    role,
  };
}

export async function verdictDto(job: JobRow, v: VerdictRow | null, delivery: Delivery | null): Promise<VerdictDto> {
  const report = (v?.report as Record<string, unknown> | null) ?? null;
  const scopeItems = (report?.scope_items as VerdictDto["scope_items"]) ?? null;
  return {
    jobId: job.id as `0x${string}`,
    verdict: (v?.verdict as VerdictDto["verdict"]) ?? null,
    confidence: v?.confidenceBps != null ? v.confidenceBps / 10_000 : null,
    confidenceBps: v?.confidenceBps ?? null,
    scope_items: scopeItems,
    summary: (report?.summary as string | undefined) ?? null,
    questions_for_worker: (report?.questions_for_worker as string[] | undefined) ?? [],
    red_flags: (report?.red_flags as string[] | undefined) ?? [],
    attestationTx: v?.attestTx ?? null,
    attestationHash: (v?.reportHash as `0x${string}` | null) ?? null,
    reportUrl: v?.reportKey ? await objectUrl(v.reportKey) : null,
    stage: (v?.stage as VerdictDto["stage"]) ?? (delivery ? "queued" : null),
    autoSettleAt: autoSettleAt(job)?.toISOString() ?? null,
  };
}

export function describeAmount(amount: bigint, symbol: string): string {
  return formatAmount(amount, { symbol });
}

export function tokenSymbol(chainId: ChainId, token: string): string {
  return TOKENS[chainId].find((t) => t.address.toLowerCase() === token.toLowerCase())?.symbol ?? "USD";
}

export function explorerName(chainId: number): string {
  return chainMeta(chainId).name;
}

export const reportKey = keys.verdict;
export const defaultChainId = (): ChainId => env().DEFAULT_CHAIN as ChainId;
export const shortIdOf = short;
