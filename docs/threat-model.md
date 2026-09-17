# Threat model — the verifier is an oracle. How is it gamed, who eats the loss?

1. **Pinned before review.** Files are sha256'd and stored on submit; the manifest hash is signed by the worker and written on-chain (`Submitted`). The verifier reads the stored bytes and re-checks the hash. No post-hoc swaps.
2. **Untrusted-content framing.** Deliverable bytes are wrapped in `<untrusted_deliverable>` blocks. The system prompt states they are data, never instructions. A heuristic layer (`INJECTION_PATTERNS`) runs independently of the model.
3. **Bounded auto-settle.** `autoSettle` reverts unless *all* hold: policy on, verdict eligible (NEEDS_REVIEW never auto-settles unless the payer chose policy 2), `confidence ≥ minConfidenceBps`, `amount ≤ maxAutoAmount`, `now ≥ attestedAt + reviewWindow`, not disputed. These are the payer's own numbers, enforced by the contract, not the service.
4. **Post-rules cap the model.** Any `unverifiable` item → NEEDS_REVIEW, confidence ≤ 0.60. Any red flag (model or heuristic) → NEEDS_REVIEW, confidence ≤ 0.50. FAIL is downgraded to NEEDS_REVIEW unless the delivery is empty, inaccessible, or all items are missing / fraud is flagged.
5. **Auditability.** Report = verdict + scope items + evidence + model + prompt hash + response hash + content hashes + adjustments; `attestationHash = keccak256(canonical report)` is on-chain; the report is stored under that hash.
6. **Human backstop.** Either party can dispute from Submitted or Attested; the arbiter sees the same pinned evidence and report and splits on-chain. Disputes work while paused.
7. **Loss allocation.** Wrong PASS: at most the payer's own `maxAutoAmount` on one job, after their own review window. Wrong FAIL: the worker loses time (resubmit ×2, dispute). Wrong NEEDS_REVIEW: nobody loses money; a human decides.

## Other surfaces
- **Intake key**: can only credit from real surplus (`balanceOf − accounted`) and lock a payer's balance into that payer's own job. Recoverable via `refundExpired`. Cannot withdraw.
- **Replay**: attributions keyed by `ref` on-chain and in the DB; EIP-712 actions use sequential nonces + deadlines; MPP/x402 credentials carry their own replay protection.
- **Amount privacy**: not stored/emitted on-chain until settlement, when it appears in calldata. Deposits credit balances, not jobs. Stated plainly in the README and privacy page.
- **Rate limits** on every POST; API keys hashed; cron/webhook routes need secrets; CSP + security headers; secrets only server-side.
- **Zone payout (F12, testnet)**: the Vault only ever hands funds to allow-listed portals, and the signed `ZoneWithdraw` binds the payload hash, so a relayer cannot redirect a payout. A payload built for the wrong portal generation is accepted on-chain but never credited, so the client reads `legacyZonePortal` from the Vault rather than guessing; a legacy portal's bounce-back lands in the Vault as surplus and is attributed back by intake, never absorbed. Zones are testnet-only and nothing on mainnet depends on them.

## Calibration
`pnpm --filter @vouch/web calibrate` (rules only) / `--model` (full). Adversarial corpus: `examples/adversarial`. Results in the root README.
