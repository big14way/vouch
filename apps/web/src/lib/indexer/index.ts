import { parseEventLogs, type Address, type Hex, type Log } from "viem";
import { tip20Abi, vaultAbi } from "@vouch/abi";
import { TOKENS, type ChainId } from "@vouch/shared";
import { db } from "../db";
import { enabledChains } from "../env";
import { isVaultConfigured, publicClient, vaultAddress } from "../chain/clients";
import { attributeMemoTransfer } from "../jobs/service";

/**
 * Chain → DB sync. Two sources feed the same processor:
 *  - polling (`pollChain`, cron every 30 s; also the Tempo path since TIDX streams are optional)
 *  - webhooks (Alchemy on Base) that push logs
 * Every event is stored once (unique on chain+tx+logIndex) and applied to the Job row idempotently.
 */
/** Blocks per eth_getLogs call. */
const MAX_RANGE = 2_000n;
/** One cron invocation keeps walking windows until the head or this budget is spent (the route's maxDuration is 60 s). */
const POLL_BUDGET_MS = 40_000;
/** Pause between windows during a backfill so public RPCs (sepolia.base.org) do not rate-limit the run. */
const WINDOW_PAUSE_MS = 250;

const STATUS_BY_EVENT: Record<string, string | undefined> = {
  JobCreated: "Open",
  Funded: "Funded",
  Submitted: "Submitted",
  Resubmitted: "Submitted",
  Attested: "Attested",
  Settled: "Settled",
  AutoSettled: "Settled",
  Disputed: "Disputed",
  Resolved: "Resolved",
  Refunded: "Refunded",
};

const TX_KEY_BY_EVENT: Record<string, string | undefined> = {
  JobCreated: "created", Funded: "funded", Submitted: "submitted", Attested: "attested", Settled: "settled",
  AutoSettled: "settled", Disputed: "disputed", Resolved: "resolved", Refunded: "refunded",
};

const ORDER = ["Open", "Funded", "Submitted", "Attested", "Settled", "Disputed", "Resolved", "Refunded"];

export async function pollChain(chainId: number, deadline = Date.now() + POLL_BUDGET_MS): Promise<{ from: bigint; to: bigint; events: number }> {
  if (!isVaultConfigured(chainId)) return { from: 0n, to: 0n, events: 0 };
  const pub = publicClient(chainId);
  const head = await pub.getBlockNumber();
  const cursor = await db.indexerCursor.findUnique({ where: { chainId } });
  // First run: start at INDEXER_START_BLOCK_<chainId> (the Vault's deployment block) so nothing before the cursor is skipped.
  const startEnv = process.env[`INDEXER_START_BLOCK_${chainId}`];
  const start = cursor ? cursor.lastBlock + 1n : startEnv && /^\d+$/.test(startEnv) ? BigInt(startEnv) : head;
  if (start > head) return { from: start, to: head, events: 0 };
  const vault = vaultAddress(chainId);
  const tokens = TOKENS[chainId as ChainId].map((t) => t.address);
  const memoEvent = tip20Abi.find((x) => x.type === "event" && x.name === "TransferWithMemo") as never;

  // Walk MAX_RANGE windows until the head or the time budget; the cursor is persisted after each window so a killed run loses nothing.
  let from = start;
  let to = start;
  let events = 0;
  for (;;) {
    to = from + MAX_RANGE - 1n < head ? from + MAX_RANGE - 1n : head;
    try {
      const [vaultLogs, memoLogs] = await Promise.all([
        pub.getLogs({ address: vault, fromBlock: from, toBlock: to }),
        pub.getLogs({ address: tokens, event: memoEvent, args: { to: vault } as never, fromBlock: from, toBlock: to }),
      ]);
      events += (await processVaultLogs(chainId, vaultLogs)) + (await processMemoLogs(chainId, memoLogs));
    } catch (e) {
      // Public RPCs rate-limit a fast backfill. Keep the windows already persisted and let the next run continue;
      // only the very first window of a run surfaces the error.
      if (from > start) { to = from - 1n; break; }
      throw e;
    }
    await db.indexerCursor.upsert({ where: { chainId }, create: { chainId, lastBlock: to }, update: { lastBlock: to } });
    if (to >= head || Date.now() >= deadline) break;
    from = to + 1n;
    await new Promise((r) => setTimeout(r, WINDOW_PAUSE_MS));
  }
  return { from: start, to, events };
}

/** Polls every enabled chain concurrently under one shared time budget. */
export async function pollAll(budgetMs = POLL_BUDGET_MS): Promise<Record<number, { from: string; to: string; events: number } | { error: string }>> {
  const deadline = Date.now() + budgetMs;
  const out: Record<number, { from: string; to: string; events: number } | { error: string }> = {};
  await Promise.all(
    enabledChains().map(async (c) => {
      try {
        const r = await pollChain(c, deadline);
        out[c] = { from: r.from.toString(), to: r.to.toString(), events: r.events };
      } catch (e) {
        out[c] = { error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return out;
}

export async function processVaultLogs(chainId: number, logs: Log[]): Promise<number> {
  const parsed = parseEventLogs({ abi: vaultAbi, logs });
  let n = 0;
  for (const l of parsed) {
    const args = l.args as Record<string, unknown>;
    const jobId = typeof args.jobId === "string" ? (args.jobId as string).toLowerCase() : null;
    const known = jobId ? await db.job.findUnique({ where: { id: jobId }, select: { id: true, status: true, txs: true } }) : null;
    const created = await db.chainEvent
      .create({
        data: {
          chainId, txHash: l.transactionHash!, logIndex: l.logIndex!, blockNumber: l.blockNumber!, name: l.eventName,
          jobId: known?.id ?? null,
          args: JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
        },
      })
      .catch(() => null); // duplicate → already processed
    if (!created) continue;
    n++;
    if (!known) continue;
    const next = STATUS_BY_EVENT[l.eventName];
    const txKey = TX_KEY_BY_EVENT[l.eventName];
    const data: Record<string, unknown> = {};
    if (txKey) data.txs = { ...((known.txs as Record<string, string>) ?? {}), [txKey]: l.transactionHash };
    // Only move forward: the service already wrote most of these; the indexer catches anything it missed.
    if (next && ORDER.indexOf(next) > ORDER.indexOf(known.status)) {
      data.status = next;
      if (next === "Funded") data.fundedAt = new Date();
      if (next === "Submitted") data.submittedAt = new Date();
      if (next === "Attested") {
        data.attestedAt = new Date();
        const verdict = Number(args.verdict);
        data.verdict = verdict === 1 ? "PASS" : verdict === 2 ? "NEEDS_REVIEW" : "FAIL";
        data.confidenceBps = Number(args.confidenceBps);
        data.attestationHash = args.attestationHash;
      }
      if (next === "Settled" || next === "Resolved") {
        data.settledAt = new Date();
        data.amountPublic = true;
      }
    }
    if (Object.keys(data).length) await db.job.update({ where: { id: known.id }, data });
    await db.chainEvent.update({ where: { id: created.id }, data: { processedAt: new Date() } });
  }
  return n;
}

export async function processMemoLogs(chainId: number, logs: Log[]): Promise<number> {
  const parsed = parseEventLogs({ abi: tip20Abi, logs, eventName: "TransferWithMemo" });
  let n = 0;
  for (const l of parsed) {
    const created = await db.chainEvent
      .create({
        data: {
          chainId, txHash: l.transactionHash!, logIndex: l.logIndex!, blockNumber: l.blockNumber!, name: "TransferWithMemo",
          jobId: null,
          args: { from: l.args.from, to: l.args.to, value: l.args.value.toString(), memo: l.args.memo, token: l.address },
        },
      })
      .catch(() => null);
    if (!created) continue;
    n++;
    await attributeMemoTransfer(chainId, {
      token: l.address as Address, from: l.args.from as Address, value: l.args.value, memo: l.args.memo as Hex,
      txHash: l.transactionHash as Hex, logIndex: l.logIndex!,
    });
    await db.chainEvent.update({ where: { id: created.id }, data: { processedAt: new Date() } });
  }
  return n;
}
