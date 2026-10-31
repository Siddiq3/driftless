import { Platform, Alert, AppState, Pressable, StyleSheet, View } from 'react-native';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Tracking, type Daily, type TrackingHealth, type MemePreferences } from 'tracking-android';
import { STATE_COPY, trackingState } from '@/tracking/state';
import { Button, Notice, Screen, T, EmptyState, Details, Toggle } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';
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
        <View style={styles.status}>
          <Icon name="check" size={18} color={C.accent} />
          <T style={styles.statusText}>{copy.title}</T>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <T style={styles.title}>Floating brain counter</T>
            <T style={styles.caption}>
              Shows over Reels &amp; Shorts. Tap it to open ScrollSnooze.
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
          <T style={styles.caption}>Rebuild the Android app to use the floating counter.</T>
        )}
        {Tracking.floatingCountCustomizationSupported() && (
          <>
            <View style={styles.divider} />
            <T style={styles.groupLabel}>Popup icon size</T>
            <View accessibilityRole="radiogroup" style={styles.segments}>
              {[
                { label: 'Small', size: 40 },
                { label: 'Medium', size: 54 },
                { label: 'Large', size: 72 },
              ].map((option) => {
                const selected = badgePrefs.size === option.size;
                return (
                  <Pressable
                    key={option.size}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      try {
                        Tracking.setFloatingCountSize(option.size);
                        setBadgePrefs(Tracking.floatingCountPreferences());
                      } catch {
                        setError('Could not change popup size.');
                      }
                    }}
                    style={({ pressed }) => [
                      styles.segment,
                      selected && styles.segmentOn,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <T style={selected ? styles.segmentTextOn : styles.segmentText}>
                      {option.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            {badgePrefs.pausedUntil > now && (
              <>
                <T style={styles.caption}>
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
        <T style={styles.caption}>
          Long press to move it, or drag it to the pause target at the bottom to hide it for one
          hour or one day. — means the video could not be identified.
        </T>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <T style={styles.title}>Meme breaks</T>
            <T style={styles.caption}>Every 50 Reels &amp; Shorts. One tiny reality check.</T>
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
          <T style={styles.caption}>Turn on the floating counter to see meme breaks.</T>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <T accessibilityRole="header" style={styles.sectionTitle}>
          Today’s activity
        </T>
        {appRows.length === 0 ? (
          <EmptyState
            mark="▥"
            title="A fresh start"
            body="Your app totals will appear here as tracking records activity."
          />
        ) : (
          <View style={styles.card}>
            {appRows.map((a, i) => (
              <View key={a.package} style={{ gap: 18 }}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <AppIcon name={label(a.package)} size={44} />
                  <View style={styles.rowText}>
                    <T style={styles.title}>{label(a.package)}</T>
                  </View>
                  <View style={styles.stat}>
                    <T style={styles.statValue}>{homeAppCount(daily, health, a.package) ?? '—'}</T>
                    <T style={styles.statLabel}>Videos</T>
                  </View>
                  <View style={styles.stat}>
                    <T style={styles.statValue}>
                      {a.local
                        ? minutes(
                            health.usageAccessGranted
                              ? a.local.usageMs
                              : a.local.surfaceMs + a.local.unknownMs,
                          )
                        : '—'}
                    </T>
                    <T style={styles.statLabel}>Minutes</T>
                  </View>
                </View>
                {a.local && a.local.adViews > 0 && (
                  <T style={styles.ads}>{a.local.adViews} ads counted separately</T>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

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
    </Screen>
  );
}

export default function TrackingScreen() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidTrackingScreen />;
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: C.accent, fontSize: 15, fontWeight: '700' },
  card: { gap: 18, padding: 18, borderRadius: 20, backgroundColor: '#17160F' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  caption: { color: C.muted, fontSize: 14, lineHeight: 20 },
  ads: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: -8 },
  divider: { height: 1, backgroundColor: '#29271F' },
  groupLabel: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: -6 },
  segments: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#29271F',
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentOn: { backgroundColor: C.accent },
  segmentText: { color: C.text, fontSize: 15, fontWeight: '700' },
  segmentTextOn: { color: C.brown, fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  stat: { minWidth: 56, alignItems: 'flex-end' },
  statValue: {
    color: C.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: C.muted, fontSize: 12, lineHeight: 16 },
});
