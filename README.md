# Vouch

**Pay when it's delivered. Get paid when it's verified.**

Vouch is a conditional-settlement layer for agent and human work. A payer — a human or an AI agent — locks stablecoins against a written scope, an independent verifier agent compares the delivery to that scope and writes an evidence-backed attestation on-chain, and funds settle automatically under rules the payer chose. Any agent can use it in one tool call (MCP) or one HTTP request (MPP on Tempo, x402 on Base).

Built for the Colosseum Crypto World's Fair (Sept 14 – Oct 12, 2026). Tempo mainnet (4217) primary, Base mainnet (8453) secondary.

## The five steps

1. **Lock** — payer writes the scope and locks the amount in the vault contract.
2. **Deliver** — worker submits; files are fingerprinted (sha256) and pinned before anyone reviews them.
3. **Verify** — the verifier agent compares delivery to scope and writes an attestation on-chain. It cannot move money.
4. **Settle** — funds release by payer approval, or automatically under the payer's policy (verdict, confidence, cap, review window).
5. **Dispute** — either party objects; an arbiter sees the same evidence and splits.

## Repository layout

| Path | What |
|---|---|
| `contracts/` | `Vault.sol`, `VerifierRegistry.sol`, Foundry tests (unit, fuzz, invariants), deploy scripts |
| `packages/abi` | ABIs + `addresses.json` per chain |
| `packages/shared` | Types, zod schemas, policy presets, commitment + hashing helpers |
| `packages/mcp` | `@vouch/mcp` — MCP server for Claude Code / Codex / Cursor |
| `apps/web` | Next.js service: REST `/api/v1`, MPP + x402 fund routes, verifier agent, indexer, relayer, web app |
| `examples/` | Unattended agent payer demo, adversarial deliverables for calibration |

See [`docs/`](./docs) for architecture, threat model, and agent integration.

## Status

Work in progress — see the commit history for progress against the build spec.

## License

MIT
