import { z } from "zod";
import { PolicyWireSchema, POLICY_PRESET_NAMES } from "./policy.js";

export const HexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, "hex expected");
export const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "address expected");
export const Bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "bytes32 expected");
export const AmountSchema = z.string().regex(/^\d+$/, "base-unit amount expected");
export const ChainIdSchema = z.union([z.literal(4217), z.literal(42431), z.literal(8453), z.literal(84532)]);

// ---------------------------------------------------------------------------
// REST /v1/jobs
// ---------------------------------------------------------------------------

export const CreateJobInputSchema = z.object({
  title: z.string().min(3).max(120),
  scopeMd: z.string().min(10).max(20_000),
  /** Base units (6 decimals), as a string. */
  amount: AmountSchema,
  token: AddressSchema.optional(),
  chainId: ChainIdSchema.optional(),
  /** Email, 0x address, or agent URL. Optional: first submitter becomes the worker. */
  worker: z.string().max(200).optional(),
  policyPreset: z.enum(POLICY_PRESET_NAMES).optional(),
  policy: PolicyWireSchema.optional(),
  /** Seconds the pay link stays valid before the job is considered abandoned (off-chain only). */
  paymentDeadline: z.number().int().min(300).max(90 * 86_400).optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export const FundRouteSchema = z.object({
  kind: z.enum(["balance", "batched", "mpp", "x402", "eip3009", "transfer"]),
  label: z.string(),
  description: z.string(),
  /** Endpoint or address relevant to the route. */
  target: z.string(),
  memo: Bytes32Schema.optional(),
});
export type FundRoute = z.infer<typeof FundRouteSchema>;

export const JobDtoSchema = z.object({
  id: Bytes32Schema,
  shortId: z.string(),
  chainId: ChainIdSchema,
  title: z.string(),
  scopeMd: z.string(),
  scopeHash: Bytes32Schema,
  token: AddressSchema,
  tokenSymbol: z.string(),
  /** Visible to the payer, the worker, and after settlement; null for the public. */
  amount: AmountSchema.nullable(),
  payer: AddressSchema.nullable(),
  worker: AddressSchema.nullable(),
  workerHint: z.string().nullable(),
  status: z.string(),
  pill: z.string(),
  verdict: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]).nullable(),
  confidenceBps: z.number().nullable(),
  policy: PolicyWireSchema,
  fundedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  attestedAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  submitDeadlineAt: z.string().nullable(),
  autoSettleAt: z.string().nullable(),
  resubmits: z.number(),
  deliverableHash: Bytes32Schema.nullable(),
  attestationHash: Bytes32Schema.nullable(),
  txs: z.record(z.string(), z.string()),
  payUrl: z.string(),
  fundRoutes: z.array(FundRouteSchema),
  feeBps: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  role: z.enum(["payer", "worker", "arbiter", "public"]),
});
export type JobDto = z.infer<typeof JobDtoSchema>;

export const CreateJobOutputSchema = z.object({
  jobId: Bytes32Schema,
  shortId: z.string(),
  commit: Bytes32Schema,
  payUrl: z.string(),
  mcpHint: z.string(),
  fundRoutes: z.array(FundRouteSchema),
  job: JobDtoSchema,
});
export type CreateJobOutput = z.infer<typeof CreateJobOutputSchema>;

// ---------------------------------------------------------------------------
// /submit
// ---------------------------------------------------------------------------

export const SubmitFileSchema = z.object({
  name: z.string().min(1).max(200),
  contentType: z.string().max(100),
  /** base64 payload; ≤ 2 MB per artifact after decoding (spec §7.6). */
  base64: z.string().max(2_800_000),
});

export const SubmitInputSchema = z.object({
  files: z.array(SubmitFileSchema).max(20).default([]),
  links: z.array(z.string().url().max(500)).max(20).default([]),
  note: z.string().max(5000).default(""),
  /** Worker address; required when the job has no worker yet and the caller is an API key. */
  worker: AddressSchema.optional(),
  /** Optional pre-signed EIP-712 Submit/Resubmit so the relayer can pay gas. */
  signature: z.object({ signer: AddressSchema, deadline: z.string(), signature: HexSchema }).optional(),
});
export type SubmitInput = z.infer<typeof SubmitInputSchema>;

export const ActionSignatureSchema = z.object({ signer: AddressSchema, deadline: z.string(), signature: HexSchema });

export const DisputeInputSchema = z.object({
  reason: z.string().min(10).max(5000),
  signature: ActionSignatureSchema.optional(),
});

export const ApproveInputSchema = z.object({ signature: ActionSignatureSchema.optional() });

export const ResolveInputSchema = z.object({
  workerBps: z.number().int().min(0).max(10_000),
  note: z.string().max(5000).default(""),
});

// ---------------------------------------------------------------------------
// Verifier output (spec §7.6) — the only contract between the model and the chain
// ---------------------------------------------------------------------------

export const ScopeItemStatus = z.enum(["met", "partial", "missing", "unverifiable"]);

export const VerdictOutputSchema = z.object({
  verdict: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
  confidence: z.number().min(0).max(1),
  scope_items: z
    .array(
      z.object({
        item: z.string().min(1).max(500),
        status: ScopeItemStatus,
        evidence: z.string().max(2000),
      }),
    )
    .min(1)
    .max(50),
  summary: z.string().min(1).max(3000),
  questions_for_worker: z.array(z.string().max(500)).max(20).default([]),
  red_flags: z.array(z.string().max(500)).max(20).default([]),
});
export type VerdictOutput = z.infer<typeof VerdictOutputSchema>;

/** Full report persisted to storage; `attestationHash = keccak256(canonicalJson(report))`. */
export const VerdictReportSchema = VerdictOutputSchema.extend({
  version: z.literal(1),
  jobId: Bytes32Schema,
  deliverableHash: Bytes32Schema,
  scopeHash: Bytes32Schema,
  model: z.string(),
  promptHash: Bytes32Schema,
  responseHash: Bytes32Schema,
  contentHashes: z.array(Bytes32Schema),
  resubmission: z.number().int().min(0),
  createdAt: z.string(),
  /** Post-rule adjustments applied by the service (caps), for auditability. */
  adjustments: z.array(z.string()),
});
export type VerdictReport = z.infer<typeof VerdictReportSchema>;

export const VerdictDtoSchema = z.object({
  jobId: Bytes32Schema,
  verdict: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]).nullable(),
  confidence: z.number().nullable(),
  confidenceBps: z.number().nullable(),
  scope_items: VerdictOutputSchema.shape.scope_items.nullable(),
  summary: z.string().nullable(),
  questions_for_worker: z.array(z.string()),
  red_flags: z.array(z.string()),
  attestationTx: z.string().nullable(),
  attestationHash: Bytes32Schema.nullable(),
  reportUrl: z.string().nullable(),
  stage: z.enum(["queued", "reading_scope", "checking_files", "writing_report", "attesting", "done", "failed"]).nullable(),
  autoSettleAt: z.string().nullable(),
});
export type VerdictDto = z.infer<typeof VerdictDtoSchema>;

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const TimelineEventSchema = z.object({
  kind: z.string(),
  at: z.string(),
  txHash: z.string().nullable(),
  chainId: ChainIdSchema.nullable(),
  detail: z.string().nullable(),
  source: z.enum(["chain", "service"]),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ---------------------------------------------------------------------------
// Agent keys
// ---------------------------------------------------------------------------

export const CreateAgentKeyInputSchema = z.object({
  label: z.string().min(1).max(100),
  /** Wallet the key is bound to; actions are signed by this wallet (agent holds the private key). */
  address: AddressSchema,
  /** Signature over `Vouch API key for <address> at <timestamp>` proving control of the wallet. */
  timestamp: z.number().int(),
  signature: HexSchema,
});

export function agentKeyChallenge(address: string, timestamp: number): string {
  return `Vouch API key for ${address.toLowerCase()} at ${timestamp}`;
}

// ---------------------------------------------------------------------------
// Errors — every error says what happened and what to do next (spec §8.5)
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    next: z.string().optional(),
    retryable: z.boolean().default(false),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
