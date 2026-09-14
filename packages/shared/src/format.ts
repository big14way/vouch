import { formatUnits, parseUnits } from "viem";

/** 6-decimal stablecoin → "$5.00" style. */
export function formatAmount(base: bigint | string | number, opts: { symbol?: string; compact?: boolean } = {}): string {
  const v = typeof base === "bigint" ? base : BigInt(base);
  const s = formatUnits(v, 6);
  const n = Number(s);
  const text = n.toLocaleString("en-US", { minimumFractionDigits: opts.compact ? 0 : 2, maximumFractionDigits: 2 });
  return opts.symbol ? `${text} ${opts.symbol}` : `$${text}`;
}

/** "5" | "5.25" → 5250000n. Throws on > 6 decimals or non-numeric. */
export function parseAmount(human: string): bigint {
  const t = human.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(t)) throw new Error("Enter an amount with up to 6 decimal places");
  return parseUnits(t, 6);
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(m, 1)}m`;
}

export function bpsToPercent(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}
