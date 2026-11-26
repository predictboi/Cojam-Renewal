// Dev only (DEV_CHAIN=stub, never in production): POST /dev/rpc answers the PWA's JSON-RPC reads from the stub
// chain, so the app runs end to end with no Kaia node. GET /v1/config points rpcUrl here in that mode.
// Sends are not accepted: every transaction goes through POST /v1/tx/sponsor, as in production.
import type { FastifyInstance } from "fastify";
import type { RouteKit } from "../server/app.ts";

const READS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_call",
  "eth_estimateGas",
  "eth_getTransactionReceipt",
  "kaia_getTransactionReceipt",
]);

export function registerDevRpcRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  if (deps.config.env.DEV_CHAIN !== "stub" || deps.config.isProduction) return;
  app.post("/dev/rpc", async (req) => {
    const body = req.body as { id?: unknown; method?: string; params?: unknown[] } | undefined;
    const id = body?.id ?? null;
    const method = String(body?.method ?? "");
    if (!READS.has(method)) return { jsonrpc: "2.0", id, error: { code: -32601, message: `dev rpc: ${method} is not served` } };
    try {
      return { jsonrpc: "2.0", id, result: await deps.rpc(method, body?.params ?? []) };
    } catch (e) {
      return { jsonrpc: "2.0", id, error: { code: -32000, message: (e as Error).message } };
    }
  });
}
