"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function Nav({ wide = false }: { wide?: boolean }) {
  const { ready, authenticated, configured, login, logout } = useAuth();
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} className={cn("rounded-md px-3 py-2 text-[15px] min-h-11 inline-flex items-center", path === href ? "text-text font-medium" : "text-muted hover:text-text")}>{label}</Link>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className={cn("mx-auto flex items-center justify-between px-4 py-2", wide ? "max-w-[1120px] sm:px-6" : "max-w-[720px]")}>
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-fg text-[13px]">V</span>
          Vouch
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {authenticated ? link("/dashboard", "Jobs") : null}
          {link("/docs", "Agents")}
          {!configured ? (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
          ) : ready ? (
            authenticated ? (
              <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
            ) : (
              <Button size="sm" onClick={login}>Sign in</Button>
            )
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function Shell({ children, narrow = false, wide = false }: { children: React.ReactNode; narrow?: boolean; wide?: boolean }) {
  return (
    <>
      <Nav wide={wide} />
      <main className={cn("mx-auto w-full px-4", wide ? "max-w-[1120px] pb-16 sm:px-6" : narrow ? "max-w-[480px] py-6 pb-28" : "max-w-[720px] py-6 pb-28")}>{children}</main>
      <footer className={cn("mx-auto px-4 pb-8 text-[13px] text-muted", wide ? "max-w-[1120px] border-t border-border pt-6 sm:px-6" : "max-w-[720px]")}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
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
