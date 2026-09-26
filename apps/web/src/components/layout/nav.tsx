"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { ArrowUpRight, Check, Copy, LogOut, Plus, Wallet } from "lucide-react";
import { shortAddress } from "@vouch/shared";
import { useAuth } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { dur, ease } from "@/components/motion";
import { cn } from "@/lib/utils";

/** The mark: a rounded tile with a check drawn as the V. */
export function Logo({ className, markOnly = false, size = 24 }: { className?: string; markOnly?: boolean; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]", className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--primary)" />
        <path d="M6.8 11.6l3.5 3.6 7-7.6" fill="none" stroke="var(--primary-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {markOnly ? null : "Vouch"}
    </span>
  );
}

function AccountMenu() {
  const { email, address, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const initial = (email ?? address ?? "?").slice(0, 1).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account"
        className="flex h-8 items-center gap-2 rounded-[var(--r-pill)] border border-border bg-surface pl-1 pr-2.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
      >
        <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-info/70 text-[11px] font-semibold text-primary-fg">{initial}</span>
        <span className="mono hidden sm:inline">{address ? shortAddress(address) : "Account"}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: dur.fast } }}
            transition={{ duration: dur.fast, ease: ease.out }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-[var(--r-lg)] border border-border bg-overlay shadow-[var(--shadow-pop)]"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-[13px] font-medium">{email ?? "Signed in"}</p>
              {address ? (
                <button
                  type="button"
                  className="mono mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-text"
                  onClick={async () => {
                    await navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                >
                  {shortAddress(address)} {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                </button>
              ) : null}
            </div>
            <div className="p-1.5">
              <Link href="/withdraw" onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 text-[13px] text-muted hover:bg-surface hover:text-text">
                <Wallet className="size-4" /> Balances and withdraw
              </Link>
              <Link href="/docs" onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 text-[13px] text-muted hover:bg-surface hover:text-text">
                <ArrowUpRight className="size-4" /> Use Vouch from an agent
              </Link>
              <button type="button" onClick={() => void logout()} className="flex h-9 w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 text-[13px] text-muted hover:bg-surface hover:text-text">
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Nav({ wide = false }: { wide?: boolean }) {
  const { ready, authenticated, configured, login } = useAuth();
  const path = usePathname();
  const link = (href: string, label: string) => {
    const active = path === href || (href === "/dashboard" && path.startsWith("/j/"));
    return (
      <Link href={href} className={cn("relative inline-flex h-8 items-center rounded-[var(--r-sm)] px-3 text-[13px] transition-colors", active ? "text-text" : "text-muted hover:text-text")}>
        {label}
        {active ? <m.span layoutId="nav-active" className="absolute inset-x-3 -bottom-[13px] h-px bg-text" transition={{ duration: dur.base, ease: ease.out }} /> : null}
      </Link>
    );
  };
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
      <div className={cn("mx-auto flex h-14 items-center justify-between gap-4 px-5 sm:px-8", wide ? "max-w-[1200px]" : "max-w-[1200px]")}>
        <div className="flex items-center gap-6">
          <Link href={authenticated ? "/dashboard" : "/"} aria-label="Vouch home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
            {authenticated ? link("/dashboard", "Jobs") : null}
            {link("/docs", "For agents")}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {!configured ? (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
          ) : ready ? (
            authenticated ? (
              <>
                {path !== "/new" ? (
                  <Link href="/new" className={buttonVariants({ size: "sm" })}>
                    <Plus className="size-3.5" strokeWidth={2.5} /> <span className="hidden sm:inline">New job</span><span className="sm:hidden">New</span>
                  </Link>
                ) : null}
                <AccountMenu />
              </>
            ) : (
              <Button size="sm" onClick={login}>Sign in</Button>
            )
          ) : (
            <span className="h-8 w-24 animate-pulse rounded-[var(--r-pill)] bg-surface" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Page frame. `narrow` centres a single card (sign-in, onboarding); default is the 1200 px app width;
 * `wide` is the marketing width used by the landing page.
 */
export function Shell({ children, narrow = false, wide = false }: { children: React.ReactNode; narrow?: boolean; wide?: boolean }) {
  return (
    <>
      <Nav wide={wide} />
      <main className={cn("mx-auto w-full px-5 sm:px-8", narrow ? "max-w-[460px] py-12 sm:py-20" : wide ? "max-w-[1120px] pb-16" : "max-w-[1200px] py-8 pb-32 sm:py-10")}>{children}</main>
      <footer className={cn("mx-auto w-full px-5 pb-10 text-[12px] text-faint sm:px-8", wide ? "max-w-[1120px] border-t border-border pt-6" : "max-w-[1200px]")}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>Settled on Tempo · Base</span>
          <Link href="/docs" className="hover:text-text">For agents</Link>
          <a href="https://github.com/big14way/vouch" className="hover:text-text" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@vouch.dev"}`} className="hover:text-text">Report a problem</a>
        </div>
      </footer>
    </>
  );
}
