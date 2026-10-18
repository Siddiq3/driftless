import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import { Button, Card, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/**
 * Google Play prominent disclosure for AccessibilityService use (PLATFORM_CAPABILITIES S1):
 * shown in-app before the system setting, describes what is accessed and how it is used,
 * requires an affirmative tap, and is separate from the privacy policy.
 * "Not now" leaves the app fully usable without counting.
 */
export default function Disclosure() {
  const agree = () => {
    Tracking.setDisclosureAccepted(true);
    Tracking.openAccessibilitySettings();
    router.back();
  };
  const decline = () => {
    Tracking.setDisclosureAccepted(false);
    router.back();
  };

  return (
    <Screen>
      <Card>
        <Icon name="counter" />
        <T v="heading">What it reads</T>
        <T muted>
          • Only Instagram and YouTube — no other apps.{'\n'}• The layout of the video player, and
          the labels on the current video (for example its description), so it can tell one video
          from the next.{'\n'}• Which app is on screen, so it knows when you leave.
        </T>
      </Card>

      <Card>
        <Icon name="lock" />
        <T v="heading">What it keeps</T>
        <T muted>
          The labels are turned into an unreadable code immediately and are never saved. Driftless
          keeps only counts and times — for example “12 Reels, 18 minutes today” — on this phone.
        </T>
      </Card>

      <Card>
        <Icon name="shield" />
        <T v="heading">What it never does</T>
        <T muted>
          It never reads your messages, never takes screenshots, never taps, types or scrolls for
          you, and never sends what you watched anywhere. If you later turn on cloud sync, only
          daily totals are shared.
        </T>
      </Card>

      <Card>
        <Icon name="settings" />
        <T v="heading">You stay in control</T>
        <T muted>
          You can switch it off any time in Settings › Accessibility, or delete the counts from this
          app.
        </T>
      </Card>

      <Button
        label="I agree, open Settings"
        onPress={agree}
        accessibilityHint="Opens Accessibility settings"
      />
      <Button kind="secondary" label="Not now" onPress={decline} />
    </Screen>
  );
}
