import { describe, expect, test } from "bun:test";

import { backoffMs } from "../lib/worker/backoff";

describe("backoffMs", () => {
  test("grows with attempts and respects max", () => {
    const a1 = backoffMs(1, 1000, 10_000);
    const a4 = backoffMs(4, 1000, 10_000);
    expect(a1).toBeGreaterThanOrEqual(1000);
    expect(a1).toBeLessThanOrEqual(1100);
    expect(a4).toBeGreaterThan(a1);
    expect(backoffMs(20, 1000, 10_000)).toBeLessThanOrEqual(10_000 + 1000);
  });
});
