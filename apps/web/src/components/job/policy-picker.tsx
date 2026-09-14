"use client";
import { m } from "framer-motion";
import { POLICY_PRESETS, POLICY_PRESET_COPY, POLICY_PRESET_NAMES, formatAmount, policyToWire, type PolicyPreset, type PolicyWire } from "@vouch/shared";
import { Input, Label } from "@/components/ui/field";
import { spring } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface PolicyValue { preset: PolicyPreset; policy: PolicyWire }

export function defaultPolicyValue(): PolicyValue {
  return { preset: "manual", policy: policyToWire(POLICY_PRESETS.manual) };
}

/** Presets Manual / Trusted / Autopilot / Custom (spec §8.4). No crypto vocabulary in the copy. */
export function PolicyPicker({ value, onChange }: { value: PolicyValue; onChange: (v: PolicyValue) => void }) {
  const p = value.policy;
  const set = (patch: Partial<PolicyWire>) => onChange({ preset: "custom", policy: { ...p, ...patch } });
  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-medium">When should payment release?</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {POLICY_PRESET_NAMES.map((name) => {
          const active = value.preset === name;
          return (
            <m.button
              key={name}
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
              aria-pressed={active}
              onClick={() => onChange(name === "custom" ? { preset: "custom", policy: { ...p, autoRelease: p.autoRelease || 1 } } : { preset: name, policy: policyToWire(POLICY_PRESETS[name]) })}
              className={cn("rounded-[var(--r-md)] border p-3 text-left min-h-11", active ? "border-primary bg-primary/5" : "border-border hover:bg-surface")}
            >
              <span className="block text-[15px] font-medium">{POLICY_PRESET_COPY[name].title}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{POLICY_PRESET_COPY[name].blurb}</span>
            </m.button>
          );
        })}
      </div>
      {value.preset === "custom" ? (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--r-md)] border border-border bg-surface p-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="autoRelease">Release automatically</Label>
            <select id="autoRelease" className="w-full rounded-[var(--r-md)] border border-border bg-bg px-3 py-2.5 min-h-11" value={p.autoRelease} onChange={(e) => set({ autoRelease: Number(e.target.value) as 0 | 1 | 2 })}>
              <option value={0}>Never (I approve)</option>
              <option value={1}>When verified as complete</option>
              <option value={2}>When verified, even if it needs review</option>
            </select>
          </div>
          <div>
            <Label htmlFor="minConf">Minimum confidence</Label>
            <Input id="minConf" type="number" min={0} max={100} value={Math.round(p.minConfidenceBps / 100)} onChange={(e) => set({ minConfidenceBps: Math.max(0, Math.min(100, Number(e.target.value))) * 100 })} />
          </div>
          <div>
            <Label htmlFor="cap" hint={`now ${formatAmount(p.maxAutoAmount)}`}>Auto-pay cap ($)</Label>
            <Input id="cap" type="number" min={0} step="1" value={Number(p.maxAutoAmount) / 1e6} onChange={(e) => set({ maxAutoAmount: String(Math.round(Math.max(0, Number(e.target.value)) * 1e6)) })} />
          </div>
          <div>
            <Label htmlFor="review">Review window (hours)</Label>
            <Input id="review" type="number" min={0} value={Math.round(p.reviewWindow / 3600)} onChange={(e) => set({ reviewWindow: Math.max(0, Number(e.target.value)) * 3600 })} />
          </div>
          <div>
            <Label htmlFor="deadline">Delivery deadline (days)</Label>
            <Input id="deadline" type="number" min={0} value={Math.round(p.submitDeadline / 86400)} onChange={(e) => set({ submitDeadline: Math.max(0, Number(e.target.value)) * 86400 })} />
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
