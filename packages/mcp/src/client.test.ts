import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { VouchClient } from "./client.js";

describe("config", () => {
  it("defaults to Tempo mainnet and validates keys", () => {
    const c = loadConfig({ VOUCH_API_URL: "http://localhost:3000" });
    expect(c.VOUCH_DEFAULT_CHAIN).toBe(4217);
    expect(() => loadConfig({ VOUCH_AGENT_PRIVATE_KEY: "nope" })).toThrow(/VOUCH_AGENT_PRIVATE_KEY/);
  });
});

describe("client", () => {
  it("derives the agent address from the key", () => {
    const c = new VouchClient(loadConfig({ VOUCH_API_URL: "http://localhost:3000", VOUCH_AGENT_PRIVATE_KEY: `0x${"11".repeat(32)}` }));
    expect(c.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it("has no address without a key", () => {
    expect(new VouchClient(loadConfig({ VOUCH_API_URL: "http://localhost:3000" })).address).toBeNull();
  });
});
