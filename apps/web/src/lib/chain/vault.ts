import { encodeFunctionData, parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";
import { vaultAbi, erc3009Abi, tip20Abi } from "@vouch/abi";
import { policyToStruct, type Policy } from "@vouch/shared";
import { publicClient, vaultAddress } from "./clients";
import { sendTx } from "./relayer";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function readJob(chainId: number, jobId: Hex) {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "getJob", args: [jobId] });
}

export async function readSurplus(chainId: number, token: Address): Promise<bigint> {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "surplus", args: [token] });
}

export async function readBalance(chainId: number, token: Address, user: Address): Promise<bigint> {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "balances", args: [token, user] });
}

export async function readNonce(chainId: number, signer: Address): Promise<bigint> {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "nonces", args: [signer] });
}

export async function readFeeBps(chainId: number): Promise<number> {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "feeBps" });
}

export async function readAttributed(chainId: number, ref: Hex): Promise<boolean> {
  return publicClient(chainId).readContract({ address: vaultAddress(chainId), abi: vaultAbi, functionName: "attributedRef", args: [ref] });
}

export async function readCanAutoSettle(chainId: number, jobId: Hex, amount: bigint) {
  const [ok, reason] = await publicClient(chainId).readContract({
    address: vaultAddress(chainId), abi: vaultAbi, functionName: "canAutoSettle", args: [jobId, amount],
  });
  return { ok, reason };
}

export async function readTokenBalance(chainId: number, token: Address, owner: Address): Promise<bigint> {
  return publicClient(chainId).readContract({ address: token, abi: tip20Abi, functionName: "balanceOf", args: [owner] });
}

// ---------------------------------------------------------------------------
// Writes (all through the serialised relayer; each returns the tx hash)
// ---------------------------------------------------------------------------

type Sig = { signer: Address; deadline: bigint; signature: Hex };

const enc = <F extends string>(functionName: F, args: unknown[]) =>
  encodeFunctionData({ abi: vaultAbi, functionName, args } as Parameters<typeof encodeFunctionData>[0]);

export async function attributeDeposit(chainId: number, token: Address, to: Address, amount: bigint, ref: Hex, jobId?: string) {
  return sendTx({ chainId, role: "intake", to: vaultAddress(chainId), kind: "attributeDeposit", jobId,
    data: enc("attributeDeposit", [token, to, amount, ref]) });
}

export async function createJobOnChain(chainId: number, p: { jobId: Hex; commit: Hex; payer: Address; worker: Address; token: Address; policy: Policy }) {
  return sendTx({ chainId, role: "intake", to: vaultAddress(chainId), kind: "createJob", jobId: p.jobId,
    data: enc("createJob", [p.jobId, p.commit, p.payer, p.worker, p.token, policyToStruct(p.policy)]) });
}

export async function fundOnChain(chainId: number, jobId: Hex, amount: bigint, scopeHash: Hex, salt: Hex) {
  return sendTx({ chainId, role: "intake", to: vaultAddress(chainId), kind: "fund", jobId,
    data: enc("fund", [jobId, amount, scopeHash, salt]) });
}

export async function depositWithAuthorization(chainId: number, p: {
  token: Address; from: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex; v: number; r: Hex; s: Hex; jobId?: string;
}) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "depositWithAuthorization", jobId: p.jobId,
    data: enc("depositWithAuthorization", [p.token, p.from, p.value, p.validAfter, p.validBefore, p.nonce, p.v, p.r, p.s]) });
}

export async function submitWithSig(chainId: number, jobId: Hex, deliverableHash: Hex, sig: Sig) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "submitWithSig", jobId,
    data: enc("submitWithSig", [jobId, deliverableHash, sig.signer, sig.deadline, sig.signature]) });
}

export async function resubmitWithSig(chainId: number, jobId: Hex, deliverableHash: Hex, sig: Sig) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "resubmitWithSig", jobId,
    data: enc("resubmitWithSig", [jobId, deliverableHash, sig.signer, sig.deadline, sig.signature]) });
}

export async function attest(chainId: number, jobId: Hex, verdict: 1 | 2 | 3, confidenceBps: number, attestationHash: Hex) {
  return sendTx({ chainId, role: "verifier", to: vaultAddress(chainId), kind: "attest", jobId,
    data: enc("attest", [jobId, verdict, confidenceBps, attestationHash]) });
}

export async function settleWithSig(chainId: number, jobId: Hex, amount: bigint, scopeHash: Hex, salt: Hex, sig: Sig) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "settleWithSig", jobId,
    data: enc("settleWithSig", [jobId, amount, scopeHash, salt, sig.signer, sig.deadline, sig.signature]) });
}

export async function autoSettle(chainId: number, jobId: Hex, amount: bigint, scopeHash: Hex, salt: Hex) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "autoSettle", jobId,
    data: enc("autoSettle", [jobId, amount, scopeHash, salt]) });
}

export async function disputeWithSig(chainId: number, jobId: Hex, reasonHash: Hex, sig: Sig) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "disputeWithSig", jobId,
    data: enc("disputeWithSig", [jobId, reasonHash, sig.signer, sig.deadline, sig.signature]) });
}

export async function resolve(chainId: number, jobId: Hex, amount: bigint, scopeHash: Hex, salt: Hex, workerBps: number) {
  return sendTx({ chainId, role: "arbiter", to: vaultAddress(chainId), kind: "resolve", jobId,
    data: enc("resolve", [jobId, amount, scopeHash, salt, workerBps]) });
}

export async function refundExpired(chainId: number, jobId: Hex, amount: bigint, scopeHash: Hex, salt: Hex) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "refundExpired", jobId,
    data: enc("refundExpired", [jobId, amount, scopeHash, salt]) });
}

export async function withdrawWithSig(chainId: number, token: Address, amount: bigint, to: Address, sig: Sig) {
  return sendTx({ chainId, role: "relayer", to: vaultAddress(chainId), kind: "withdrawWithSig",
    data: enc("withdrawWithSig", [token, amount, to, sig.signer, sig.deadline, sig.signature]) });
}

// ---------------------------------------------------------------------------
// Log parsing helpers
// ---------------------------------------------------------------------------

/** Find TIP-20 / ERC-20 transfers into the vault inside a receipt (memo'd or plain). */
export function transfersToVault(chainId: number, receipt: TransactionReceipt) {
  const vault = vaultAddress(chainId).toLowerCase();
  const memo = parseEventLogs({ abi: tip20Abi, logs: receipt.logs, eventName: "TransferWithMemo" })
    .filter((l) => l.args.to.toLowerCase() === vault)
    .map((l) => ({ token: l.address, from: l.args.from, value: l.args.value, memo: l.args.memo as Hex | undefined, logIndex: l.logIndex }));
  const plain = parseEventLogs({ abi: tip20Abi, logs: receipt.logs, eventName: "Transfer" })
    .filter((l) => l.args.to.toLowerCase() === vault)
    .map((l) => ({ token: l.address, from: l.args.from, value: l.args.value, memo: undefined as Hex | undefined, logIndex: l.logIndex }));
  // A memo'd TIP-20 transfer emits both events; prefer the memo'd one and de-duplicate by (token, from, value).
  const seen = new Set<string>();
  const out: typeof memo = [];
  for (const t of [...memo, ...plain]) {
    const k = `${t.token.toLowerCase()}:${t.from.toLowerCase()}:${t.value}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export { erc3009Abi };
