import { ArrowUpRight } from "lucide-react";
import { shortHash, txUrl } from "@vouch/shared";
import { cn } from "@/lib/utils";

export function TxLink({ chainId, hash, label, className }: { chainId: number; hash: string; label?: string; className?: string }) {
  return (
    <a href={txUrl(chainId, hash)} target="_blank" rel="noreferrer" className={cn("group inline-flex items-center gap-0.5 text-[12px] text-muted transition-colors hover:text-text", !label && "mono", className)}>
      {label ?? shortHash(hash)}
      <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
    </a>
  );
}
