/** Exponential backoff with jitter for durable worker retries. */

export function backoffMs(attempt: number, baseMs = 5_000, maxMs = 15 * 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1_000, exp * 0.1));
  return Math.min(maxMs, exp + jitter);
}

export function nextRunAfter(attempt: number, now = Date.now()): string {
  return new Date(now + backoffMs(attempt)).toISOString();
}
