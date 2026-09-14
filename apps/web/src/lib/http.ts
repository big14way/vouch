import { NextResponse } from "next/server";

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), init);

export async function body<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = {};
    }
  }
  return schema.parse(raw);
}

export type Ctx = { params: Promise<{ id: string }> };

export function options(): Response {
  return new Response(null, { status: 204 });
}
