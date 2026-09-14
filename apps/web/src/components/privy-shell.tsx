"use client";
import { useEffect, useMemo, type ReactNode } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { base, baseSepolia, tempo, tempoModerato } from "viem/chains";
import type { Address, EIP1193Provider } from "viem";
import { setTokenGetter } from "@/lib/client/api";
import { AuthContext, type Auth } from "@/lib/client/auth";

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 4217);
const CHAINS = [tempo, tempoModerato, base, baseSepolia];

function Bridge({ children }: { children: ReactNode }) {
  const { getAccessToken, authenticated, ready, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  useEffect(() => {
    setTokenGetter(async () => (ready && authenticated ? getAccessToken() : null));
  }, [getAccessToken, authenticated, ready]);
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const value = useMemo<Auth>(
    () => ({
      ready,
      authenticated,
      configured: true,
      email: user?.email?.address ?? user?.google?.email ?? null,
      address: (wallet?.address as Address | undefined) ?? null,
      login,
      logout,
      getProvider: async () => (wallet ? ((await wallet.getEthereumProvider()) as unknown as EIP1193Provider) : null),
    }),
    [ready, authenticated, user, wallet, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function PrivyShell({ appId, children }: { appId: string; children: ReactNode }) {
  const defaultChain = CHAINS.find((c) => c.id === DEFAULT_CHAIN_ID) ?? tempo;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { theme: "light", accentColor: "#0A6C4E", logo: "/icon.svg" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        supportedChains: CHAINS,
        defaultChain,
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
