import { discoveryDocument } from "@/lib/openapi";

export const dynamic = "force-dynamic";

/** MPP discovery document at the canonical path (mpp.dev/advanced/discovery). Registries fetch this. */
export function GET() {
  return Response.json(discoveryDocument(), { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
