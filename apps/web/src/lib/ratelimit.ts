import { errors } from "./errors";

/**
 * Sliding-window limiter, in-process. Good enough for a single Vercel region and for the demo;
 * swap `store` for Upstash in multi-instance deployments.
 */
const store = new Map<string, number[]>();

export interface LimitOptions {
  /** Max requests per window. */
  limit: number;
  /** Window in ms. */
  windowMs: number;
}

export const LIMITS = {
  post: { limit: 30, windowMs: 60_000 },
  fund: { limit: 10, windowMs: 60_000 },
  submit: { limit: 10, windowMs: 60_000 },
  read: { limit: 240, windowMs: 60_000 },
  keys: { limit: 5, windowMs: 60_000 },
} as const satisfies Record<string, LimitOptions>;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export function rateLimit(req: Request, bucket: keyof typeof LIMITS, key = clientIp(req)): void {
  const { limit, windowMs } = LIMITS[bucket];
  const now = Date.now();
  const k = `${bucket}:${key}`;
  const hits = (store.get(k) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw errors.rateLimited();
  hits.push(now);
  store.set(k, hits);
  if (store.size > 10_000) {
    for (const [sk, v] of store) if (v.every((t) => now - t >= windowMs)) store.delete(sk);
  }
}
