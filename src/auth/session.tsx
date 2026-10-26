import { Pressable, Text, View, TurboModuleRegistry, Platform } from 'react-native';
import type { GoogleSignin as GoogleSDK } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Env } from '../config/env';
import { googleIdentity, googleDisplayName } from './google';
import { invalidateEntitlement } from '@/billing/cache';
import { selectPersonalSession } from '@/data/session';

// Stores only the user's choice to stay signed in. Credentials are managed by Google's SDK.
const ENABLED_KEY = 'driftless.google.enabled.v1';
const LEGACY_KEY = 'driftless.tokens.v1';
const OWNER_KEY = 'driftless.google.cache-owner.v1';
type SessionState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | {
      status: 'signedOut';
      googleSupported: boolean;
      signIn: () => Promise<void>;
      error: string | null;
    }
  | {
      status: 'signedIn';
      displayName?: string | null;
      getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
      signOut: () => Promise<void>;
      disconnect: () => Promise<void>;
    };
const Ctx = createContext<SessionState>({ status: 'loading' });
export const useSession = () => useContext(Ctx);

function UnconfiguredSession({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    invalidateEntitlement();
    void selectPersonalSession(null)
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (failed)
    return (
      <ScopeRecovery
        retry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  return (
    <Ctx.Provider value={{ status: ready ? 'unconfigured' : 'loading' }}>{children}</Ctx.Provider>
  );
}

export function SessionProvider({ env, children }: { env: Env | null; children: ReactNode }) {
  if (
    !env ||
    (Platform.OS === 'ios' && !env.googleIosClientId) ||
    !TurboModuleRegistry.get('RNGoogleSignin')
  )
    return <UnconfiguredSession>{children}</UnconfiguredSession>;
  return <GoogleSession env={env}>{children}</GoogleSession>;
}

function ScopeRecovery({ retry }: { retry: () => void }) {
  return (
    <View style={{ padding: 24 }}>
      <Text accessibilityRole="alert">
        Saved progress could not be opened. Your phone data is retained. Retry to resume safely.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retry}>
        <Text>Retry</Text>
      </Pressable>
    </View>
  );
}

function GoogleSession({ env, children }: { env: Env; children: ReactNode }) {
  const GoogleSignin = useMemo(
    // Lazy load after checking native availability, so guest mode works in older dev clients.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('@react-native-google-signin/google-signin').GoogleSignin as typeof GoogleSDK,
    [],
  );
  const [attempt, setAttempt] = useState(0);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef({ value: 0 });
  const enabled = useRef(false);
  const cachedToken = useRef<{ value: string; until: number } | null>(null);
  const tokenRequest = useRef<Promise<string | null> | null>(null);
  const signingIn = useRef(false);
  const pendingSignOut = useRef(false);
  const accountOwner = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const lifetime = generation.current;
    GoogleSignin.configure({
      webClientId: env.googleWebClientId,
      iosClientId: env.googleIosClientId ?? undefined,
      offlineAccess: false,
    });
    (async () => {
      // Existing Cognito sessions must never be reused as Google credentials.
      await SecureStore.deleteItemAsync(LEGACY_KEY);
      const staySignedIn = await SecureStore.getItemAsync(ENABLED_KEY);
      const token = staySignedIn === 'true' ? await googleIdentity(GoogleSignin, false) : null;
      const owner = token ? GoogleSignin.getCurrentUser()?.user.id : null;
      if (active) {
        invalidateEntitlement();
        if (owner) await SecureStore.setItemAsync(OWNER_KEY, owner);
        if (!active) return;
        accountOwner.current = owner ?? null;
        enabled.current = Boolean(token);
        cachedToken.current = token ? { value: token, until: Date.now() + 60_000 } : null;
        await selectPersonalSession(owner ?? null);
        if (!active) return;
        setSignedIn(Boolean(token));
      }
    })().catch(() => {
      if (active) {
        // A timeout/outage is not a sign-out. Keep the saved choice and guest data intact.
        invalidateEntitlement();
        setInitializationFailed(true);
      }
    });
    return () => {
      active = false;
      lifetime.value++;
    };
  }, [env.googleWebClientId, env.googleIosClientId, GoogleSignin, attempt]);

  const signIn = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setError(null);
    try {
      const token = await googleIdentity(GoogleSignin, true);
      if (!token) return;
      invalidateEntitlement();
      const owner = GoogleSignin.getCurrentUser()?.user.id;
      if (owner) await SecureStore.setItemAsync(OWNER_KEY, owner);
      else await SecureStore.deleteItemAsync(OWNER_KEY);
      await SecureStore.setItemAsync(ENABLED_KEY, 'true');
      generation.current.value++;
      tokenRequest.current = null;
      cachedToken.current = { value: token, until: Date.now() + 60_000 };
      accountOwner.current = owner ?? null;
      enabled.current = true;
      await selectPersonalSession(owner ?? null);
      setSignedIn(true);
    } catch {
      setError('Google sign-in could not complete. Please try again.');
    } finally {
      signingIn.current = false;
    }
  }, [GoogleSignin]);

  const signOut = useCallback(async () => {
    pendingSignOut.current = true;
    invalidateEntitlement();
    generation.current.value++;
    tokenRequest.current = null;
    enabled.current = false;
    cachedToken.current = null;
    setSignedIn(undefined);
    try {
      await selectPersonalSession(null);
    } catch (error) {
      setInitializationFailed(true);
      throw error;
    }
    setSignedIn(false);
    try {
      await SecureStore.setItemAsync(ENABLED_KEY, 'false');
      await SecureStore.deleteItemAsync(OWNER_KEY);
    } finally {
      await GoogleSignin.signOut();
      pendingSignOut.current = false;
    }
  }, [GoogleSignin]);

  const disconnect = useCallback(async () => {
    // Revokes this app's Google grant after deleting its cloud data; never deletes a Google account.
    try {
      await GoogleSignin.revokeAccess();
    } finally {
      await signOut();
    }
  }, [signOut, GoogleSignin]);

  const credentialGeneration = generation.current.value;
  const getAccessToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!signedIn || !enabled.current || generation.current.value !== credentialGeneration)
        return null;
      const current = generation.current.value;
      const matchesOwner = () => GoogleSignin.getCurrentUser()?.user.id === accountOwner.current;
      if (
        !forceRefresh &&
        matchesOwner() &&
        cachedToken.current &&
        Date.now() < cachedToken.current.until &&
        Date.now() >= cachedToken.current.until - 60_000
      )
        return cachedToken.current.value;
      if (forceRefresh) cachedToken.current = null;
      // Silent sign-in obtains the current Google ID token without opening a browser/account picker.
      // Share a concurrent refresh; an explicit sign-out invalidates its result.
      if (!tokenRequest.current) {
        const request = googleIdentity(GoogleSignin, false).then(async (token) => {
          if (
            token &&
            accountOwner.current &&
            GoogleSignin.getCurrentUser()?.user.id !== accountOwner.current
          ) {
            if (generation.current.value === current) {
              invalidateEntitlement();
              enabled.current = false;
              await selectPersonalSession(null);
              if (generation.current.value === current) setSignedIn(false);
            }
            return null;
          }
          if (!token && generation.current.value === current) {
            invalidateEntitlement();
            enabled.current = false;
            await selectPersonalSession(null);
            if (generation.current.value === current) setSignedIn(false);
          }
          if (token && enabled.current && generation.current.value === current)
            cachedToken.current = { value: token, until: Date.now() + 60_000 };
          return token;
        });
        tokenRequest.current = request;
        const release = () => {
          if (tokenRequest.current === request) tokenRequest.current = null;
        };
        void request.then(release, release);
      }
      const token = await tokenRequest.current;
      return enabled.current && generation.current.value === current ? token : null;
    },
    [signedIn, GoogleSignin, credentialGeneration],
  );

  const value: SessionState =
    signedIn === undefined
      ? { status: 'loading' }
      : signedIn
        ? {
            status: 'signedIn',
            displayName: googleDisplayName(GoogleSignin.getCurrentUser()?.user),
            getAccessToken,
            signOut,
            disconnect,
          }
        : { status: 'signedOut', googleSupported: true, signIn, error };
  if (initializationFailed)
    return (
      <ScopeRecovery
        retry={() => {
          setInitializationFailed(false);
          if (pendingSignOut.current) void signOut().catch(() => setInitializationFailed(true));
          else setAttempt((n) => n + 1);
        }}
      />
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
