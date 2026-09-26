"use client";
import { useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { FileText, UploadCloud, X } from "lucide-react";
import { dur, ease } from "@/components/motion";
import { cn } from "@/lib/utils";

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

function size(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Drop zone. Each file is fingerprinted (sha256) in the browser before upload; the fingerprint is shown per file. */
export function FileDrop({ files, onChange, max = 2 * 1024 * 1024 }: { files: PickedFile[]; onChange: (f: PickedFile[]) => void; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
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
      <input ref={ref} type="file" multiple className="sr-only" id="files" onChange={(e) => void add(e.target.files)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed px-4 py-8 text-center transition-colors duration-150",
          over ? "border-primary/70 bg-primary/[0.06]" : "border-border-strong bg-bg/50 hover:border-faint hover:bg-bg",
        )}
      >
        <span className={cn("grid size-10 place-items-center rounded-full border transition-colors", over ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface text-muted group-hover:text-text")}>
          <UploadCloud className={cn("size-[18px]", busy && "animate-pulse")} />
        </span>
        <span className="text-[14px] font-medium">{busy ? "Fingerprinting…" : "Drop files here, or click to choose"}</span>
        <span className="text-[12px] text-faint">Up to {Math.round(max / 1024 / 1024)} MB each · fingerprinted before review</span>
      </button>
      {err ? <p role="alert" className="mt-1.5 text-[12px] text-danger">{err}</p> : null}
      <AnimatePresence initial={false}>
        {files.length ? (
          <m.ul className="mt-3 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnimatePresence initial={false}>
              {files.map((f, i) => (
                <m.li
                  key={`${f.sha256}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: dur.base, ease: ease.out }}
                  className="flex items-center gap-3 rounded-[var(--r-md)] border border-border bg-bg/60 px-3 py-2.5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] bg-surface text-muted">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {f.name} <span className="font-normal text-faint">· {size(f.size)}</span>
                    </p>
                    <p className="mono mt-0.5 truncate text-[11px] text-faint">sha256 {f.sha256.slice(0, 18)}…{f.sha256.slice(-6)}</p>
                  </div>
                  <button type="button" aria-label={`Remove ${f.name}`} className="grid size-8 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-surface hover:text-text" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </button>
                </m.li>
              ))}
            </AnimatePresence>
          </m.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
