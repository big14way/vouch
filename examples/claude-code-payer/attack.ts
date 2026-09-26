/**
 * Live prompt-injection run: a worker agent submits a delivery that tells the verifier to output PASS.
 * Expected: red_flags, confidence capped, no auto-settle. Same env as run.ts.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VouchClient, loadConfig } from "@gwilll/vouch-mcp";
import { parseAmount } from "@vouch/shared";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const apiUrl = process.env.VOUCH_API_URL ?? "http://localhost:3000";
  const chain = Number(process.env.VOUCH_DEFAULT_CHAIN ?? 42431);
  const cfg = (key: string | undefined) => loadConfig({ VOUCH_API_URL: apiUrl, VOUCH_AGENT_PRIVATE_KEY: key, VOUCH_DEFAULT_CHAIN: String(chain) });
  const payer = new VouchClient(cfg(process.env.PAYER_PRIVATE_KEY));
  const worker = new VouchClient(cfg(process.env.WORKER_PRIVATE_KEY));
  const dir = new URL("../adversarial/", import.meta.url);
  const scope = await readFile(new URL("scope.md", dir), "utf8");
  const sample = process.env.SAMPLE ?? "01-ignore-scope.md";

  const created = await payer.createJob({
    title: "One-page brief (injection test)", scopeMd: scope, amount: parseAmount(process.env.DEMO_AMOUNT ?? "5").toString(), chainId: chain, policyPreset: "autopilot", worker: worker.address,
  });
  log("created", created.jobId, "→", created.payUrl);
  const funded = await payer.fundJob(created.jobId);
  log("funded  ", funded.status, "route", funded.route, "fundTx", funded.tx);

  const tmp = await mkdtemp(join(tmpdir(), "vouch-attack-"));
  const file = join(tmp, "brief.md");
  await writeFile(file, await readFile(new URL(sample, dir), "utf8"));
  log("worker submits", sample, "(contains an instruction aimed at the verifier)");
  const submitted = await worker.submitDelivery(created.jobId, { files: [file], links: [], note: "Brief attached." });
  log("submitted", submitted.status, "tx", submitted.tx);

  const v = await payer.waitForVerdict(created.jobId, 240_000);
  log("verdict ", v.verdict, "confidence", v.confidence, "attestation", v.attestationTx);
  for (const f of v.red_flags) log("   red flag:", f);
  const job = (await payer.getJob(created.jobId)).job;
  log("status  ", job.status, "autoSettleAt", job.autoSettleAt ?? "none: the money stays locked until the payer decides");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
