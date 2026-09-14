"use client";
import type { JobDto, VerdictDto, TimelineEvent } from "@vouch/shared";

export class ClientError extends Error {
  constructor(message: string, public readonly code: string, public readonly next?: string, public readonly retryable = false) {
    super(message);
  }
}

let tokenGetter: () => Promise<string | null> = async () => null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = await tokenGetter();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.json !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; next?: string; retryable?: boolean } }).error;
    throw new ClientError(e?.message ?? `Request failed (${res.status})`, e?.code ?? `http_${res.status}`, e?.next, e?.retryable);
  }
  return data as T;
}

export type JobResponse = { job: JobDto };
export type VerdictResponse = VerdictDto;
export type TimelineResponse = { events: TimelineEvent[] };

export const jobs = {
  get: (id: string) => api<JobResponse>(`/jobs/${id}`),
  list: () => api<{ jobs: JobDto[] }>("/jobs"),
  verdict: (id: string) => api<VerdictResponse>(`/jobs/${id}/verdict`),
  timeline: (id: string) => api<TimelineResponse>(`/jobs/${id}/timeline`),
  create: (json: unknown) => api<{ jobId: string; shortId: string; payUrl: string; mcpHint: string; job: JobDto }>("/jobs", { method: "POST", json }),
  sign: (id: string, qs: Record<string, string>) => api<{ typedData: TypedData }>(`/jobs/${id}/sign?${new URLSearchParams(qs)}`),
  submit: (id: string, json: unknown, resubmit = false) => api<{ status: string; tx: string; job: JobDto; verifier: { id?: string } }>(`/jobs/${id}/${resubmit ? "resubmit" : "submit"}`, { method: "POST", json }),
  approve: (id: string, signature: Sig) => api<{ status: string; tx: string; job: JobDto }>(`/jobs/${id}/approve`, { method: "POST", json: { signature } }),
  dispute: (id: string, reason: string, signature: Sig) => api<{ status: string; tx: string; job: JobDto }>(`/jobs/${id}/dispute`, { method: "POST", json: { reason, signature } }),
  resolve: (id: string, workerBps: number, note: string) => api<{ status: string; tx: string; job: JobDto }>(`/jobs/${id}/resolve`, { method: "POST", json: { workerBps, note } }),
  refund: (id: string) => api<{ status: string; tx: string; job: JobDto }>(`/jobs/${id}/refund`, { method: "POST" }),
  fundFromBalance: (id: string) => api<{ status: string; tx?: string; job: JobDto }>(`/jobs/${id}/fund`, { method: "POST", json: {} }),
  fundEip3009: (id: string, json: unknown) => api<{ status: string; tx?: string; depositTx: string; job: JobDto }>(`/jobs/${id}/fund/eip3009`, { method: "POST", json }),
  fundConfirm: (id: string, txHash: string) => api<{ status: string; tx?: string; job: JobDto }>(`/jobs/${id}/fund/confirm`, { method: "POST", json: { txHash } }),
  fundInfo: (id: string) => api<{ chainId: number; vault: string; token: string; tokenSymbol: string; amount: string; status: string }>(`/jobs/${id}/fund`),
};

export const me = {
  get: () => api<{ kind: "user"; id: string; email: string | null; name: string | null; role: string | null; address: string | null; isArbiter: boolean; onboarded: boolean }>("/me"),
  update: (json: unknown) => api<{ onboarded: boolean }>("/me", { method: "POST", json }),
  balances: () => api<{ address: string; balances: { chainId: number; token: string; symbol: string; available: string; locked: string }[] }>("/balances"),
  withdrawTyped: (qs: Record<string, string>) => api<{ typedData: TypedData }>(`/withdraw?${new URLSearchParams(qs)}`),
  withdraw: (json: unknown) => api<{ tx: string; feeSponsored: boolean }>("/withdraw", { method: "POST", json }),
  keys: () => api<{ keys: { id: string; prefix: string; label: string; address: string; createdAt: string; revokedAt: string | null }[] }>("/agents/keys"),
  createKey: (json: unknown) => api<{ key: string; prefix: string }>("/agents/keys", { method: "POST", json }),
  revokeKey: (id: string) => api<{ ok: boolean }>("/agents/keys", { method: "DELETE", json: { id } }),
  arbiterQueue: () => api<{ items: ArbiterItem[] }>("/arbiter/jobs"),
  stats: () => api<Stats>("/stats"),
};

export type Sig = { signer: string; deadline: string; signature: string };
export type TypedData = { domain: Record<string, unknown>; types: Record<string, { name: string; type: string }[]>; primaryType: string; message: Record<string, string> };
export type ArbiterItem = { job: JobDto; verdict: VerdictDto; disputes: { id: string; by: string; reason: string; createdAt: string; resolvedAt: string | null; workerBps: number | null }[]; evidence: { files: { name: string; sha256: string; url: string }[]; links: string[]; note: string } };
export type Stats = { created: number; funded: number; delivered: number; verified: number; settled: number; autoSettled: number; disputed: number; autoSettledPct: number | null; medianTimeToSettleSeconds: number | null; returningPayers: number };
