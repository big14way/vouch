import { llmsTxt } from "@/lib/openapi";

export const dynamic = "force-dynamic";

/** llms.txt: agent-readable summary of how to use Vouch. Linked from x-service-info.docs.llms. */
export function GET() {
  return new Response(llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
