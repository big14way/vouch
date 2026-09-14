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
}

export const AuthContext = createContext<Auth>({
  ready: false,
  authenticated: false,
  configured: false,
  email: null,
  address: null,
  login: () => undefined,
  logout: () => undefined,
  getProvider: async () => null,
});

export function useAuth(): Auth {
  return useContext(AuthContext);
}
