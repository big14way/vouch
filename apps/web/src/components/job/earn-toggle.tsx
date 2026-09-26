"use client";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import type { EarnVaultDto } from "@vouch/shared";
import { isTempo } from "@vouch/shared";
import { api } from "@/lib/client/api";
import { spring } from "@/components/motion";
import { cn } from "@/lib/utils";

/**
 * "Earn while locked" (F11). Tempo only. Lists the Earn vaults the Vouch vault allow-lists on-chain, with venue
 * and APY from the Tempo API. Off by default; the copy states who keeps the yield and who carries the risk.
 */
export function EarnToggle({ chainId, value, onChange }: { chainId: number; value: string | null; onChange: (earnVault: string | null) => void }) {
  const [vaults, setVaults] = useState<EarnVaultDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tempo = isTempo(chainId);

  useEffect(() => {
    if (!tempo) return;
    let alive = true;
    api<{ vaults: EarnVaultDto[] }>(`/earn/vaults?chainId=${chainId}`)
      .then((r) => alive && setVaults(r.vaults.filter((v) => v.allowed)))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Could not load Earn vaults."));
    return () => { alive = false; };
  }, [chainId, tempo]);

  useEffect(() => {
    if (!tempo && value) onChange(null);
  }, [tempo, value, onChange]);

  if (!tempo) return null;
  const on = Boolean(value);
  const selected = vaults?.find((v) => v.address.toLowerCase() === value?.toLowerCase()) ?? null;
  const apy = (v: EarnVaultDto) => (v.apy && Number(v.apy) > 0 ? `~${(Number(v.apy) * 100).toFixed(1)}%` : "rate not measured yet");

  return (
    <fieldset className="rounded-[var(--r-md)] border border-border-strong bg-bg/50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <legend className="text-[14px] font-medium">Earn while locked</legend>
          <p className="mt-0.5 text-[12px] leading-[18px] text-muted">
            {vaults === null && !err ? "Checking available vaults…" : vaults && vaults.length === 0 ? "No Earn vault is enabled for this network yet." : "Your locked money earns while the work happens. The yield is yours."}
          </p>
        </div>
        <m.button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={!vaults || vaults.length === 0}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          onClick={() => onChange(on ? null : (vaults?.[0]?.address ?? null))}
          className={cn("relative h-6 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-40", on ? "border-primary bg-primary" : "border-border-strong bg-overlay")}
        >
          <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-text shadow transition-[left] duration-150", on ? "left-[18px]" : "left-0.5")} />
        </m.button>
      </div>
      {err ? <p className="mt-2 text-[13px] text-danger">{err}</p> : null}
      {on && vaults && vaults.length > 0 ? (
        <div className="mt-3 space-y-2">
          {vaults.map((v) => {
            const active = v.address.toLowerCase() === value?.toLowerCase();
            return (
              <button key={v.address} type="button" aria-pressed={active} onClick={() => onChange(v.address)} className={cn("flex w-full items-center justify-between rounded-[var(--r-md)] border px-3 py-2 text-left min-h-11", active ? "border-primary bg-primary/5" : "border-border hover:bg-surface")}>
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{v.label}</span>
                  <span className="block text-[13px] text-muted">{v.assetSymbol}{v.venue ? ` · venue ${v.venue.slice(0, 8)}…` : ""}{v.verified ? " · verified" : " · testnet vault"}</span>
                </span>
                <span className="mono ml-3 shrink-0 text-[15px]">{apy(v)}</span>
              </button>
            );
          })}
          <p className="text-[13px] text-muted">
            Principal comes back in full at settlement{selected ? ` from ${selected.label}` : ""}. If the venue ever returns less, the difference is taken from your balance, not the worker&rsquo;s payout. The Earn vault&rsquo;s own record shows the deposited amount.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
