import { Mppx, evm, tempo } from "mppx/server";
import { Receipt } from "mppx";
import type { Address } from "viem";
import { BASE_MAINNET_ID, TEMPO_MODERATO_ID, TOKENS, defaultToken, isTempo, type ChainId } from "@vouch/shared";
import { accountFor, hasRole, vaultAddress } from "./chain/clients";
import { env } from "./env";

/**
 * One mppx server instance per chain.
 *  - Tempo: `tempo/charge` — the agent pays a TIP-20 transfer straight into the Vault with `memo = jobId`.
 *    Pull-mode clients get fees sponsored by our feePayer account when one is configured.
 *  - Base:  `evm/charge` — EIP-3009 `transferWithAuthorization` into the Vault, settled through an
 *    x402 facilitator. Speaks both the native Payment-auth wire format and x402 (X-PAYMENT).
 * The route handler runs only after the payment is verified; it then attributes the deposit and funds the job.
 */
type Instance = Record<string, unknown>;
const instances = new Map<number, Instance>();

const USDC_DOMAIN: Record<number, { name: string; version: string }> = {
  [BASE_MAINNET_ID]: { name: "USD Coin", version: "2" },
  84532: { name: "USDC", version: "2" },
};

export function realm(): string {
  const e = env();
  return e.MPP_REALM ?? new URL(e.NEXT_PUBLIC_APP_URL).host;
}

export function mppFor(chainId: ChainId): Instance {
  const cached = instances.get(chainId);
  if (cached) return cached;
  let inst: Instance;
  const recipient = vaultAddress(chainId);
  const token = defaultToken(chainId);
  if (isTempo(chainId)) {
    inst = Mppx.create({
      realm: realm(),
      methods: [
        tempo({
          currency: token.address,
          recipient,
          testnet: chainId === TEMPO_MODERATO_ID,
          ...(hasRole("feePayer") ? { feePayer: accountFor("feePayer") } : {}),
        }),
      ],
    }) as unknown as Instance;
  } else {
    const domain = USDC_DOMAIN[chainId] ?? { name: "USD Coin", version: "2" };
    inst = Mppx.create({
      realm: realm(),
      methods: [
        evm({
          currency: token.address,
          chainId,
          decimals: 6,
          authorization: domain,
          recipient,
          x402: { facilitator: env().X402_FACILITATOR_URL },
        }),
      ],
    }) as unknown as Instance;
  }
  instances.set(chainId, inst);
  return inst;
}

export interface ChargeSpec {
  chainId: ChainId;
  token: Address;
  /** Display units, e.g. "5.00". */
  amount: string;
  description: string;
  jobId: `0x${string}`;
}

/** Build the configured charge handler for a job. Tempo carries `memo = jobId` so the transfer is self-describing on-chain. */
export function chargeHandler(spec: ChargeSpec) {
  const inst = mppFor(spec.chainId) as Record<string, (o: Record<string, unknown>) => (req: Request) => Promise<ChargeResult>>;
  const common = { amount: spec.amount, description: spec.description, externalId: spec.jobId, currency: spec.token, recipient: vaultAddress(spec.chainId) };
  if (isTempo(spec.chainId)) {
    const fn = inst["tempo/charge"];
    if (!fn) throw new Error("tempo/charge not configured");
    return fn({ ...common, memo: spec.jobId });
  }
  const fn = inst["evm/charge"];
  if (!fn) throw new Error("evm/charge not configured");
  return fn(common);
}

export type ChargeResult =
  | { status: 402; challenge: Response }
  | { status: 200; withReceipt: (res: Response) => Response };

/** Extract the settlement reference (tx hash on Tempo; facilitator reference/tx hash on Base) from a receipted response. */
export function receiptFromResponse(res: Response): { reference: string; method: string } | null {
  const header = res.headers.get("Payment-Receipt");
  if (!header) return null;
  try {
    const r = Receipt.deserialize(header);
    return { reference: r.reference, method: r.method };
  } catch {
    return null;
  }
}

export function tokenForChain(chainId: ChainId, token?: string) {
  const list = TOKENS[chainId];
  const found = token ? list.find((t) => t.address.toLowerCase() === token.toLowerCase()) : list[0];
  return found;
}
