import type { DeliveryManifest } from "@vouch/shared";
import { createHash } from "node:crypto";
import { env } from "../env";
import { getObject } from "../storage";

/** A fetched artifact, ready to be placed in the prompt as an untrusted block. */
export type Artifact =
  | { kind: "text"; name: string; text: string; sha256: string; truncated: boolean }
  | { kind: "image"; name: string; base64: string; mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; sha256: string }
  | { kind: "error"; name: string; error: string; sha256: string | null };

const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml|markdown|csv|sql|toml))/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_TEXT_CHARS = 60_000;

function sha(bytes: Uint8Array): string {
  return `0x${createHash("sha256").update(bytes).digest("hex")}`;
}

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, MAX_TEXT_CHARS)}\n…[truncated ${text.length - MAX_TEXT_CHARS} chars]`, truncated: true };
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const mod = await import("pdf-parse");
  const Parser = (mod as unknown as { PDFParse: new (o: { data: Uint8Array }) => { getText: () => Promise<{ text: string }>; destroy?: () => Promise<void> } }).PDFParse;
  const parser = new Parser({ data: bytes });
  try {
    const r = await parser.getText();
    return r.text;
  } finally {
    await parser.destroy?.();
  }
}

export async function bytesToArtifact(name: string, contentType: string, bytes: Uint8Array): Promise<Artifact> {
  const hash = sha(bytes);
  const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  try {
    if (IMAGE_TYPES.has(ct)) {
      return { kind: "image", name, base64: Buffer.from(bytes).toString("base64"), mediaType: ct as "image/png", sha256: hash };
    }
    if (ct === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      const { text, truncated } = clip(await pdfToText(bytes));
      return { kind: "text", name, text, sha256: hash, truncated };
    }
    if (TEXT_TYPES.test(ct) || ct === "" || /\.(md|txt|json|csv|js|ts|tsx|py|sol|html|css|yml|yaml|toml|sql|rs|go)$/i.test(name)) {
      const { text, truncated } = clip(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
      return { kind: "text", name, text, sha256: hash, truncated };
    }
    return { kind: "error", name, error: `Unsupported content type ${ct || "unknown"} (${bytes.length} bytes). Not reviewed.`, sha256: hash };
  } catch (e) {
    return { kind: "error", name, error: `Could not decode: ${e instanceof Error ? e.message : String(e)}`, sha256: hash };
  }
}

async function fetchWithLimit(url: string, headers: Record<string, string> = {}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const max = env().VERIFIER_MAX_ARTIFACT_BYTES;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { headers: { "user-agent": "vouch-verifier/0.1", ...headers }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > max) throw new Error(`larger than ${Math.round(max / 1024 / 1024)} MB`);
    return { bytes: buf, contentType: res.headers.get("content-type") ?? "" };
  } finally {
    clearTimeout(t);
  }
}

const GITHUB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/(pull|tree|blob|commit)\/([^/#?]+))?/i;

/** GitHub: README + (for PRs) the diff, via the public API. */
async function fetchGithub(url: string): Promise<Artifact[]> {
  const m = url.match(GITHUB_RE);
  if (!m) return [];
  const [, owner, repoRaw, kind, ref] = m;
  const repo = repoRaw!.replace(/\.git$/, "");
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const out: Artifact[] = [];
  try {
    const readme = await fetchWithLimit(`${api}/readme`, { ...headers, accept: "application/vnd.github.raw+json" });
    out.push(await bytesToArtifact(`${owner}/${repo}/README`, "text/markdown", readme.bytes));
  } catch (e) {
    out.push({ kind: "error", name: `${owner}/${repo}/README`, error: `README not fetched: ${e instanceof Error ? e.message : e}`, sha256: null });
  }
  if (kind === "pull" && ref) {
    try {
      const diff = await fetchWithLimit(`${api}/pulls/${ref}`, { ...headers, accept: "application/vnd.github.diff" });
      out.push(await bytesToArtifact(`${owner}/${repo}/pull/${ref}.diff`, "text/plain", diff.bytes));
    } catch (e) {
      out.push({ kind: "error", name: `${owner}/${repo}/pull/${ref}.diff`, error: `Diff not fetched: ${e instanceof Error ? e.message : e}`, sha256: null });
    }
  }
  return out;
}

const FIGMA_RE = /^https?:\/\/(www\.)?figma\.com\/(file|design|proto)\/([A-Za-z0-9]+)/i;

async function fetchFigma(url: string): Promise<Artifact[]> {
  const m = url.match(FIGMA_RE);
  if (!m) return [];
  const key = m[3];
  const token = process.env.FIGMA_TOKEN;
  if (!token) return [{ kind: "error", name: `figma/${key}`, error: "Figma link: metadata not fetched (no FIGMA_TOKEN). Treat as unverifiable unless a screenshot was provided.", sha256: null }];
  try {
    const r = await fetchWithLimit(`https://api.figma.com/v1/files/${key}?depth=2`, { "x-figma-token": token });
    const json = JSON.parse(new TextDecoder().decode(r.bytes)) as { name?: string; lastModified?: string; document?: { children?: { name: string; children?: { name: string }[] }[] } };
    const pages = (json.document?.children ?? []).map((p) => `${p.name}: ${(p.children ?? []).map((c) => c.name).join(", ")}`).join("\n");
    const text = `Figma file: ${json.name}\nLast modified: ${json.lastModified}\nPages/frames:\n${pages}`;
    return [{ kind: "text", name: `figma/${key}`, text, sha256: sha(new TextEncoder().encode(text)), truncated: false }];
  } catch (e) {
    return [{ kind: "error", name: `figma/${key}`, error: `Figma metadata not fetched: ${e instanceof Error ? e.message : e}`, sha256: null }];
  }
}

export async function fetchLink(url: string): Promise<Artifact[]> {
  if (GITHUB_RE.test(url)) return fetchGithub(url);
  if (FIGMA_RE.test(url)) return fetchFigma(url);
  try {
    const { bytes, contentType } = await fetchWithLimit(url);
    let ct = contentType;
    if (/text\/html/i.test(ct)) {
      // Strip tags so the model reads the content, not the markup.
      const html = new TextDecoder().decode(bytes);
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return [await bytesToArtifact(url, "text/plain", new TextEncoder().encode(text))];
    }
    if (!ct) ct = "application/octet-stream";
    return [await bytesToArtifact(url, ct, bytes)];
  } catch (e) {
    return [{ kind: "error", name: url, error: `Link not accessible: ${e instanceof Error ? e.message : String(e)}`, sha256: null }];
  }
}

/** Load every pinned file and linked resource of a manifest. Order is deterministic (files, then links). */
export async function loadArtifacts(manifest: DeliveryManifest): Promise<Artifact[]> {
  const out: Artifact[] = [];
  for (const f of manifest.files) {
    const obj = await getObject(f.url);
    if (!obj) {
      out.push({ kind: "error", name: f.name, error: "Pinned file missing from storage.", sha256: f.sha256 });
      continue;
    }
    const a = await bytesToArtifact(f.name, f.contentType || obj.contentType, obj.body);
    if (a.kind !== "error" && a.sha256 !== f.sha256) {
      out.push({ kind: "error", name: f.name, error: "Stored bytes do not match the pinned sha256. Not reviewed.", sha256: f.sha256 });
      continue;
    }
    out.push(a);
  }
  for (const l of manifest.links) out.push(...(await fetchLink(l)));
  return out;
}
