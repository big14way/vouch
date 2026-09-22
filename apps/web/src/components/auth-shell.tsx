"use client";
import type { ReactNode } from "react";
import { PrivyShell } from "./privy-shell";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/** Privy around the app routes. Without an app id (local dev, CI) the default AuthContext applies and pages render signed-out. */
export function AuthShell({ children }: { children: ReactNode }) {
  return appId ? <PrivyShell appId={appId}>{children}</PrivyShell> : <>{children}</>;
}
