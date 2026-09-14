"use client";
import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { formatAmount } from "@vouch/shared";

/** Counts up from 0 to the value over 300 ms the first time it becomes visible (the "money is safe" moment). */
export function AmountDisplay({ amount, symbol, size = "lg", countUp = false }: { amount: string | null; symbol: string; size?: "md" | "lg" | "xl"; countUp?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<bigint | null>(countUp && !reduced ? 0n : amount ? BigInt(amount) : null);
  useEffect(() => {
    if (!amount) return setShown(null);
    const target = BigInt(amount);
    if (!countUp || reduced) return setShown(target);
    const ctrl = animate(0, Number(target), { duration: 0.3, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(BigInt(Math.round(v))) });
    return () => ctrl.stop();
  }, [amount, countUp, reduced]);
  const cls = size === "xl" ? "text-[36px]" : size === "lg" ? "text-[28px]" : "text-[22px]";
  if (shown === null) return <span className={`${cls} mono font-semibold text-muted`}>Amount private</span>;
  return (
    <span className={`${cls} mono font-semibold tracking-tight`}>
      {formatAmount(shown)} <span className="text-[13px] font-normal text-muted">{symbol}</span>
    </span>
  );
}
