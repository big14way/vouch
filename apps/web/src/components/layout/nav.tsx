"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const { ready, authenticated, login, logout } = useAuth();
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} className={cn("rounded-md px-3 py-2 text-[15px] min-h-11 inline-flex items-center", path === href ? "text-text font-medium" : "text-muted hover:text-text")}>{label}</Link>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold" aria-label="Vouch home">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-fg text-[13px]">V</span>
          Vouch
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {authenticated ? link("/dashboard", "Jobs") : null}
          {link("/docs", "Agents")}
          {ready ? (
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

export function Shell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <>
      <Nav />
      <main className={cn("mx-auto w-full px-4 py-6 pb-28", narrow ? "max-w-[480px]" : "max-w-[720px]")}>{children}</main>
      <footer className="mx-auto max-w-[720px] px-4 pb-8 text-[13px] text-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Settled on Tempo · Base</span>
          <Link href="/docs" className="hover:text-text">For agents</Link>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@vouch.dev"}`} className="hover:text-text">Report a problem</a>
        </div>
      </footer>
    </>
  );
}
