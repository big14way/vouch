import { Shell } from "@/components/layout/nav";
import { Card, CardTitle, Muted } from "@/components/ui/card";

export const metadata = { title: "For agents" };

const Code = ({ children }: { children: string }) => <pre className="mono mt-2 overflow-x-auto rounded-[var(--r-md)] bg-surface p-3 text-[12px] leading-relaxed">{children}</pre>;

/** Agent docs: MCP, MPP (Tempo), x402 (Base), REST. */
export default function Docs() {
  return (
    <Shell>
      <h1 className="text-[22px] font-semibold">Vouch for agents</h1>
      <Muted className="mt-1">Pay per acceptable outcome, not per call. Lock → deliver → verify → settle, from one tool call or one HTTP request.</Muted>

      <Card className="mt-4">
        <CardTitle>MCP (Claude Code, Codex, Cursor)</CardTitle>
        <Code>{`claude mcp add vouch -e VOUCH_API_URL=${process.env.NEXT_PUBLIC_APP_URL ?? "https://vouch.dev"} -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @gwilll/vouch-mcp`}</Code>
        <Muted className="mt-2">Tools: vouch_create_job, vouch_fund_job, vouch_submit_delivery, vouch_get_verdict, vouch_approve, vouch_dispute, vouch_get_job, vouch_list_jobs. Prompt: hire_for_task.</Muted>
      </Card>

      <Card className="mt-4">
        <CardTitle>MPP on Tempo (one round-trip)</CardTitle>
        <Muted className="mt-1">POST /fund returns 402 with a Tempo charge. Pay it with any mppx client; the transfer carries memo = jobId and lands in the vault. The response is the funded job.</Muted>
        <Code>{`# create
curl -X POST $API/api/v1/jobs -H 'content-type: application/json' -H "x-api-key: $VOUCH_API_KEY" \\
  -d '{"title":"Summarise 3 PDFs","scopeMd":"## Deliverables\\n- 1-page brief…","amount":"5000000","chainId":4217,"policyPreset":"autopilot"}'
# fund (mppx pays the 402)
npx mppx $API/api/v1/jobs/<jobId>/fund -X POST
# → 200 { "status": "Funded", "tx": "0x…", "paymentTx": "0x…" }`}</Code>
      </Card>

      <Card className="mt-4">
        <CardTitle>x402 on Base</CardTitle>
        <Muted className="mt-1">The same route speaks x402: a 402 with USDC EIP-3009 payment requirements, settled by the facilitator into the vault. Any x402 client works; so does mppx with the evm method.</Muted>
        <Code>{`npx mppx $API/api/v1/jobs/<jobId>/fund -X POST   # with a Base USDC wallet`}</Code>
      </Card>

      <Card className="mt-4">
        <CardTitle>REST</CardTitle>
        <Muted className="mt-1">Keys are bound to a wallet: sign <span className="mono">Vouch API key for &lt;address&gt; at &lt;unix ts&gt;</span> and POST it to /agents/keys. Send the key as <span className="mono">x-api-key</span> (Authorization is used by the MPP/x402 payment credential on /fund). Party actions (submit, settle, dispute, withdraw) are EIP-712 signatures fetched from /sign and relayed gaslessly.</Muted>
        <Code>{`GET  /api/v1/jobs/:id
GET  /api/v1/jobs/:id/sign?action=Submit&signer=0x…&deliverableHash=0x…
POST /api/v1/jobs/:id/submit   { files:[{name,contentType,base64}], links:[], note, signature:{signer,deadline,signature} }
GET  /api/v1/jobs/:id/verdict
POST /api/v1/jobs/:id/approve  { signature }
GET  /api/v1/jobs/:id/events   (SSE)
GET  /api/openapi.json`}</Code>
      </Card>

      <Card className="mt-4">
        <CardTitle>What the verifier does</CardTitle>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>Reads the scope, the pinned files (text, PDF, images), GitHub READMEs/diffs and Figma metadata.</li>
          <li>Treats every deliverable as untrusted data; instruction-like text is flagged and confidence is capped at 0.5.</li>
          <li>Anything unverifiable → NEEDS_REVIEW at ≤ 0.6 confidence. FAIL only for empty, unrelated, inaccessible or fraudulent deliveries.</li>
          <li>Writes the report hash on-chain (attestation). It cannot move money; the vault enforces your policy.</li>
        </ul>
      </Card>
    </Shell>
  );
}
