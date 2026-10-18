import type { v1 } from '@driftless/contracts';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ApiError, createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { APP_VERSION, readEnv } from '@/config/env';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';

const CAPABILITY_LABELS: Record<keyof v1.Capabilities, string> = {
  videoCounting: 'Reels & Shorts counting',
  minutesTracking: 'Time in apps',
  blocking: 'App blocking (Pro)',
  schedules: 'Schedules (Pro)',
  advancedAnalytics: 'Advanced analytics (Pro)',
  socialSharingOfUsage: 'Share progress with friends',
};

type Load =
  | { state: 'loading' }
  | { state: 'ok'; me: v1.MeResponse }
  | { state: 'error'; offline: boolean; message: string };

export default function Home() {
  const s = useSession();
  const env = readEnv();
  const api = useMemo(
    () =>
      s.status === 'signedIn' && env
        ? createApiClient({
            baseUrl: env.apiUrl,
            getAccessToken: s.getAccessToken,
            platform: 'android',
            appVersion: APP_VERSION,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.status, env?.apiUrl],
  );
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const refresh = useCallback(() => {
    if (!api) return;
    setLoad({ state: 'loading' });
    api
      .getMe()
      .then(({ data }) => setLoad({ state: 'ok', me: data }))
      .catch((e: unknown) =>
        setLoad({
          state: 'error',
          offline: e instanceof ApiError && e.offline,
          message: e instanceof Error ? e.message : 'unknown error',
        }),
      );
  }, [api]);

  useEffect(refresh, [refresh]);

  if (s.status !== 'signedIn') return <Redirect href="/welcome" />;

  return (
    <Screen>
      <T v="title">Today</T>
      {load.state === 'loading' && <ActivityIndicator accessibilityLabel="Loading your profile" />}
      {load.state === 'error' && (
        <>
          <Notice
            tone="warn"
            title={load.offline ? "You're offline" : 'Could not load your profile'}
            body={
              load.offline ? 'Anything tracked on this phone keeps working offline.' : load.message
            }
          />
          <Button kind="secondary" label="Try again" onPress={refresh} />
        </>
      )}
      {load.state === 'ok' && (
        <>
          <Card>
            <T v="heading">{load.me.profile.displayName ?? 'Welcome'}</T>
            <T muted>Plan: {load.me.entitlement.tier === 'pro' ? 'Pro' : 'Free'}</T>
          </Card>
          <Card>
            <T v="heading">What works on this phone</T>
            {(Object.keys(CAPABILITY_LABELS) as (keyof v1.Capabilities)[]).map((k) => (
              <T key={k} muted>
                {load.me.capabilities[k] ? '✓' : '—'} {CAPABILITY_LABELS[k]}
                {load.me.capabilities[k] ? '' : ' · not available yet'}
              </T>
            ))}
          </Card>
        </>
      )}
      <Button kind="secondary" label="Sign out" onPress={() => void s.signOut()} />
    </Screen>
  );
}
