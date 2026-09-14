import type { Address, Hex, TransactionReceipt } from "viem";
import { isTempo } from "@vouch/shared";
import { db } from "../db";
import { errors } from "../errors";
import { accountFor, publicClient, walletClient, type Role } from "./clients";

/**
 * Serialised transaction sender. One in-flight tx per (chain, role) so nonces never collide;
 * every send is written to `TxLog` before broadcast and updated on confirmation.
 * On Tempo the server keys pay their own fees in pathUSD (agents-style); human-initiated
 * transactions are sponsored elsewhere via `feePayer`.
 */
const queues = new Map<string, Promise<unknown>>();

export interface SendParams {
  chainId: number;
  role: Role;
  to: Address;
  data: Hex;
  kind: string;
  jobId?: string;
  /** Sponsor fees with the Tempo feePayer account instead of the role account. */
  sponsor?: boolean;
}

export interface SendResult {
  hash: Hex;
  receipt: TransactionReceipt;
}

export async function sendTx(p: SendParams): Promise<SendResult> {
  const key = `${p.chainId}:${p.role}`;
  const prev = queues.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => sendNow(p));
  queues.set(key, run);
  try {
    return await run;
  } finally {
    if (queues.get(key) === run) queues.delete(key);
  }
}

async function sendNow(p: SendParams): Promise<SendResult> {
  const account = accountFor(p.role);
  const log = await db.txLog.create({
    data: { chainId: p.chainId, kind: p.kind, jobId: p.jobId, from: account.address.toLowerCase(), to: p.to.toLowerCase() },
  });
  try {
    const wallet = walletClient(p.chainId, p.role);
    const pub = publicClient(p.chainId);
    const sponsored = p.sponsor && isTempo(p.chainId);
    const hash = await wallet.sendTransaction({
      account,
      chain: wallet.chain,
      to: p.to,
      data: p.data,
      ...(sponsored ? { feePayer: accountFor("feePayer") } : {}),
    } as Parameters<typeof wallet.sendTransaction>[0]);
    await db.txLog.update({ where: { id: log.id }, data: { hash, status: "sent" } });
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== "success") {
      await db.txLog.update({ where: { id: log.id }, data: { status: "failed", error: "reverted", gasUsed: receipt.gasUsed.toString() } });
      throw errors.chain(`Transaction ${p.kind} reverted on-chain.`);
    }
    await db.txLog.update({ where: { id: log.id }, data: { status: "confirmed", gasUsed: receipt.gasUsed.toString() } });
    return { hash, receipt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.txLog.update({ where: { id: log.id }, data: { status: "failed", error: message.slice(0, 2000) } }).catch(() => undefined);
    if (e && typeof e === "object" && "status" in e) throw e;
    throw errors.chain(`Could not send ${p.kind}: ${message.split("\n")[0]}`);
  }
}
