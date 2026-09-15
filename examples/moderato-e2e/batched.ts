/**
 * Live on Tempo Moderato: fund a job in ONE fee-sponsored Tempo transaction from the payer's wallet.
 *
 *   calls = [ approve(vault, amount), deposit(token, amount), createJob(...), fund(jobId, amount, scopeHash, salt) ]
 *
 * Variant 1 — local sponsor: the Vouch feePayer key co-signs (`feePayer: account`). The payer's pathUSD moves by
 *             exactly the job amount; the fee is debited from the feePayer. This is what the web app's
 *             "Pay with Tempo wallet" does, with the sponsor behind a relay URL instead of a local key.
 * Variant 2 — public sponsor service: `feePayer: true` through `withRelay(http(rpc), http(sponsor))`
 *             (https://sponsor.moderato.tempo.xyz on testnet). Reported, not asserted: it is Tempo's service,
 *             with its own policy.
 *
 * Env: contracts/.env.moderato (PAYER_*, WORKER_*, FEEPAYER_*), optional RPC_URL, SPONSOR_URL.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, encodeFunctionData, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempoModerato } from "viem/chains";
import { createClient, withRelay } from "viem/tempo";
import { vaultAbi, tip20Abi, getAddresses } from "@vouch/abi";
import { computeCommit, hashScope, policyToStruct, randomBytes32, POLICY_PRESETS } from "@vouch/shared";

const RPC = process.env.RPC_URL ?? "https://rpc.moderato.tempo.xyz";
const SPONSOR = process.env.SPONSOR_URL ?? "https://sponsor.moderato.tempo.xyz";
const CHAIN_ID = 42431;
const PATHUSD: Address = "0x20C0000000000000000000000000000000000000";
const VAULT = getAddresses(CHAIN_ID, process.env).Vault as Address;
const AMOUNT = 5_000_000n;
const explorer = (h: Hex) => `https://explore.moderato.tempo.xyz/tx/${h}`;

for (const line of readFileSync(resolve(import.meta.dirname, "../../contracts/.env.moderato"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}
const key = (n: string) => privateKeyToAccount(process.env[`${n}_PRIVATE_KEY`] as Hex);
const payer = key("PAYER"), worker = key("WORKER"), feePayer = key("FEEPAYER");

const chain = { ...tempoModerato, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const bal = (who: Address) => pub.readContract({ address: PATHUSD, abi: tip20Abi, functionName: "balanceOf", args: [who] });
const jobStatus = (jobId: Hex) => pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "getJob", args: [jobId] }).then((j) => j.status);

let failures = 0;
const check = (ok: boolean, msg: string) => { failures += ok ? 0 : 1; console.log(`   ${ok ? "✓" : "✗"} ${msg}`); };

function fundCalls(jobId: Hex, salt: Hex, scopeHash: Hex) {
  const commit = computeCommit({ jobId, payer: payer.address, worker: worker.address, token: PATHUSD, amount: AMOUNT, scopeHash, salt });
  const policy = POLICY_PRESETS.trusted;
  return [
    { to: PATHUSD, data: encodeFunctionData({ abi: tip20Abi, functionName: "approve", args: [VAULT, AMOUNT] }) },
    { to: VAULT, data: encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [PATHUSD, AMOUNT] }) },
    { to: VAULT, data: encodeFunctionData({ abi: vaultAbi, functionName: "createJob", args: [jobId, commit, payer.address, worker.address, PATHUSD, policyToStruct(policy)] }) },
    { to: VAULT, data: encodeFunctionData({ abi: vaultAbi, functionName: "fund", args: [jobId, AMOUNT, scopeHash, salt] }) },
  ] as const;
}

async function variant1() {
  console.log("\n=== Variant 1: one batched tx, fee co-signed by the Vouch feePayer key ===");
  const jobId = randomBytes32(), salt = randomBytes32(), scopeHash = hashScope("## Deliverables\n- batched demo");
  const [p0, f0] = await Promise.all([bal(payer.address), bal(feePayer.address)]);
  const client = createClient({ account: payer, chain, transport: http(RPC) });
  const hash = await client.sendTransaction({ calls: fundCalls(jobId, salt, scopeHash), feePayer, gas: 3_000_000n } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${r.status === "success" ? "✔" : "✘"} batched approve→deposit→createJob→fund  ${explorer(hash)}  gas ${r.gasUsed}`);
  const [p1, f1] = await Promise.all([bal(payer.address), bal(feePayer.address)]);
  check(r.status === "success", "transaction succeeded");
  check((await jobStatus(jobId)) === 2, "job is Funded after a single transaction");
  check(p0 - p1 === AMOUNT, `payer pathUSD moved by exactly the job amount (${p0 - p1}); no fee charged to the payer`);
  check(f0 - f1 > 0n, `feePayer paid the fee: ${f0 - f1} pathUSD base units`);
  const tx = await pub.getTransaction({ hash });
  console.log(`   tx type ${tx.type} · from ${tx.from} · feePayer ${(tx as unknown as { feePayer?: Address }).feePayer ?? "(see explorer)"}`);
  return jobId;
}

async function variant2() {
  console.log(`\n=== Variant 2: same batch, sponsored by the public service ${SPONSOR} (reported, not asserted) ===`);
  const jobId = randomBytes32(), salt = randomBytes32(), scopeHash = hashScope("## Deliverables\n- batched demo 2");
  const p0 = await bal(payer.address);
  try {
    const client = createClient({ account: payer, chain, transport: withRelay(http(RPC), http(SPONSOR)) });
    const hash = await client.sendTransaction({ calls: fundCalls(jobId, salt, scopeHash), feePayer: true, gas: 3_000_000n } as never);
    const r = await pub.waitForTransactionReceipt({ hash });
    const p1 = await bal(payer.address);
    console.log(`${r.status === "success" ? "✔" : "✘"} sponsored by service  ${explorer(hash)}  gas ${r.gasUsed}  payer delta ${p0 - p1}  job status ${await jobStatus(jobId)}`);
  } catch (e) {
    console.log(`   service declined or unavailable: ${((e as Error).message.split("\n")[0] ?? "").slice(0, 200)}`);
  }
}

async function main() {
  console.log(`Vault ${VAULT} · payer ${payer.address} · feePayer ${feePayer.address}`);
  await variant1();
  await variant2();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
