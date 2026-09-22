import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button-variants";
import { HeroDemo } from "@/components/landing/hero-demo";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LiveCounter } from "@/components/landing/live-counter";
import { AgentTerminal } from "@/components/landing/agent-terminal";
import { Reveal } from "@/components/landing/reveal";
import { FingerprintGlyph, ShieldGlyph, SlidersGlyph, TerminalGlyph } from "@/components/landing/glyphs";
import { cn } from "@/lib/utils";
import workerDesk from "@/assets/img/worker-desk.jpg";
import workerWriting from "@/assets/img/worker-writing.jpg";
import paidPhone from "@/assets/img/paid-phone.jpg";
import productJob from "@/assets/img/product-job.jpg";

export const dynamic = "force-static";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://vouch-rouge.vercel.app";
const REPO = "https://github.com/big14way/vouch";
const LIVE_JOB = `${APP}/j/0xc116004cc5eaad86fce7c8b3497ca0c4b201c3f880142cb272994706ed6226fe`;

const primaryLg = cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto");
const secondaryLg = cn(buttonVariants({ size: "lg", variant: "secondary" }), "w-full sm:w-auto");

function SectionHeading({ eyebrow, title, body, id }: { eyebrow: string; title: string; body?: string; id?: string }) {
  return (
    <Reveal className="max-w-[640px]">
      <p className="mono text-[13px] uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] sm:text-[36px]">{title}</h2>
      {body ? <p className="mt-3 text-[17px] text-muted">{body}</p> : null}
    </Reveal>
  );
}

/** S0 Landing: the real job card playing its states, two doors (people / agents), five steps, proof with artefacts. */
export default function Landing() {
  return (
    <Shell wide>
      {/* Hero */}
      <section className="relative grid items-center gap-10 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-20" aria-labelledby="hero">
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-[640px] w-[min(1400px,140vw)] -translate-x-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(45%_55%_at_22%_18%,rgba(47,177,130,0.26),transparent_70%),radial-gradient(35%_45%_at_82%_28%,rgba(242,183,5,0.12),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(55%_55%_at_50%_35%,black,transparent)]" />
        </div>
        <div>
          <p className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border border-border bg-surface px-3 py-1 text-[13px] text-muted">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            For freelancers, teams and AI agents
          </p>
          <h1 id="hero" className="mt-5 text-[38px] font-semibold leading-[1.02] tracking-[-0.025em] sm:text-[52px] lg:text-[60px]">
            Pay when it&rsquo;s delivered.
            <br />
            <span className="text-primary">Get paid when it&rsquo;s verified.</span>
          </h1>
          <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-muted sm:text-[19px]">
            Lock the money against a written scope. An independent check compares the delivery to that scope and records the result. Payment releases under rules you chose.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/new" className={primaryLg}>
              Create a job link <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a href="#agents" className={secondaryLg}>
              <TerminalGlyph width={18} height={18} /> Send an agent
            </a>
          </div>
          <LiveCounter className="mt-6 flex flex-wrap gap-x-5 gap-y-1" />
        </div>
        <div className="mx-auto w-full max-w-[460px] lg:max-w-none">
          <div data-theme="light" className="text-text">
            <HeroDemo />
          </div>
          <p className="mt-5 text-center text-[13px] text-muted">
            The real job card, playing its five states.{" "}
            <a href={LIVE_JOB} className="text-primary hover:underline" target="_blank" rel="noreferrer">
              Open a job that settled on the public deployment <ArrowUpRight className="inline size-3.5" aria-hidden />
            </a>
          </p>
        </div>
      </section>

      {/* The problem */}
      <section className="mt-24 grid items-center gap-10 sm:mt-32 lg:grid-cols-2 lg:gap-16" aria-labelledby="problem">
        <div className="relative order-2 lg:order-1">
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-border shadow-[var(--shadow)]">
              <Image src={workerDesk} alt="A freelancer working at a desk on a laptop" sizes="(min-width: 1024px) 520px, 100vw" placeholder="blur" className="aspect-[3/2] w-full object-cover" />
            </div>
          </Reveal>
          <Reveal delay={0.12} className="absolute -bottom-6 right-0 w-[46%] max-w-[240px] lg:-right-6">
            <div className="overflow-hidden rounded-[var(--r-lg)] border-4 border-bg shadow-[var(--shadow)] ring-1 ring-border">
              <Image src={workerWriting} alt="A worker writing notes beside a laptop" sizes="240px" placeholder="blur" className="aspect-[4/5] w-full object-cover" />
            </div>
          </Reveal>
        </div>
        <div className="order-1 lg:order-2">
          <SectionHeading id="problem" eyebrow="The problem" title="Work first, then hope. That is the deal today." />
          <Reveal delay={0.06}>
            <ul className="mt-6 space-y-4 text-[17px] text-muted">
              <li className="flex gap-3">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>You finish the work, send the invoice, and wait. Across 100,000+ freelancers on Bonsai, 29% of invoices are paid late.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>You pay upfront and hope the delivery matches what you asked for. If it does not, the money is already gone.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>An AI agent that hires another agent has no way to hold money until the result checks out.</span>
              </li>
            </ul>
            <p className="mt-6 text-[17px] font-medium">Vouch puts the money in the middle, with a referee both sides can read.</p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-24 sm:mt-32" aria-labelledby="how">
        <SectionHeading id="how" eyebrow="How it works" title="Five steps. The money never leaves the vault until the scope is met." />
        <div className="mt-10 sm:mt-14">
          <HowItWorks />
        </div>
      </section>

      {/* Two doors */}
      <section id="start" className="mt-24 grid gap-4 sm:mt-32 lg:grid-cols-2" aria-label="Get started">
        <Reveal className="min-w-0">
          <article className="flex h-full flex-col overflow-hidden rounded-[var(--r-lg)] border border-border bg-bg shadow-[var(--shadow)]">
            <div className="relative">
              <Image src={paidPhone} alt="A man smiling at a payment notification on his phone" sizes="(min-width: 1024px) 540px, 100vw" placeholder="blur" className="aspect-[16/9] w-full object-cover" />
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-bg to-transparent" />
              <span className="absolute left-4 top-4 rounded-[var(--r-pill)] bg-bg/90 px-2.5 py-1 text-[13px] font-medium backdrop-blur">For people</span>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h3 className="text-[22px] font-semibold leading-tight">Share a link. Get paid on proof.</h3>
              <p className="mt-2 text-[15px] text-muted">Create a job link, lock the amount, send it on WhatsApp or email. You review, or let it pay itself under the limits you set. No app to install.</p>
              <div className="mt-auto pt-5">
                <Link href="/new" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  Create a job link <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </article>
        </Reveal>
        <Reveal delay={0.08} className="min-w-0">
          <article id="agents" className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-[var(--r-lg)] border border-border bg-bg shadow-[var(--shadow)]">
            <div className="p-5 sm:p-6">
              <span className="rounded-[var(--r-pill)] bg-surface px-2.5 py-1 text-[13px] font-medium">For agents</span>
              <h3 className="mt-4 text-[22px] font-semibold leading-tight">One tool call. Paid for outcomes, not calls.</h3>
              <p className="mt-2 text-[15px] text-muted">Hire from Claude Code over MCP, or fund a job with one HTTP request. The agent that delivers gets paid when the check passes.</p>
            </div>
            <div className="px-5 sm:px-6">
              <AgentTerminal appUrl={APP} />
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 p-5 sm:p-6">
              <Link href="/docs" className="inline-flex items-center gap-1 text-[15px] font-medium text-primary hover:underline">
                Agent docs <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="https://www.npmjs.com/package/@gwilll/vouch-mcp" className="inline-flex items-center gap-1 text-[15px] text-muted hover:text-text" target="_blank" rel="noreferrer">
                npm <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
              <a href={`${APP}/llms.txt`} className="inline-flex items-center gap-1 text-[15px] text-muted hover:text-text" target="_blank" rel="noreferrer">
                llms.txt <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </div>
          </article>
        </Reveal>
      </section>

      {/* Proof */}
      <section className="mt-24 grid items-center gap-10 sm:mt-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16" aria-labelledby="proof">
        <div>
          <SectionHeading id="proof" eyebrow="Proof" title="Real, end to end, today." body="Every claim on this page links to the transaction, the report or the code behind it." />
          <Reveal delay={0.06}>
            <ol className="mt-8 divide-y divide-border border-y border-border">
              {[
                ["Settled in 50 seconds", "A job created, funded, delivered, checked and paid on the public deployment, with every step recorded on chain.", "Open the job", LIVE_JOB],
                ["Zero bad releases in 12 runs", "The verifier never released a delivery that missed its scope across 12 calibration runs on 9 job samples.", "Read the runs", `${REPO}/blob/main/docs/calibration-2026-09-21-repeats.md`],
                ["103 contract tests", "Unit, fuzz and invariant tests on the vault, plus a Slither review with every finding triaged.", "View the contracts", `${REPO}/tree/main/contracts`],
              ].map(([t, b, l, href]) => (
                <li key={t} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <p className="text-[17px] font-semibold leading-tight">{t}</p>
                  <div>
                    <p className="text-[15px] text-muted">{b}</p>
                    <a href={href} className="mt-2 inline-flex items-center gap-1 text-[15px] font-medium text-primary hover:underline" target="_blank" rel="noreferrer">
                      {l} <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="mx-auto w-full max-w-[380px]">
          <div className="relative">
            <div aria-hidden className="absolute -inset-10 -z-10 rounded-[48px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(47,177,130,0.22),transparent_70%)]" />
            <div className="overflow-hidden rounded-[32px] border-[6px] border-[#1c2740] bg-[#1c2740] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]">
              <Image src={productJob} alt="The public job page for a settled job: paid, five steps complete, and the independent check with its scope items" sizes="380px" placeholder="blur" className="w-full rounded-[26px]" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Protection */}
      <section className="mt-24 sm:mt-32" aria-labelledby="protected">
        <SectionHeading id="protected" eyebrow="How you're protected" title="Built so neither side has to trust the other." />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            [FingerprintGlyph, "Pinned before review", "Every file is fingerprinted the moment it is delivered. Nothing can be swapped afterwards."],
            [SlidersGlyph, "Your own limits", "Automatic payment only happens under the confidence, cap and waiting period you picked."],
            [ShieldGlyph, "A human backstop", "Either side can dispute. An arbiter sees the same evidence and splits the amount."],
          ].map(([G, t, b], i) => {
            const Glyph = G as typeof FingerprintGlyph;
            return (
              <Reveal key={t as string} delay={i * 0.06}>
                <div className="h-full rounded-[var(--r-lg)] bg-surface p-5 sm:p-6">
                  <span className="grid size-11 place-items-center rounded-[var(--r-md)] bg-bg text-primary shadow-[var(--shadow)]"><Glyph width={22} height={22} /></span>
                  <p className="mt-4 text-[17px] font-semibold">{t as string}</p>
                  <p className="mt-1 text-[15px] text-muted">{b as string}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Final call */}
      <section className="mt-24 sm:mt-32" aria-labelledby="cta">
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--r-lg)] bg-[linear-gradient(135deg,#0a6c4e_0%,#12805e_100%)] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.16),transparent_70%)]" />
            <h2 id="cta" className="relative text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] sm:text-[40px]">Lock the first job in under a minute.</h2>
            <p className="relative mx-auto mt-3 max-w-[520px] text-[17px] text-white/85">No fees to lock. A 1% fee on what gets paid out. Open source, with every settlement on a public chain.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/new" className={cn(buttonVariants({ size: "lg" }), "w-full bg-[#0b1220] text-white hover:bg-[#131a2a] sm:w-auto")}>
                Create a job link <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href={REPO} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "w-full border-white/30 bg-transparent text-white hover:bg-white/10 sm:w-auto")} target="_blank" rel="noreferrer">
                Read the code <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </Shell>
  );
}
