import { TOKENS, type ChainId } from "@vouch/shared";
import { appUrl, enabledChains } from "./env";

/**
 * MPP discovery document (mpp.dev/advanced/discovery): a standard OpenAPI 3.1 file served at `/openapi.json`
 * with `x-payment-info.offers[]` on paid operations and `x-service-info` at the root. Registries (MPPScan,
 * the mpp.dev services directory) aggregate it so agents can find Vouch before they ever hit the 402.
 *
 * The fund route is priced per job, so its offers carry `amount: null` (variable) — the runtime 402 Challenge
 * is authoritative for the exact amount, per the spec. One offer per enabled chain: tempo/charge on Tempo,
 * evm/charge (x402-compatible) on Base.
 */
export function discoveryDocument(): Record<string, unknown> {
  const chains = enabledChains().filter((c): c is ChainId => c in TOKENS);
  const offers = chains.flatMap((chainId) => {
    const tempo = chainId === 4217 || chainId === 42431;
    return TOKENS[chainId].map((t) => ({
      amount: null,
      currency: t.address,
      description: `${tempo ? "Tempo charge" : "x402 / EIP-3009 authorisation"} for the job amount in ${t.symbol}${tempo ? " (memo = jobId, fees sponsored)" : ""}`,
      intent: "charge",
      method: tempo ? "tempo" : "evm",
      ...(tempo ? {} : { chainId }),
    }));
  });
  const sig = {
    type: "object",
    properties: { signer: { type: "string" }, deadline: { type: "string" }, signature: { type: "string" } },
    required: ["signer", "deadline", "signature"],
  };
  const paid = { "402": { description: "Payment Required — MPP (Tempo) or x402 (Base) challenge" } };
  return {
    openapi: "3.1.0",
    info: {
      title: "Vouch",
      version: "0.1.0",
      description:
        "Pay per acceptable outcome, not per call. Lock stablecoins against a written scope, get an independent verification of the delivery, settle under the payer's policy. Tempo (MPP) and Base (x402).",
    },
    servers: [{ url: appUrl("/api/v1") }],
    "x-service-info": {
      categories: ["payments", "agents", "verification", "work"],
      docs: { homepage: appUrl("/"), apiReference: appUrl("/openapi.json"), llms: appUrl("/llms.txt") },
    },
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "vk_… key bound to an agent wallet (POST /agents/keys). Send as x-api-key so the MPP/x402 Payment credential can use Authorization." },
        privy: { type: "http", scheme: "bearer", description: "Privy access token (humans)." },
      },
      schemas: { ActionSignature: sig },
    },
    paths: {
      "/jobs": {
        post: {
          summary: "Create a job (lock a scope + amount; funding comes next)",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "scopeMd", "amount"],
                  properties: {
                    title: { type: "string" },
                    scopeMd: { type: "string" },
                    amount: { type: "string", description: "base units, 6 decimals" },
                    token: { type: "string" },
                    chainId: { type: "integer", enum: [4217, 42431, 8453, 84532] },
                    worker: { type: "string" },
                    policyPreset: { type: "string", enum: ["manual", "trusted", "autopilot", "custom"] },
                    policy: { type: "object" },
                    earnVault: { type: "string", description: "Tempo only: allow-listed Earn vault for 'Earn while locked' (see GET /earn/vaults)" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "jobId, commit, payUrl, mcpHint, fundRoutes, job" } },
        },
        get: { summary: "List my jobs", security: [{ apiKey: [] }], responses: { "200": { description: "jobs[]" } } },
      },
      "/jobs/{id}": { get: { summary: "Get a job (role-scoped)", responses: { "200": { description: "job" } } } },
      "/jobs/{id}/fund": {
        post: {
          summary: "Fund the job. 402 → pay (MPP charge on Tempo with memo = jobId; x402 EIP-3009 on Base) → 200 { status: 'Funded', tx }. Callers that already hold a Vouch balance are funded without payment.",
          "x-payment-info": { offers },
          responses: { "200": { description: "Funded: fund tx, payment tx, job" }, ...paid },
        },
        get: { summary: "Funding details: chain, token, amount, routes", responses: { "200": { description: "fund info" } } },
      },
      "/jobs/{id}/fund/eip3009": { post: { summary: "Base: relay a signed USDC ReceiveWithAuthorization, then fund", responses: { "200": { description: "Funded" } } } },
      "/jobs/{id}/fund/confirm": { post: { summary: "Confirm a wallet-side transaction (batched Tempo tx or plain transfer with memo)", responses: { "200": { description: "Funded" } } } },
      "/jobs/{id}/fund/batch": { get: { summary: "Calldata for a Tempo wallet's batched approve → deposit → createJob → fund", responses: { "200": { description: "batch params" } } } },
      "/jobs/{id}/sign": {
        get: {
          summary: "EIP-712 typed data for Submit | Resubmit | Settle | Dispute",
          parameters: [{ name: "action", in: "query" }, { name: "signer", in: "query" }, { name: "deliverableHash", in: "query" }, { name: "reason", in: "query" }],
          responses: { "200": { description: "typedData" } },
        },
      },
      "/jobs/{id}/submit": { post: { summary: "Deliver: files (base64, ≤ 2 MB each), links, note + signed Submit. Pins sha256 per file, queues the verifier.", responses: { "200": { description: "Submitted" } } } },
      "/jobs/{id}/resubmit": { post: { summary: "Resubmit after FAIL (max 2)", responses: { "200": { description: "Submitted" } } } },
      "/jobs/{id}/verdict": { get: { summary: "Verdict, confidence, scope checklist, evidence, questions, attestation tx, report URL", responses: { "200": { description: "verdict" } } } },
      "/jobs/{id}/approve": { post: { summary: "Payer releases payment (signed Settle)", responses: { "200": { description: "Settled" } } } },
      "/jobs/{id}/dispute": { post: { summary: "Open a dispute (signed Dispute)", responses: { "200": { description: "Disputed" } } } },
      "/jobs/{id}/resolve": { post: { summary: "Arbiter split", security: [{ apiKey: [] }], responses: { "200": { description: "Resolved" } } } },
      "/jobs/{id}/refund": { post: { summary: "refundExpired after the delivery deadline", responses: { "200": { description: "Refunded" } } } },
      "/jobs/{id}/timeline": { get: { summary: "Merged chain + service events", responses: { "200": { description: "events[]" } } } },
      "/jobs/{id}/events": { get: { summary: "Server-Sent Events: job + verdict snapshots", responses: { "200": { description: "text/event-stream" } } } },
      "/agents/keys": {
        post: { summary: "Issue an API key bound to a wallet (sign `Vouch API key for <address> at <ts>`)", responses: { "201": { description: "key" } } },
        get: { summary: "List keys", responses: { "200": { description: "keys[]" } } },
        delete: { summary: "Revoke a key", responses: { "200": { description: "ok" } } },
      },
      "/balances": { get: { summary: "Available / Locked per chain + token", security: [{ apiKey: [] }], responses: { "200": { description: "balances[]" } } } },
      "/withdraw": {
        get: { summary: "Typed data for Withdraw", responses: { "200": { description: "typedData" } } },
        post: { summary: "Relay withdrawWithSig (fee sponsored on Tempo)", responses: { "200": { description: "tx" } } },
      },
      "/earn/vaults": { get: { summary: "Curated Tempo Earn vaults a job may use (APY, venue, on-chain allow-list state)", responses: { "200": { description: "vaults[]" } } } },
      "/health": { get: { summary: "Chain heads, relayer balances, verifier queue", responses: { "200": { description: "health" } } } },
      "/stats": { get: { summary: "Public funnel numbers", responses: { "200": { description: "stats" } } } },
    },
  };
}

/** llms.txt (llmstxt.org): what an agent needs to know to use Vouch, in plain text. */
export function llmsTxt(): string {
  const base = appUrl("");
  return `# Vouch

> Pay per acceptable outcome, not per call. A payer (human or AI agent) locks stablecoins against a written scope; an independent verifier compares the delivery to that scope and writes an attestation on-chain; funds settle under the payer's policy or on approval; disputes go to an arbiter. Tempo (MPP) and Base (x402).

## Use it

- MCP: \`claude mcp add vouch -e VOUCH_API_URL=${base} -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @vouch/mcp\` (tools: vouch_create_job, vouch_fund_job, vouch_submit_delivery, vouch_get_verdict, vouch_approve, vouch_dispute, vouch_get_job, vouch_list_jobs; prompt: hire_for_task)
- HTTP: POST ${base}/api/v1/jobs → POST ${base}/api/v1/jobs/{id}/fund (402 → pay with mppx or any x402 client → 200 Funded)
- Discovery: ${base}/openapi.json (x-payment-info offers; amount is per job, the 402 is authoritative)

## Flow

1. Lock: POST /api/v1/jobs with title, scopeMd, amount (6-decimal base units), chainId (4217 Tempo, 8453 Base), policyPreset (manual | trusted | autopilot).
2. Fund: POST /api/v1/jobs/{id}/fund. Tempo: tempo/charge with memo = jobId, fees sponsored. Base: x402 EIP-3009 USDC.
3. Deliver: worker POSTs files/links/note with a signed EIP-712 Submit (GET /jobs/{id}/sign?action=Submit).
4. Verify: verifier attests PASS | NEEDS_REVIEW | FAIL with confidence and a per-item checklist; GET /jobs/{id}/verdict.
5. Settle: automatic under the payer's policy (verdict, confidence ≥ threshold, amount ≤ cap, after the review window) or POST /approve with a signed Settle. Dispute → arbiter split.

## Auth

- Agents: POST /api/v1/agents/keys with a wallet signature over "Vouch API key for <address> at <unix ts>"; send the key as x-api-key.
- Humans: Privy access token as Authorization: Bearer.

## Guarantees

- Files are sha256-pinned before review. Deliverables are treated as untrusted data; instruction-like text is flagged and confidence capped at 0.5.
- The verifier cannot move money. autoSettle reverts unless every policy predicate holds. Worst case for a payer: their own cap on one job.

## Links

- Docs: ${base}/docs
- OpenAPI: ${base}/openapi.json
- Source: https://github.com/big14way/vouch
`;
}
