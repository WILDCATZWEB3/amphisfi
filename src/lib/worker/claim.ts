/** Pure helpers for durable worker lease/claim semantics (unit-tested). */

export type ClaimableJob = {
  id: string;
  kind: string;
  wallet_id: string | null;
  status: string;
  run_after: string; // ISO
  lease_expires_at: string | null;
  attempts: number;
};

export type RunningLock = {
  wallet_id: string;
  lease_expires_at: string | null;
  status: string;
};

export const DEFAULT_LEASE_SECONDS = 120;

export function isLeaseExpired(leaseExpiresAt: string | null | undefined, nowMs: number): boolean {
  if (!leaseExpiresAt) return false; // null lease on running = treat as still held until timeout path sets it
  return Date.parse(leaseExpiresAt) < nowMs;
}

/** Running wallet sync blocks new claims unless its lease expired. */
export function walletSyncBlocked(
  walletId: string | null,
  running: RunningLock[],
  nowMs: number,
): boolean {
  if (!walletId) return false;
  return running.some(
    (r) =>
      r.wallet_id === walletId &&
      r.status === "running" &&
      !isLeaseExpired(r.lease_expires_at, nowMs),
  );
}

export function isClaimCandidate(
  job: ClaimableJob,
  nowMs: number,
  running: RunningLock[],
): boolean {
  if (job.status !== "queued") return false;
  if (Date.parse(job.run_after) > nowMs) return false;
  if (job.kind === "wallet_sync" && walletSyncBlocked(job.wallet_id, running, nowMs)) return false;
  return true;
}

/** Pick oldest eligible queued job (stable by created order of input). */
export function selectClaimCandidate(
  jobs: ClaimableJob[],
  running: RunningLock[],
  nowMs: number,
): ClaimableJob | null {
  for (const job of jobs) {
    if (isClaimCandidate(job, nowMs, running)) return job;
  }
  return null;
}

export function leaseExpiresAtIso(nowMs: number, leaseSeconds = DEFAULT_LEASE_SECONDS): string {
  const secs = Math.max(30, Math.min(leaseSeconds, 3600));
  return new Date(nowMs + secs * 1000).toISOString();
}

/** Simulate optimistic claim: only succeeds if still queued. */
export function applyOptimisticClaim(
  job: ClaimableJob,
  workerId: string,
  nowMs: number,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): { ok: true; job: ClaimableJob & { locked_by: string } } | { ok: false; reason: string } {
  if (job.status !== "queued") return { ok: false, reason: "not_queued" };
  return {
    ok: true,
    job: {
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      lease_expires_at: leaseExpiresAtIso(nowMs, leaseSeconds),
      locked_by: workerId,
    } as ClaimableJob & { locked_by: string },
  };
}
