"use client";
import { createContext, useContext } from "react";
import type { Address, EIP1193Provider } from "viem";

/**
 * Thin auth surface the app talks to. Privy (large) implements it inside a lazily-loaded shell,
 * so public pages (the job page, docs) don't ship the wallet SDK in their first load.
 */
export interface Auth {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  email: string | null;
  address: Address | null;
  login: () => void;
  logout: () => Promise<void> | void;
  /** EIP-1193 provider of the user's embedded wallet, once it exists. */
  getProvider: () => Promise<EIP1193Provider | null>;
  /** Returns the wallet address, creating the embedded wallet first if login did not (times out after 20 s). */
  ensureWallet: () => Promise<Address>;
  /** Plain-language reason the wallet could not be created, if the last attempt failed. */
  walletError: string | null;
}

/** Shown when the embedded wallet cannot be created; the usual cause is a browser blocking Privy's frame. */
export const WALLET_HELP =
  "We could not create your wallet. A browser privacy setting is the usual cause (Brave Shields, strict tracking protection, an ad blocker): allow auth.privy.io for this site, then try again.";

export const AuthContext = createContext<Auth>({
  ready: false,
  authenticated: false,
  configured: false,
  email: null,
  address: null,
  login: () => undefined,
  logout: () => undefined,
  getProvider: async () => null,
  ensureWallet: async () => {
    throw new Error("Sign in first.");
  },
  walletError: null,
});

export function useAuth(): Auth {
  return useContext(AuthContext);
}
