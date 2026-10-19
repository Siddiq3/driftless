import type { v1 } from '@siddiq3/driftless-contracts';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ApiError, createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { APP_VERSION, readEnv } from '@/config/env';
import { cacheEntitlement } from '@/billing/pro';
import { syncGoals } from '@/goals/sync';
import { registerPush } from '@/sync/push';
import { syncNow } from '@/sync/run';
import { Details, Toggle, Button, Section, Notice, Screen, T } from '@/ui/kit';

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

export default function Settings() {
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

  // State is only set from the request's callbacks, never synchronously inside the effect.
  const fetchMe = useCallback(() => {
    if (!api) return;
    api
      .getMe()
      .then(({ data }) => {
        cacheEntitlement(data.entitlement);
        setLoad({ state: 'ok', me: data });
      })
      .catch((e: unknown) =>
        setLoad({
          state: 'error',
          offline: e instanceof ApiError && e.offline,
          message: e instanceof Error ? e.message : 'unknown error',
        }),
      );
  }, [api]);

  useEffect(fetchMe, [fetchMe]);

  const [syncNote, setSyncNote] = useState<string | null>(null);
  const cloudSync = load.state === 'ok' && load.me.profile.consent.cloudSync;

  // Sync runs only after the user turned cloud sync on. Results are reported, never blocking.
  useEffect(() => {
    if (!api || !cloudSync) return;
    syncGoals(api).catch(() => undefined); // best effort; goals work locally regardless
    registerPush(api).catch(() => undefined); // needs Firebase config; harmless without it
    syncNow(api)
      .then((o) =>
        setSyncNote(
          o.kind === 'sent'
            ? 'Synced'
            : o.kind === 'idle'
              ? 'Up to date'
              : o.kind === 'deferred'
                ? o.stuck
                  ? 'Sync keeps failing — your data is safe on this phone'
                  : 'Will retry sync shortly'
                : `Sync refused (${o.code})`,
        ),
      )
      .catch((e: unknown) => setSyncNote(e instanceof Error ? e.message : 'Sync failed'));
  }, [api, cloudSync]);

  const setCloudSync = (on: boolean) => {
    if (!api || load.state !== 'ok') return;
    const consent = on ? { cloudSync: true } : { cloudSync: false, shareWithFriends: false };
    api
      .patchMe({ consent }, load.me.profile.rev)
      .then(({ data }) => setLoad({ state: 'ok', me: data }))
      .catch((e: unknown) => setSyncNote(e instanceof Error ? e.message : 'Could not change sync'));
  };

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
              load.offline ? 'Anything tracked on this phone keeps working offline.' : load.message
            }
          />
          <Button kind="secondary" label="Try again" onPress={retry} />
        </>
      )}
      {load.state === 'ok' && (
        <>
          <Section>
            <T v="heading">{load.me.profile.displayName ?? 'Welcome'}</T>
            <T muted>Plan: {load.me.entitlement.tier === 'pro' ? 'Pro' : 'Free'}</T>
          </Section>
          <Section>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <T v="heading">Cloud backup</T>
                <T v="caption" muted>
                  Back up daily totals only
                </T>
              </View>
              <Toggle
                accessibilityLabel="Cloud backup"
                value={load.me.profile.consent.cloudSync}
                onValueChange={setCloudSync}
              />
            </View>
            {syncNote && (
              <T v="caption" muted>
                {syncNote}
              </T>
            )}
          </Section>
          <Details title="Device support" icon="help">
            <T v="heading">What works on this phone</T>
            {(Object.keys(CAPABILITY_LABELS) as (keyof v1.Capabilities)[]).map((k) => (
              <T key={k} muted>
                {load.me.capabilities[k] ? '✓' : '—'} {CAPABILITY_LABELS[k]}
                {load.me.capabilities[k] ? '' : ' · not available yet'}
              </T>
            ))}
          </Details>
        </>
      )}
      <Button kind="secondary" label="Privacy & data" onPress={() => router.push('/privacy')} />
      <Button kind="secondary" label="Driftless Pro" onPress={() => router.push('/pro')} />
      <Button kind="secondary" label="Sign out" onPress={() => void s.signOut()} />
    </Screen>
  );
}
