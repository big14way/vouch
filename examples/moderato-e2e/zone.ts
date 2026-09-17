/**
 * Live on Tempo Moderato: private payout into Tempo Zone A (F12, testnet-only).
 *
 *   1. worker has an available balance in the Vault (deposit here; in production it is a settled payout)
 *   2. encrypt the recipient (worker) + memo for the zone sequencer with `sender = Vault`; Zone A's portal is a
 *      legacy build (no sender binding, 4-arg depositEncrypted) so the Vault's `legacyZonePortal` flag picks the scheme
 *   3. Vault.withdrawToZone → ZonePortal.depositEncrypted: public chain shows Vault → Portal + amount only
 *   4. read the worker's private balance on Zone A with a signed authorisation token (401 without it)
 *
 * Env: contracts/.env.moderato (WORKER_*), optional RPC_URL, ZONE_ID (6).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, createPublicClient, decodeEventLog, encodeAbiParameters, http, keccak256, parseAbiItem, toEventSelector, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempoModerato } from "viem/chains";
import { Actions, Abis } from "viem/tempo";
import { vaultAbi, tip20Abi, getAddresses } from "@vouch/abi";
import { ENCRYPTED_PAYLOAD_ABI, encryptZoneRecipient, zonesFor } from "@vouch/shared";

const RPC = process.env.RPC_URL ?? "https://rpc.moderato.tempo.xyz";
const CHAIN_ID = 42431;
const PATHUSD: Address = "0x20C0000000000000000000000000000000000000";
const VAULT = getAddresses(CHAIN_ID, process.env).Vault as Address;
const ZONE = zonesFor(CHAIN_ID).find((z) => z.zoneId === Number(process.env.ZONE_ID ?? 6))!;
const AMOUNT = 2_000_000n; // $2
const explorer = (h: Hex) => `https://explore.moderato.tempo.xyz/tx/${h}`;
// Older portal builds (Moderato Zone A, Sept 2026) emit `EncryptedDepositMade` (selector 0x98f4c0a3) without
// `tempoRefundRecipient`/`depositNumber`; current builds emit `DepositMade` per viem's ABI. Match by selector.
const DEPOSIT_MADE_SHAPES = [
  ...Abis.zonePortal.filter((x) => x.type === "event" && x.name === "DepositMade"),
  parseAbiItem("event EncryptedDepositMade(bytes32 indexed newCurrentDepositQueueHash, address indexed sender, address token, uint128 netAmount, uint128 fee, uint256 keyIndex, bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag)"),
] as const;

for (const line of readFileSync(resolve(import.meta.dirname, "../../contracts/.env.moderato"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}
const worker = privateKeyToAccount(process.env.WORKER_PRIVATE_KEY as Hex);
const chain = { ...tempoModerato, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createClient({ account: worker, chain, transport: http(RPC) });
let failures = 0;
const check = (ok: boolean, msg: string) => { failures += ok ? 0 : 1; console.log(`   ${ok ? "✓" : "✗"} ${msg}`); };

async function tx(label: string, address: Address, abi: typeof vaultAbi | typeof tip20Abi, functionName: string, args: unknown[], gas = 3_000_000n) {
  const { writeContract } = await import("viem/actions");
  const hash = await writeContract(wallet, { address, abi: abi as never, functionName: functionName as never, args: args as never, gas, account: worker, chain } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${r.status === "success" ? "✔" : "✘"} ${label.padEnd(40)} ${explorer(hash)}  gas ${r.gasUsed}`);
  if (r.status !== "success") throw new Error(`${label} reverted`);
  return r;
}

async function main() {
  console.log(`Vault ${VAULT} · worker ${worker.address} · ${ZONE.name} portal ${ZONE.portal} (zone chain ${ZONE.chainId})`);
  check(await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "allowedZonePortal", args: [ZONE.portal] }), "portal allow-listed on the Vault");
  const portalInfo = await Actions.zone.getPortalInfo(pub, { zoneId: ZONE.zoneId, portalAddress: ZONE.portal }).catch(() => null);
  console.log("   portal info:", portalInfo ? JSON.stringify(portalInfo, (_k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 200) : "(getPortalInfo unavailable on this portal version)");

  // 1. available balance (stands in for a settled payout)
  await tx("approve(vault)", PATHUSD, tip20Abi, "approve", [VAULT, AMOUNT], 400_000n);
  await tx("deposit → available balance", VAULT, vaultAbi, "deposit", [PATHUSD, AMOUNT]);

  // 2. encrypted recipient bound to the Vault as portal caller (legacy scheme if the portal predates the binding)
  const legacy = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "legacyZonePortal", args: [ZONE.portal] });
  const { keyIndex, publicKey } = await Actions.zone.getEncryptionKey(pub, { zoneId: ZONE.zoneId, portalAddress: ZONE.portal });
  const enc = await encryptZoneRecipient({ sequencerKey: publicKey, recipient: worker.address, sender: VAULT, portal: ZONE.portal, keyIndex, legacy });
  const payloadHash = keccak256(encodeAbiParameters(ENCRYPTED_PAYLOAD_ABI, [enc]));
  console.log(`   encrypted recipient prepared (${legacy ? "legacy" : "current"} scheme): keyIndex ${keyIndex}, ciphertext ${enc.ciphertext.length / 2 - 1} bytes, payload hash ${payloadHash.slice(0, 18)}…`);

  // zone client (authenticated) so the private balance can be read before and after the payout
  const noAuth = await fetch(ZONE.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
  check(noAuth.status === 401, `zone RPC refuses unauthenticated reads (HTTP ${noAuth.status})`);
  // the token embeds the chain id it is valid for: sign it for the zone chain, not the Tempo L1
  const zoneChain = { ...tempoModerato, id: ZONE.chainId, name: ZONE.name, rpcUrls: { default: { http: [ZONE.rpcUrl] } } };
  const { token: authToken } = await Actions.zone.signAuthorizationToken(wallet, { zoneId: ZONE.zoneId, chain: zoneChain });
  const zone = createPublicClient({ chain: zoneChain, transport: http(ZONE.rpcUrl, { fetchOptions: { headers: { "X-Authorization-Token": authToken } } }) });
  console.log(`   zone chain id (authenticated): ${await zone.getChainId().catch((e) => "error " + (e as Error).message.slice(0, 80))}`);
  const readZoneBal = () => zone.readContract({ address: PATHUSD, abi: tip20Abi, functionName: "balanceOf", args: [worker.address], account: worker.address }).catch(() => null);
  const zoneBefore = (await readZoneBal()) ?? 0n;
  console.log(`   worker's private ${ZONE.name} balance before: ${zoneBefore}`);

  // 3. private payout
  const feeBefore = await pub.readContract({ address: ZONE.portal, abi: Abis.zonePortal, functionName: "calculateDepositFee" }).catch(() => 0n);
  const portalBefore = await pub.readContract({ address: PATHUSD, abi: tip20Abi, functionName: "balanceOf", args: [ZONE.portal] });
  const r = await tx(`withdrawToZone → portal.depositEncrypted${legacy ? " (legacy shape)" : ""}`, VAULT, vaultAbi, "withdrawToZone", [ZONE.portal, PATHUSD, AMOUNT, keyIndex, enc]);
  const portalLogs = r.logs.filter((l) => l.address.toLowerCase() === ZONE.portal.toLowerCase());
  check(portalLogs.length >= 1, `portal emitted ${portalLogs.length} log(s)`);
  const log = portalLogs[0];
  const shape = log && DEPOSIT_MADE_SHAPES.find((e) => toEventSelector(e) === log.topics[0]);
  let ev: { sender?: Address; netAmount?: bigint; amount?: bigint; fee?: bigint; tempoRefundRecipient?: Address; ciphertext?: Hex } | undefined;
  if (log && shape) {
    ev = decodeEventLog({ abi: [shape], data: log.data, topics: log.topics }).args as typeof ev;
    console.log(`   ${shape.name} decoded with ${shape === DEPOSIT_MADE_SHAPES[0] ? "the current viem ABI" : "the legacy portal event shape"} (topic ${log.topics[0]?.slice(0, 10)})`);
  } else if (log) {
    console.log(`   portal log topic ${log.topics[0]?.slice(0, 10)} is not a known DepositMade shape; checking balances instead`);
  }
  if (ev) {
    const net = ev.netAmount ?? ev.amount ?? 0n;
    check(ev.sender?.toLowerCase() === VAULT.toLowerCase(), "public sender is the Vault, not the worker");
    if (ev.tempoRefundRecipient) check(ev.tempoRefundRecipient.toLowerCase() === worker.address.toLowerCase(), "worker is the refund recipient");
    else console.log("   ℹ legacy portal: a bounced deposit returns to the Vault as surplus and intake attributes it back to the worker");
    check(net + (ev.fee ?? 0n) === AMOUNT, `amount ${AMOUNT} = net ${net} + portal fee ${ev.fee ?? 0n} (quoted ${feeBefore})`);
    check((ev.ciphertext?.length ?? 0) > 2, "recipient + memo travel encrypted");
  }
  const portalAfter = await pub.readContract({ address: PATHUSD, abi: tip20Abi, functionName: "balanceOf", args: [ZONE.portal] });
  check(portalAfter - portalBefore === AMOUNT, `portal holds the ${AMOUNT} (was ${portalBefore}, now ${portalAfter})`);
  check((await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "balances", args: [PATHUSD, worker.address] })) === 0n, "vault balance is zero afterwards");

  // 4. private balance read (only the account, with a signed token, can see it); the zone mirrors the L1 block,
  //    so the credit usually lands within seconds
  let bal: bigint | null = null;
  for (let i = 0; i < 50 && (bal === null || bal <= zoneBefore); i++) {
    await new Promise((res) => setTimeout(res, 6000));
    bal = await readZoneBal();
    if (i % 5 === 4) console.log(`   waiting for the zone to process the deposit… (${(i + 1) * 6}s)`);
  }
  check(bal !== null && bal - zoneBefore === AMOUNT - (ev?.fee ?? 0n), `worker's private ${ZONE.name} balance rose by ${bal === null ? "?" : bal - zoneBefore} to ${bal ?? "unreadable"} (net of portal fee)`);
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
