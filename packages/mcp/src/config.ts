import { z } from "zod";

const Schema = z.object({
  VOUCH_API_URL: z.string().url().default("https://vouch.dev"),
  VOUCH_API_KEY: z.string().optional(),
  VOUCH_AGENT_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  VOUCH_DEFAULT_CHAIN: z.coerce.number().default(4217),
  VOUCH_MAX_PAYMENT: z.string().default("100"), // display units; the payer's own cap per fund call
  VOUCH_HTTP_PORT: z.coerce.number().optional(),
});

export type Config = z.infer<typeof Schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = Schema.safeParse(env);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid Vouch MCP configuration: ${issues}`);
  }
  return r.data;
}
