/**
 * DefiLlama coins API (free, no key). Prices are aggregated from on-chain DEX
 * liquidity and CEX feeds. A price is accepted only when DefiLlama reports
 * confidence >= MIN_CONFIDENCE and its observation time is close to the
 * requested time; otherwise the mint is reported as unavailable.
 */
import type { MarketDataProvider, PricePoint } from "./provider";

const BASE = "https://coins.llama.fi";
const MIN_CONFIDENCE = 0.8;
const HISTORICAL_TOLERANCE_S = 60 * 60; // observation must be within 1h of the trade
const CURRENT_MAX_AGE_S = 2 * 60 * 60; // "current" price must be under 2h old

type LlamaRes = { coins?: Record<string, { price?: number; timestamp?: number; confidence?: number }> };

async function getJson(url: string, attempt = 0): Promise<LlamaRes> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`Price provider HTTP ${res.status}`);
  return (await res.json()) as LlamaRes;
}

function pick(res: LlamaRes, mints: string[], accept: (ts: number) => boolean): Map<string, PricePoint | null> {
  const out = new Map<string, PricePoint | null>();
  for (const m of mints) {
    const c = res.coins?.[`solana:${m}`];
    const ok =
      c && typeof c.price === "number" && c.price > 0 && Number.isFinite(c.price) &&
      typeof c.timestamp === "number" && accept(c.timestamp) &&
      (c.confidence ?? 0) >= MIN_CONFIDENCE;
    out.set(m, ok ? { priceUsd: c.price!, observedAt: c.timestamp!, source: "defillama" } : null);
  }
  return out;
}

export const defiLlama: MarketDataProvider = {
  name: "defillama",
  async getHistoricalPrices(mints, timestamp) {
    if (!mints.length) return new Map();
    const ids = mints.map((m) => `solana:${m}`).join(",");
    const res = await getJson(`${BASE}/prices/historical/${Math.floor(timestamp)}/${ids}?searchWidth=1h`);
    return pick(res, mints, (ts) => Math.abs(ts - timestamp) <= HISTORICAL_TOLERANCE_S);
  },
  async getCurrentPrices(mints) {
    const out = new Map<string, PricePoint | null>();
    const now = Date.now() / 1000;
    for (let i = 0; i < mints.length; i += 50) {
      const chunk = mints.slice(i, i + 50);
      const res = await getJson(`${BASE}/prices/current/${chunk.map((m) => `solana:${m}`).join(",")}`);
      for (const [k, v] of pick(res, chunk, (ts) => now - ts <= CURRENT_MAX_AGE_S)) out.set(k, v);
    }
    return out;
  },
};
