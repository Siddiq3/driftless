import { Platform, Alert, AppState, View } from 'react-native';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Tracking, type Daily, type TrackingHealth, type MemePreferences } from 'tracking-android';
import { STATE_COPY, trackingState } from '@/tracking/state';
import { Button, Section, Notice, Screen, T, EmptyState, Details, Toggle } from '@/ui/kit';
import { AppIcon, Icon } from '@/ui/Icon';
import { personalRawDay, refreshPersonalData } from '@/data/personal';
import { localDateOf } from '@siddiq3/driftless-contracts/domain';
import { currentAccountTime, currentTimeZone } from '@/sync/run';
import { homeAppCount } from '@/tracking/candidateCount';
import { CountingPermissionBanner } from '@/permissions/CountingPermissionBanner';

const minutes = (ms: number) => Math.round(ms / 60_000);

function AndroidTrackingScreen() {
  const [now, setNow] = useState(() => Date.now());
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [badgePrefs, setBadgePrefs] = useState({ size: 54, pausedUntil: 0 });
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [memes, setMemes] = useState<MemePreferences>({ enabled: true });
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(() => {
    try {
      setNow(Date.now());
      refreshPersonalData(1);
      const h = Tracking.health();
      const d = personalRawDay(localDateOf(currentAccountTime(), currentTimeZone()));
      setHealth(h);
      setBadgeEnabled(Tracking.floatingCountEnabled());
      setBadgePrefs(Tracking.floatingCountPreferences());
      setMemes(Tracking.memePreferences());
      setDaily(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    }
  }, []);

  useEffect(() => {
    if (!badgePrefs.pausedUntil) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, badgePrefs.pausedUntil - Date.now()) + 100,
    );
    return () => clearTimeout(timer);
  }, [badgePrefs.pausedUntil]);

  // Re-read when the screen gains focus and when the user returns from Settings.
  useFocusEffect(read);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => sub.remove();
  }, [read]);

  const share = async (fn: () => string) => {
    try {
      const uri = fn();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert('Saved', uri);
    } catch (e) {
      Alert.alert('Not available', e instanceof Error ? e.message : 'unknown error');
    }
  };

  if (error) {
    return (
      <Screen>
        <Notice tone="warn" title="The counter could not be read" body={error} />
      </Screen>
    );
  }
  if (!health || !daily) return <Screen>{null}</Screen>;

  const state = trackingState(health);
  const copy = STATE_COPY[state];
  const appRows = health.apps
    .filter(
      (app) =>
        daily.apps.some((row) => row.package === app.package) ||
        daily.personalAppViews?.[app.package] != null,
    )
    .map((app) => ({
      package: app.package,
      local: daily.apps.find((row) => row.package === app.package),
    }));
  const label = (pkg: string) => health.apps.find((a) => a.package === pkg)?.label ?? pkg;

  return (
    <Screen topBanner={<CountingPermissionBanner health={health} />}>
      {state.startsWith('tracking') && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check" />
          <T v="label">{copy.title}</T>
        </View>
      )}

      <Section>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="heading">Floating brain counter</T>
            <T v="caption" muted>
              Shows over Reels &amp; Shorts. Tap to open ScrollSnooze. Long press and drag to move
              anywhere.
            </T>
          </View>
          <Toggle
            accessibilityLabel="Floating brain counter"
            value={badgeEnabled}
            disabled={!Tracking.floatingCountSupported() || !health.disclosureAccepted}
            onValueChange={(enabled) => {
              try {
                Tracking.setFloatingCountEnabled(enabled);
                setBadgeEnabled(enabled);
                setBadgePrefs(Tracking.floatingCountPreferences());
              } catch {
                setError('Could not change the floating counter.');
              }
            }}
          />
        </View>
        {!Tracking.floatingCountSupported() && (
          <T v="caption" muted>
            Rebuild the Android app to use the floating counter.
          </T>
        )}
        <T v="caption" muted>
          Long press, then drag to the pause target at the bottom to hide for one hour or one day. —
          means the video could not be identified.
        </T>
        {Tracking.floatingCountCustomizationSupported() && (
          <>
            <T v="label">Popup icon size</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Small', size: 40 },
                { label: 'Medium', size: 54 },
                { label: 'Large', size: 72 },
              ].map((option) => (
                <Button
                  key={option.size}
                  label={`${option.label}${badgePrefs.size === option.size ? ' ✓' : ''}`}
                  kind="secondary"
                  onPress={() => {
                    try {
                      Tracking.setFloatingCountSize(option.size);
                      setBadgePrefs(Tracking.floatingCountPreferences());
                    } catch {
                      setError('Could not change popup size.');
                    }
                  }}
                />
              ))}
            </View>
            {badgePrefs.pausedUntil > now && (
              <>
                <T v="caption" muted>
                  Popup paused until {new Date(badgePrefs.pausedUntil).toLocaleString()}. Counting
                  continues.
                </T>
                <Button
                  label="Resume popup now"
                  kind="secondary"
                  onPress={() => {
                    try {
                      Tracking.resumeFloatingCount();
                      setBadgePrefs(Tracking.floatingCountPreferences());
                    } catch {
                      setError('Could not resume the popup.');
                    }
                  }}
                />
              </>
            )}
          </>
        )}
      </Section>

      <Section>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="heading">Meme breaks</T>
            <T v="caption" muted>
              Every 50 Reels &amp; Shorts. One tiny reality check.
            </T>
          </View>
          <Toggle
            accessibilityLabel="Meme break cards"
            value={memes.enabled}
            disabled={!Tracking.memeCardsSupported()}
            onValueChange={(enabled) => {
              try {
                Tracking.setMemePreferences(enabled);
                setMemes({ ...memes, enabled });
              } catch {
                setError('Could not change meme breaks.');
              }
            }}
          />
        </View>
        {!badgeEnabled && (
          <T v="caption" muted>
            Turn on the floating counter to see meme breaks.
          </T>
        )}
      </Section>

      <Section>
        <T v="heading">Today’s activity</T>
        {appRows.length === 0 ? (
          <EmptyState
            mark="▥"
            title="A fresh start"
            body="Your app totals will appear here as tracking records activity."
          />
        ) : (
          appRows.map((a) => (
            <View key={a.package} style={{ gap: 8, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AppIcon name={label(a.package)} />
                <T v="label">{label(a.package)}</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View style={{ flex: 1 }}>
                  <T v="display">{homeAppCount(daily, health, a.package) ?? '—'}</T>
                  <T v="caption" muted>
                    Videos
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="display">
                    {a.local
                      ? minutes(
                          health.usageAccessGranted
                            ? a.local.usageMs
                            : a.local.surfaceMs + a.local.unknownMs,
                        )
                      : '—'}
                  </T>
                  <T v="caption" muted>
                    Minutes on this phone
                  </T>
                </View>
              </View>
              {a.local && a.local.adViews > 0 && (
                <T v="caption" muted>
                  {a.local.adViews} ads counted separately
                </T>
              )}
            </View>
          ))
        )}
      </Section>

      <Details title="Minutes (Usage Access)" icon="clock">
        <T muted>
          {health.usageAccessGranted
            ? `On. Minutes in ${health.apps.map((app) => app.label).join(', ')} come from Android and work even when video counting is unavailable.`
            : `Off. Allow Usage Access to record minutes in ${health.apps.map((app) => app.label).join(', ')} — this works even when video counting is unavailable.`}
        </T>
        {!health.usageAccessGranted && (
          <Button
            kind="secondary"
            label="Open Usage Access settings"
            onPress={Tracking.openUsageAccessSettings}
          />
        )}
      </Details>
      <Details title="Tracking details" icon="help">
        <T muted>{copy.body}</T>
        <T v="caption" muted>
          Counter active for {daily.heartbeatMinutes} minutes today. Time when it was off is a gap,
          not zero.
        </T>
      </Details>
      <Details title="Supported apps" icon="play">
        {health.apps.map((a) => (
          <T key={a.package} muted>
            {a.label}: {a.installed ? `version ${a.version}` : 'not installed'}
          </T>
        ))}
      </Details>

      {health.debugBuild && (
        <Details title="Accuracy testing (debug build)" icon="settings">
          <T v="caption" muted>
            Exports contain only event times and ids — no content. See docs/ACCURACY_PROTOCOL.md.
          </T>
          <Button
            kind="secondary"
            label="Export counted events"
            onPress={() => share(() => Tracking.exportSessionLog(7).uri)}
          />
          <Button
            kind="secondary"
            label="Capture screen structure in 8 s"
            accessibilityHint="After tapping, switch to Reels or Shorts and wait"
            onPress={() => {
              try {
                Tracking.scheduleStructureCapture(8000);
                Alert.alert(
                  'Switch now',
                  'Open Reels or Shorts and wait about 8 seconds, then come back here.',
                );
              } catch (e) {
                Alert.alert('Not available', e instanceof Error ? e.message : 'unknown error');
              }
            }}
          />
          <Button
            kind="secondary"
            label="Share last capture"
            onPress={() => share(() => Tracking.lastStructureCapture())}
          />
        </Details>
      )}

      <Details title="Manage local counts" icon="settings">
        <Button
          kind="danger"
          label="Delete counts on this phone"
          onPress={() =>
            Alert.alert('Delete all counts?', 'This removes every count stored on this phone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  Tracking.wipeLocalData();
                  read();
                },
              },
            ])
          }
        />
      </Details>
    </Screen>
  );
}

export default function TrackingScreen() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidTrackingScreen />;
}
