import { json } from "@/lib/http";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Machine-readable API description for agents (spec §12 Docs). */
export function GET() {
  const base = appUrl("/api/v1");
  const sig = { type: "object", properties: { signer: { type: "string" }, deadline: { type: "string" }, signature: { type: "string" } }, required: ["signer", "deadline", "signature"] };
  return json({
    openapi: "3.1.0",
    info: { title: "Vouch API", version: "0.1.0", description: "Pay on verified delivery. Lock → deliver → verify → settle. Fund routes: MPP charge on Tempo, x402/EIP-3009 on Base." },
    servers: [{ url: base }],
    components: {
      securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "vk_… key bound to an agent wallet (POST /agents/keys). Also accepted as `Authorization: Bearer`; use x-api-key on /fund so the MPP/x402 Payment credential can use Authorization." }, privy: { type: "http", scheme: "bearer", description: "Privy access token (humans)." } },
      schemas: { ActionSignature: sig },
    },
    paths: {
      "/jobs": {
        post: { summary: "Create a job", requestBody: { content: { "application/json": { schema: { type: "object", required: ["title", "scopeMd", "amount"], properties: { title: { type: "string" }, scopeMd: { type: "string" }, amount: { type: "string", description: "base units, 6 decimals" }, token: { type: "string" }, chainId: { type: "integer", enum: [4217, 42431, 8453, 84532] }, worker: { type: "string" }, policyPreset: { type: "string", enum: ["manual", "trusted", "autopilot", "custom"] }, policy: { type: "object" } } } } } }, responses: { "201": { description: "jobId, commit, payUrl, mcpHint, fundRoutes, job" } } },
        get: { summary: "List my jobs", security: [{ apiKey: [] }] },
      },
      "/jobs/{id}": { get: { summary: "Get a job (role-scoped)" } },
      "/jobs/{id}/fund": { post: { summary: "Fund. 402 → pay (MPP on Tempo, x402 on Base) → 200 {status:'Funded', tx}. Balance holders skip payment." }, get: { summary: "Funding details and routes" } },
      "/jobs/{id}/fund/eip3009": { post: { summary: "Base: relay a signed USDC ReceiveWithAuthorization, then fund" } },
      "/jobs/{id}/fund/confirm": { post: { summary: "Confirm a wallet-side transaction (batched Tempo tx or plain transfer with memo)" } },
      "/jobs/{id}/sign": { get: { summary: "EIP-712 typed data for Submit | Resubmit | Settle | Dispute", parameters: [{ name: "action", in: "query" }, { name: "signer", in: "query" }, { name: "deliverableHash", in: "query" }, { name: "reason", in: "query" }] } },
      "/jobs/{id}/submit": { post: { summary: "Deliver: files (base64, ≤2MB each), links, note + signed Submit. Pins sha256 per file, queues the verifier." } },
      "/jobs/{id}/resubmit": { post: { summary: "Resubmit after FAIL (max 2)" } },
      "/jobs/{id}/verdict": { get: { summary: "Verdict, confidence, scope checklist, evidence, questions, attestation tx, report URL" } },
      "/jobs/{id}/approve": { post: { summary: "Payer releases payment (signed Settle)" } },
      "/jobs/{id}/dispute": { post: { summary: "Open a dispute (signed Dispute)" } },
      "/jobs/{id}/resolve": { post: { summary: "Arbiter split", security: [{ apiKey: [] }] } },
      "/jobs/{id}/refund": { post: { summary: "refundExpired after the delivery deadline" } },
      "/jobs/{id}/timeline": { get: { summary: "Merged chain + service events" } },
      "/jobs/{id}/events": { get: { summary: "Server-Sent Events: job + verdict snapshots" } },
      "/agents/keys": { post: { summary: "Issue an API key bound to a wallet (sign `Vouch API key for <address> at <ts>`)" }, get: { summary: "List keys" }, delete: { summary: "Revoke a key" } },
      "/balances": { get: { summary: "Available / Locked per chain + token", security: [{ apiKey: [] }] } },
      "/withdraw": { get: { summary: "Typed data for Withdraw" }, post: { summary: "Relay withdrawWithSig" } },
      "/health": { get: { summary: "Chain heads, relayer balances, verifier queue" } },
      "/stats": { get: { summary: "Public funnel numbers" } },
    },
  });
}
