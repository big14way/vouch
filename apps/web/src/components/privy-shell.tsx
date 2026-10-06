"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PrivyProvider, useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { base, baseSepolia, tempo, tempoModerato } from "viem/chains";
import type { Address, EIP1193Provider } from "viem";
import { setTokenGetter } from "@/lib/client/api";
import { AuthContext, WALLET_HELP, type Auth } from "@/lib/client/auth";

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 4217);
const CHAINS = [tempo, tempoModerato, base, baseSepolia];
const WALLET_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("wallet_timeout")), ms))]);
}

function Bridge({ children }: { children: ReactNode }) {
  const { getAccessToken, authenticated, ready, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const [walletError, setWalletError] = useState<string | null>(null);
  const creating = useRef<Promise<Address> | null>(null);
  const healed = useRef(false);
  // Set during render, not in an effect: child effects (the first queries) run before a parent's effect,
  // so an effect-set getter let the first authenticated requests go out without a token and 401.
  setTokenGetter(async () => (ready && authenticated ? getAccessToken() : null));
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  // The linked account is known as soon as login completes, even while the wallet frame is still loading.
  const address = ((wallet?.address ?? user?.wallet?.address) as Address | undefined) ?? null;

  // createOnLogin can fail silently (tester, Oct 6: email linked, no wallet, onboarding stuck on "Creating your wallet…").
  // Create it on demand instead, once at a time, with a timeout and a plain reason when it fails.
  const ensureWallet = useCallback(async (): Promise<Address> => {
    if (address) return address;
    if (!authenticated) throw new Error("Sign in first.");
    if (!creating.current) {
      setWalletError(null);
      creating.current = withTimeout(createWallet().then((w) => w.address as Address), WALLET_TIMEOUT_MS)
        .catch((e: unknown) => {
          console.error("[vouch] wallet creation failed", e);
          setWalletError(WALLET_HELP);
          throw new Error(WALLET_HELP);
        })
        .finally(() => {
          creating.current = null;
        });
    }
    return creating.current;
  }, [address, authenticated, createWallet]);

  // Give createOnLogin a moment to finish; if the wallet frame never reports ready (blocked by the browser), try anyway
  // after 8 s so the attempt times out into a visible reason instead of an endless spinner.
  useEffect(() => {
    if (!ready || !authenticated || address || healed.current) return;
    const t = setTimeout(() => {
      if (healed.current) return;
      healed.current = true;
      ensureWallet().catch(() => undefined);
    }, walletsReady ? 1500 : 8000);
    return () => clearTimeout(t);
  }, [ready, authenticated, walletsReady, address, ensureWallet]);

  const value = useMemo<Auth>(
    () => ({
      ready,
      authenticated,
      configured: true,
      email: user?.email?.address ?? user?.google?.email ?? null,
      address,
      login,
      logout,
      getProvider: async () => (wallet ? ((await wallet.getEthereumProvider()) as unknown as EIP1193Provider) : null),
      ensureWallet,
      walletError: address ? null : walletError,
    }),
    [ready, authenticated, user, wallet, address, login, logout, ensureWallet, walletError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function PrivyShell({ appId, children }: { appId: string; children: ReactNode }) {
  const defaultChain = CHAINS.find((c) => c.id === DEFAULT_CHAIN_ID) ?? tempo;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"], // Google is not enabled in the Privy dashboard; offering it was a dead end on the first click (tester, Oct 4)
        appearance: { theme: "dark", accentColor: "#2fb182", logo: "/icon.svg" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        supportedChains: CHAINS,
        defaultChain,
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
