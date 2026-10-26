import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, AppState, Text, TextInput } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { backupAccount } from '@/sync/accountBackup';
import { bootstrapFailure } from './bootstrapFailure';
import { installAccountUsage } from '@/sync/accountUsage';
import { useSession } from './session';
import { ApiError, AccountState, createApiClient } from '@/api/client';
import { APP_VERSION, readEnv } from '@/config/env';
import { resolvePersonalAccount, selectPersonalSession } from '@/data/session';
import { invalidateEntitlement } from '@/billing/cache';
import { dark } from '@/design-tokens';
import { Button, Notice, Screen } from '@/ui/kit';

const Context = createContext<string | null>(null);
export const useAccountIncarnation = () => useContext(Context);

/** Google authentication grants no dataset access. Resolve the lifecycle and select its exact
 * local incarnation before mounting screens or starting background backup. */
export function AccountBoundary({ children }: { children: ReactNode }) {
  const session = useSession();
  const token = session.status === 'signedIn' ? session.getAccessToken : null;
  const apiUrl = readEnv()?.apiUrl;
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [revision, setRevision] = useState(0);
  const api = useMemo(
    () =>
      token && apiUrl
        ? createApiClient({
            baseUrl: apiUrl!,
            getAccessToken: token,
            platform: 'android',
            appVersion: APP_VERSION,
          })
        : null,
    // A refresh creates a new client after invalidating previously captured generations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, apiUrl, revision],
  );
  const [result, setResult] = useState<{
    api: typeof api;
    state: z.infer<typeof AccountState>;
    usageReady: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [busy, setBusy] = useState(false);
  const registrationId = useRef(randomUUID());
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
    return () => {
      apiRef.current = null;
    };
  }, [api]);
  const current = result?.api === api ? result.state : null;
  useEffect(() => {
    if (!api || !token || !apiUrl) return;
    let alive = true;
    const allowed = () => alive;
    let failedStage = 'account';
    const progress = (value: string) => {
      failedStage = value;
    };
    const load = async () => {
      progress('account');
      const state = await api.accountState();
      if (!alive) return;
      let usageReady = false;
      if (state.state === 'active' && state.incarnation) {
        const bound = createApiClient({
          baseUrl: apiUrl!,
          getAccessToken: token,
          platform: 'android',
          appVersion: APP_VERSION,
          incarnation: state.incarnation,
        });
        progress('profile');
        const { data: me } = await bound.getMe(allowed);
        if (me.incarnation !== state.incarnation)
          throw new Error('Account incarnation response mismatch');
        progress('storage');
        await resolvePersonalAccount(me.userId, me.incarnation, allowed, true);
        if (!alive) return;
        progress('usage');
        const usage = await bound.getAccountUsage(allowed);
        if (usage.policy) {
          await installAccountUsage(usage, state.incarnation, allowed);
          progress('restore');
          const backup = await backupAccount(bound, allowed, undefined, me);
          if (backup.state !== 'saved') throw new Error(backup.message);
          usageReady = true;
        }
      } else {
        // Remove a previously visible account dataset before rendering recovery/registration.
        await selectPersonalSession('unresolved');
      }
      if (alive) setResult({ api, state, usageReady });
    };
    void load().catch((e: unknown) => {
      if (alive) {
        const failure = bootstrapFailure(e);
        setRetryable(failure.retryable);
        setError(failure.message);
        // Codes/stages only: never log identity, credentials, URLs or private payloads.
        console.warn('account_bootstrap_failed', { stage: failedStage, code: failure.code });
      }
    });
    return () => {
      alive = false;
    };
  }, [api, token, apiUrl]);
  useEffect(() => {
    if (!api || current?.state !== 'active') return;
    let alive = true;
    const check = () => {
      if (AppState.currentState !== 'active') return;
      void api
        .accountState()
        .then((state) => {
          if (!alive) return;
          if (state.state !== 'active' || state.incarnation !== current.incarnation) {
            invalidateEntitlement();
            setResult(null);
            setRevision((r) => r + 1);
          }
        })
        .catch(() => undefined);
    };
    const subscription = AppState.addEventListener('change', check);
    const timer = setInterval(check, 60_000);
    return () => {
      alive = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, [api, current]);
  if (!token) return <Context.Provider value={null}>{children}</Context.Provider>;
  if (current?.state === 'active' && current.incarnation && result?.usageReady)
    return <Context.Provider value={current.incarnation}>{children}</Context.Provider>;
  const act = async () => {
    if (!api || !current || busy || !apiUrl) return;
    setBusy(true);
    setError(null);
    try {
      if (current.state === 'deleting' && current.incarnation) {
        await createApiClient({
          baseUrl: apiUrl!,
          getAccessToken: token,
          platform: 'android',
          appVersion: APP_VERSION,
          incarnation: current.incarnation,
        }).deleteAccount();
      } else {
        const state =
          current.state === 'active'
            ? current
            : await api.registerAccount(registrationId.current, current.incarnation);
        if (apiRef.current !== api) return;
        if (!state.incarnation) throw new Error('Registration did not establish an incarnation');
        const bound = createApiClient({
          baseUrl: apiUrl!,
          getAccessToken: token,
          platform: 'android',
          appVersion: APP_VERSION,
          incarnation: state.incarnation,
        });
        const existing = await bound.getAccountUsage();
        if (apiRef.current !== api) return;
        if (!existing.policy)
          await bound.configureAccountUsage({ tz: timezone, limits: {}, expectedRev: 0 });
      }
      if (apiRef.current !== api) return;
      invalidateEntitlement();
      setResult(null);
      setRevision((r) => r + 1);
    } catch (e) {
      if (apiRef.current === api) {
        if (e instanceof ApiError && e.code === 'registration_conflict') {
          setResult(null);
          setRevision((r) => r + 1);
        } else
          setError(
            e instanceof ApiError
              ? bootstrapFailure(e).message
              : e instanceof Error
                ? e.message
                : 'Please retry',
          );
      }
    } finally {
      if (apiRef.current === api) setBusy(false);
    }
  };
  return (
    <Screen>
      {!current && !error && (
        <>
          <ActivityIndicator color={dark.accent} accessibilityLabel="Restoring account" />
          <Text style={{ color: dark.text }}>
            Restoring your account… Your saved phone data is retained.
          </Text>
        </>
      )}
      {current && (
        <Notice
          title={
            current.state === 'deleting'
              ? 'Finish account deletion'
              : current.state === 'active'
                ? 'Choose your fixed account timezone'
                : 'Create account'
          }
          body={
            current.state === 'deleting'
              ? 'Deletion was interrupted. Resume it before creating another account.'
              : current.state === 'active'
                ? 'Your account day uses this fixed timezone. Account-wide limits begin at its next midnight; existing local rules apply until then.'
                : 'Create an account to back up this guest session’s history and goals. Deleted accounts and older saved account datasets stay separate.'
          }
        />
      )}
      {current && current.state !== 'deleting' && (
        <TextInput
          accessibilityLabel="Fixed account timezone"
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
        />
      )}
      {error && (
        <Text style={{ color: dark.text }} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {current && (
        <Button
          label={
            current.state === 'deleting'
              ? 'Resume deletion'
              : current.state === 'active'
                ? 'Confirm fixed timezone'
                : 'Create account'
          }
          onPress={() => void act()}
          busy={busy}
        />
      )}
      {!current && error && retryable && (
        <Button
          label="Retry"
          onPress={() => {
            setError(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
      {session.status === 'signedIn' && (
        <Button label="Sign out" onPress={() => void session.signOut()} busy={busy} />
      )}
    </Screen>
  );
}
