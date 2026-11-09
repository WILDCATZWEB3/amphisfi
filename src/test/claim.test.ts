import { describe, expect, test } from "bun:test";

import {
  applyOptimisticClaim,
  isClaimCandidate,
  isLeaseExpired,
  leaseExpiresAtIso,
  selectClaimCandidate,
  walletSyncBlocked,
} from "../lib/worker/claim";

const base = {
  id: "a",
  kind: "wallet_sync",
  wallet_id: "w1",
  status: "queued",
  run_after: "2020-01-01T00:00:00.000Z",
  lease_expires_at: null,
  attempts: 0,
};

describe("lease helpers", () => {
  test("expired lease detected", () => {
    expect(isLeaseExpired("2020-01-01T00:00:00.000Z", Date.parse("2020-01-01T00:01:00.000Z"))).toBe(
      true,
    );
    expect(isLeaseExpired("2030-01-01T00:00:00.000Z", Date.parse("2020-01-01T00:00:00.000Z"))).toBe(
      false,
    );
  });

  test("wallet sync blocked by active lease", () => {
    const now = Date.parse("2024-01-01T00:00:00.000Z");
    expect(
      walletSyncBlocked(
        "w1",
        [{ wallet_id: "w1", status: "running", lease_expires_at: "2030-01-01T00:00:00.000Z" }],
        now,
      ),
    ).toBe(true);
    expect(
      walletSyncBlocked(
        "w1",
        [{ wallet_id: "w1", status: "running", lease_expires_at: "2020-01-01T00:00:00.000Z" }],
        now,
      ),
    ).toBe(false);
  });

  test("selects oldest eligible and skips blocked wallet", () => {
    const now = Date.parse("2024-06-01T00:00:00.000Z");
    const jobs = [
      { ...base, id: "1", wallet_id: "w1" },
      { ...base, id: "2", wallet_id: "w2" },
      { ...base, id: "3", kind: "price_alerts", wallet_id: null },
    ];
    const running = [
      { wallet_id: "w1", status: "running", lease_expires_at: "2030-01-01T00:00:00.000Z" },
    ];
    expect(selectClaimCandidate(jobs, running, now)?.id).toBe("2");
  });

  test("not yet run_after is ineligible", () => {
    const now = Date.parse("2024-01-01T00:00:00.000Z");
    expect(isClaimCandidate({ ...base, run_after: "2030-01-01T00:00:00.000Z" }, now, [])).toBe(
      false,
    );
  });

  test("optimistic claim only from queued", () => {
    const now = Date.now();
    const ok = applyOptimisticClaim(base, "worker-1", now, 60);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.job.status).toBe("running");
      expect(ok.job.attempts).toBe(1);
      expect(ok.job.locked_by).toBe("worker-1");
      expect(Date.parse(ok.job.lease_expires_at!)).toBeGreaterThan(now);
    }
    const bad = applyOptimisticClaim({ ...base, status: "running" }, "w", now);
    expect(bad.ok).toBe(false);
  });

  test("leaseExpiresAtIso clamps", () => {
    const now = Date.parse("2024-01-01T00:00:00.000Z");
    const a = Date.parse(leaseExpiresAtIso(now, 10));
    const b = Date.parse(leaseExpiresAtIso(now, 99999));
    expect(a - now).toBe(30_000);
    expect(b - now).toBe(3_600_000);
  });
});
