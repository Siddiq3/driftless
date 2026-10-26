import { Platform } from 'react-native';
jest.mock('@/data/session', () => ({
  selectPersonalSession: jest.fn().mockResolvedValue(undefined),
}));
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TurboModuleRegistry } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { invalidateEntitlement } from '../src/billing/cache';
import { SessionProvider, useSession } from '../src/auth/session';

jest.mock('../src/billing/cache', () => ({ invalidateEntitlement: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    getCurrentUser: jest.fn(() => ({ user: { id: '100000000000000000001' } })),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn(),
    revokeAccess: jest.fn(),
  },
}));
const mockMarkers = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockMarkers.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockMarkers.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockMarkers.delete(key);
  }),
}));
const response = (idToken = 'google-id-token') => ({
  type: 'success' as const,
  data: {
    idToken,
    serverAuthCode: null,
    scopes: [],
    user: {
      id: '100000000000000000001',
      name: 'Test',
      email: 'test@example.test',
      photo: null,
      familyName: null,
      givenName: null,
    },
  },
});
let latest: ReturnType<typeof useSession>;
let renderer: ReactTestRenderer | undefined;
function Probe() {
  const session = useSession();
  useEffect(() => {
    latest = session;
  }, [session]);
  return null;
}
const mount = async (ios = false) => {
  await act(async () => {
    renderer = create(
      createElement(SessionProvider, {
        env: {
          apiUrl: 'https://api.example.test',
          googleWebClientId: 'web.apps.googleusercontent.com',
          ...(ios ? { googleIosClientId: 'ios.apps.googleusercontent.com' } : {}),
        },
        // React's createElement typing requires this prop for a required children field.
        // eslint-disable-next-line react/no-children-prop
        children: createElement(Probe),
      }),
    );
  });
};
const login = async () => {
  const session = latest;
  if (session.status !== 'signedOut') throw new Error('Expected signed out');
  await act(async () => {
    await session.signIn();
  });
};
const signedIn = () => {
  const s = latest;
  if (s.status !== 'signedIn') throw new Error('Expected signed in');
  return s;
};
const originalPlatform = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockMarkers.clear();
  jest.clearAllMocks();
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as never);
  jest
    .mocked(GoogleSignin.getCurrentUser)
    .mockReturnValue({ user: { id: '100000000000000000001' } } as never);
  jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
  jest.mocked(GoogleSignin.signIn).mockResolvedValue(response());
  jest.mocked(GoogleSignin.signInSilently).mockResolvedValue(response('renewed-token'));
  jest.mocked(GoogleSignin.signOut).mockResolvedValue(null);
  jest.mocked(GoogleSignin.revokeAccess).mockResolvedValue(null);
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('react-test-renderer is deprecated')) return;
    original(...args);
  });
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
  jest.restoreAllMocks();
});

test('guest startup never silently selects a Google account and removes legacy tokens', async () => {
  mockMarkers.set('driftless.tokens.v1', 'old-cognito-token');
  await mount();
  expect(latest.status).toBe('signedOut');
  expect(GoogleSignin.signInSilently).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('driftless.tokens.v1');
  expect(mockMarkers.has('driftless.tokens.v1')).toBe(false);
});
test('only an opted-in saved session restores silently', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  await mount();
  expect(latest.status).toBe('signedIn');
  expect(GoogleSignin.signIn).not.toHaveBeenCalled();
});
test('canceling the Google picker leaves guest mode and no saved session', async () => {
  await mount();
  jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null });
  await login();
  expect(latest).toMatchObject({ status: 'signedOut', error: null });
  expect(mockMarkers.has('driftless.google.enabled.v1')).toBe(false);
});
test('a successful account choice stores a non-credential owner marker and clears prior access', async () => {
  await mount();
  await login();
  expect(latest.status).toBe('signedIn');
  expect(mockMarkers.get('driftless.google.enabled.v1')).toBe('true');
  expect(mockMarkers.get('driftless.google.cache-owner.v1')).toBe('100000000000000000001');
  expect(invalidateEntitlement).toHaveBeenCalled();
});
test('sign-out invalidates a pending token and cached API-client getters', async () => {
  await mount();
  await login();
  const session = signedIn();
  let complete!: (value: ReturnType<typeof response>) => void;
  jest.mocked(GoogleSignin.signInSilently).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = session.getAccessToken(true);
  await act(async () => {
    await session.signOut();
  });
  complete(response('late-token'));
  await expect(pending).resolves.toBeNull();
  await expect(session.getAccessToken()).resolves.toBeNull();
  expect(GoogleSignin.signInSilently).toHaveBeenCalledTimes(1);
  expect(latest.status).toBe('signedOut');
  expect(mockMarkers.get('driftless.google.enabled.v1')).toBe('false');
});
test('concurrent API calls share one silent Google credential request', async () => {
  await mount();
  await login();
  let complete!: (value: ReturnType<typeof response>) => void;
  jest.mocked(GoogleSignin.signInSilently).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const session = signedIn();
  const first = session.getAccessToken(true);
  const second = session.getAccessToken(true);
  complete(response('current-id-token'));
  await expect(Promise.all([first, second])).resolves.toEqual([
    'current-id-token',
    'current-id-token',
  ]);
  expect(GoogleSignin.signInSilently).toHaveBeenCalledTimes(1);
});
test('account disconnect revokes the app grant and disables restoration', async () => {
  await mount();
  await login();
  const session = signedIn();
  await act(async () => {
    await session.disconnect();
  });
  expect(GoogleSignin.revokeAccess).toHaveBeenCalledTimes(1);
  expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
  expect(latest.status).toBe('signedOut');
});
test('an older native binary keeps guest mode usable without loading the Google SDK', async () => {
  jest.mocked(TurboModuleRegistry.get).mockReturnValue(null);
  await mount();
  expect(latest.status).toBe('unconfigured');
  expect(GoogleSignin.configure).not.toHaveBeenCalled();
});

test('a restored stable identity clears entitlement until its incarnation is verified', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  mockMarkers.set('driftless.google.cache-owner.v1', '100000000000000000001');
  await mount();
  expect(invalidateEntitlement).toHaveBeenCalledTimes(1);
});
test('a restored different account clears the previous native entitlement', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  mockMarkers.set('driftless.google.cache-owner.v1', 'previous-owner');
  await mount();
  expect(invalidateEntitlement).toHaveBeenCalledTimes(1);
});
test('sign-out clears native access immediately even when saving the marker fails', async () => {
  await mount();
  await login();
  jest.mocked(invalidateEntitlement).mockClear();
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => {
    await expect(signedIn().signOut()).rejects.toThrow('storage unavailable');
  });
  expect(invalidateEntitlement).toHaveBeenCalledTimes(1);
  expect(latest.status).toBe('signedOut');
  expect(GoogleSignin.signOut).toHaveBeenCalled();
});

test('silent account replacement never reuses the previous account entitlement or API client', async () => {
  await mount();
  await login();
  const previous = signedIn();
  jest.mocked(invalidateEntitlement).mockClear();
  jest
    .mocked(GoogleSignin.getCurrentUser)
    .mockReturnValue({ user: { id: 'another-owner' } } as never);
  await act(async () => {
    await expect(previous.getAccessToken()).resolves.toBeNull();
  });
  expect(invalidateEntitlement).toHaveBeenCalledTimes(1);
  expect(latest.status).toBe('signedOut');
});

test('an API client from a previous login cannot get the new login credentials', async () => {
  await mount();
  await login();
  const previous = signedIn();
  await act(async () => previous.signOut());
  await login();
  jest.mocked(GoogleSignin.signInSilently).mockClear();
  await expect(previous.getAccessToken()).resolves.toBeNull();
  expect(GoogleSignin.signInSilently).not.toHaveBeenCalled();
  await expect(signedIn().getAccessToken(true)).resolves.toBe('renewed-token');
});

it('uses the signed-in Google profile name as the presentation name', async () => {
  jest.mocked(GoogleSignin.getCurrentUser).mockReturnValue({
    user: { id: '100000000000000000001', name: 'Siddiq Kolimi', email: 'siddiq@example.test' },
  } as never);
  await mount();
  await login();
  expect(signedIn().displayName).toBe('Siddiq Kolimi');
});

test('local scope initialization failure exposes Retry and resumes without erasing data', async () => {
  const { selectPersonalSession } = require('@/data/session');
  selectPersonalSession.mockRejectedValueOnce(new Error('disk unavailable'));
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your phone data is retained');
  await act(async () =>
    renderer!.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress(),
  );
  expect(latest.status).toBe('signedOut');
});

test('failed sign-out scope selection can retry the safe exit without signing in again', async () => {
  await mount();
  await login();
  const { selectPersonalSession } = require('@/data/session');
  selectPersonalSession.mockRejectedValueOnce(new Error('disk unavailable'));
  await act(async () => {
    await expect(signedIn().signOut()).rejects.toThrow('disk unavailable');
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your phone data is retained');
  await act(async () =>
    renderer!.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress(),
  );
  expect(latest.status).toBe('signedOut');
  expect(GoogleSignin.signOut).toHaveBeenCalled();
});

test('failed silent renewal releases the shared request so Retry can recover', async () => {
  await mount();
  await login();
  jest.mocked(GoogleSignin.signInSilently).mockRejectedValueOnce(new Error('sdk unavailable'));
  await expect(signedIn().getAccessToken(true)).rejects.toThrow('sdk unavailable');
  expect(latest.status).toBe('signedIn');
  await expect(signedIn().getAccessToken(true)).resolves.toBe('renewed-token');
});

test('cold reopen restores Google once and reuses its credential for bootstrap requests', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  await mount();
  expect(latest.status).toBe('signedIn');
  await expect(signedIn().getAccessToken()).resolves.toBe('renewed-token');
  await expect(signedIn().getAccessToken()).resolves.toBe('renewed-token');
  expect(GoogleSignin.signInSilently).toHaveBeenCalledTimes(1);
});
test('temporary restoration failure never silently sends an opted-in account to guest mode', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  jest.mocked(GoogleSignin.signInSilently).mockRejectedValueOnce(new Error('temporary outage'));
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your phone data is retained');
  expect(mockMarkers.get('driftless.google.enabled.v1')).toBe('true');
  const { selectPersonalSession } = require('@/data/session');
  expect(selectPersonalSession).not.toHaveBeenCalled();
  await act(async () =>
    renderer!.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress(),
  );
  expect(latest.status).toBe('signedIn');
});

test('reuses a recent credential but renews after its short reuse window', async () => {
  await mount();
  await login();
  const now = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  await expect(signedIn().getAccessToken()).resolves.toBe('google-id-token');
  expect(GoogleSignin.signInSilently).not.toHaveBeenCalled();
  jest.mocked(Date.now).mockReturnValue(now + 61_000);
  await expect(signedIn().getAccessToken()).resolves.toBe('renewed-token');
  await expect(signedIn().getAccessToken()).resolves.toBe('renewed-token');
  expect(GoogleSignin.signInSilently).toHaveBeenCalledTimes(1);
});
test('a cold-reopen Google timeout remains recoverable instead of selecting guest storage', async () => {
  jest.useFakeTimers();
  try {
    mockMarkers.set('driftless.google.enabled.v1', 'true');
    jest.mocked(GoogleSignin.signInSilently).mockImplementationOnce(() => new Promise(() => {}));
    await mount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    const { selectPersonalSession } = require('@/data/session');
    expect(selectPersonalSession).not.toHaveBeenCalled();
    expect(mockMarkers.get('driftless.google.enabled.v1')).toBe('true');
    expect(JSON.stringify(renderer!.toJSON())).toContain('Your phone data is retained');
    await act(async () =>
      renderer!.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress(),
    );
    expect(latest.status).toBe('signedIn');
  } finally {
    jest.useRealTimers();
  }
});

test('iPhone login configures the iOS client and never checks Play Services', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount(true);
  await login();
  expect(latest.status).toBe('signedIn');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: 'web.apps.googleusercontent.com',
    iosClientId: 'ios.apps.googleusercontent.com',
    offlineAccess: false,
  });
  expect(GoogleSignin.hasPlayServices).not.toHaveBeenCalled();
});

test('missing iOS OAuth configuration leaves guest mode available', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount();
  expect(latest.status).toBe('unconfigured');
  expect(GoogleSignin.configure).not.toHaveBeenCalled();
});
