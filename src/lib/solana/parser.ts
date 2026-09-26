/**
 * Transaction normalization. Pure functions — no network, no database.
 * Classifies from actual balance changes; never guesses. Anything ambiguous
 * stays "unknown" and no swap is produced.
 */
import type { ParsedTx } from "./rpc.server";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const SYSTEM = "11111111111111111111111111111111";
const STAKE = "Stake11111111111111111111111111111111111111";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const MEMO = ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"];
const INFRA = new Set([SYSTEM, COMPUTE, TOKEN, TOKEN22, ATA, ...MEMO]);

/** Known DEX / aggregator programs — used only to name the source and raise confidence. */
export const DEX_PROGRAMS: Record<string, string> = {
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter",
  JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB: "Jupiter",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium",
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "Raydium CLMM",
  CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: "Raydium CPMM",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "PumpSwap",
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: "Meteora DLMM",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB": "Meteora",
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: "Phoenix",
};

export type ParsedType =
  | "swap" | "transfer" | "token_transfer" | "sol_transfer" | "nft" | "staking" | "program_interaction" | "unknown";

export type NormalizedSwap = {
  inputMint: string; inputAmount: string; inputDecimals: number;
  outputMint: string; outputAmount: string; outputDecimals: number;
  source: string | null; confidence: "high" | "medium";
};

export type Normalized = {
  status: "success" | "failed";
  feeLamports: number | null;
  parsedType: ParsedType;
  programs: string[];
  source: string | null;
  swap: NormalizedSwap | null;
  mints: { mint: string; decimals: number }[];
};

// Ignore SOL moves below this when tokens also changed (rent for token accounts, tips).
const SOL_DUST = 10_000_000n; // 0.01 SOL

export function normalizeTransaction(tx: ParsedTx, wallet: string): Normalized {
  const meta = tx.meta;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const outer = tx.transaction.message.instructions;
  const inner = (meta?.innerInstructions ?? []).flatMap((i) => i.instructions);
  const programs = [...new Set([...outer, ...inner].map((i) => i.programId))];
  const dex = programs.map((p) => DEX_PROGRAMS[p]).find(Boolean) ?? null;
  const nonInfra = programs.filter((p) => !INFRA.has(p));

  const base: Normalized = {
    status: meta?.err ? "failed" : "success",
    feeLamports: meta?.fee ?? null,
    parsedType: "unknown",
    programs,
    source: dex,
    swap: null,
    mints: [],
  };
  if (!meta) return base;

  // Token deltas for accounts owned by the wallet, keyed by mint (raw base units).
  const deltas = new Map<string, { delta: bigint; decimals: number }>();
  const add = (mint: string, amt: bigint, decimals: number) => {
    const cur = deltas.get(mint) ?? { delta: 0n, decimals };
    cur.delta += amt;
    deltas.set(mint, cur);
  };
  for (const b of meta.preTokenBalances ?? []) if (b.owner === wallet) add(b.mint, -BigInt(b.uiTokenAmount.amount), b.uiTokenAmount.decimals);
  for (const b of meta.postTokenBalances ?? []) if (b.owner === wallet) add(b.mint, BigInt(b.uiTokenAmount.amount), b.uiTokenAmount.decimals);
  base.mints = [...deltas.entries()].map(([mint, v]) => ({ mint, decimals: v.decimals }));

  // Native SOL delta, excluding the fee when the wallet paid it.
  const idx = keys.indexOf(wallet);
  let solDelta = 0n;
  if (idx >= 0 && meta.preBalances[idx] !== undefined && meta.postBalances[idx] !== undefined) {
    solDelta = BigInt(meta.postBalances[idx]!) - BigInt(meta.preBalances[idx]!);
    if (idx === 0) solDelta += BigInt(meta.fee);
  }

  if (base.status === "failed") return base;

  if (programs.includes(STAKE)) return { ...base, parsedType: "staking" };

  // Merge native SOL into wrapped SOL for exchange detection.
  const assets = new Map<string, { delta: bigint; decimals: number }>();
  for (const [m, v] of deltas) if (v.delta !== 0n) assets.set(m, { ...v });
  const tokenMoves = assets.size > 0;
  if (solDelta !== 0n && (!tokenMoves || solDelta > SOL_DUST || solDelta < -SOL_DUST)) {
    const w = assets.get(SOL_MINT) ?? { delta: 0n, decimals: 9 };
    w.delta += solDelta;
    if (w.delta === 0n) assets.delete(SOL_MINT);
    else assets.set(SOL_MINT, w);
  }

  const outs = [...assets.entries()].filter(([, v]) => v.delta < 0n);
  const ins = [...assets.entries()].filter(([, v]) => v.delta > 0n);

  // Swap: exactly one asset left the wallet and exactly one different asset arrived.
  if (outs.length === 1 && ins.length === 1 && nonInfra.length > 0) {
    const [inMint, inV] = outs[0]!;
    const [outMint, outV] = ins[0]!;
    const nft = (inV.decimals === 0) || (outV.decimals === 0);
    if (nft) return { ...base, parsedType: "nft" };
    return {
      ...base,
      parsedType: "swap",
      swap: {
        inputMint: inMint, inputAmount: (-inV.delta).toString(), inputDecimals: inV.decimals,
        outputMint: outMint, outputAmount: outV.delta.toString(), outputDecimals: outV.decimals,
        source: dex, confidence: dex ? "high" : "medium",
      },
    };
  }
  if (outs.length > 1 || ins.length > 1 || (outs.length === 1 && ins.length === 1)) {
    // Several assets moved (or exchange without a program) — ambiguous, do not guess.
    return { ...base, parsedType: nonInfra.length > 0 ? "program_interaction" : "unknown" };
  }

  const moved = [...outs, ...ins];
  if (moved.length === 1) {
    const [mint, v] = moved[0]!;
    if (v.decimals === 0 && (v.delta === 1n || v.delta === -1n)) return { ...base, parsedType: "nft" };
    if (nonInfra.length === 0) return { ...base, parsedType: mint === SOL_MINT && !tokenMoves ? "sol_transfer" : "token_transfer" };
    return { ...base, parsedType: "program_interaction" };
  }

  return { ...base, parsedType: nonInfra.length > 0 ? "program_interaction" : "unknown" };
}
