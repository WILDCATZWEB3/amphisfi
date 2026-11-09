/**
 * Server-only Robinhood Chain RPC provider.
 * Prefer ROBINHOOD_RPC_URL (Alchemy full URL or bare key). Fall back to public RPC.
 * Never expose keys or this module to the client bundle.
 */
import { createPublicClient, formatEther, http, type Address } from "viem";

import { robinhoodChain } from "@/lib/chains/robinhood/config";
import {
  describeRpcConfig,
  publicRobinhoodRpcFallback,
  resolveRobinhoodRpcUrl,
} from "@/lib/rpc/resolve-url";

export type RpcProviderId = "alchemy_or_configured" | "public_fallback";

export type EthBalanceResult =
  | {
      available: true;
      balanceWei: string;
      balanceEth: string;
      provider: RpcProviderId;
    }
  | {
      available: false;
      reason: string;
      provider: RpcProviderId | null;
    };

function primaryUrl(): string | null {
  return resolveRobinhoodRpcUrl(process.env["ROBINHOOD_RPC_URL"]);
}

function fallbackUrl(): string {
  return publicRobinhoodRpcFallback();
}

function makeClient(url: string) {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(url, { retryCount: 2, retryDelay: 300, timeout: 12_000 }),
  });
}

/** Ordered providers: configured Alchemy/custom first, then public fallback. */
export function listRpcEndpoints(): Array<{ id: RpcProviderId; url: string }> {
  const out: Array<{ id: RpcProviderId; url: string }> = [];
  const primary = primaryUrl();
  if (primary) out.push({ id: "alchemy_or_configured", url: primary });
  out.push({ id: "public_fallback", url: fallbackUrl() });
  return out;
}

export async function getNativeEthBalance(address: string): Promise<EthBalanceResult> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { available: false, reason: "Invalid address.", provider: null };
  }

  const endpoints = listRpcEndpoints();
  let lastError = "No RPC endpoint available.";

  for (const ep of endpoints) {
    try {
      const client = makeClient(ep.url);
      const wei = await client.getBalance({ address: address as Address });
      return {
        available: true,
        balanceWei: wei.toString(),
        balanceEth: formatEther(wei),
        provider: ep.id,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "RPC request failed.";
      console.log("[rpc] eth_getBalance failed", ep.id, lastError);
    }
  }

  return {
    available: false,
    reason: lastError,
    provider: endpoints.at(-1)?.id ?? null,
  };
}

export async function getLatestBlockNumber(): Promise<
  { ok: true; blockNumber: number; provider: RpcProviderId } | { ok: false; reason: string }
> {
  for (const ep of listRpcEndpoints()) {
    try {
      const client = makeClient(ep.url);
      const n = await client.getBlockNumber();
      return { ok: true, blockNumber: Number(n), provider: ep.id };
    } catch (e) {
      console.log("[rpc] blockNumber failed", ep.id, e instanceof Error ? e.message : e);
    }
  }
  return { ok: false, reason: "All RPC providers failed." };
}

/** Health helper: does not reveal secrets. */
export function rpcConfigStatus() {
  const raw = process.env["ROBINHOOD_RPC_URL"];
  const described = describeRpcConfig(raw);
  return {
    configuredPrimary: described.configured,
    mode: described.mode,
    primaryHost: described.host,
    fallbackHost: "rpc.mainnet.chain.robinhood.com",
  };
}
