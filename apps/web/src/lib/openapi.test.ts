import { describe, expect, it } from "vitest";
import { validate } from "mppx/discovery";
import { discoveryDocument, llmsTxt } from "./openapi";

process.env.DATABASE_URL ??= "postgresql://x";
process.env.JOB_SECRETS_KEY ??= `0x${"ab".repeat(32)}`;
process.env.ENABLED_CHAINS = "42431,84532";
process.env.NEXT_PUBLIC_APP_URL = "https://vouch.dev";

describe("MPP discovery document", () => {
  const doc = discoveryDocument() as { paths: Record<string, Record<string, { "x-payment-info"?: { offers: { method: string; amount: null; currency: string }[] } }>>; "x-service-info": { docs: { llms: string } } };

  it("passes mppx's discovery validator with no errors", () => {
    const issues = validate(doc);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("advertises one variable-priced offer per enabled chain token on the fund route", () => {
    const offers = doc.paths["/jobs/{id}/fund"]!.post!["x-payment-info"]!.offers;
    expect(offers.map((o) => o.method)).toEqual(["tempo", "tempo", "evm"]);
    expect(offers.every((o) => o.amount === null)).toBe(true);
    expect(offers[0]!.currency).toBe("0x20C0000000000000000000000000000000000000");
  });

  it("links llms.txt and the llms text names the fund route", () => {
    expect(doc["x-service-info"].docs.llms).toBe("https://vouch.dev/llms.txt");
    expect(llmsTxt()).toContain("/api/v1/jobs/{id}/fund");
  });
});
