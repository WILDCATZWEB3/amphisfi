/**
 * Solana RPC data service (server-only). The single place that talks to an RPC
 * node, so the provider can be swapped by changing SOLANA_RPC_URL.
 * Handles JSON-RPC batching, retries, exponential backoff and 429s.
 */

const PUBLIC_MAINNET = "https://api.mainnet-beta.solana.com";

export function rpcUrl(): string {
  return process.env["SOLANA_RPC_URL"] || process.env["VITE_SOLANA_RPC_URL"] || PUBLIC_MAINNET;
}

export function usingPublicRpc(): boolean {
  return rpcUrl() === PUBLIC_MAINNET;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RpcReq = { method: string; params: unknown[] };
type RpcRes = { id: number; result?: unknown; error?: { code: number; message: string } };

async function post(body: unknown, attempt = 0): Promise<unknown> {
  const maxAttempts = 5;
  let res: Response;
  try {
    res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (attempt < maxAttempts) {
      await sleep(500 * 2 ** attempt);
      return post(body, attempt + 1);
    }
    throw err;
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
      return post(body, attempt + 1);
    }
    throw new Error(res.status === 429 ? "RPC rate limit reached" : `RPC error ${res.status}`);
  }
  if (!res.ok) throw new Error(`RPC request failed (${res.status})`);
  return res.json();
}

async function call<T>(method: string, params: unknown[]): Promise<T> {
  const json = (await post({ jsonrpc: "2.0", id: 1, method, params })) as RpcRes;
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result as T;
}

/** Batched call; falls back to sequential calls if the provider rejects batches. */
async function callBatch<T>(reqs: RpcReq[]): Promise<(T | null)[]> {
  if (reqs.length === 0) return [];
  const body = reqs.map((r, i) => ({ jsonrpc: "2.0", id: i, method: r.method, params: r.params }));
  const json = await post(body).catch(() => null);
  if (Array.isArray(json)) {
    const out: (T | null)[] = new Array(reqs.length).fill(null);
    let anyError = false;
    for (const item of json as RpcRes[]) {
      if (item.error) anyError = true;
      else out[item.id] = (item.result ?? null) as T | null;
    }
    if (!anyError) return out;
  }
  // Sequential fallback with a small delay to stay polite to the provider.
  const out: (T | null)[] = [];
  for (const r of reqs) {
    out.push(await call<T>(r.method, r.params).catch(() => null));
    await sleep(120);
  }
  return out;
}

export type SignatureInfo = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
};

export function getSignaturesForAddress(
  address: string,
  opts: { before?: string | undefined; until?: string | undefined; limit?: number },
): Promise<SignatureInfo[]> {
  const cfg: Record<string, unknown> = { limit: Math.min(opts.limit ?? 100, 1000), commitment: "finalized" };
  if (opts.before) cfg["before"] = opts.before;
  if (opts.until) cfg["until"] = opts.until;
  return call<SignatureInfo[]>("getSignaturesForAddress", [address, cfg]);
}

export async function getTransactions(signatures: string[], chunk = 10): Promise<(ParsedTx | null)[]> {
  const out: (ParsedTx | null)[] = [];
  for (let i = 0; i < signatures.length; i += chunk) {
    const part = signatures.slice(i, i + chunk);
    const res = await callBatch<ParsedTx>(
      part.map((s) => ({
        method: "getTransaction",
        params: [s, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" }],
      })),
    );
    out.push(...res);
    if (i + chunk < signatures.length) await sleep(250);
  }
  return out;
}

// Minimal shape of a jsonParsed transaction — only the fields Amphis reads.
export type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};
export type ParsedInstruction = {
  programId: string;
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
};
export type ParsedTx = {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
    innerInstructions?: { index: number; instructions: ParsedInstruction[] }[];
  } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean; writable: boolean }[];
      instructions: ParsedInstruction[];
    };
  };
};
