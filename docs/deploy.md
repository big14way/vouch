# Deploy

## 1. Contracts
```
cd contracts
cp ../.env.example ../.env    # DEPLOYER_PRIVATE_KEY, ARBITER_ADDRESS, INTAKE_ADDRESS, VERIFIER_ADDRESS, FEE_RECIPIENT
./script/deploy-tempo.sh                                                  # Tempo testnet (RPC_URL=https://rpc.tempo.xyz for mainnet); explicit gas, see contracts/README.md
#   REGISTRY=0x… EARN_VAULTS=0x… ZONE_PORTALS=0x7069DeC4E64Fd07334A0933eDe836C17259c9B23:true   # reuse a registry, allow-list Earn venues / Zone portals (portal:legacy)
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```
Testnet funds: `cast rpc tempo_fundAddress <address> --rpc-url https://rpc.moderato.tempo.xyz`. Then `pnpm --filter @vouch/example-moderato-e2e start` proves the deployment end-to-end.
Copy `deployments/<chainId>.json` addresses into `packages/abi/addresses.json` (or set `VAULT_ADDRESS_<chainId>`).

Earn while locked: allow-list an Earn vault whose `asset()` is a job token — `cast send <Vault> "setEarnVault(address,bool)" <earnVault> true` (owner). The picker only offers allow-listed vaults; discovery and APY come from `GET https://api.tempo.xyz/v1/earn/vaults`.

Private payouts (F12, Moderato only): allow-list the Zone A portal — `cast send <Vault> "setZonePortal(address,bool,bool)" 0x7069DeC4E64Fd07334A0933eDe836C17259c9B23 true true` (`legacy=true` for the current Zone A build) — and set `ZONES_ENABLED=1`, `NEXT_PUBLIC_ZONES_ENABLED=1`, `ZONE_PORTAL_42431`. The relayer pays the `withdrawToZoneWithSig` gas.

Fund the server keys: intake/relayer/verifier/feePayer need pathUSD on Tempo (fees are paid in stablecoin) and a little ETH on Base (~0.01).

## 2. Database
```
cd apps/web && pnpm db:deploy       # applies prisma/migrations to DATABASE_URL (Neon); on Vercel this runs in the build step instead
```

## Go-live checklist (what to gather before step 3)

| Item | Where to get it | Used for |
|---|---|---|
| Vercel project | From the repo root: `vercel link --yes --project vouch`, then set **Root Directory `apps/web`**, framework Next.js, Node 22.x and the build command `cd ../.. && pnpm -r --filter "./packages/**" build && pnpm --filter @vouch/web build` (dashboard → Settings, or `PATCH api.vercel.com/v9/projects/vouch`; the glob must be quoted). `.vercelignore` keeps env files and Foundry artefacts out of the upload. | hosting |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | neon.tech → project → pooled + direct connection strings (`neon link --project-id <id> --branch production -y` writes both into `.env.local`). Migrations run inside the Vercel build (`prisma migrate deploy` over the direct URL, see below), because outbound port 5432 is blocked from some networks, including this dev machine | Postgres |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | dashboard.privy.io → app → Settings; add the Vercel domain under Allowed origins; enable embedded wallets; add chains 42431 / 84532 (4217 / 8453 for mainnet) | login + embedded wallets |
| `JOB_SECRETS_KEY`, `MPP_SECRET_KEY`, `CRON_SECRET` | `openssl rand -hex 32` each; `JOB_SECRETS_KEY` needs the `0x` prefix (`0x` + 64 hex) or every API route fails env validation | job salts, MPP challenge binding, cron auth |
| Role keys | `RELAYER_PRIVATE_KEY`, `INTAKE_PRIVATE_KEY`, `VERIFIER_PRIVATE_KEY`, `TEMPO_FEEPAYER_PRIVATE_KEY` (+ `_84532` overrides); fund them (pathUSD on Tempo, ETH on Base) | relays, attribution, attestations, sponsorship |
| `ANTHROPIC_API_KEY` | console.anthropic.com | the verifier (without it every submission reports `failed`) |
| `NEXT_PUBLIC_APP_URL` | the Vercel domain | pay links, discovery doc, MPP realm |
| `INDEXER_START_BLOCK_42431` / `_84532` | `contracts/deployments/<chainId>.json` → `block` | first indexer run backfills from deployment |
| R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) | Cloudflare → R2 → API token (Admin Read & Write lets the S3 API create the bucket) | deliverable storage. **Required on Vercel**: the in-memory fallback does not survive between function invocations, so a deliverable uploaded in one request is gone when the verifier reads it |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com | worker/payer emails (optional) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | sentry.io | error reporting (optional) |

Then, from the repo root: `scripts/vercel-env.sh apps/web/.env.production && vercel deploy --prod --yes` (env changes need a redeploy; `vercel deploy` alone gives a preview without the production env). The build command runs `prisma migrate deploy` against `DATABASE_URL_UNPOOLED` before `next build` when that variable is set, so a production deploy applies pending migrations; previews without a database skip the step. Check `https://<app>/api/v1/health` (vault reachable, indexer lag, relayer balances); `vercel logs <domain> --since 10m --json` shows the failing validation when it 500s.

**Crons on the Hobby plan.** Vercel Hobby allows two crons per project, once a day each, so `apps/web/vercel.json` carries no schedules and `.github/workflows/cron.yml` calls the three routes every 5 minutes instead (`gh secret set CRON_SECRET`, `gh variable set VOUCH_APP_URL`). Submissions still verify inline through `after()`; the workflow only drains retries, polls the indexer and runs the timelock. GitHub's schedule is best-effort (it fired once in the first six hours), so the API also ticks itself: job GET and `/api/v1/health` run the indexer (15 s budget) and the timelock after the response when no tick ran in the last 20 s (`apps/web/src/lib/nudge.ts`). Anyone polling a job therefore converges within seconds; the workflow covers jobs nobody is watching. On a Pro plan, put `* * * * *` / `*/5 * * * *` schedules back into `vercel.json` and delete the workflow.

Live since Sept 19: https://vouch-rouge.vercel.app (project `vouch`, team big14ways-projects; testnets Moderato + Base Sepolia, Vault v4).

## 3. Service (Vercel)
Set every variable in `.env.example`. Three that are easy to miss: `MPP_SECRET_KEY` (binds MPP challenges; required in production), `INDEXER_START_BLOCK_<chainId>` (the Vault deployment block, so the first indexer run backfills instead of starting at the head), and per-chain role keys (`INTAKE_PRIVATE_KEY_84532` etc.) when the Tempo and Base roles are different wallets. The cron routes accept `Authorization: Bearer $CRON_SECRET` (what Vercel crons and the GitHub workflow send) or `x-cron-secret`.

## 4. Base webhook (optional, faster than polling)
Alchemy → Custom webhook on the Vault address and the USDC contract → `https://<app>/api/webhooks/alchemy`, signing key in `ALCHEMY_WEBHOOK_SECRET`.

## 5. Agents
Publish `packages/mcp` (`pnpm --filter @gwilll/vouch-mcp build && npm publish --access public`). List the `/fund` route on mpp.dev.

## Local
Postgres: `brew install postgresql@17 && brew services start postgresql@17 && createdb vouch` (or Docker). Then:
```
pnpm install
pnpm --filter @vouch/abi build && pnpm --filter @vouch/shared build
cp .env.example apps/web/.env      # fill DATABASE_URL, JOB_SECRETS_KEY (32 bytes hex), keys
cd apps/web && pnpm db:migrate && pnpm dev
```
Without R2 configured, files are kept in memory (dev only). Without `ANTHROPIC_API_KEY`, submissions queue and the verifier stage shows "failed" with a clear error.
