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
const mount = async () => {
  await act(async () => {
    renderer = create(
      createElement(SessionProvider, {
        env: {
          apiUrl: 'https://api.example.test',
          googleWebClientId: 'web.apps.googleusercontent.com',
        },
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
beforeEach(() => {
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
  const pending = session.getAccessToken();
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
  const first = session.getAccessToken();
  const second = session.getAccessToken();
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

test('a restored account preserves bounded offline access only for the same recorded owner', async () => {
  mockMarkers.set('driftless.google.enabled.v1', 'true');
  mockMarkers.set('driftless.google.cache-owner.v1', '100000000000000000001');
  await mount();
  expect(invalidateEntitlement).not.toHaveBeenCalled();
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
  await expect(signedIn().getAccessToken()).resolves.toBe('renewed-token');
});
