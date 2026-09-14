import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { Mppx, evm, tempo } from "mppx/client";
import { agentKeyChallenge, hashManifest, type DeliveryCore, type JobDto, type VerdictDto } from "@vouch/shared";
import type { Config } from "./config.js";

export class VouchError extends Error {
  constructor(message: string, public readonly code: string, public readonly next?: string) {
    super(message);
  }
}

const MIME: Record<string, string> = {
  ".md": "text/markdown", ".txt": "text/plain", ".json": "application/json", ".csv": "text/csv", ".html": "text/html",
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".js": "text/javascript", ".ts": "text/typescript", ".py": "text/x-python", ".sol": "text/plain", ".zip": "application/zip",
};

/** Thin REST client + payer wallet. Everything the MCP tools do goes through here. */
export class VouchClient {
  readonly account: PrivateKeyAccount | null;
  private apiKey: string | undefined;
  private payer: { fetch: typeof fetch } | null = null;

  constructor(readonly cfg: Config) {
    this.account = cfg.VOUCH_AGENT_PRIVATE_KEY ? privateKeyToAccount(cfg.VOUCH_AGENT_PRIVATE_KEY as Hex) : null;
    this.apiKey = cfg.VOUCH_API_KEY;
  }

  get address(): Address | null {
    return this.account?.address ?? null;
  }

  private url(path: string): string {
    return `${this.cfg.VOUCH_API_URL.replace(/\/$/, "")}/api/v1${path}`;
  }

  /** Issue an API key bound to the agent wallet on first use (no login: the wallet is the identity). */
  async ensureApiKey(): Promise<string | undefined> {
    if (this.apiKey) return this.apiKey;
    if (!this.account) return undefined;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await this.account.signMessage({ message: agentKeyChallenge(this.account.address, timestamp) });
    const res = await fetch(this.url("/agents/keys"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: `mcp ${new Date().toISOString().slice(0, 10)}`, address: this.account.address, timestamp, signature }),
    });
    const data = (await res.json()) as { key?: string; error?: { message: string } };
    if (!res.ok || !data.key) throw new VouchError(data.error?.message ?? "could not create API key", "key_error");
    this.apiKey = data.key;
    return this.apiKey;
  }

  async request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const key = await this.ensureApiKey();
    const res = await fetch(this.url(path), {
      method,
      // x-api-key (not Authorization) so the MPP `Authorization: Payment …` credential can coexist on /fund.
      headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string; next?: string } }).error;
      throw new VouchError(err?.message ?? `HTTP ${res.status}`, err?.code ?? `http_${res.status}`, err?.next);
    }
    return data as T;
  }

  // ---- jobs ----

  createJob(input: Record<string, unknown>) {
    return this.request<{ jobId: Hex; shortId: string; payUrl: string; mcpHint: string; fundRoutes: unknown[]; job: JobDto }>("POST", "/jobs", input);
  }

  getJob(id: string) {
    return this.request<{ job: JobDto }>("GET", `/jobs/${id}`);
  }

  listJobs(status?: string) {
    return this.request<{ jobs: JobDto[] }>("GET", `/jobs${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  }

  getVerdict(id: string) {
    return this.request<VerdictDto>("GET", `/jobs/${id}/verdict`);
  }

  getTimeline(id: string) {
    return this.request<{ events: unknown[] }>("GET", `/jobs/${id}/timeline`);
  }

  // ---- payments (MPP on Tempo, x402-compatible evm/charge on Base) ----

  private payerFetch(): typeof fetch {
    if (!this.account) throw new VouchError("VOUCH_AGENT_PRIVATE_KEY is not set.", "no_wallet", "Set VOUCH_AGENT_PRIVATE_KEY to a wallet holding pathUSD (Tempo) or USDC (Base).");
    if (!this.payer) {
      const max = this.cfg.VOUCH_MAX_PAYMENT;
      const mppx = Mppx.create({
        polyfill: false,
        methods: [tempo({ account: this.account }), evm({ account: this.account, maxAmount: max })],
      });
      this.payer = { fetch: mppx.fetch as typeof fetch };
    }
    return this.payer.fetch;
  }

  /** POST /fund. A 402 is paid automatically by mppx (Tempo charge or EIP-3009), then the 200 comes back. */
  async fundJob(id: string): Promise<{ status: string; route?: string; tx?: string; paymentTx?: string; job: JobDto; note?: string }> {
    const key = await this.ensureApiKey();
    const doFetch = this.payerFetch();
    const res = await doFetch(this.url(`/jobs/${id}/fund`), {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) },
      body: "{}",
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; route?: string; tx?: string; paymentTx?: string; job?: JobDto; note?: string; error?: { message?: string; code?: string; next?: string } };
    if (res.status === 402) throw new VouchError("Payment required but the wallet could not pay.", "payment_failed", "Check the agent wallet holds enough pathUSD/USDC on the job's chain, or set VOUCH_MAX_PAYMENT higher.");
    if (!res.ok || !data.job) throw new VouchError(data.error?.message ?? `HTTP ${res.status}`, data.error?.code ?? "fund_failed", data.error?.next);
    return { status: data.status ?? data.job.status, route: data.route, tx: data.tx, paymentTx: data.paymentTx, job: data.job, note: data.note };
  }

  // ---- signed actions ----

  private async signAction(id: string, action: "Submit" | "Resubmit" | "Settle" | "Dispute", params: Record<string, string>) {
    if (!this.account) throw new VouchError("VOUCH_AGENT_PRIVATE_KEY is not set.", "no_wallet");
    const qs = new URLSearchParams({ action, signer: this.account.address, ...params }).toString();
    const { typedData } = await this.request<{ typedData: { domain: Record<string, unknown>; types: Record<string, { name: string; type: string }[]>; primaryType: string; message: Record<string, string> } }>("GET", `/jobs/${id}/sign?${qs}`);
    const message = Object.fromEntries(Object.entries(typedData.message).map(([k, v]) => [k, k === "nonce" || k === "deadline" ? BigInt(v) : v]));
    const signature = await this.account.signTypedData({
      domain: typedData.domain, types: typedData.types, primaryType: typedData.primaryType, message,
    } as unknown as Parameters<PrivateKeyAccount["signTypedData"]>[0]);
    return { signer: this.account.address, deadline: typedData.message.deadline!, signature };
  }

  async submitDelivery(id: string, input: { files: string[]; links: string[]; note: string }, resubmit = false) {
    if (!this.account) throw new VouchError("VOUCH_AGENT_PRIVATE_KEY is not set.", "no_wallet");
    const files = [];
    const payload = [];
    for (const path of input.files) {
      const bytes = await readFile(path);
      const sha256 = `0x${createHash("sha256").update(bytes).digest("hex")}` as Hex;
      const contentType = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
      files.push({ name: basename(path), sha256, size: bytes.length, contentType });
      payload.push({ name: basename(path), contentType, base64: bytes.toString("base64") });
    }
    const core: DeliveryCore = { jobId: id as Hex, submittedBy: this.account.address, files, links: input.links, note: input.note };
    const deliverableHash = hashManifest(core);
    const signature = await this.signAction(id, resubmit ? "Resubmit" : "Submit", { deliverableHash });
    return this.request<{ status: string; tx: string; deliverableHash: Hex; verifier: { id: string; stage: string }; job: JobDto }>(
      "POST", `/jobs/${id}/${resubmit ? "resubmit" : "submit"}`,
      { files: payload, links: input.links, note: input.note, worker: this.account.address, signature },
    );
  }

  async approve(id: string) {
    const signature = await this.signAction(id, "Settle", {});
    return this.request<{ status: string; tx: string; job: JobDto }>("POST", `/jobs/${id}/approve`, { signature });
  }

  async dispute(id: string, reason: string) {
    const signature = await this.signAction(id, "Dispute", { reason });
    return this.request<{ status: string; tx: string; job: JobDto }>("POST", `/jobs/${id}/dispute`, { reason, signature });
  }

  /** Poll until the verifier is done (or a timeout). */
  async waitForVerdict(id: string, timeoutMs = 180_000, intervalMs = 5_000): Promise<VerdictDto> {
    const deadline = Date.now() + timeoutMs;
    let last: VerdictDto | null = null;
    while (Date.now() < deadline) {
      last = await this.getVerdict(id);
      if (last.stage === "done" || last.stage === "failed") return last;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return last ?? (await this.getVerdict(id));
  }
}
