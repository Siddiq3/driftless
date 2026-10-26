import { ApiError } from '@/api/client';
import { bootstrapFailure } from '@/auth/bootstrapFailure';
it.each([
  [null, 'network', true],
  [401, 'unauthorized', true],
  [429, 'rate_limited', true],
  [503, 'unavailable', true],
  [409, 'account_inactive', true],
  [200, 'contract_mismatch', false],
  [409, 'profile_missing', false],
  [403, 'forbidden', false],
  [400, 'bad_request', false],
] as const)('classifies %s/%s without exposing raw errors', (status, code, retryable) => {
  const failure = bootstrapFailure(new ApiError(status, code, 'private diagnostic'));
  expect(failure.retryable).toBe(retryable);
  expect(failure.message).not.toContain('private diagnostic');
});
it('allows local initialization to resume', () => {
  expect(bootstrapFailure(new Error('sqlite unavailable')).retryable).toBe(true);
});

it.each(['credential_timeout', 'credential_unavailable'])('offers safe Retry for %s', (code) => {
  const failure = bootstrapFailure(new ApiError(null, code, 'private diagnostic'));
  expect(failure.retryable).toBe(true);
  expect(failure.message).toContain('Google session restoration');
});
