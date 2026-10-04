/**
 * Robinhood Chain swap detection (server-only). Conservative: a transaction is a
 * trade only when the wallet's net balance change is exactly one token out and
 * one different token in. Anything else is skipped, never guessed.
 * Bump PARSER_VERSION when the rules change so older rows are re-detected.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const PARSER_VERSION = 1;
export const NATIVE = "0x0000000000000000000000000000000000000000";

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

export async function detectTrades(walletId: string, wallet: string) {
  const db = supabaseAdmin;
  const links = await allLinks(walletId);
  const { data: existing } = await db.from("evm_trades").select("transaction_id,parser_version").eq("wallet_id", walletId);
  const done = new Set((existing ?? []).filter((e) => e.parser_version >= PARSER_VERSION).map((e) => e.transaction_id));
  const todo = links.map((l) => l.transaction_id).filter((id) => !done.has(id));
  let detected = 0;

  for (let i = 0; i < todo.length; i += 100) {
    const ids = todo.slice(i, i + 100);
    const [{ data: txs }, { data: transfers }] = await Promise.all([
      db.from("evm_transactions").select("id,hash,block_time,from_address,value_wei,status").in("id", ids),
      db.from("token_transfers").select("transaction_id,token_address,from_address,to_address,amount_raw,standard").in("transaction_id", ids),
    ]);
    const tokens = [...new Set((transfers ?? []).map((t) => t.token_address))];
    const { data: meta } = tokens.length
      ? await db.from("evm_tokens").select("address,decimals").eq("chain", "robinhood").in("address", tokens)
      : { data: [] };
    const decimals = new Map((meta ?? []).map((m) => [m.address, m.decimals]));
    decimals.set(NATIVE, 18);

    const rows = [];
    for (const tx of txs ?? []) {
      if (tx.status !== "success") continue;
      const net = new Map<string, bigint>();
      const add = (k: string, v: bigint) => net.set(k, (net.get(k) ?? 0n) + v);
      if (tx.from_address === wallet && BigInt(String(tx.value_wei)) > 0n) add(NATIVE, -BigInt(String(tx.value_wei)));
      for (const t of (transfers ?? []).filter((x) => x.transaction_id === tx.id && x.standard === "erc20")) {
        const amt = BigInt(String(t.amount_raw));
        if (t.from_address === wallet) add(t.token_address, -amt);
        if (t.to_address === wallet) add(t.token_address, amt);
      }
      const outs = [...net].filter(([, v]) => v < 0n);
      const ins = [...net].filter(([, v]) => v > 0n);
      if (outs.length !== 1 || ins.length !== 1) continue;
      const [sold, soldAmt] = outs[0]!;
      const [bought, boughtAmt] = ins[0]!;
      rows.push({
        chain: "robinhood", wallet_id: walletId, transaction_id: tx.id, transaction_hash: tx.hash, block_time: tx.block_time,
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
  }
  return detected;
}
