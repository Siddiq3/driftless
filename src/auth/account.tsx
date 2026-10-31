import { Platform, AppState, Text } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { accountReady, markAccountReady } from '@/data/accountReady';
import { backupAccount } from '@/sync/accountBackup';
import { bootstrapFailure } from './bootstrapFailure';
import { installAccountUsage } from '@/sync/accountUsage';
import { useSession } from './session';
import {
  forgetVerifiedAccount,
  readVerifiedAccount,
  rememberVerifiedAccount,
} from './verifiedAccount';
import { ApiError, AccountState, createApiClient } from '@/api/client';
import { APP_VERSION, readEnv } from '@/config/env';
import { resolvePersonalAccount, selectPersonalSession } from '@/data/session';
import { invalidateEntitlement } from '@/billing/cache';
import { StartupScreen } from '@/ui/StartupScreen';
import { dark } from '@/design-tokens';
import { measureStartup } from '@/startup/timing';
import { Button, Notice, Screen } from '@/ui/kit';

const Context = createContext<string | null>(null);
export const useAccountIncarnation = () => useContext(Context);

/**
 * Phone data is safe and backup keeps retrying once the app is open, so an unfinished restore never
 * blocks it. Account errors still stop here, because they need the person to act.
 */
export async function firstRestoreSettled(restore: Promise<void>, waitMs = 10_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, waitMs);
  });
  try {
    await Promise.race([
      restore.catch((error: unknown) => {
        if (error instanceof ApiError) throw error;
      }),
      waited,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Google authentication grants no dataset access. Resolve the lifecycle and select its exact
 * local incarnation before mounting screens or starting background backup. */
export function AccountBoundary({ children }: { children: ReactNode }) {
  const session = useSession();
  const token = session.status === 'signedIn' ? session.getAccessToken : null;
  const apiUrl = readEnv()?.apiUrl;
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [revision, setRevision] = useState(0);
  const api = useMemo(
    () =>
      token && apiUrl
        ? createApiClient({
            baseUrl: apiUrl!,
            getAccessToken: token,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
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
    unconfirmed?: boolean;
  } | null>(null);
  const [stage, setStage] = useState('account');
  const savedAccountRejected = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [busy, setBusy] = useState(false);
  const registrationId = useRef(randomUUID());
  const approvedDeletedIncarnation = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    approvedDeletedIncarnation.current = undefined;
  }, [token]);
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
      if (alive) setStage(value);
    };
    const load = async () => {
      progress('account');
      // Open saved data at once for an account the server already confirmed on this phone.
      // The check below confirms it again in the background and resets this on any change.
      const verified = savedAccountRejected.current ? null : await readVerifiedAccount();
      if (verified) {
        try {
          const saved = await measureStartup('account-saved', () =>
            resolvePersonalAccount(verified.userId, verified.incarnation, allowed, true),
          );
          if (await accountReady(saved, allowed)) {
            if (alive)
              setResult({
                api,
                state: { state: 'active', incarnation: verified.incarnation },
                usageReady: true,
                unconfirmed: true,
              });
            return;
          }
        } catch {
          await forgetVerifiedAccount();
        }
        if (!alive) return;
      }
      const readStartedAt = Date.now();
      // /me accepts an unbound request, but the response is never trusted until lifecycle
      // discovery confirms the same active incarnation. Settle speculation to avoid an
      // unhandled rejection for deleted/new accounts, which still use registration below.
      const profileRequest = measureStartup('account-profile', () => api.getMe(allowed)).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const discovery = await measureStartup('account-lifecycle', () => api.accountState());
      let state = discovery;
      if (!alive) return;
      if (state.state === 'deleted' && approvedDeletedIncarnation.current !== state.incarnation) {
        await selectPersonalSession('unresolved');
        if (alive) setResult({ api, state, usageReady: false });
        return;
      }
      if (state.state === 'deleted' || state.state === 'legacy_quarantined') {
        progress('registration');
        try {
          state = await measureStartup('account-registration', () =>
            api.registerAccount(registrationId.current, state.incarnation),
          );
        } catch (e) {
          // Another device may have finished registration. Discover its account; never reset it.
          if (!(e instanceof ApiError) || e.code !== 'registration_conflict') throw e;
          state = await api.accountState();
          if (state.state !== 'active' && state.state !== 'deleting') throw e;
        }
        if (!alive) return;
      }
      if (state.state === 'active') approvedDeletedIncarnation.current = undefined;
      let usageReady = false;
      if (state.state === 'active' && state.incarnation) {
        const bound = createApiClient({
          baseUrl: apiUrl!,
          getAccessToken: token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          appVersion: APP_VERSION,
          incarnation: state.incarnation,
        });
        progress('profile');
        const profileForAccount =
          discovery.state === 'active'
            ? profileRequest.then((profile) => {
                if (!alive) throw new Error('Account initialization cancelled');
                if (!profile.ok) throw profile.error;
                return profile.value.data.incarnation === state.incarnation
                  ? profile.value
                  : measureStartup('account-profile-bound', () => bound.getMe(allowed));
              })
            : measureStartup('account-profile-bound', () => bound.getMe(allowed));
        const [profileResult, existingUsage] = await Promise.all([
          profileForAccount,
          measureStartup('account-allowance', () => bound.getAccountUsage(allowed)),
        ]);
        const me = profileResult.data;
        if (!alive) return;
        if (me.incarnation !== state.incarnation)
          throw new Error('Account incarnation response mismatch');
        progress('timezone');
        // Keep saved account timezones; use the device timezone only for initial setup.
        const usage = existingUsage.policy
          ? existingUsage
          : await bound.configureAccountUsage(
              { tz: timezone, limits: {}, expectedRev: 0 },
              allowed,
            );
        if (!alive) return;
        if (!usage.policy) throw new Error('Account timezone setup did not finish');
        progress('storage');
        const db = await measureStartup('account-storage', () =>
          resolvePersonalAccount(me.userId, me.incarnation, allowed, true),
        );
        if (!alive) return;
        progress('usage');
        if (usage.policy) {
          await measureStartup('account-install-allowance', () =>
            installAccountUsage(usage, me.incarnation, allowed),
          );
          // Seed the bound client only after ownership and native allowance installation.
          // A first restore consumes it; returning users hand it to the first background backup.
          bound.primeStartupReads(profileResult, usage, readStartedAt);
          if (!(await accountReady(db, allowed))) {
            progress('restore');
            await firstRestoreSettled(
              measureStartup('account-first-restore', () =>
                backupAccount(bound, allowed, undefined, me),
              ).then(async (backup) => {
                if (backup.state === 'saved') await markAccountReady(db, allowed);
              }),
            );
          }
          usageReady = true;
          if (await accountReady(db, allowed))
            await rememberVerifiedAccount(me.userId, state.incarnation);
        }
      } else {
        // Remove a previously visible account dataset before rendering deletion recovery.
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
  }, [api, token, apiUrl, timezone]);
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
            savedAccountRejected.current = true;
            void forgetVerifiedAccount().finally(() => {
              if (!alive) return;
              setResult(null);
              setRevision((r) => r + 1);
            });
          }
        })
        .catch(() => undefined);
    };
    if (result?.unconfirmed) check();
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
    if (!api || current?.state !== 'deleting' || !current.incarnation || busy || !apiUrl) return;
    setBusy(true);
    setError(null);
    try {
      await createApiClient({
        baseUrl: apiUrl!,
        getAccessToken: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: APP_VERSION,
        incarnation: current.incarnation,
      }).deleteAccount();
      if (apiRef.current !== api) return;
      invalidateEntitlement();
      setResult(null);
      setRevision((r) => r + 1);
    } catch (e) {
      if (apiRef.current === api) {
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
  if (!current && !error)
    return (
      <StartupScreen
        message={
          stage === 'restore'
            ? 'Restoring your account progress…'
            : stage === 'storage'
              ? 'Opening saved progress…'
              : stage === 'usage' || stage === 'timezone'
                ? 'Preparing your app limits…'
                : 'Checking your account…'
        }
        onSignOut={
          session.status === 'signedIn'
            ? () => {
                void session
                  .signOut()
                  .catch(() => setError('Sign-out could not finish. Please retry.'));
              }
            : undefined
        }
      />
    );
  return (
    <Screen>
      {current?.state === 'deleted' && (
        <>
          <Notice
            title="Account deleted"
            body="Create a new account to continue. Your previous account history will stay separate."
          />
          <Button
            label="Create a new account"
            onPress={() => {
              registrationId.current = randomUUID();
              approvedDeletedIncarnation.current = current.incarnation;
              setError(null);
              setResult(null);
              setRevision((r) => r + 1);
            }}
          />
        </>
      )}
      {current?.state === 'deleting' && (
        <Notice
          title="Finish account deletion"
          body="Deletion was interrupted. Resume it before creating another account."
        />
      )}
      {error && (
        <Text style={{ color: dark.text }} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {current?.state === 'deleting' && (
        <Button label="Resume deletion" onPress={() => void act()} busy={busy} />
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
