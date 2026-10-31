import { useAccountIncarnation } from '@/auth/account';
import type { v1 } from '@siddiq3/driftless-contracts';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { capabilityReport } from '@/capabilities/model';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, View } from 'react-native';
import { ApiError, createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { APP_VERSION, readEnv } from '@/config/env';
import { cacheEntitlement, entitlementGeneration } from '@/billing/cache';
import { Details, Notice, Screen } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import {
  SettingsCanvas,
  SettingsText,
  SettingsSection,
  SettingsRow,
  SettingsDivider,
} from '@/settings/SettingsControls';
import { settingsTheme as t, settingsStyles as styles } from '@/settings/theme';

const CAPABILITY_LABELS: Record<keyof v1.Capabilities, string> = {
  videoCounting: 'Reels & Shorts counting',
  minutesTracking: 'Time in apps',
  blocking: 'App blocking',
  schedules: 'Schedules',
  advancedAnalytics: 'Advanced analytics',
  socialSharingOfUsage: 'Friends leaderboard',
};

type Load =
  | { state: 'loading' }
  | { state: 'ok'; me: v1.MeResponse }
  | { state: 'error'; offline: boolean; message: string };

export default function Settings() {
  const s = useSession();
  const env = readEnv();
  const incarnation = useAccountIncarnation();
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

  const name =
    s.displayName || (load.state === 'ok' ? load.me.profile.displayName : null) || 'Welcome';
  return (
    <SettingsCanvas>
      <Screen
        hideHeader
        hideTabs
        backgroundColor={t.color.transparent}
        contentStyle={styles.screen}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
            style={({ pressed }) => [styles.back, { opacity: pressed ? t.opacity.pressed : 1 }]}
          >
            <Icon name="back" size={t.size.icon} color={t.color.text} />
          </Pressable>
          <SettingsText variant="title" accessibilityRole="header">
            Settings
          </SettingsText>
        </View>
        <View style={styles.profile}>
          <View style={styles.avatar} accessible={false}>
            <SettingsText variant="state">{name.slice(0, 1).toLocaleUpperCase()}</SettingsText>
          </View>
          <View style={styles.copy}>
            <SettingsText variant="state">{name}</SettingsText>
            <SettingsText muted>All features included · No subscription needed</SettingsText>
          </View>
        </View>
        {load.state === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={t.color.accent} accessibilityLabel="Loading your profile" />
            <SettingsText muted>Checking your account…</SettingsText>
          </View>
        )}
        {load.state === 'error' && (
          <View style={styles.section}>
            <Notice
              tone="warn"
              title={load.offline ? "You're offline" : 'Could not load your profile'}
              body={
                load.offline
                  ? 'Cloud features are unavailable. Local tracking depends on the permissions shown below.'
                  : load.message
              }
            />
            <SettingsRow title="Try again" icon="cloud" onPress={retry} />
          </View>
        )}
        <SettingsSection title="Your app">
          <SettingsRow
            title="Focus & app pauses"
            subtitle="Apps, daily limits and focus times"
            icon="shield"
            onPress={() => router.push('/blocking')}
          />
          <SettingsDivider />
          <SettingsRow
            title="Your data & account"
            subtitle="Export, reset or delete your account and data"
            icon="lock"
            onPress={() => router.push('/privacy')}
          />
        </SettingsSection>
        <SettingsSection title="On this device">
          <Details title="Device support" icon="help">
            {(Object.keys(CAPABILITY_LABELS) as (keyof v1.Capabilities)[]).map((key) => (
              <View key={key} style={styles.section}>
                <View style={styles.header}>
                  <Icon
                    name={report[key].available ? 'check' : 'minus'}
                    size={t.size.smallIcon}
                    color={t.color.muted}
                  />
                  <SettingsText variant="row">{CAPABILITY_LABELS[key]}</SettingsText>
                </View>
                <SettingsText muted>{report[key].detail}</SettingsText>
              </View>
            ))}
          </Details>
        </SettingsSection>
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => void s.signOut()}
            style={({ pressed }) => [styles.signOut, { opacity: pressed ? t.opacity.pressed : 1 }]}
          >
            <SettingsText variant="label" style={{ color: t.color.danger }}>
              Sign out
            </SettingsText>
          </Pressable>
          <SettingsText muted style={styles.version}>
            ScrollSnooze · {APP_VERSION}
          </SettingsText>
        </View>
      </Screen>
    </SettingsCanvas>
  );
}
