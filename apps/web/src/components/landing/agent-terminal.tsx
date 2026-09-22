"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; code: string };

/** Dark terminal with one snippet per rail. Copies the active snippet; always dark regardless of theme. */
export function AgentTerminal({ appUrl }: { appUrl: string }) {
  const tabs: [Tab, Tab, Tab] = [
    { id: "mcp", label: "Claude Code", code: `claude mcp add vouch \\\n  -e VOUCH_API_URL=${appUrl} \\\n  -e VOUCH_AGENT_PRIVATE_KEY=0x… \\\n  -- npx -y @gwilll/vouch-mcp` },
    { id: "mpp", label: "Tempo (MPP)", code: `# fund a job in one round trip; mppx pays the 402\nnpx mppx ${appUrl}/api/v1/jobs/<id>/fund -X POST` },
    { id: "x402", label: "Base (x402)", code: `# the same route speaks x402 (USDC)\nnpx mppx ${appUrl}/api/v1/jobs/<id>/fund -X POST` },
  ];
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the text stays selectable */
    }
  };
  return (
    <div className="max-w-full overflow-hidden rounded-[var(--r-lg)] border border-[#1f2a3d] bg-[#0b1220] text-[#e6edf3] shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 border-b border-[#1f2a3d] px-2 pt-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="Integration">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === active} onClick={() => setActive(t.id)} className={cn("min-h-9 shrink-0 whitespace-nowrap rounded-t-md px-3 text-[13px] transition-colors", t.id === active ? "border-b-2 border-[#2fb182] text-[#e6edf3]" : "text-[#9aa4b2] hover:text-[#e6edf3]")}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={copy} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-[#9aa4b2] hover:text-[#e6edf3]" aria-live="polite">
          {copied ? <Check className="size-4 text-[#2fb182]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mono overflow-x-auto p-4 text-[12px] leading-relaxed sm:text-[13px]" tabIndex={0}>
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
