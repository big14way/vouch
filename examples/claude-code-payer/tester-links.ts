/**
 * Tester round: creates and funds real pay links on Tempo testnet for people to try Vouch as the worker.
 * Each job is a small task a freelancer can finish in ~10 minutes, $5 locked up front, first person to deliver
 * becomes the worker, and it releases automatically 15 minutes after a verified delivery (PASS ≥ 85%).
 *
 *   PAYER_PRIVATE_KEY=0x… VOUCH_API_URL=https://vouch-rouge.vercel.app COUNT=2 npx tsx tester-links.ts
 *
 * Writes the links to ../../docs/testers/links.local.md (gitignored: a link belongs to whoever delivers first).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { VouchClient, loadConfig } from "@gwilll/vouch-mcp";
import { parseAmount } from "@vouch/shared";

const TASKS = [
  {
    title: "3 tagline options for Kora Coffee",
    scope: `## Deliverables
- Three tagline options for Kora Coffee, a small café in Lagos that roasts its own beans.
- Each tagline is 10 words or fewer.
- One sentence under each tagline explaining the idea.

## Format
- A note or a Markdown file.`,
  },
  {
    title: "Instagram caption for a new jollof dish",
    scope: `## Deliverables
- One Instagram caption announcing a new smoky party jollof at "Mama Put Express", a Lagos restaurant.
- Between 60 and 120 words.
- Mentions the price placeholder [PRICE] once.
- Ends with exactly 3 hashtags.

## Format
- A note or a Markdown file.`,
  },
  {
    title: "Translate a short notice into Nigerian Pidgin",
    scope: `## Deliverables
- A Nigerian Pidgin translation of this notice, keeping every piece of information:
  "Our shop will close early on Friday at 4 pm for stock-taking. We open again on Saturday at 9 am. Orders placed online before Friday noon will still be delivered on time. Thank you for your patience."

## Format
- A note or a Markdown file with the translation only.`,
  },
  {
    title: "Simple logo concept for Ada's Tailoring",
    scope: `## Deliverables
- One logo concept for "Ada's Tailoring", a tailoring shop.
- The name "Ada's Tailoring" appears in the logo.
- Uses at most 3 colours.

## Format
- A PNG, JPG or SVG image.`,
  },
  {
    title: "Product description for handwoven Aso Oke",
    scope: `## Deliverables
- A product description for a handwoven Aso Oke fabric set sold online.
- Between 80 and 120 words.
- Includes 3 bullet points of features and the placeholder [PRICE] once.

## Format
- A note or a Markdown file.`,
  },
];

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const apiUrl = process.env.VOUCH_API_URL ?? "https://vouch-rouge.vercel.app";
  const key = process.env.PAYER_PRIVATE_KEY;
  if (!key) throw new Error("Set PAYER_PRIVATE_KEY (a Moderato wallet holding pathUSD).");
  const count = Number(process.env.COUNT ?? 2);
  const payer = new VouchClient(loadConfig({ VOUCH_API_URL: apiUrl, VOUCH_AGENT_PRIVATE_KEY: key, VOUCH_DEFAULT_CHAIN: "42431" }));
  const amount = parseAmount(process.env.AMOUNT ?? "5");
  const policy = { autoRelease: 1, minConfidenceBps: 8500, maxAutoAmount: amount.toString(), reviewWindow: 15 * 60, submitDeadline: 7 * 86_400 };

  // TASKS=2,3,4 picks tasks by index (e.g. to finish a round that was rate-limited).
  const pick = process.env.TASKS ? process.env.TASKS.split(",").map(Number).map((i) => TASKS[i]!) : TASKS;
  const file = new URL("../../docs/testers/links.local.md", import.meta.url);
  await mkdir(new URL("../../docs/testers/", import.meta.url), { recursive: true });
  const existing = await readFile(file, "utf8").catch(() => "");
  let out = existing || `# Tester pay links\n\n$${process.env.AMOUNT ?? "5"} locked in each, Tempo testnet. First person to deliver becomes the worker; pays automatically 15 minutes after a verified delivery.\n\n| Task | Link | Status | Sent to |\n|---|---|---|---|\n`;
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const fundWithRetry = async (id: string) => {
    for (let i = 0; ; i++) {
      try {
        return await payer.fundJob(id);
      } catch (e) {
        if ((e as { code?: string }).code !== "rate_limited" || i >= 4) throw e;
        log("rate limited, waiting 60 s");
        await pause(60_000);
      }
    }
  };
  let n = 0;
  for (let round = 0; round < count; round++) {
    for (const t of pick) {
      if (n++) await pause(12_000); // stay under the API's per-wallet rate limit
      const created = await payer.createJob({ title: t.title, scopeMd: t.scope, amount: amount.toString(), chainId: 42431, policy, paymentDeadline: 7 * 86_400 });
      const funded = await fundWithRetry(created.jobId);
      log(funded.status.padEnd(7), t.title, created.payUrl);
      out += `| ${t.title} | ${created.payUrl} | ${funded.status} | |\n`;
      await writeFile(file, out); // saved as it goes, so a failure keeps the links already made
    }
  }
  log(`links in docs/testers/links.local.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
