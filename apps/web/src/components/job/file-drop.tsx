"use client";
import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PickedFile { name: string; contentType: string; size: number; sha256: `0x${string}`; base64: string }

async function sha256Hex(buf: ArrayBuffer): Promise<`0x${string}`> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return `0x${Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Files are fingerprinted (sha256) in the browser before upload, and the hash is shown next to each file. */
export function FileDrop({ files, onChange, max = 2 * 1024 * 1024 }: { files: PickedFile[]; onChange: (f: PickedFile[]) => void; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async (list: FileList | null) => {
    if (!list) return;
    setErr(null);
    setBusy(true);
    const out: PickedFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > max) {
        setErr(`${f.name} is larger than ${Math.round(max / 1024 / 1024)} MB. Compress it or share a link.`);
        continue;
      }
      const buf = await f.arrayBuffer();
      out.push({ name: f.name, contentType: f.type || "application/octet-stream", size: f.size, sha256: await sha256Hex(buf), base64: toBase64(buf) });
    }
    onChange([...files, ...out]);
    setBusy(false);
  };
  return (
    <div>
      <div
        className="rounded-[var(--r-md)] border border-dashed border-border p-4 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void add(e.dataTransfer.files);
        }}
      >
        <input ref={ref} type="file" multiple className="sr-only" id="files" onChange={(e) => void add(e.target.files)} />
        <Button type="button" variant="secondary" loading={busy} onClick={() => ref.current?.click()}>
          <Paperclip className="size-4" aria-hidden /> Add files
        </Button>
        <p className="mt-2 text-[13px] text-muted">Up to {Math.round(max / 1024 / 1024)} MB each. Each file is fingerprinted before review.</p>
      </div>
      {err ? <p role="alert" className="mt-1.5 text-[13px] text-danger">{err}</p> : null}
      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.sha256}-${i}`} className="flex items-center gap-2 rounded-[var(--r-md)] border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{f.name}</p>
                <p className="mono truncate text-[11px] text-muted">{f.sha256}</p>
              </div>
              <button type="button" aria-label={`Remove ${f.name}`} className="grid size-9 place-items-center rounded-md hover:bg-surface" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
