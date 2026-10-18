import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  revokeAsync,
  useAuthRequest,
  type DiscoveryDocument,
} from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
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

WebBrowser.maybeCompleteAuthSession();

const STORE_KEY = 'driftless.tokens.v1';
/** Refresh a little before expiry to avoid racing the server clock. */
const EXPIRY_SKEW_MS = 60_000;

type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: number };

export function discoveryFor(env: Env): DiscoveryDocument {
  const d = env.cognitoDomain.replace(/\/+$/, '');
  return {
    authorizationEndpoint: `${d}/oauth2/authorize`,
    tokenEndpoint: `${d}/oauth2/token`,
    revocationEndpoint: `${d}/oauth2/revoke`,
  };
}

async function load(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    await SecureStore.deleteItemAsync(STORE_KEY);
    return null;
  }
}

async function save(t: Tokens | null): Promise<void> {
  if (t) {
    // Keychain/Keystore-backed; not synced, not readable before first unlock.
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(t), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(STORE_KEY);
  }
}

type SessionState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signedOut'; signIn: () => Promise<void>; error: string | null }
  | {
      status: 'signedIn';
      getAccessToken: () => Promise<string | null>;
      signOut: () => Promise<void>;
    };

const Ctx = createContext<SessionState>({ status: 'loading' });

export function useSession(): SessionState {
  return useContext(Ctx);
}

export function SessionProvider({ env, children }: { env: Env | null; children: ReactNode }) {
  if (!env) return <Ctx.Provider value={{ status: 'unconfigured' }}>{children}</Ctx.Provider>;
  return <ConfiguredSession env={env}>{children}</ConfiguredSession>;
}

function ConfiguredSession({ env, children }: { env: Env; children: ReactNode }) {
  const discovery = useMemo(() => discoveryFor(env), [env]);
  const redirectUri = useMemo(
    () => makeRedirectUri({ scheme: 'driftless', path: 'auth/callback' }),
    [],
  );
  const [tokens, setTokens] = useState<Tokens | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const refreshing = useRef<Promise<Tokens | null> | null>(null);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: env.cognitoClientId,
      redirectUri,
      scopes: ['openid', 'email'],
      responseType: ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    void load().then(setTokens);
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    exchangeCodeAsync(
      {
        clientId: env.cognitoClientId,
        code: response.params.code ?? '',
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then(async (r) => {
        const t: Tokens = {
          accessToken: r.accessToken,
          refreshToken: r.refreshToken ?? null,
          expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000,
        };
        await save(t);
        setTokens(t);
        setError(null);
      })
      .catch(() => setError('could not complete sign-in'));
  }, [response, request, env.cognitoClientId, redirectUri, discovery]);

  const signOut = useCallback(async () => {
    const t = tokens;
    await save(null);
    setTokens(null);
    if (t?.refreshToken) {
      await revokeAsync({ clientId: env.cognitoClientId, token: t.refreshToken }, discovery).catch(
        () => undefined,
      );
    }
  }, [tokens, env.cognitoClientId, discovery]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const t = tokens;
    if (!t) return null;
    if (t.expiresAt - EXPIRY_SKEW_MS > Date.now()) return t.accessToken;
    if (!t.refreshToken) return null;
    refreshing.current ??= refreshAsync(
      { clientId: env.cognitoClientId, refreshToken: t.refreshToken },
      discovery,
    )
      .then(async (r) => {
        const next: Tokens = {
          accessToken: r.accessToken,
          refreshToken: r.refreshToken ?? t.refreshToken,
          expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000,
        };
        await save(next);
        setTokens(next);
        return next;
      })
      .catch(async () => {
        // Refresh token revoked/expired: sign out locally. Local tracking is unaffected.
        await save(null);
        setTokens(null);
        return null;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return (await refreshing.current)?.accessToken ?? null;
  }, [tokens, env.cognitoClientId, discovery]);

  const value: SessionState =
    tokens === undefined
      ? { status: 'loading' }
      : tokens
        ? { status: 'signedIn', getAccessToken, signOut }
        : {
            status: 'signedOut',
            // Errors from the browser round-trip are derived from the response, not copied into state.
            error:
              error ??
              (response?.type === 'error' ? (response.error?.message ?? 'sign-in failed') : null),
            signIn: async () => {
              setError(null);
              await promptAsync();
            },
          };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
