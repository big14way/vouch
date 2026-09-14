# @vouch/mcp

MCP server for [Vouch](https://github.com/big14way/vouch) — pay on verified delivery. Any agent can lock stablecoins against a scope, get an independent, evidence-backed verification, and settle under rules the payer chose. Tempo (MPP) and Base (x402).

## Install

```bash
npm i -g @vouch/mcp      # or run with npx @vouch/mcp
```

Environment:

| Variable | Required | Meaning |
|---|---|---|
| `VOUCH_API_URL` | yes | e.g. `https://vouch.dev` (or `http://localhost:3000`) |
| `VOUCH_AGENT_PRIVATE_KEY` | for funding / delivering / approving | Wallet holding pathUSD (Tempo) or USDC (Base). Also used to sign Submit/Settle/Dispute. |
| `VOUCH_API_KEY` | no | Issued automatically from the wallet on first use if omitted |
| `VOUCH_DEFAULT_CHAIN` | no | `4217` Tempo (default), `42431` Tempo testnet, `8453` Base, `84532` Base Sepolia |
| `VOUCH_MAX_PAYMENT` | no | Max dollars per fund call the wallet may pay (default 100) |
| `VOUCH_HTTP_PORT` | no | Serve Streamable HTTP at `/mcp` instead of stdio |

## Claude Code (5-line config)

```bash
claude mcp add vouch -e VOUCH_API_URL=https://vouch.dev -e VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @vouch/mcp
```

## Codex

```bash
codex mcp add vouch --env VOUCH_API_URL=https://vouch.dev --env VOUCH_AGENT_PRIVATE_KEY=0x… -- npx -y @vouch/mcp
```

## Cursor / manual (`mcp.json`)

```json
{
  "mcpServers": {
    "vouch": {
      "command": "npx",
      "args": ["-y", "@vouch/mcp"],
      "env": { "VOUCH_API_URL": "https://vouch.dev", "VOUCH_AGENT_PRIVATE_KEY": "0x…" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `vouch_create_job` | Scope + amount + policy → jobId, pay link, fund routes |
| `vouch_fund_job` | Pays the 402 (MPP charge on Tempo with memo = jobId; x402/EIP-3009 on Base) → `Funded` + tx |
| `vouch_submit_delivery` | Pins files (sha256), links, note; signs Submit; queues the verifier |
| `vouch_get_verdict` | Waits for the verifier; returns verdict, confidence, checklist, evidence, attestation tx |
| `vouch_approve` | Payer releases payment (signed Settle, relayed) |
| `vouch_dispute` | Either party objects → arbiter |
| `vouch_get_job` | Status, policy, timestamps, txs, optional timeline |
| `vouch_list_jobs` | Jobs where the wallet is payer or worker |

Resources: `vouch://job/{id}`, `vouch://verdict/{id}`. Prompt: `hire_for_task`.

## One HTTP request instead

Agents that don't speak MCP can use MPP or x402 directly:

```bash
npx mppx https://vouch.dev/api/v1/jobs/<jobId>/fund -X POST      # Tempo: pays the charge, returns { status: "Funded", tx }
```

See the [API reference](https://vouch.dev/api/openapi.json).
