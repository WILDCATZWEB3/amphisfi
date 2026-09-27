/**
 * Transaction normalization. Pure functions — no network, no database.
 * Classifies from the wallet's actual net balance changes; never guesses.
 * Routed swaps (e.g. SOL > USDC > TOKEN via Jupiter) collapse naturally into
 * one net exchange because intermediate hops net to zero for the wallet.
 * Anything ambiguous stays unclassified and no trade is produced.
 */
import type { ParsedTx } from "./rpc.server";
import { detectProtocol, QUOTE_MINTS, SOL_MINT } from "./protocols";

export { SOL_MINT };

/** Bump whenever classification logic changes; older rows get reprocessed. */
export const PARSER_VERSION = 2;

const SYSTEM = "11111111111111111111111111111111";
const STAKE = "Stake11111111111111111111111111111111111111";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const MEMO = ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"];
const INFRA = new Set([SYSTEM, COMPUTE, TOKEN, TOKEN22, ATA, ...MEMO]);

export type ParsedType =
  | "swap" | "transfer" | "token_transfer" | "sol_transfer" | "nft" | "staking" | "program_interaction" | "unknown";

export type Direction = "buy" | "sell" | "swap" | "unknown";
export type Confidence = "high" | "medium" | "low";

export type NormalizedSwap = {
  inputMint: string; inputAmount: string; inputDecimals: number;
  outputMint: string; outputAmount: string; outputDecimals: number;
  source: string | null; protocol: string | null;
  direction: Direction; confidence: Confidence;
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

export function directionOf(inputMint: string, outputMint: string): Direction {
  const inQ = QUOTE_MINTS.has(inputMint);
  const outQ = QUOTE_MINTS.has(outputMint);
  if (inQ && !outQ) return "buy";
  if (!inQ && outQ) return "sell";
  return "swap";
}

export function normalizeTransaction(tx: ParsedTx, wallet: string): Normalized {
  const meta = tx.meta;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const outer = tx.transaction.message.instructions;
  const inner = (meta?.innerInstructions ?? []).flatMap((i) => i.instructions);
  const programs = [...new Set([...outer, ...inner].map((i) => i.programId))];
  const proto = detectProtocol(programs);
  const nonInfra = programs.filter((p) => !INFRA.has(p));

  const base: Normalized = {
    status: meta?.err ? "failed" : "success",
    feeLamports: meta?.fee ?? null,
    parsedType: "unknown",
    programs,
    source: proto?.source ?? null,
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

  // Native SOL delta; the network fee is added back so fees stay separate from trade amounts.
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
  const hadWsol = assets.has(SOL_MINT);
  let mergedNative = false;
  if (solDelta !== 0n && (!tokenMoves || solDelta > SOL_DUST || solDelta < -SOL_DUST)) {
    const w = assets.get(SOL_MINT) ?? { delta: 0n, decimals: 9 };
    w.delta += solDelta;
    mergedNative = true;
    if (w.delta === 0n) assets.delete(SOL_MINT);
    else assets.set(SOL_MINT, w);
  }

  const outs = [...assets.entries()].filter(([, v]) => v.delta < 0n);
  const ins = [...assets.entries()].filter(([, v]) => v.delta > 0n);

  // Trade: exactly one asset net-left the wallet and exactly one different asset net-arrived,
  // and some non-infrastructure program executed (plain transfers never qualify).
  if (outs.length === 1 && ins.length === 1 && nonInfra.length > 0) {
    const [inMint, inV] = outs[0]!;
    const [outMint, outV] = ins[0]!;
    if (inV.decimals === 0 || outV.decimals === 0) return { ...base, parsedType: "nft" };
    // high: verified DEX program; medium: verified DEX but native+wrapped SOL both moved
    // (rent/wrapping noise may be folded in); low: unrecognized program — not treated as verified.
    const confidence: Confidence = !proto ? "low" : mergedNative && hadWsol ? "medium" : "high";
    return {
      ...base,
      parsedType: "swap",
      swap: {
        inputMint: inMint, inputAmount: (-inV.delta).toString(), inputDecimals: inV.decimals,
        outputMint: outMint, outputAmount: outV.delta.toString(), outputDecimals: outV.decimals,
        source: proto?.source ?? null, protocol: proto?.protocol ?? null,
        direction: directionOf(inMint, outMint), confidence,
      },
    };
  }
  if (outs.length > 1 || ins.length > 1 || (outs.length === 1 && ins.length === 1)) {
    // Several assets moved (or exchange without any program) — ambiguous, do not guess.
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
