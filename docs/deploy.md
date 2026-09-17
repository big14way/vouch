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
cd apps/web && pnpm db:deploy       # applies prisma/migrations to DATABASE_URL (Neon)
```

## Go-live checklist (what to gather before step 3)

| Item | Where to get it | Used for |
|---|---|---|
| Vercel project | vercel.com → New project → import `big14way/vouch`, **Root Directory `apps/web`**, framework Next.js; build command `cd ../.. && pnpm --filter @vouch/abi build && pnpm --filter @vouch/shared build && pnpm --filter @vouch/mcp build && cd apps/web && pnpm build` | hosting, crons (`apps/web/vercel.json`) |
| `DATABASE_URL` | neon.tech → project → pooled connection string (`?sslmode=require`); then `pnpm db:deploy` once | Postgres |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | dashboard.privy.io → app → Settings; add the Vercel domain under Allowed origins; enable embedded wallets; add chains 42431 / 84532 (4217 / 8453 for mainnet) | login + embedded wallets |
| `JOB_SECRETS_KEY`, `MPP_SECRET_KEY`, `CRON_SECRET` | `openssl rand -hex 32` each | job salts, MPP challenge binding, cron auth |
| Role keys | `RELAYER_PRIVATE_KEY`, `INTAKE_PRIVATE_KEY`, `VERIFIER_PRIVATE_KEY`, `TEMPO_FEEPAYER_PRIVATE_KEY` (+ `_84532` overrides); fund them (pathUSD on Tempo, ETH on Base) | relays, attribution, attestations, sponsorship |
| `ANTHROPIC_API_KEY` | console.anthropic.com | the verifier (without it every submission reports `failed`) |
| `NEXT_PUBLIC_APP_URL` | the Vercel domain | pay links, discovery doc, MPP realm |
| `INDEXER_START_BLOCK_42431` / `_84532` | `contracts/deployments/<chainId>.json` → `block` | first indexer run backfills from deployment |
| R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) | Cloudflare → R2 → API token | deliverable storage (optional; the memory store is dev-only) |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com | worker/payer emails (optional) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | sentry.io | error reporting (optional) |

Then: `cd apps/web && vercel link && ../../scripts/vercel-env.sh .env.production && vercel --prod`. The crons start within a minute; check `https://<app>/api/v1/health` (vault reachable, indexer lag, relayer balances). `next build` passes locally as of Sept 17 (job page first load 244 kB, API routes 106 kB).

## 3. Service (Vercel)
Set every variable in `.env.example`. Three that are easy to miss: `MPP_SECRET_KEY` (binds MPP challenges; required in production), `INDEXER_START_BLOCK_<chainId>` (the Vault deployment block, so the first indexer run backfills instead of starting at the head), and per-chain role keys (`INTAKE_PRIVATE_KEY_84532` etc.) when the Tempo and Base roles are different wallets. `vercel.json` schedules the indexer and verifier every minute and the timelock every 5 minutes; set `CRON_SECRET` and Vercel sends it as a bearer token.

## 4. Base webhook (optional, faster than polling)
Alchemy → Custom webhook on the Vault address and the USDC contract → `https://<app>/api/webhooks/alchemy`, signing key in `ALCHEMY_WEBHOOK_SECRET`.

## 5. Agents
Publish `packages/mcp` (`pnpm --filter @vouch/mcp build && npm publish --access public`). List the `/fund` route on mpp.dev.

## Local
Postgres: `brew install postgresql@17 && brew services start postgresql@17 && createdb vouch` (or Docker). Then:
```
pnpm install
pnpm --filter @vouch/abi build && pnpm --filter @vouch/shared build
cp .env.example apps/web/.env      # fill DATABASE_URL, JOB_SECRETS_KEY (32 bytes hex), keys
cd apps/web && pnpm db:migrate && pnpm dev
```
Without R2 configured, files are kept in memory (dev only). Without `ANTHROPIC_API_KEY`, submissions queue and the verifier stage shows "failed" with a clear error.
