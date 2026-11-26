// Copied from the spike (platform/spike/web/src/lib/rpc.ts); the sponsor call moved to the API client.
// Minimal Kaia JSON-RPC and fee payer client (fetch only, works in the browser and in Node 22).

export class RpcError extends Error {
  code?: number;
  data?: string;
  constructor(message: string, code?: number, data?: string) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

let seq = 0;
export async function rpc<T = unknown>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
  });
  if (!res.ok) throw new RpcError(`${method}: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new RpcError(`${method}: ${j.error.message}`, j.error.code, j.error.data);
  return j.result as T;
}

export const hexToBig = (h: string) => BigInt(h);

export async function getNonce(url: string, address: string): Promise<number> {
  return Number(BigInt(await rpc<string>(url, 'eth_getTransactionCount', [address, 'pending'])));
}
export async function getGasPrice(url: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, 'eth_gasPrice'));
}
export async function getBalance(url: string, address: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, 'eth_getBalance', [address, 'latest']));
}
export async function ethCall(url: string, to: string, data: string): Promise<string> {
  return rpc<string>(url, 'eth_call', [{ to, data }, 'latest']);
}
export async function estimateGas(url: string, from: string, to: string, data: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, 'eth_estimateGas', [{ from, to, data }]));
}

export interface Receipt {
  status: number;
  blockNumber: number;
  transactionIndex: number;
  gasUsed: bigint;
  feePayer?: string;
}

export async function getReceipt(url: string, hash: string): Promise<Receipt | null> {
  const r = await rpc<Record<string, string> | null>(url, 'kaia_getTransactionReceipt', [hash]);
  if (!r) return null;
  return {
    status: Number(BigInt(r.status)),
    blockNumber: Number(BigInt(r.blockNumber)),
    transactionIndex: Number(BigInt(r.transactionIndex)),
    gasUsed: BigInt(r.gasUsed),
    feePayer: r.feePayer,
  };
}

export async function waitReceipt(url: string, hash: string, timeoutMs = 60000, everyMs = 400): Promise<Receipt> {
  const t0 = Date.now();
  for (;;) {
    const r = await getReceipt(url, hash).catch(() => null);
    if (r) return r;
    if (Date.now() - t0 > timeoutMs) throw new Error(`No receipt for ${hash} after ${timeoutMs / 1000} s`);
    await new Promise((res) => setTimeout(res, everyMs));
  }
}

