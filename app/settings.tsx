import { useAccountIncarnation } from '@/auth/account';
import type { v1 } from '@siddiq3/driftless-contracts';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { capabilityReport } from '@/capabilities/model';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform } from 'react-native';
import { ApiError, createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { APP_VERSION, readEnv } from '@/config/env';
import { cacheEntitlement } from '@/billing/pro';
import { entitlementGeneration } from '@/billing/cache';
import { useAccountBackup } from '@/sync/AccountBackupProvider';
import { Details, Button, Section, Notice, Screen, T, Toggle } from '@/ui/kit';

const CAPABILITY_LABELS: Record<keyof v1.Capabilities, string> = {
  videoCounting: 'Reels & Shorts counting',
  minutesTracking: 'Time in apps',
  blocking: 'App blocking',
  schedules: 'Schedules',
  advancedAnalytics: 'Advanced analytics',
  socialSharingOfUsage: 'Share progress with friends',
};

type Load =
  | { state: 'loading' }
  | { state: 'ok'; me: v1.MeResponse }
  | { state: 'error'; offline: boolean; message: string };

export default function Settings() {
  const s = useSession();
  const backup = useAccountBackup();
  const env = readEnv();
  const incarnation = useAccountIncarnation();
  const [sharingBusy, setSharingBusy] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const api = useMemo(
    () =>
      s.status === 'signedIn' && env
        ? createApiClient({
            baseUrl: env.apiUrl,
            getAccessToken: s.getAccessToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            incarnation: incarnation ?? undefined,
            appVersion: APP_VERSION,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.status, env?.apiUrl, incarnation],
  );
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const requestGeneration = useRef(0);

  // State is only set from the request's callbacks, never synchronously inside the effect.
  const fetchMe = useCallback(() => {
    if (!api) return;
    const generation = ++requestGeneration.current;
    const accountGeneration = entitlementGeneration();
    api
      .getMe()
      .then(({ data }) => {
        if (
          generation !== requestGeneration.current ||
          accountGeneration !== entitlementGeneration()
        )
          return;
        try {
          cacheEntitlement(data.entitlement, Date.now(), accountGeneration);
        } catch {
          // A missing native entitlement bridge does not make the backend unavailable.
          // Runtime support and native health below still determine feature availability.
        }
        try {
          setHealth(Tracking.health());
        } catch {
          setHealth(null);
        }
        setLoad({ state: 'ok', me: data });
      })
      .catch((e: unknown) => {
        if (
          generation !== requestGeneration.current ||
          accountGeneration !== entitlementGeneration()
        )
          return;
        setLoad({
          state: 'error',
          offline: e instanceof ApiError && e.offline,
          message: e instanceof Error ? e.message : 'unknown error',
        });
      });
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      const update = () => {
        try {
          setHealth(Tracking.health());
        } catch {
          setHealth(null);
        }
        setLoad({ state: 'loading' });
        fetchMe();
      };
      update();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') update();
        else {
          requestGeneration.current++;
          setHealth(null);
          setLoad({ state: 'loading' });
        }
      });
      const timer = setInterval(() => {
        try {
          setHealth(Tracking.health());
        } catch {
          setHealth(null);
        }
      }, 5000);
      return () => {
        requestGeneration.current++;
        subscription.remove();
        clearInterval(timer);
      };
    }, [fetchMe]),
  );
  const report = capabilityReport({
    platform: Platform.OS,
    health,
    support: Tracking.runtimeSupport(),
    backend: load.state === 'ok' ? load.me : null,
  });

  const retry = () => {
    setLoad({ state: 'loading' });
    fetchMe();
  };

  if (s.status !== 'signedIn') return <Redirect href="/welcome" />;

  return (
    <Screen>
      {load.state === 'loading' && <ActivityIndicator accessibilityLabel="Loading your profile" />}
      {load.state === 'error' && (
        <>
          <Notice
            tone="warn"
            title={load.offline ? "You're offline" : 'Could not load your profile'}
            body={
              load.offline
                ? 'Cloud features are unavailable. Local tracking depends on the permissions shown below.'
                : load.message
            }
          />
          <Button kind="secondary" label="Try again" onPress={retry} />
        </>
      )}
      {load.state === 'ok' && (
        <>
          <Section>
            <T v="heading">{s.displayName || load.me.profile.displayName || 'Welcome'}</T>
            <T muted>All features included · No subscription needed</T>
          </Section>
          <Details title="Progress sharing" icon="shield">
            <T muted>Share daily totals with all friends</T>
            <Toggle
              accessibilityLabel="Share my progress with friends"
              value={load.me.profile.consent.shareWithFriends}
              disabled={sharingBusy}
              onValueChange={(value) => {
                if (!api || sharingBusy) return;
                const generation = requestGeneration.current;
                setSharingBusy(true);
                setSharingError(null);
                void api
                  .patchMe(
                    {
                      consent: value
                        ? { cloudSync: true, shareWithFriends: true }
                        : { shareWithFriends: false },
                    },
                    load.me.profile.rev,
                  )
                  .then(({ data }) => {
                    if (generation === requestGeneration.current)
                      setLoad({ state: 'ok', me: data });
                  })
                  .catch(() => {
                    if (generation === requestGeneration.current)
                      setSharingError('Sharing settings could not be saved. Please retry.');
                  })
                  .finally(() => setSharingBusy(false));
              }}
            />
            <T v="caption" muted>
              General friend sharing is separate from War invitations. To stop sharing in a battle,
              remove that friend from Friends.
            </T>
            {sharingError && <Notice title="Sharing not updated" body={sharingError} tone="warn" />}
          </Details>
          <Section>
            <T v="heading">Account</T>
            <T v="caption" muted>
              {backup.status.message}
            </T>
            {backup.status.state === 'pending' && (
              <Button kind="secondary" label="Retry backup" onPress={() => void backup.retry()} />
            )}
          </Section>
        </>
      )}
      <Details title="Device support" icon="help">
        <T v="heading">Current availability</T>
        {(Object.keys(CAPABILITY_LABELS) as (keyof v1.Capabilities)[]).map((k) => (
          <T key={k} muted>
            {report[k].available ? '✓' : '—'} {CAPABILITY_LABELS[k]} · {report[k].detail}
          </T>
        ))}
      </Details>
      <Button kind="secondary" label="Privacy & data" onPress={() => router.push('/privacy')} />
      <Button
        kind="secondary"
        label="Focus & app pauses"
        onPress={() => router.push('/blocking')}
      />
      <Button kind="secondary" label="Sign out" onPress={() => void s.signOut()} />
    </Screen>
  );
}
