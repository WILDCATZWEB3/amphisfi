/**
 * Historical USD prices from DefiLlama (server-only). Every lookup, including
 * misses, is cached in evm_price_snapshots. Missing prices stay null — never guessed.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SLUG = "robinhood"; // verified: coins.llama.fi recognises robinhood:<address>
const SOURCE = "defillama";
const BUCKET = 300; // 5-minute buckets keep the cache reusable

export type Price = { price: number | null; observedTs: number | null };

export async function historicalPrices(tokens: string[], unixTs: number): Promise<Map<string, Price>> {
  const ts = Math.floor(unixTs / BUCKET) * BUCKET;
  const out = new Map<string, Price>();
  const { data: cached } = await supabaseAdmin.from("evm_price_snapshots")
    .select("token,price_usd,observed_ts").eq("chain", SLUG).eq("requested_ts", ts).in("token", tokens);
  for (const c of cached ?? []) out.set(c.token, { price: c.price_usd === null ? null : Number(c.price_usd), observedTs: c.observed_ts });
  const missing = tokens.filter((t) => !out.has(t));
  if (!missing.length) return out;

  const coins = missing.map((t) => `${SLUG}:${t}`).join(",");
  const res = await fetch(`https://coins.llama.fi/prices/historical/${ts}/${coins}?searchWidth=2h`);
  if (!res.ok) throw new Error(`Price feed unavailable (${res.status})`);
  const body = (await res.json()) as { coins?: Record<string, { price: number; timestamp: number }> };
  const rows = missing.map((t) => {
    const hit = body.coins?.[`${SLUG}:${t}`];
    const p = hit && Number.isFinite(hit.price) ? { price: hit.price, observedTs: hit.timestamp } : { price: null, observedTs: null };
    out.set(t, p);
    return { chain: SLUG, token: t, requested_ts: ts, price_usd: p.price, observed_ts: p.observedTs, status: p.price === null ? "missing" : "ok", source: SOURCE };
  });
  await supabaseAdmin.from("evm_price_snapshots").upsert(rows, { onConflict: "chain,token,requested_ts", ignoreDuplicates: true });
  return out;
}
