/**
 * Verified Solana DEX / aggregator program IDs. Add new programs here only when
 * the program ID is confirmed on-chain. `kind` distinguishes aggregators (which
 * route through other DEXes) from direct AMMs / order books.
 */
export type Protocol = { name: string; kind: "aggregator" | "amm" | "orderbook" | "launchpad" };

export const PROTOCOLS: Record<string, Protocol> = {
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: { name: "Jupiter", kind: "aggregator" },
  JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB: { name: "Jupiter", kind: "aggregator" },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": { name: "Raydium", kind: "amm" },
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: { name: "Raydium CLMM", kind: "amm" },
  CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: { name: "Raydium CPMM", kind: "amm" },
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: { name: "Orca", kind: "amm" },
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "Pump.fun", kind: "launchpad" },
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: { name: "PumpSwap", kind: "amm" },
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: { name: "Meteora DLMM", kind: "amm" },
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB": { name: "Meteora", kind: "amm" },
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: { name: "Phoenix", kind: "orderbook" },
};

/** Quote assets: acquiring a non-quote token with one of these is a "buy". */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const QUOTE_MINTS = new Set([
  SOL_MINT,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

/** Prefer the aggregator (the user's entry point) over the pools it routed through. */
export function detectProtocol(programs: string[]): { source: string; protocol: string } | null {
  const hits = programs.map((p) => PROTOCOLS[p]).filter((p): p is Protocol => !!p);
  if (!hits.length) return null;
  const top = hits.find((h) => h.kind === "aggregator") ?? hits[0]!;
  const venues = [...new Set(hits.map((h) => h.name))];
  return { source: top.name, protocol: venues.join(" > ") };
}
