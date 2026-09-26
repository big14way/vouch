"use client";
import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { formatAmount } from "@vouch/shared";
import { cn } from "@/lib/utils";

/** Counts up once (400 ms, ease-out) when money becomes locked; otherwise static, because amounts are data. */
export function AmountDisplay({ amount, symbol, size = "lg", countUp = false, className }: { amount: string | null; symbol: string; size?: "md" | "lg" | "xl"; countUp?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<bigint | null>(countUp && !reduced ? 0n : amount ? BigInt(amount) : null);
  useEffect(() => {
    if (!amount) return setShown(null);
    const target = BigInt(amount);
    if (!countUp || reduced) return setShown(target);
    const ctrl = animate(0, Number(target), { duration: 0.4, ease: [0.23, 1, 0.32, 1], onUpdate: (v) => setShown(BigInt(Math.round(v))) });
    return () => ctrl.stop();
  }, [amount, countUp, reduced]);
  const cls = size === "xl" ? "text-[32px] sm:text-[40px]" : size === "lg" ? "text-[28px]" : "text-[20px]";
  if (shown === null) return <span className={cn("text-[20px] font-medium tracking-[-0.02em] text-muted", className)}>Amount visible to the payer and worker</span>;
  const [whole, cents] = formatAmount(shown).split(".");
  return (
    <span className={cn(cls, "tnum font-semibold leading-none tracking-[-0.035em]", className)}>
      {whole}
      <span className="text-muted">.{cents ?? "00"}</span>
      <span className="ml-2 align-middle text-[13px] font-medium tracking-normal text-muted">{symbol}</span>
    </span>
  );
}
