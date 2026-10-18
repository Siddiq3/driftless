import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Tracking, type Daily, type TrackingHealth } from 'tracking-android';
import { STATE_COPY, trackingState } from '@/tracking/state';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';

const minutes = (ms: number) => Math.round(ms / 60_000);

export default function TrackingScreen() {
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(() => {
    try {
      Tracking.refreshUsage(1);
      const h = Tracking.health();
      const d = Tracking.daily();
      setHealth(h);
      setDaily(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    }
  }, []);

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
  const label = (pkg: string) => health.apps.find((a) => a.package === pkg)?.label ?? pkg;

  return (
    <Screen>
      <T v="title">Reels & Shorts counter</T>
      <Notice
        tone={state.startsWith('tracking') ? 'info' : 'warn'}
        title={copy.title}
        body={copy.body}
      />

      {state === 'needs_disclosure' && (
        <Button label="How counting works" onPress={() => router.push('/disclosure')} />
      )}
      {(state === 'needs_service' || state === 'enabled_not_running') && (
        <Button label="Open Accessibility settings" onPress={Tracking.openAccessibilitySettings} />
      )}

      <Card>
        <T v="heading">Minutes (Usage Access)</T>
        <T muted>
          {health.usageAccessGranted
            ? 'On. Minutes in Instagram and YouTube come from Android and work even when the counter is off.'
            : 'Off. Allow Usage Access to record minutes in Instagram and YouTube — this works on every phone, including ones where the counter is blocked.'}
        </T>
        {!health.usageAccessGranted && (
          <Button
            kind="secondary"
            label="Open Usage Access settings"
            onPress={Tracking.openUsageAccessSettings}
          />
        )}
      </Card>

      <Card>
        <T v="heading">Today on this phone</T>
        {daily.apps.length === 0 ? (
          <T muted>Nothing counted yet today.</T>
        ) : (
          daily.apps.map((a) => (
            <T key={a.package} muted>
              {label(a.package)}: {a.views} videos ·{' '}
              {minutes(health.usageAccessGranted ? a.usageMs : a.surfaceMs + a.unknownMs)} min
              {a.adViews > 0 ? ` · ${a.adViews} ads` : ''}
            </T>
          ))
        )}
        <T v="caption" muted>
          Counter active for {daily.heartbeatMinutes} min today. Time when it was off is a gap, not
          zero.
        </T>
      </Card>

      <Card>
        <T v="heading">Supported apps</T>
        {health.apps.map((a) => (
          <T key={a.package} muted>
            {a.label}: {a.installed ? `version ${a.version}` : 'not installed'}
            {a.installed
              ? a.validated
                ? ' · accuracy confirmed'
                : ' · accuracy not yet confirmed'
              : ''}
          </T>
        ))}
      </Card>

      {health.debugBuild && (
        <Card>
          <T v="heading">Accuracy testing (debug build)</T>
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
        </Card>
      )}

      <Button
        kind="secondary"
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
    </Screen>
  );
}
