/**
 * Unattended agent-to-agent demo (spec §10 week 2 exit, §13 step 2).
 *
 *   PAYER agent: creates "Write a 1-page brief on three topics", $5, Autopilot → funds via MPP (Tempo) / x402 (Base).
 *   WORKER agent: writes the brief, submits it (files pinned, Submit signed).
 *   Vouch verifier: attests PASS/NEEDS_REVIEW/FAIL on-chain.
 *   Vault: after the review window the timelock cron calls autoSettle. No human clicks.
 *
 * Env: VOUCH_API_URL, PAYER_PRIVATE_KEY, WORKER_PRIVATE_KEY, VOUCH_DEFAULT_CHAIN (4217 | 42431 | 8453 | 84532), DEMO_AMOUNT (default 5)
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VouchClient, loadConfig } from "@gwilll/vouch-mcp";
import { formatAmount, parseAmount } from "@vouch/shared";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const apiUrl = process.env.VOUCH_API_URL ?? "http://localhost:3000";
  const chain = Number(process.env.VOUCH_DEFAULT_CHAIN ?? 42431);
  const payerKey = process.env.PAYER_PRIVATE_KEY;
  const workerKey = process.env.WORKER_PRIVATE_KEY;
  if (!payerKey || !workerKey) throw new Error("Set PAYER_PRIVATE_KEY and WORKER_PRIVATE_KEY (wallets funded with pathUSD on Tempo or USDC on Base).");

  const payer = new VouchClient(loadConfig({ VOUCH_API_URL: apiUrl, VOUCH_AGENT_PRIVATE_KEY: payerKey, VOUCH_DEFAULT_CHAIN: String(chain) }));
  const worker = new VouchClient(loadConfig({ VOUCH_API_URL: apiUrl, VOUCH_AGENT_PRIVATE_KEY: workerKey, VOUCH_DEFAULT_CHAIN: String(chain) }));
  log("payer ", payer.address, "worker", worker.address, "chain", chain);

  // 1. Lock
  const amount = parseAmount(process.env.DEMO_AMOUNT ?? "5");
  const scope = `## Deliverables
- A brief (≤ 500 words) on three topics: late payment in freelance work, agent-to-agent commerce on Tempo, and x402.
- Each topic gets a heading, three bullet findings, and one recommendation.

## Format
- One Markdown file named brief.md.`;
  const created = await payer.createJob({
    title: "Write a 1-page brief on three topics", scopeMd: scope, amount: amount.toString(), chainId: chain, policyPreset: "autopilot", worker: worker.address,
  });
  log("created", created.jobId, "→", created.payUrl);

  // 2. Fund (402 → pay → 200)
  const funded = await payer.fundJob(created.jobId);
  log("funded  ", funded.status, "route", funded.route, "fundTx", funded.tx, "paymentTx", funded.paymentTx);

  // 3. Worker delivers
  const dir = await mkdtemp(join(tmpdir(), "vouch-demo-"));
  const brief = join(dir, "brief.md");
  await writeFile(
    brief,
    `# Brief

## Late payment in freelance work
- 85% of freelancers report late payment (Remote, 2025); 29% of invoices are paid late (Bonsai, 100k users, 3 years).
- Non-payment concentrates in small buyers citing "dissatisfaction with deliverables" — a scope dispute without a referee.
- Half of UK self-employed have completed work they were never paid for (IPSE).
- Recommendation: lock funds against a written scope before work starts.

## Agent-to-agent commerce on Tempo
- Tempo's Machine Payments Protocol charges per request with a 402 challenge; settlement is a TIP-20 transfer in ~0.5 s.
- 85+ services list in the MPP directory; all are pay-first.
- Fee sponsorship and batched transactions let a payer act with one signature and no gas token.
- Recommendation: add a verification step between payment and access for outcome-priced work.

## x402
- Coinbase's x402 gates HTTP resources behind USDC EIP-3009 authorisations settled by a facilitator.
- It answers "pay per call", not "pay per acceptable outcome".
- Base USDC supports receiveWithAuthorization, so payers never need ETH.
- Recommendation: use x402 as the funding rail, Vouch as the conditional layer.
`,
  );
  const submitted = await worker.submitDelivery(created.jobId, { files: [brief], links: [], note: "Brief attached as brief.md, 3 sections, ≤ 500 words." });
  log("submitted", submitted.status, "tx", submitted.tx, "deliverableHash", submitted.deliverableHash);

  // 4. Verdict
  const verdict = await payer.waitForVerdict(created.jobId, 240_000);
  log("verdict ", verdict.verdict, "confidence", verdict.confidence, "attestation", verdict.attestationTx);
  for (const it of verdict.scope_items ?? []) log("   ", it.status.padEnd(12), it.item);
  if (verdict.red_flags.length) log("   flags", verdict.red_flags);

  // 5. Settle: Autopilot → the timelock cron calls autoSettle after the review window; nothing to click.
  const job = (await payer.getJob(created.jobId)).job;
  log("status  ", job.status, "autoSettleAt", job.autoSettleAt ?? "(not eligible — payer reviews)");
  log(`done: ${formatAmount(amount)} locked → delivered → ${verdict.verdict}. ${job.autoSettleAt ? "Pays automatically at " + job.autoSettleAt : "Awaiting payer approval."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
