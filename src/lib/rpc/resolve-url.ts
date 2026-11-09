/**
 * Resolve ROBINHOOD_RPC_URL env to a usable HTTPS endpoint.
 * Accepts a full URL or a bare Alchemy API key (never log the value).
 */
const ALCHEMY_RH_PREFIX = "https://robinhood-mainnet.g.alchemy.com/v2/";
const PUBLIC_FALLBACK = "https://rpc.mainnet.chain.robinhood.com";

export function isLikelyApiKey(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return false;
  // Alchemy keys are typically alphanumerics; reject whitespace/path junk.
  return /^[A-Za-z0-9_-]{16,128}$/.test(v);
}

export function resolveRobinhoodRpcUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (isLikelyApiKey(v)) return `${ALCHEMY_RH_PREFIX}${v}`;
  return null;
}

export function publicRobinhoodRpcFallback(): string {
  return PUBLIC_FALLBACK;
}

/** Safe summary for health checks — never includes the key. */
export function describeRpcConfig(raw: string | null | undefined): {
  configured: boolean;
  mode: "full_url" | "alchemy_key" | "missing" | "invalid";
  host: string | null;
} {
  const v = raw?.trim();
  if (!v) return { configured: false, mode: "missing", host: null };
  if (/^https?:\/\//i.test(v)) {
    try {
      return { configured: true, mode: "full_url", host: new URL(v).host };
    } catch {
      return { configured: false, mode: "invalid", host: null };
    }
  }
  if (isLikelyApiKey(v)) {
    return { configured: true, mode: "alchemy_key", host: "robinhood-mainnet.g.alchemy.com" };
  }
  return { configured: false, mode: "invalid", host: null };
}
