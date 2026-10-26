import { googleIdentity, type GoogleIdentityClient } from '../src/auth/google';

const client = (): GoogleIdentityClient => ({
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'google-identity' } }),
  signInSilently: jest
    .fn()
    .mockResolvedValue({ type: 'success', data: { idToken: 'renewed-google-identity' } }),
});

test('interactive login checks Play Services and returns the Google ID token', async () => {
  const sdk = client();
  expect(await googleIdentity(sdk, true)).toBe('google-identity');
  expect(sdk.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  expect(sdk.signInSilently).not.toHaveBeenCalled();
});
test('silent renewal never opens interactive sign-in or a Play Services dialog', async () => {
  const sdk = client();
  expect(await googleIdentity(sdk, false)).toBe('renewed-google-identity');
  expect(sdk.hasPlayServices).not.toHaveBeenCalled();
  expect(sdk.signIn).not.toHaveBeenCalled();
});
test.each(['cancelled', 'noSavedCredentialFound'])(
  '%s never establishes a session',
  async (type) => {
    const sdk = client();
    jest.mocked(sdk.signIn).mockResolvedValue({ type, data: null });
    expect(await googleIdentity(sdk, true)).toBeNull();
  },
);
test('a response without an ID token fails rather than using a Google API access token', async () => {
  const sdk = client();
  jest.mocked(sdk.signIn).mockResolvedValue({ type: 'success', data: { idToken: null } });
  await expect(googleIdentity(sdk, true)).rejects.toThrow('identity token');
});
test('unavailable Play Services do not launch an account picker', async () => {
  const sdk = client();
  jest.mocked(sdk.hasPlayServices).mockRejectedValue(new Error('unavailable'));
  await expect(googleIdentity(sdk, true)).rejects.toThrow('unavailable');
  expect(sdk.signIn).not.toHaveBeenCalled();
});

test('a stalled silent session times out and a later attempt can recover', async () => {
  jest.useFakeTimers();
  try {
    const sdk = client();
    jest.mocked(sdk.signInSilently).mockImplementationOnce(() => new Promise(() => {}));
    const pending = expect(googleIdentity(sdk, false)).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(await googleIdentity(sdk, false)).toBe('renewed-google-identity');
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
