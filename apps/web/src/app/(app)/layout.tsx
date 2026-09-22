import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth-shell";

/** Routes that need identity or a wallet. The public pages (landing, docs, legal) stay outside this group and ship no wallet SDK. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
