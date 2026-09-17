/**
 * Service-layer end-to-end against a running Vouch API (default http://localhost:3000) on Tempo Moderato.
 * This is the week-1 exit criterion of the spec driven through the REST API instead of raw contract calls:
 *
 *   payer agent:  API key from a wallet signature → POST /jobs → POST /fund (402 → mppx pays the Tempo charge
 *                 with memo = jobId → server attributes the deposit, creates + funds the job on the payer's behalf)
 *   worker agent: files sha256-pinned, EIP-712 Submit signed, POST /submit → verifier queued (runs if ANTHROPIC_API_KEY is set)
 *   payer agent:  GET /verdict (waits), then POST /approve (signed Settle, relayed) or the timelock auto-settles
 *   crons:        /api/cron/indexer and /api/cron/timelock are called with CRON_SECRET to prove the event path
 *
 * Env: contracts/.env.moderato (PAYER_*, WORKER_*), VOUCH_API_URL, CRON_SECRET (from apps/web/.env), optional APPROVE=0 to skip approval.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { VouchClient, loadConfig } from "@vouch/mcp";
import { formatAmount } from "@vouch/shared";

for (const f of ["../../contracts/.env.moderato", "../../apps/web/.env"]) {
  for (const line of readFileSync(resolve(import.meta.dirname, f), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.+)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
  }
}
const API = process.env.VOUCH_API_URL ?? "http://localhost:3000";
const CHAIN = 42431;
let failures = 0;
const check = (ok: boolean, msg: string) => { failures += ok ? 0 : 1; console.log(`   ${ok ? "✓" : "✗"} ${msg}`); };
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function cron(path: string) {
  const r = await fetch(`${API}/api/cron/${path}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const body = await r.json().catch(() => ({}));
  log(`cron/${path}`, r.status, JSON.stringify(body).slice(0, 300));
  return body as Record<string, unknown>;
}

async function main() {
  const payer = new VouchClient(loadConfig({ VOUCH_API_URL: API, VOUCH_AGENT_PRIVATE_KEY: process.env.PAYER_PRIVATE_KEY, VOUCH_DEFAULT_CHAIN: String(CHAIN) }));
  const worker = new VouchClient(loadConfig({ VOUCH_API_URL: API, VOUCH_AGENT_PRIVATE_KEY: process.env.WORKER_PRIVATE_KEY, VOUCH_DEFAULT_CHAIN: String(CHAIN) }));
  log("api", API, "payer", payer.address, "worker", worker.address);

  const health = await fetch(`${API}/api/v1/health`).then((r) => r.json()) as { ok: boolean; chains: Record<string, { vault?: boolean; error?: string }> };
  check(health.chains["42431"]?.vault === true, "health: vault configured on 42431");

  // 1. API key from the wallet (no login)
  const key = await payer.ensureApiKey();
  check(Boolean(key?.startsWith("vk_")), "payer got a wallet-bound API key");

  // 2. Lock
  const created = await payer.createJob({
    title: "Service e2e: 1-page brief", scopeMd: "## Deliverables\n- A one-page brief (≤ 500 words) in brief.md\n\n## Format\n- Markdown", amount: "5000000",
    chainId: CHAIN, policyPreset: "manual", worker: worker.address,
    earnVault: process.env.EARN_VAULT_42431 || undefined,
  });
  log("created", created.jobId, created.payUrl);
  check(created.job.status === "Open" && created.job.role === "payer", "job Open, caller is payer");
  if (process.env.EARN_VAULT_42431) check(created.job.policy.earnVault?.toLowerCase() === process.env.EARN_VAULT_42431.toLowerCase(), "job carries the Earn vault (earn while locked)");
  check(created.fundRoutes.some((r) => (r as { kind: string }).kind === "mpp"), "MPP fund route advertised");

  // 3. Fund via MPP (402 → mppx pays → 200)
  const funded = await payer.fundJob(created.jobId);
  log("funded", funded.status, "route", funded.route, "fundTx", funded.tx, "paymentTx", funded.paymentTx);
  check(funded.status === "Funded", "status Funded after one round-trip");
  check(funded.route === "mpp", "route was MPP");
  check(Boolean(funded.paymentTx), "payment tx recorded");

  // 4. Indexer sees the memo'd transfer + Funded event (idempotent with the service's own writes)
  const idx = await cron("indexer");
  check(typeof idx.chains === "object", "indexer cron ran");

  // 5. Deliver
  const dir = mkdtempSync(join(tmpdir(), "vouch-svc-"));
  const brief = join(dir, "brief.md");
  writeFileSync(brief, "# Brief\n\nThree findings and one recommendation per topic, under 500 words.\n\n## Late payment\n- 85% report late payment.\n- 29% of invoices are late.\n- Half of UK self-employed have done unpaid work.\n- Recommendation: lock funds first.\n");
  const submitted = await worker.submitDelivery(created.jobId, { files: [brief], links: [], note: "brief.md attached" });
  log("submitted", submitted.status, "tx", submitted.tx, "hash", submitted.deliverableHash);
  check(submitted.status === "Submitted", "status Submitted (relayed submitWithSig)");

  // 6. Verdict (only completes when ANTHROPIC_API_KEY is configured on the server)
  const hasModel = Boolean(process.env.ANTHROPIC_API_KEY);
  await cron("verifier");
  const verdict = await payer.waitForVerdict(created.jobId, hasModel ? 180_000 : 5_000);
  log("verdict", verdict.stage, verdict.verdict, verdict.confidence, verdict.attestationTx ?? "");
  if (hasModel) check(verdict.stage === "done" && Boolean(verdict.attestationTx), "verifier attested on-chain");
  else check(verdict.stage === "failed" || verdict.stage === "queued", "verifier queued/failed cleanly without a model key");

  // 7. Approve (payer signs Settle; relayer pays gas)
  if (process.env.APPROVE !== "0") {
    const approved = await payer.approve(created.jobId);
    log("approved", approved.status, "tx", approved.tx);
    check(approved.status === "Settled", "status Settled via settleWithSig");
    const job = (await worker.getJob(created.jobId)).job;
    check(job.amount === "5000000" && job.role === "worker", `worker sees the amount after settlement (${job.amount ? formatAmount(job.amount) : "hidden"})`);
  }

  const timeline = await payer.getTimeline(created.jobId);
  log("timeline events:", timeline.events.length);
  check(timeline.events.length >= 4, "timeline has created/funded/submitted/settled");
  await cron("timelock");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
