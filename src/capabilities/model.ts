import type { v1 } from '@siddiq3/driftless-contracts';
import type { TrackingHealth } from 'tracking-android';

export type NativeSupport = { counting: boolean; minutes: boolean; blocking: boolean };
export type CapabilityStatus = { available: boolean; detail: string };
export type CapabilityReport = Record<keyof v1.Capabilities, CapabilityStatus>;
type Input = {
  platform: string;
  health: TrackingHealth | null;
  support: NativeSupport;
  backend: v1.MeResponse | null;
};
const unavailable = (detail: string): CapabilityStatus => ({ available: false, detail });
const available = (detail: string): CapabilityStatus => ({ available: true, detail });

/** Device observations and backend eligibility are separate evidence. Neither implies the other. */
export function capabilityReport({
  platform,
  health: h,
  support,
  backend: me,
}: Input): CapabilityReport {
  const android = platform === 'android';
  const installed = h?.apps.some((a) => a.installed) ?? false;
  const accessibility = !android
    ? 'Not implemented on this platform'
    : !h || !h.implemented
      ? 'Native tracking unavailable'
      : !h.disclosureAccepted
        ? 'Tracking disclosure required'
        : !h.serviceEnabled
          ? 'Accessibility permission required'
          : !h.serviceRunning
            ? 'Accessibility service is not running'
            : !installed
              ? 'Install a supported app'
              : null;
  const videoTargets = h?.apps.filter((a) => a.installed && a.videoDetectionImplemented !== false) ?? [];
  const videoCounting = !support.counting
    ? unavailable('Counting module unavailable')
    : accessibility
      ? unavailable(accessibility)
      : videoTargets.length === 0
        ? unavailable('Short-video detection rules are not configured for the installed apps yet')
        : videoTargets.some((a) => !a.validated)
        ? unavailable('Local counting available; accuracy unverified for installed app versions')
        : available('Service running; installed versions approved');
  const minutesTracking = !android
    ? unavailable('Not implemented on this platform')
    : !h?.implemented || !support.minutes
      ? unavailable('Usage tracking module unavailable')
      : !installed
        ? unavailable('Install a supported app')
        : !h.usageAccessGranted
          ? unavailable('Usage Access permission required')
          : available('Usage Access granted; local app minutes available');
  const cloud = (key: keyof v1.Capabilities) =>
    !me
      ? 'Backend status unavailable'
      : !me.capabilities[key]
        ? 'Not enabled by the backend'
        : null;
  const blocking = (key: 'blocking' | 'schedules'): CapabilityStatus => {
    if (!support.blocking) return unavailable('Blocking module unavailable');
    if (accessibility) return unavailable(accessibility);
    const gate = cloud(key);
    if (gate) return unavailable(gate);
    if (me!.entitlement.tier !== 'pro' || !['active', 'grace'].includes(me!.entitlement.state))
      return unavailable('Verified Pro entitlement required');
    if (h?.blockingEntitled !== true)
      return unavailable('Native Pro verification unavailable or expired; refresh your profile');
    // This report describes configurability, never an assertion that enforcement is active.
    return available(
      key === 'blocking'
        ? 'Available to configure for app minutes; reel-count blocking is not implemented'
        : 'Preset schedules available to configure; protection requires an enabled rule',
    );
  };
  const shareGate = !android
    ? 'Not implemented on this platform'
    : (cloud('socialSharingOfUsage') ??
      (!me!.profile.consent.cloudSync || !me!.profile.consent.shareWithFriends
        ? 'Cloud backup and friend-sharing consent required'
        : null));
  return {
    videoCounting,
    minutesTracking,
    blocking: blocking('blocking'),
    schedules: blocking('schedules'),
    advancedAnalytics: unavailable('Advanced analytics is not implemented'),
    socialSharingOfUsage: shareGate
      ? unavailable(shareGate)
      : videoCounting.available
        ? available('Backend and consent enabled; eligible totals required')
        : unavailable(
            'Approved counting versions required for reel scores; local counts are not cloud scores',
          ),
  };
}
