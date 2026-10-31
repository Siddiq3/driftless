jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '12345678-1234-4234-8234-123456789012'),
}));
import { ensureSocialProfile } from '../src/social/profile';
import { googleDisplayName } from '../src/auth/google';
import { ApiError, type ApiClient } from '../src/api/client';

function client() {
  let profile = { displayName: null as string | null, handle: null as string | null, rev: 1 };
  return {
    getMe: jest.fn(async () => ({ data: { profile } })),
    patchMe: jest.fn(async (patch) => {
      profile = { ...profile, ...patch, rev: profile.rev + 1 };
      return { data: { profile } };
    }),
  };
}
it('uses the Google account name and never falls back to the email address', () => {
  const named = { name: ' Siddiq Kolimi ', email: 'other@example.test' };
  expect(googleDisplayName(named)).toBe('Siddiq Kolimi');
  for (const name of [null, undefined, '   ']) {
    const unnamed = { name, email: 'siddiq@example.test' };
    expect(googleDisplayName(unnamed)).toBeNull();
  }
  expect(googleDisplayName(null)).toBeNull();
});
it('allocates one handle and coalesces concurrent initialization without changing sharing consent', async () => {
  const api = client();
  const request = () =>
    ensureSocialProfile(api as unknown as ApiClient, 'Siddiq Kolimi', () => true);
  await Promise.all([request(), request()]);
  await request();
  expect(api.patchMe).toHaveBeenCalledTimes(1);
  expect(api.patchMe).toHaveBeenCalledWith(
    { displayName: 'Siddiq Kolimi', handle: 'player_12345678' },
    1,
    expect.any(Function),
  );
});
it('retries a profile revision conflict and preserves an existing handle', async () => {
  const api = client();
  api.patchMe.mockRejectedValueOnce(new ApiError(412, 'precondition_failed', 'changed'));
  await ensureSocialProfile(api as unknown as ApiClient, 'Siddiq', () => true);
  expect(api.patchMe).toHaveBeenCalledTimes(2);
  await ensureSocialProfile(api as unknown as ApiClient, 'New name', () => true);
  expect(api.patchMe.mock.calls[2]![0]).toEqual({ displayName: 'New name' });
});
it('never writes after session cancellation', async () => {
  const api = client();
  let allowed = true;
  api.getMe.mockImplementationOnce(async () => {
    allowed = false;
    return { data: { profile: { displayName: null, handle: null, rev: 1 } } };
  });
  await expect(
    ensureSocialProfile(api as unknown as ApiClient, 'A', () => allowed),
  ).rejects.toThrow('Account changed');
  expect(api.patchMe).not.toHaveBeenCalled();
});

it('an existing account keeps its Google name and handle with no write', async () => {
  const api = client();
  await ensureSocialProfile(api as unknown as ApiClient, 'Siddiq', () => true);
  api.patchMe.mockClear();
  await ensureSocialProfile(api as unknown as ApiClient, 'Siddiq', () => true);
  expect(api.patchMe).not.toHaveBeenCalled();
});
it('a missing Google name stores no name and never stores a placeholder', async () => {
  const api = client();
  await ensureSocialProfile(api as unknown as ApiClient, null, () => true);
  expect(api.patchMe.mock.calls[0]![0]).toEqual({ handle: 'player_12345678' });
});
