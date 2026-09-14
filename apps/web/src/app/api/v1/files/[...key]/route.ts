import { withErrors, errors } from "@/lib/errors";
import { getObject, storageConfigured } from "@/lib/storage";

/** GET /api/v1/files/<key> — serves stored objects when R2 is not configured (local dev). */
export const GET = withErrors(async (_req, ctx: { params: Promise<{ key: string[] }> }) => {
  const { key } = await ctx.params;
  if (storageConfigured()) throw errors.notFound("file");
  const obj = await getObject(key.map(decodeURIComponent).join("/"));
  if (!obj) throw errors.notFound("file");
  return new Response(obj.body as BodyInit, { headers: { "content-type": obj.contentType, "cache-control": "private, max-age=60" } });
});
