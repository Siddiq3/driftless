import { BASE_DELAY_MS, isRetryable, MAX_DELAY_MS, nextDelayMs } from '../src/db/outbox';

describe('outbox retry policy', () => {
  it('backs off exponentially with jitter, bounded', () => {
    expect(nextDelayMs(0, () => 1)).toBe(BASE_DELAY_MS);
    expect(nextDelayMs(3, () => 1)).toBe(BASE_DELAY_MS * 8);
    expect(nextDelayMs(50, () => 1)).toBe(MAX_DELAY_MS);
    expect(nextDelayMs(5, () => 0)).toBe(BASE_DELAY_MS); // never below the base
  });
  it('retries network, 408/409/429 and 5xx; not other 4xx', () => {
    expect([null, 408, 409, 429, 500, 503].every(isRetryable)).toBe(true);
    expect([400, 401, 403, 404, 412, 413, 422].some(isRetryable)).toBe(false);
  });
});
