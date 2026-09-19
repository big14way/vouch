# MPP directory listing

Vouch publishes an MPP discovery document at `/openapi.json` (`x-payment-info.offers[]` on the fund route, `x-service-info` at the root) and an `llms.txt`. Both are validated in CI with `mppx/discovery`'s validator (`apps/web/src/lib/openapi.test.ts`). Once the service is live at its public URL, two registries pick it up:

| Registry | Action | Status |
|---|---|---|
| [MPPScan](https://www.mppscan.com/register) | Register the live `/openapi.json` URL; one click | pending public deploy |
| [mpp.dev services directory](https://mpp.dev/services#list-your-service) | PR to `tempoxyz/mpp` adding an entry to `schemas/services.ts` using the service PR template | pending public deploy |

The directory only accepts live services, so both steps wait for the Vercel deployment. Everything below is ready to paste.

## PR template answers (tempoxyz/mpp)

**Motivation.** Vouch is a conditional-settlement layer for agent and human work: a payer locks stablecoins against a written scope, an independent verifier compares the delivery to the scope and writes an attestation on-chain, and funds settle under the payer's own policy (verdict, confidence threshold, cap, review window) or on approval. Every other service in the directory is pay-first; Vouch is the "pay per acceptable outcome" layer that sits on top of an MPP charge. It serves agents that hire other agents or humans for outcome-priced work (a brief, a design, a code change) and want the money held until the output matches what they asked for.

- **Service name:** Vouch
- **Live service URL:** `https://vouch-rouge.vercel.app` (Vercel, Sept 19; testnets Moderato 42431 + Base Sepolia 84532)
- **Provider URL:** `https://vouch-rouge.vercel.app`
- **OpenAPI or API reference URL:** `https://vouch-rouge.vercel.app/openapi.json`

**Summary checklist**
- [ ] The service is live and accepts MPP payments.
- [ ] This PR adds its entry in `schemas/services.ts`.
- [ ] Listed endpoints, prices, and payment methods match the live service.
- [ ] Public documentation and icon URLs are stable and accessible.
- [ ] `pnpm generate:discovery`, `pnpm check:types`, `pnpm build` succeed.

**Key design considerations**
- **Integration:** first-party.
- **Payment methods and intents:** `tempo/charge` (pathUSD, USDC.e) with `memo = jobId` and pull-mode fee sponsorship; `evm/charge` (x402-compatible, USDC on Base). Amount is per job, so offers are variable-priced (`amount: null`); the runtime 402 is authoritative.
- **Provider relationship:** we own and operate the service.
- **Directory fit:** no existing listing holds funds against a scope with an independent verification step; MCPay, Latinum, Corbits and Mercantill are pay-before-access.

## `schemas/services.ts` entry (draft)

```ts
{
  id: "vouch",
  name: "Vouch",
  url: "https://vouch-rouge.vercel.app",
  serviceUrl: "https://vouch-rouge.vercel.app",
  description: "Pay per acceptable outcome. Lock stablecoins against a scope, get an independent verification of the delivery, settle under the payer's policy. For agents hiring agents or humans.",
  icon: "https://vouch-rouge.vercel.app/icon.svg",
  categories: ["payments", "agents", "verification", "work"],
  integration: "first-party",
  tags: ["settlement", "verification", "escrow-free", "outcomes", "mcp", "x402"],
  status: "active",
  docs: {
    homepage: "https://vouch-rouge.vercel.app",
    llmsTxt: "https://vouch-rouge.vercel.app/llms.txt",
    apiReference: "https://vouch-rouge.vercel.app/openapi.json",
  },
  methods: {
    tempo: { intents: ["charge"], assets: ["0x20c0000000000000000000000000000000000000", "0x20c000000000000000000000b9537d11c60e8b50"] },
    evm: { intents: ["charge"], assets: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"] },
  },
  realm: "vouch-rouge.vercel.app",
  provider: { name: "Vouch", url: "https://vouch-rouge.vercel.app" },
  endpoints: [
    {
      method: "POST",
      path: "/api/v1/jobs",
      description: "Create a job: scope, amount, policy → jobId + fund routes (free)",
    },
    {
      method: "POST",
      path: "/api/v1/jobs/:id/fund",
      description: "Lock the job amount. 402 → pay → 200 { status: 'Funded', tx }",
      payment: {
        intent: "charge",
        method: "tempo",
        currency: "0x20c0000000000000000000000000000000000000",
        decimals: 6,
        description: "Job amount (variable, set at creation); memo = jobId; fees sponsored",
        amount: null,
        unitType: "job",
      },
    },
    { method: "GET", path: "/api/v1/jobs/:id/verdict", description: "Verification result with per-item evidence (free)" },
  ],
}
```

Field names follow the live catalog at `https://mpp.dev/api/services`; adjust to the schema types in the repo when opening the PR.
