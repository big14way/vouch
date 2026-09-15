/**
 * Live end-to-end on Tempo Moderato against the deployed Vault (spec §10 week-1 exit criterion).
 *
 * Job A — wallet path:   payer approve → deposit → createJob → fund; worker submit; verifier attest PASS;
 *                        anyone autoSettle (Autopilot, reviewWindow 0); worker withdraw pathUSD.
 * Job B — memo path:     payer transferWithMemo(vault, amount, memo = jobId) → surplus; intake attributeDeposit,
 *                        createJob + fund on the payer's behalf; open worker submits; verifier NEEDS_REVIEW;
 *                        payer signs EIP-712 Settle, relayer sends settleWithSig (gasless for the payer).
 *
 * Env: contracts/.env.moderato (PAYER_*, WORKER_*, VERIFIER_*, INTAKE_*, RELAYER_* keys), optional RPC_URL.
 * Every step prints an explorer link. Exit code 1 on any mismatch.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempoModerato } from "viem/chains";
import { vaultAbi, tip20Abi, getAddresses } from "@vouch/abi";
import { computeCommit, hashScope, jobMemo, randomBytes32, vaultDomain, VaultTypes, ZERO_ADDRESS, POLICY_PRESETS, type Policy } from "@vouch/shared";

const RPC = process.env.RPC_URL ?? "https://rpc.moderato.tempo.xyz";
const CHAIN_ID = 42431;
const PATHUSD: Address = "0x20C0000000000000000000000000000000000000";
const VAULT = getAddresses(CHAIN_ID, process.env).Vault as Address;
if (!VAULT) throw new Error("Vault address for 42431 missing in packages/abi/addresses.json");

// Load contracts/.env.moderato if the keys are not already in the environment.
for (const line of readFileSync(resolve(import.meta.dirname, "../../contracts/.env.moderato"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}
const key = (name: string) => {
  const v = process.env[`${name}_PRIVATE_KEY`];
  if (!v) throw new Error(`${name}_PRIVATE_KEY not set`);
  return privateKeyToAccount(v as Hex);
};
const payer = key("PAYER"), worker = key("WORKER"), verifier = key("VERIFIER"), intake = key("INTAKE"), relayer = key("RELAYER");

const chain = { ...tempoModerato, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = (account: ReturnType<typeof privateKeyToAccount>) => createWalletClient({ account, chain, transport: http(RPC) });

const AMOUNT = 5_000_000n; // $5
const explorer = (h: Hex) => `https://explore.moderato.tempo.xyz/tx/${h}`;
let failures = 0;
/** Gas paid per account, in pathUSD base units: on Tempo fees are charged in the fee token (6 decimals); gasUsed × price is 18-decimal. */
const gasPaid = new Map<Address, bigint>();
const check = (cond: boolean, msg: string) => { if (!cond) { failures++; console.log(`   ✗ ${msg}`); } else console.log(`   ✓ ${msg}`); };

async function tx(label: string, account: ReturnType<typeof privateKeyToAccount>, address: Address, abi: typeof vaultAbi | typeof tip20Abi, functionName: string, args: unknown[], gas = 1_500_000n): Promise<Hex> {
  const hash = await wallet(account).writeContract({ address, abi: abi as never, functionName: functionName as never, args: args as never, gas });
  const r = await pub.waitForTransactionReceipt({ hash });
  // Tempo debits ceil(gasUsed × effectiveGasPrice / 1e12) pathUSD base units per transaction.
  gasPaid.set(account.address, (gasPaid.get(account.address) ?? 0n) + (r.gasUsed * r.effectiveGasPrice + 10n ** 12n - 1n) / 10n ** 12n);
  console.log(`${r.status === "success" ? "✔" : "✘"} ${label.padEnd(34)} ${explorer(hash)}  gas ${r.gasUsed}`);
  if (r.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  return hash;
}
const read = <T,>(functionName: string, args: unknown[] = []) => pub.readContract({ address: VAULT, abi: vaultAbi, functionName: functionName as never, args: args as never }) as Promise<T>;
const tokenBal = (who: Address) => pub.readContract({ address: PATHUSD, abi: tip20Abi, functionName: "balanceOf", args: [who] });

async function jobA() {
  console.log("\n=== Job A: wallet path, Autopilot, autoSettle, withdraw ===");
  const jobId = randomBytes32();
  const salt = randomBytes32();
  const scopeHash = hashScope("## Deliverables\n- 1-page brief");
  const policy: Policy = { ...POLICY_PRESETS.autopilot, reviewWindow: 0 };
  const commit = computeCommit({ jobId, payer: payer.address, worker: worker.address, token: PATHUSD, amount: AMOUNT, scopeHash, salt });
  const workerBefore = await tokenBal(worker.address);
  gasPaid.set(worker.address, 0n);

  await tx("approve(vault)", payer, PATHUSD, tip20Abi, "approve", [VAULT, AMOUNT], 400_000n);
  await tx("deposit", payer, VAULT, vaultAbi, "deposit", [PATHUSD, AMOUNT]);
  check((await read<bigint>("balances", [PATHUSD, payer.address])) >= AMOUNT, "payer vault balance credited");
  await tx("createJob", payer, VAULT, vaultAbi, "createJob", [jobId, commit, payer.address, worker.address, PATHUSD, policy]);
  await tx("fund", payer, VAULT, vaultAbi, "fund", [jobId, AMOUNT, scopeHash, salt]);
  let job = await read<{ status: number; verdict: number; confidenceBps: number }>("getJob", [jobId]);
  check(job.status === 2, "status Funded");

  const deliverable = keccak256(toHex("manifest A"));
  await tx("submit (worker)", worker, VAULT, vaultAbi, "submit", [jobId, deliverable]);
  const report = keccak256(toHex("report A"));
  await tx("attest PASS 95% (verifier)", verifier, VAULT, vaultAbi, "attest", [jobId, 1, 9500, report]);
  job = await read<{ status: number; verdict: number; confidenceBps: number }>("getJob", [jobId]);
  check(job.status === 4 && job.verdict === 1 && job.confidenceBps === 9500, "status Attested, PASS, 9500 bps");
  const [ok] = await read<[boolean, Hex]>("canAutoSettle", [jobId, AMOUNT]);
  check(ok, "canAutoSettle is true (autopilot, reviewWindow 0)");
  await tx("autoSettle (relayer)", relayer, VAULT, vaultAbi, "autoSettle", [jobId, AMOUNT, scopeHash, salt]);
  const fee = AMOUNT / 100n;
  const workerCredit = await read<bigint>("balances", [PATHUSD, worker.address]);
  check(workerCredit >= AMOUNT - fee, `worker credited ${AMOUNT - fee} (amount − 1% fee)`);
  await tx("withdraw (worker)", worker, VAULT, vaultAbi, "withdraw", [PATHUSD, AMOUNT - fee, worker.address]);
  const workerAfter = await tokenBal(worker.address);
  const workerGas = gasPaid.get(worker.address) ?? 0n;
  check(workerAfter - workerBefore === AMOUNT - fee - workerGas, `worker pathUSD delta ${workerAfter - workerBefore} = payout ${AMOUNT - fee} − gas ${workerGas} (fees paid in pathUSD) on the real token`);
  const vaultBal = await tokenBal(VAULT);
  const accounted = await read<bigint>("accounted", [PATHUSD]);
  check(vaultBal >= accounted, `solvency: vault holds ${vaultBal} ≥ accounted ${accounted}`);
  return jobId;
}

async function jobB() {
  console.log("\n=== Job B: memo transfer → intake attribution → open worker → NEEDS_REVIEW → relayed settle ===");
  const jobId = randomBytes32();
  const salt = randomBytes32();
  const scopeHash = hashScope("## Deliverables\n- logo redesign");
  const policy: Policy = POLICY_PRESETS.manual;
  const surplusBefore = await read<bigint>("surplus", [PATHUSD]);

  const memoTx = await tx("transferWithMemo(vault, memo=jobId)", payer, PATHUSD, tip20Abi, "transferWithMemo", [VAULT, AMOUNT, jobMemo(jobId)], 400_000n);
  check((await read<bigint>("surplus", [PATHUSD])) - surplusBefore === AMOUNT, "memo transfer shows as unattributed surplus");
  const ref = keccak256(toHex(`${memoTx}:0`));
  await tx("attributeDeposit (intake)", intake, VAULT, vaultAbi, "attributeDeposit", [PATHUSD, payer.address, AMOUNT, ref]);
  check((await read<bigint>("balances", [PATHUSD, payer.address])) >= AMOUNT, "payer credited from surplus");

  const commit = computeCommit({ jobId, payer: payer.address, worker: ZERO_ADDRESS, token: PATHUSD, amount: AMOUNT, scopeHash, salt });
  await tx("createJob on payer's behalf (intake)", intake, VAULT, vaultAbi, "createJob", [jobId, commit, payer.address, ZERO_ADDRESS, PATHUSD, policy]);
  await tx("fund on payer's behalf (intake)", intake, VAULT, vaultAbi, "fund", [jobId, AMOUNT, scopeHash, salt]);
  await tx("submit (open worker)", worker, VAULT, vaultAbi, "submit", [jobId, keccak256(toHex("manifest B"))]);
  let job = await read<{ status: number; worker: Address }>("getJob", [jobId]);
  check(job.worker.toLowerCase() === worker.address.toLowerCase(), "first submitter became the worker");
  await tx("attest NEEDS_REVIEW 60% (verifier)", verifier, VAULT, vaultAbi, "attest", [jobId, 2, 6000, keccak256(toHex("report B"))]);
  const [ok] = await read<[boolean, Hex]>("canAutoSettle", [jobId, AMOUNT]);
  check(!ok, "manual policy: autoSettle not permitted");

  // Payer approves without paying gas: EIP-712 Settle, relayed.
  const nonce = await read<bigint>("nonces", [payer.address]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const signature = await wallet(payer).signTypedData({
    domain: vaultDomain(CHAIN_ID, VAULT), types: { Settle: VaultTypes.Settle }, primaryType: "Settle", message: { jobId, nonce, deadline },
  });
  await tx("settleWithSig (relayer, payer signed)", relayer, VAULT, vaultAbi, "settleWithSig", [jobId, AMOUNT, scopeHash, salt, payer.address, deadline, signature]);
  job = await read<{ status: number; worker: Address }>("getJob", [jobId]);
  check(job.status === 5, "status Settled");
  check((await read<bigint>("nonces", [payer.address])) === nonce + 1n, "payer nonce consumed");
  return jobId;
}

async function main() {
  console.log(`Vault ${VAULT} on Tempo Moderato (${RPC})`);
  console.log(`payer ${payer.address} · worker ${worker.address} · verifier ${verifier.address} · intake ${intake.address} · relayer ${relayer.address}`);
  const a = await jobA();
  const b = await jobB();
  console.log(`\njobs: A ${a}\n      B ${b}`);
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
