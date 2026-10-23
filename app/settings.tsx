import type { v1 } from '@siddiq3/driftless-contracts';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { capabilityReport } from '@/capabilities/model';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useApi } from '@/api/useApi';
import { apiSessionKey } from '@/api/sessionClient';
import { useSession } from '@/auth/session';
import { cacheEntitlement } from '@/billing/pro';
import { entitlementGeneration } from '@/billing/cache';
import { cancelGoalSync, syncGoals } from '@/goals/sync';
import { registerPush } from '@/sync/push';
import { syncNow } from '@/sync/run';
import { Details, Toggle, Button, Section, Notice, Screen, T } from '@/ui/kit';

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
  const api = useApi();
  return <SettingsForSession key={api ? apiSessionKey(api) : 'guest'} />;
}

function SettingsForSession() {
  const s = useSession();
  const api = useApi();
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

  const [refresh, setRefresh] = useState(0);
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
        setRefresh((n) => n + 1);
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
      const backendTimer = setInterval(() => {
        if (AppState.currentState === 'active') {
          setLoad({ state: 'loading' });
          fetchMe();
        }
      }, 30000);
      return () => {
        requestGeneration.current++;
        subscription.remove();
        clearInterval(backendTimer);
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

  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [goalSyncNote, setGoalSyncNote] = useState<string | null>(null);
  const userId = load.state === 'ok' ? load.me.userId : null;
  const cloudSync = load.state === 'ok' && load.me.profile.consent.cloudSync;

  // Sync runs only after the user turned cloud sync on. Results are reported, never blocking.
  useEffect(() => {
    if (!api || !cloudSync) return;
    if (!userId) return;
    let current = true;
    syncGoals(api, userId).then(
      () => {
        if (current) setGoalSyncNote('Goals backed up');
      },
      (e: unknown) => {
        if (current)
          setGoalSyncNote(
            `Goal backup failed: ${e instanceof Error ? e.message : 'Try again'}. Local goals remain saved.`,
          );
      },
    );
    registerPush(api).catch(() => undefined); // needs Firebase config; harmless without it
    syncNow(api)
      .then(
        (o) =>
          current &&
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
      .catch((e: unknown) => {
        if (current) setSyncNote(e instanceof Error ? e.message : 'Sync failed');
      });
    return () => {
      current = false;
      cancelGoalSync(api);
    };
  }, [api, cloudSync, userId, refresh]);

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
            <T v="heading">{load.me.profile.displayName ?? 'Welcome'}</T>
            <T muted>All features included · No subscription needed</T>
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
                  Back up goals and daily totals
                </T>
              </View>
              <Toggle
                accessibilityLabel="Cloud backup"
                value={load.me.profile.consent.cloudSync}
                onValueChange={setCloudSync}
              />
            </View>
            {goalSyncNote && (
              <T v="caption" muted>
                {goalSyncNote}
              </T>
            )}
            <Button
              kind="secondary"
              label="Retry backup"
              onPress={() => setRefresh((n) => n + 1)}
            />
            {syncNote && (
              <T v="caption" muted>
                {syncNote}
              </T>
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
