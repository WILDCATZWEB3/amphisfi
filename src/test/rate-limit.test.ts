import { describe, expect, test } from "bun:test";

import { _resetRateLimitBuckets, rateLimit } from "../lib/rate-limit/memory";

describe("rateLimit", () => {
  test("allows under limit and blocks over", () => {
    _resetRateLimitBuckets();
    const key = "t:1";
    const windowMs = 10_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit({ key, limit: 3, windowMs, nowMs: 1000 + i }).allowed).toBe(true);
    }
    const blocked = rateLimit({ key, limit: 3, windowMs, nowMs: 1005 });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  test("window expiry frees slots", () => {
    _resetRateLimitBuckets();
    const key = "t:2";
    expect(rateLimit({ key, limit: 1, windowMs: 1000, nowMs: 0 }).allowed).toBe(true);
    expect(rateLimit({ key, limit: 1, windowMs: 1000, nowMs: 500 }).allowed).toBe(false);
    expect(rateLimit({ key, limit: 1, windowMs: 1000, nowMs: 1001 }).allowed).toBe(true);
  });
});
