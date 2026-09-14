import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

/**
 * Cloudflare R2 (S3 API). Deliverables under `jobs/{id}/{sha256}`, verdict reports under
 * `verdicts/{id}/{attestationHash}.json`. Falls back to an in-memory map when R2 is not configured
 * (local development / tests) so the flow still works end-to-end.
 */
const memory = new Map<string, { body: Uint8Array; contentType: string }>();

let client: S3Client | undefined;
function s3(): S3Client | undefined {
  const e = env();
  if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY) return undefined;
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  });
  return client;
}

export function storageConfigured(): boolean {
  return Boolean(s3());
}

export async function putObject(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const c = s3();
  if (!c) {
    memory.set(key, { body: bytes, contentType });
    return;
  }
  await c.send(new PutObjectCommand({ Bucket: env().R2_BUCKET, Key: key, Body: bytes, ContentType: contentType }));
}

export async function getObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  const c = s3();
  if (!c) return memory.get(key) ?? null;
  try {
    const res = await c.send(new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key }));
    const body = await res.Body?.transformToByteArray();
    if (!body) return null;
    return { body, contentType: res.ContentType ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Time-limited download URL. When R2 is not configured, points at the app's own proxy route. */
export async function objectUrl(key: string, expiresIn = 3600): Promise<string> {
  const c = s3();
  if (!c) return `${env().NEXT_PUBLIC_APP_URL}/api/v1/files/${encodeURIComponent(key)}`;
  return getSignedUrl(c, new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key }), { expiresIn });
}

export const keys = {
  deliverable: (jobId: string, sha256: string) => `jobs/${jobId}/${sha256}`,
  manifest: (jobId: string, manifestHash: string) => `jobs/${jobId}/manifest-${manifestHash}.json`,
  verdict: (jobId: string, attestationHash: string) => `verdicts/${jobId}/${attestationHash}.json`,
};
