/** Retry schedule for outbox items: exponential backoff with full jitter, capped. */

export const BASE_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 6 * 3600_000;
/** After this many failures the item stays queued but is surfaced to the user as "sync stuck". */
export const STUCK_AFTER_ATTEMPTS = 8;

export function nextDelayMs(attempts: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts));
  return Math.max(BASE_DELAY_MS, Math.floor(random() * exp));
}

/** Which failures are worth retrying. 4xx (except 408/409/429) are permanent. */
export function isRetryable(status: number | null): boolean {
  if (status === null) return true; // network error / offline
  if (status === 408 || status === 409 || status === 429) return true;
  return status >= 500;
}
