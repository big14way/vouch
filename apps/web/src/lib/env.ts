import { z } from "zod";

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

/** Server-only env. Parsed lazily so build steps that don't need secrets still succeed. */
const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),

  TEMPO_RPC_URL: z.string().url().default("https://rpc.tempo.xyz"),
  TEMPO_TESTNET_RPC_URL: z.string().url().default("https://rpc.moderato.tempo.xyz"),
  BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),

  VAULT_ADDRESS_4217: addr.optional(),
  VAULT_ADDRESS_42431: addr.optional(),
  VAULT_ADDRESS_8453: addr.optional(),
  VAULT_ADDRESS_84532: addr.optional(),

  /** Chains the service actively serves (indexer, cron, fund routes). */
  ENABLED_CHAINS: z.string().default("42431,84532"),
  DEFAULT_CHAIN: z.coerce.number().default(42431),

  RELAYER_PRIVATE_KEY: hex32.optional(),
  TEMPO_FEEPAYER_PRIVATE_KEY: hex32.optional(),
  VERIFIER_PRIVATE_KEY: hex32.optional(),
  INTAKE_PRIVATE_KEY: hex32.optional(),
  ARBITER_ADDRESS: addr.optional(),
  ARBITER_PRIVATE_KEY: hex32.optional(),
  JOB_SECRETS_KEY: hex32,

  MPP_REALM: z.string().optional(),
  X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),

  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default("vouch"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Vouch <no-reply@vouch.dev>"),
  SUPPORT_EMAIL: z.string().default("support@vouch.dev"),

  ANTHROPIC_API_KEY: z.string().optional(),
  VERIFIER_MODEL: z.string().default("claude-sonnet-4-6"),
  VERIFIER_TIMEOUT_MS: z.coerce.number().default(60_000),
  VERIFIER_MAX_ARTIFACT_BYTES: z.coerce.number().default(2 * 1024 * 1024),

  ALCHEMY_WEBHOOK_SECRET: z.string().optional(),
  TIDX_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  SENTRY_DSN: z.string().optional(),
  ARBITER_ALLOWLIST: z.string().default(""), // comma-separated emails / addresses allowed into S7
  RELAYER_MIN_BALANCE: z.string().default("5000000"), // 5 pathUSD / 0.005 ETH-equivalent alert threshold
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function enabledChains(): number[] {
  return env()
    .ENABLED_CHAINS.split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function appUrl(path = ""): string {
  return `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
}
