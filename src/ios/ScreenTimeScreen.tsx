import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ScreenTime, type ScreenTimeStatus } from '../../modules/screen-time/src';
import { Button, Notice, Screen, Section, T } from '@/ui/kit';
import { BrandMark } from '@/ui/BrandMark';

/** iOS controls deliberately do not reuse Android's Accessibility / Usage Access setup. */
export function ScreenTimeScreen({
  footer,
  introduction = false,
}: {
  footer?: React.ReactNode;
  introduction?: boolean;
}) {
  const [status, setStatus] = useState<ScreenTimeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    try {
      if (ScreenTime.supported()) setStatus(ScreenTime.status());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screen Time could not be read.');
    }
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screen Time could not be updated.');
    } finally {
      setBusy(false);
    }
  };
  const approved = status?.authorization === 'approved';
  return (
    <Screen>
      <View style={{ gap: 16, alignItems: 'flex-start', paddingVertical: 20 }}>
        <BrandMark size={56} />
        <T v="title">{introduction ? 'A little less scrolling.' : 'iPhone app pauses'}</T>
        <T muted>Make room for what matters, with ScrollSnooze.</T>
      </View>
      <Section>
        <T v="heading">Your apps. Your choice.</T>
        <T>
          Choose apps privately with Apple’s Screen Time picker, then pause them whenever you need
          space. Pauses stay on until you resume them here.
        </T>
        <T muted>
          iPhone pauses apply to the whole app. iOS does not provide individual Reels or Shorts
          counts, floating counters or feed-only pauses.
        </T>
      </Section>
      {!ScreenTime.supported() && (
        <Notice
          title="Screen Time build required"
          body="Use an iOS development build with the Family Controls capability to enable app pauses."
        />
      )}
      {error && <Notice tone="warn" title="Screen Time needs attention" body={error} />}
      {ScreenTime.supported() && (
        <Section>
          <T v="heading">Screen Time access</T>
          <T>
            {approved
              ? 'Access allowed'
              : status?.authorization === 'denied'
                ? 'Access was denied. You can request it again.'
                : 'Allow access to choose and pause apps. You can continue without access.'}
          </T>
          {!approved && (
            <Button
              label="Allow Screen Time access"
              busy={busy}
              onPress={() => void run(ScreenTime.authorize)}
            />
          )}
          {approved && (
            <>
              <T>{status?.selectedCount ?? 0} apps, categories or websites selected</T>
              <Button
                kind="secondary"
                label="Choose apps"
                busy={busy}
                onPress={() => void run(ScreenTime.chooseApps)}
              />
              {!!status?.selectedCount && (
                <Button
                  label={status?.paused ? 'Resume apps' : 'Pause selected apps'}
                  busy={busy}
                  onPress={() => void run(() => ScreenTime.setPaused(!status?.paused))}
                />
              )}
              <T muted>
                {status?.paused
                  ? 'Selected apps are paused until you resume them.'
                  : 'Selected apps are available.'}
              </T>
            </>
          )}
        </Section>
      )}
      <Notice
        title="More iPhone features are being built"
        body="Automatic daily minute limits, scheduled pauses and Screen Time charts are not available in this version. Android history saved to your account remains separate from iPhone activity."
      />
      {footer ?? (
        <Button
          kind="secondary"
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      )}
    </Screen>
  );
}
