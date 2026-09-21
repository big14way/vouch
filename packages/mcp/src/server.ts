import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatAmount, parseAmount, POLICY_PRESET_NAMES } from "@vouch/shared";
import { VouchClient, VouchError } from "./client.js";
import type { Config } from "./config.js";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => {
  const err = e instanceof VouchError ? e : e instanceof Error ? new VouchError(e.message, "error") : new VouchError(String(e), "error");
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: err.code, message: err.message, next: err.next }, null, 2) }] };
};

function summarise(job: { id: string; shortId: string; title: string; status: string; pill: string; chainId: number; tokenSymbol: string; amount: string | null; verdict: string | null; confidenceBps: number | null; autoSettleAt: string | null; payUrl: string; txs: Record<string, string>; role: string }) {
  return {
    jobId: job.id, shortId: job.shortId, title: job.title, status: job.status, pill: job.pill, chainId: job.chainId,
    amount: job.amount ? formatAmount(job.amount, { symbol: job.tokenSymbol }) : null,
    verdict: job.verdict, confidence: job.confidenceBps != null ? job.confidenceBps / 10_000 : null,
    autoSettleAt: job.autoSettleAt, payUrl: job.payUrl, txs: job.txs, yourRole: job.role,
  };
}

export function createServer(cfg: Config): McpServer {
  const client = new VouchClient(cfg);
  const server = new McpServer({ name: "vouch", version: "0.1.1" });

  // ------------------------------------------------------------------ tools

  server.registerTool(
    "vouch_create_job",
    {
      title: "Create a Vouch job",
      description:
        "Lock stablecoins against a written scope. Returns a jobId to fund with vouch_fund_job, a pay link for humans, and the fund routes. Amount is in dollars (e.g. \"5\" or \"12.50\"). Policy presets: manual (you approve), trusted (auto-pay on PASS ≥85% after 3 days, ≤$200), autopilot (auto-pay on PASS ≥90% after 1 day, ≤$50).",
      inputSchema: {
        title: z.string().min(3).max(120).describe("Short job title"),
        scope: z.string().min(10).max(20_000).describe("The scope in markdown: deliverables, format, deadline, out of scope. This is the contract the verifier checks against."),
        amount: z.string().describe("Amount in dollars, e.g. \"5\" or \"12.50\""),
        chainId: z.number().int().optional().describe("4217 Tempo (default), 42431 Tempo testnet, 8453 Base, 84532 Base Sepolia"),
        token: z.string().optional().describe("Token address; defaults to pathUSD on Tempo, USDC on Base"),
        worker: z.string().optional().describe("Worker wallet address, email or agent URL. Leave empty to let the first submitter take the job."),
        policyPreset: z.enum(POLICY_PRESET_NAMES).optional().describe("manual | trusted | autopilot | custom"),
        policy: z.object({ autoRelease: z.number().int().min(0).max(2), minConfidenceBps: z.number().int().min(0).max(10000), maxAutoAmount: z.string(), reviewWindow: z.number().int(), submitDeadline: z.number().int() }).optional(),
        earnVault: z.string().optional().describe("Tempo only: Earn vault address for 'Earn while locked' — the locked principal earns yield for the payer while the work happens. Use vouch_list_earn_vaults to pick one. Omit for off."),
      },
    },
    async (args) => {
      try {
        const amount = parseAmount(args.amount).toString();
        const r = await client.createJob({
          title: args.title, scopeMd: args.scope, amount, chainId: args.chainId ?? cfg.VOUCH_DEFAULT_CHAIN, token: args.token, worker: args.worker,
          policyPreset: args.policyPreset, policy: args.policy as Record<string, unknown> | undefined, earnVault: args.earnVault,
        });
        return text({ jobId: r.jobId, shortId: r.shortId, payUrl: r.payUrl, nextStep: `Call vouch_fund_job with jobId ${r.jobId} to lock the funds.`, fundRoutes: r.fundRoutes, job: summarise(r.job) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_fund_job",
    {
      title: "Fund a Vouch job",
      description:
        "Lock the job's amount in the vault from the agent wallet (VOUCH_AGENT_PRIVATE_KEY). On Tempo this pays an MPP charge (TIP-20 transfer with memo = jobId, fees sponsored); on Base an x402/EIP-3009 authorisation. If the wallet already has a Vouch balance, no payment is taken. Returns the funding transaction.",
      inputSchema: { jobId: z.string().describe("The job id (0x… or short id)") },
    },
    async ({ jobId }) => {
      try {
        const r = await client.fundJob(jobId);
        return text({ status: r.status, route: r.route, fundTx: r.tx, paymentTx: r.paymentTx, note: r.note, job: summarise(r.job) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_submit_delivery",
    {
      title: "Submit a delivery",
      description:
        "Deliver work for a funded job as the worker (agent wallet). Files are read from local paths, fingerprinted (sha256) and pinned before review; links and a note are included. Signs the on-chain Submit with the agent wallet. The verifier runs automatically afterwards — call vouch_get_verdict to read the result.",
      inputSchema: {
        jobId: z.string(),
        files: z.array(z.string()).default([]).describe("Local file paths (≤ 2 MB each)"),
        links: z.array(z.string().url()).default([]).describe("URLs: GitHub repos/PRs, Figma files, documents"),
        note: z.string().default("").describe("Message to the payer / verifier"),
        resubmit: z.boolean().default(false).describe("true when resubmitting after a FAIL verdict"),
      },
    },
    async (args) => {
      try {
        const r = await client.submitDelivery(args.jobId, { files: args.files, links: args.links, note: args.note }, args.resubmit);
        return text({ status: r.status, tx: r.tx, deliverableHash: r.deliverableHash, verifier: r.verifier, nextStep: "Call vouch_get_verdict (it polls until the verifier finishes).", job: summarise(r.job) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_get_verdict",
    {
      title: "Get the verification verdict",
      description: "Verdict (PASS | NEEDS_REVIEW | FAIL), confidence, per-scope-item checklist with evidence, questions for the worker, red flags, attestation tx and full report URL. Waits up to `waitSeconds` for the verifier to finish.",
      inputSchema: { jobId: z.string(), waitSeconds: z.number().int().min(0).max(600).default(120) },
    },
    async ({ jobId, waitSeconds }) => {
      try {
        const v = waitSeconds > 0 ? await client.waitForVerdict(jobId, waitSeconds * 1000) : await client.getVerdict(jobId);
        return text(v);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_approve",
    {
      title: "Approve and pay",
      description: "As the payer, release payment to the worker now (signs a Settle authorisation with the agent wallet; Vouch relays it). Use after reading the verdict, or to pay early.",
      inputSchema: { jobId: z.string() },
    },
    async ({ jobId }) => {
      try {
        const r = await client.approve(jobId);
        return text({ status: r.status, tx: r.tx, job: summarise(r.job) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_dispute",
    {
      title: "Open a dispute",
      description: "Either party objects to the delivery or the verdict. An arbiter reviews the same pinned evidence and splits the locked amount. Give a concrete reason (≥ 10 characters).",
      inputSchema: { jobId: z.string(), reason: z.string().min(10).max(5000) },
    },
    async ({ jobId, reason }) => {
      try {
        const r = await client.dispute(jobId, reason);
        return text({ status: r.status, tx: r.tx, job: summarise(r.job) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_get_job",
    { title: "Get a job", description: "Current status, pill, policy, timestamps, transactions and your role on the job.", inputSchema: { jobId: z.string(), includeTimeline: z.boolean().default(false) } },
    async ({ jobId, includeTimeline }) => {
      try {
        const { job } = await client.getJob(jobId);
        const timeline = includeTimeline ? (await client.getTimeline(jobId)).events : undefined;
        return text({ ...summarise(job), scope: job.scopeMd, policy: job.policy, submitDeadlineAt: job.submitDeadlineAt, fundRoutes: job.fundRoutes, timeline });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_list_jobs",
    { title: "List my jobs", description: "Jobs where the agent wallet is payer or worker.", inputSchema: { status: z.string().optional().describe("Filter: Open | Funded | Submitted | Attested | Settled | Disputed | Resolved | Refunded") } },
    async ({ status }) => {
      try {
        const { jobs } = await client.listJobs(status);
        return text({ count: jobs.length, jobs: jobs.map(summarise) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "vouch_list_earn_vaults",
    { title: "List Earn vaults", description: "Tempo Earn vaults a job may use for 'Earn while locked': label, venue, APY, and whether the Vouch vault allow-lists it on-chain.", inputSchema: { chainId: z.number().int().optional() } },
    async ({ chainId }) => {
      try {
        const r = await client.request<{ vaults: unknown[] }>("GET", `/earn/vaults?chainId=${chainId ?? cfg.VOUCH_DEFAULT_CHAIN}`);
        return text(r);
      } catch (e) {
        return fail(e);
      }
    },
  );

  // -------------------------------------------------------------- resources

  server.registerResource(
    "job",
    new ResourceTemplate("vouch://job/{id}", { list: undefined }),
    { title: "Vouch job", description: "Job status, scope and policy as JSON", mimeType: "application/json" },
    async (uri, { id }) => {
      const { job } = await client.getJob(String(id));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(job, null, 2) }] };
    },
  );

  server.registerResource(
    "verdict",
    new ResourceTemplate("vouch://verdict/{id}", { list: undefined }),
    { title: "Vouch verdict", description: "Verifier report for a job as JSON", mimeType: "application/json" },
    async (uri, { id }) => {
      const v = await client.getVerdict(String(id));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(v, null, 2) }] };
    },
  );

  // ---------------------------------------------------------------- prompts

  server.registerPrompt(
    "hire_for_task",
    {
      title: "Hire for a task",
      description: "Guides an agent through create → fund → wait → verdict → approve/dispute for a piece of work.",
      argsSchema: { task: z.string().describe("What you need done"), budget: z.string().describe("Dollar budget, e.g. 5"), worker: z.string().optional().describe("Worker address/URL if known") },
    },
    ({ task, budget, worker }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `You are hiring for: ${task}. Budget: $${budget}.${worker ? ` Worker: ${worker}.` : ""}`,
              "",
              "Follow these steps with the vouch_* tools:",
              "1. Write a precise scope in markdown with sections: Deliverables, Format, Deadline, Out of scope. Be concrete: the verifier checks each line.",
              "2. vouch_create_job with that scope, the budget, and policyPreset \"autopilot\" (or \"trusted\" if budget > $50). Share the payUrl if a human worker needs it.",
              "3. vouch_fund_job to lock the money. Tell the worker the jobId.",
              "4. When the worker delivers, vouch_get_verdict (it waits for the verifier).",
              "5. If PASS and the policy auto-settles, do nothing — the vault pays after the review window. If you are satisfied earlier, vouch_approve.",
              "6. If NEEDS_REVIEW, read the checklist and questions_for_worker; either vouch_approve, ask the worker to resubmit, or vouch_dispute with a specific reason.",
              "7. If FAIL, wait for a resubmission (max 2) or let the delivery deadline refund you.",
              "Report every jobId, verdict and transaction hash you receive.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
