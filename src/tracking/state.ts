import type { TrackingHealth } from 'tracking-android';

export type TrackingState =
  | 'needs_disclosure'
  | 'needs_service'
  | 'enabled_not_running'
  | 'tracking'
  | 'tracking_unvalidated';

/** Single user-facing status derived from native health. */
export function trackingState(h: TrackingHealth): TrackingState {
  if (!h.disclosureAccepted) return 'needs_disclosure';
  if (!h.serviceEnabled) return 'needs_service';
  if (!h.serviceRunning) return 'enabled_not_running';
  const installed = h.apps.filter((a) => a.installed);
  return installed.length > 0 && installed.every((a) => a.validated)
    ? 'tracking'
    : 'tracking_unvalidated';
}

export const STATE_COPY: Record<TrackingState, { title: string; body: string }> = {
  needs_disclosure: {
    title: 'Counting is off',
    body: 'Read how counting works and choose whether to turn it on.',
  },
  needs_service: {
    title: 'Turn on the counter in Settings',
    body: 'Open Accessibility settings, find “ScrollSnooze short-video counter” and switch it on. You can switch it off there at any time.',
  },
  enabled_not_running: {
    title: 'Android has stopped the counter',
    body: 'The counter is switched on but not running. This can happen after an update, a battery saver, or when Advanced Protection is on (it blocks apps like this). Nothing is counted while it is stopped — you will see a gap, not zeros.',
  },
  tracking: {
    title: 'Counting on this phone',
    body: 'Counts are saved on this phone and backed up only after you sign in.',
  },
  tracking_unvalidated: {
    title: 'Counting on this phone',
    body: 'Your app versions have not passed our accuracy tests yet, so these numbers may be off. They are saved on this phone, backed up only after you sign in, and are not used for goals or friends.',
  },
};
