/**
 * Robinhood Chain swap detection (server-only). Conservative: a transaction is a
 * trade only when the wallet itself sent it, it succeeded, and the wallet's net
 * balance change is exactly one token out and one different token in (routed hops
 * collapse into one logical trade). Everything else is marked unclassified or
 * transfer — never guessed. Bump PARSER_VERSION when rules change.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const PARSER_VERSION = 2;
export const NATIVE = "0x0000000000000000000000000000000000000000";

/** Known swap event signatures (topic0). Presence raises confidence to "high". */
const SWAP_TOPICS: Record<string, string> = {
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822": "uniswap-v2",
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67": "uniswap-v3",
  "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f": "uniswap-v4",
};

type Link = { transaction_id: string };

async function allLinks(walletId: string) {
  const out: Link[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from("wallet_transactions")
      .select("transaction_id").eq("wallet_id", walletId).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const big = (v: unknown) => BigInt(String(v ?? "0").split(".")[0] || "0");

export async function detectTrades(walletId: string, wallet: string) {
  const db = supabaseAdmin;
  const links = await allLinks(walletId);
  const { data: existing } = await db.from("evm_trades").select("transaction_id,parser_version").eq("wallet_id", walletId);
  const done = new Set((existing ?? []).filter((e) => e.parser_version >= PARSER_VERSION).map((e) => e.transaction_id));
  const todo = links.map((l) => l.transaction_id).filter((id) => !done.has(id));
  let detected = 0;

  for (let i = 0; i < todo.length; i += 100) {
    const ids = todo.slice(i, i + 100);
    const [{ data: txs, error: e1 }, { data: transfers, error: e2 }, { data: logs }] = await Promise.all([
      db.from("evm_transactions")
        .select("id,hash,block_number,block_time,from_address,to_address,status,value_wei::text,gas_used::text,effective_gas_price_wei::text")
        .in("id", ids),
      db.from("token_transfers").select("transaction_id,token_address,from_address,to_address,standard,amount_raw::text").in("transaction_id", ids),
      db.from("evm_logs").select("transaction_id,topic0").in("transaction_id", ids),
    ]);
    if (e1 || e2) throw new Error(e1?.message ?? e2?.message);
    const tokens = [...new Set((transfers ?? []).map((t) => t.token_address))];
    const { data: meta } = tokens.length
      ? await db.from("evm_tokens").select("address,decimals").eq("chain", "robinhood").in("address", tokens)
      : { data: [] };
    const decimals = new Map((meta ?? []).map((m) => [m.address, m.decimals]));
    decimals.set(NATIVE, 18);

    const rows = [];
    const classes: Array<{ id: string; c: string }> = [];
    for (const tx of (txs ?? []) as unknown as Array<{ id: string; hash: string; block_number: string; block_time: string | null; from_address: string; to_address: string | null; status: string; value_wei: string; gas_used: string | null; effective_gas_price_wei: string | null }>) {
      const tt = (transfers ?? []).filter((x) => x.transaction_id === tx.id && x.standard === "erc20");
      const net = new Map<string, bigint>();
      const add = (k: string, v: bigint) => net.set(k, (net.get(k) ?? 0n) + v);
      if (tx.from_address === wallet) add(NATIVE, -big(tx.value_wei));
      for (const t of tt) {
        const amt = big(t.amount_raw);
        if (t.from_address === wallet) add(t.token_address, -amt);
        if (t.to_address === wallet) add(t.token_address, amt);
      }
      const outs = [...net].filter(([, v]) => v < 0n);
      const ins = [...net].filter(([, v]) => v > 0n);
      const initiated = tx.from_address === wallet;
      if (tx.status !== "success" || !initiated || outs.length !== 1 || ins.length !== 1) {
        classes.push({ id: tx.id, c: !initiated || !tt.length ? "transfer" : "unclassified" });
        continue;
      }
      const [sold, soldAmt] = outs[0]!;
      const [bought, boughtAmt] = ins[0]!;
      const topics = (logs ?? []).filter((l) => l.transaction_id === tx.id).map((l) => l.topic0 ?? "");
      const protocol = topics.map((t) => SWAP_TOPICS[t]).find(Boolean) ?? null;
      classes.push({ id: tx.id, c: "trade" });
      rows.push({
        chain: "robinhood", wallet_id: walletId, transaction_id: tx.id, transaction_hash: tx.hash, block_time: tx.block_time,
        block_number: Number(tx.block_number), router_address: tx.to_address, protocol,
        direction: sold === NATIVE ? "BUY" : bought === NATIVE ? "SELL" : "SWAP",
        gas_fee_wei: tx.gas_used && tx.effective_gas_price_wei ? (big(tx.gas_used) * big(tx.effective_gas_price_wei)).toString() : null,
        confidence: protocol ? "high" : "medium",
        detection_source: protocol ? "net-flow+swap-event" : "net-flow",
        sold_token: sold, sold_amount_raw: (-soldAmt).toString(), sold_decimals: decimals.get(sold) ?? null,
        bought_token: bought, bought_amount_raw: boughtAmt.toString(), bought_decimals: decimals.get(bought) ?? null,
        parser_version: PARSER_VERSION, valuation_status: "pending",
      });
    }
    if (rows.length) {
      const { error } = await db.from("evm_trades").upsert(rows as never, { onConflict: "wallet_id,transaction_id" });
      if (error) throw new Error(`Trade store failed: ${error.message}`);
      detected += rows.length;
    }
    for (const c of ["trade", "unclassified", "transfer"]) {
      const these = classes.filter((x) => x.c === c).map((x) => x.id);
      if (these.length && c !== "trade") await db.from("evm_trades").delete().eq("wallet_id", walletId).in("transaction_id", these);
      if (these.length) await db.from("wallet_transactions").update({ classification: c }).eq("wallet_id", walletId).in("transaction_id", these);
    }
  }
  return detected;
}
