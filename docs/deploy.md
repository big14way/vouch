# Deploy

## 1. Contracts
```
cd contracts
cp ../.env.example ../.env    # DEPLOYER_PRIVATE_KEY, ARBITER_ADDRESS, INTAKE_ADDRESS, VERIFIER_ADDRESS, FEE_RECIPIENT
./script/deploy-tempo.sh                                                  # Tempo testnet (RPC_URL=https://rpc.tempo.xyz for mainnet); explicit gas, see contracts/README.md
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```
Testnet funds: `cast rpc tempo_fundAddress <address> --rpc-url https://rpc.moderato.tempo.xyz`. Then `pnpm --filter @vouch/example-moderato-e2e start` proves the deployment end-to-end.
Copy `deployments/<chainId>.json` addresses into `packages/abi/addresses.json` (or set `VAULT_ADDRESS_<chainId>`).

Fund the server keys: intake/relayer/verifier/feePayer need pathUSD on Tempo (fees are paid in stablecoin) and a little ETH on Base (~0.01).

## 2. Database
```
cd apps/web && pnpm db:deploy       # applies prisma/migrations to DATABASE_URL (Neon)
```

## 3. Service (Vercel)
Set every variable in `.env.example`. `vercel.json` schedules the indexer and verifier every minute and the timelock every 5 minutes; set `CRON_SECRET` and Vercel sends it as a bearer token.

## 4. Base webhook (optional, faster than polling)
Alchemy → Custom webhook on the Vault address and the USDC contract → `https://<app>/api/webhooks/alchemy`, signing key in `ALCHEMY_WEBHOOK_SECRET`.

## 5. Agents
Publish `packages/mcp` (`pnpm --filter @vouch/mcp build && npm publish --access public`). List the `/fund` route on mpp.dev.

## Local
```
pnpm install
pnpm --filter @vouch/abi build && pnpm --filter @vouch/shared build
cp .env.example apps/web/.env      # fill DATABASE_URL, JOB_SECRETS_KEY (32 bytes hex), keys
cd apps/web && pnpm db:migrate && pnpm dev
```
Without R2 configured, files are kept in memory (dev only). Without `ANTHROPIC_API_KEY`, submissions queue and the verifier stage shows "failed" with a clear error.
