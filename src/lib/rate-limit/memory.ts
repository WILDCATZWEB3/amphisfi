/** Simple in-process sliding-window rate limiter for public endpoints. */

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}): RateLimitResult {
  const now = input.nowMs ?? Date.now();
  const windowStart = now - input.windowMs;
  let b = buckets.get(input.key);
  if (!b) {
    b = { timestamps: [] };
    buckets.set(input.key, b);
  }
  b.timestamps = b.timestamps.filter((t) => t > windowStart);
  if (b.timestamps.length >= input.limit) {
    const oldest = b.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + input.windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  b.timestamps.push(now);
  return { allowed: true };
}

/** Test helper */
export function _resetRateLimitBuckets() {
  buckets.clear();
}

export function clientKeyFromRequest(request: Request | undefined, prefix: string): string {
  const h = request?.headers;
  const xf = h?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h?.get("x-real-ip")?.trim();
  const ip = xf || real || "unknown";
  return `${prefix}:${ip}`;
}
