import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer as createHttpServer } from "node:http";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

export { createServer } from "./server.js";
export { VouchClient, VouchError } from "./client.js";
export { loadConfig, type Config } from "./config.js";

/** Entry point: stdio by default; `VOUCH_HTTP_PORT=…` serves Streamable HTTP at /mcp instead. */
export async function main(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.VOUCH_HTTP_PORT) {
    const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const http = createHttpServer(async (req, res) => {
      if (!req.url?.startsWith("/mcp")) {
        res.writeHead(404).end();
        return;
      }
      // Stateless: one server + transport per request.
      const server = createServer(cfg);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { void transport.close(); void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    });
    http.listen(cfg.VOUCH_HTTP_PORT, () => console.error(`vouch-mcp listening on http://localhost:${cfg.VOUCH_HTTP_PORT}/mcp`));
    return;
  }
  const server = createServer(cfg);
  await server.connect(new StdioServerTransport());
  console.error(`vouch-mcp ready (stdio) → ${cfg.VOUCH_API_URL}`);
}
