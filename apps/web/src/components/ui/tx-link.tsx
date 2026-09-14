import { ExternalLink } from "lucide-react";
import { shortHash, txUrl } from "@vouch/shared";

export function TxLink({ chainId, hash, label }: { chainId: number; hash: string; label?: string }) {
  return (
    <a href={txUrl(chainId, hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-info hover:underline mono">
      {label ?? shortHash(hash)}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}
