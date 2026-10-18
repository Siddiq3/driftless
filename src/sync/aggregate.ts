import type { v1 } from '@siddiq3/driftless-contracts';
import type { Daily, TrackingHealth } from 'tracking-android';

export type DayValues = Omit<v1.DailyAggregate, 'rev'>;

/**
 * Turns one local day of native data into the aggregate that may leave the phone.
 *
 * Honesty rules (D-019, PRODUCT_SPEC §4):
 *  - `views` only counts apps whose installed version passed the accuracy gate; if none did, null.
 *  - `minutes` prefers Android UsageStats (complete); otherwise counter time if the counter ran;
 *    otherwise null. Never 0 for "unknown".
 *  - `coverage` describes how trustworthy the numbers are for that day.
 */
export function aggregateDay(
  daily: Daily,
  health: TrackingHealth,
  deviceId: string,
  tz: string,
): DayValues {
  const validated = new Set(
    health.apps.filter((a) => a.installed && a.validated).map((a) => a.package),
  );
  const counterRan = daily.heartbeatMinutes > 0;

  let views: number | null = null;
  let adViews: number | null = null;
  if (validated.size > 0 && counterRan) {
    views = 0;
    adViews = 0;
    for (const a of daily.apps) {
      if (!validated.has(a.package)) continue;
      views += a.views;
      adViews += a.adViews;
    }
  }

  const usageMs = daily.apps.reduce((n, a) => n + a.usageMs, 0);
  const counterMs = daily.apps.reduce((n, a) => n + a.surfaceMs + a.unknownMs, 0);
  let minutes: number | null = null;
  // No rows at all for the day (e.g. before install, or older than the UsageStats refresh window)
  // means "not tracked", never 0 minutes.
  const hasRows = daily.apps.length > 0;
  if (health.usageAccessGranted && hasRows) minutes = Math.floor(usageMs / 60_000);
  else if (counterRan) minutes = Math.floor(counterMs / 60_000);
  if (minutes !== null) minutes = Math.min(1440, Math.max(0, minutes));

  const coverage =
    views !== null ? daily.coverage : health.usageAccessGranted && hasRows ? 1 : daily.coverage;

  return {
    localDate: daily.localDate,
    tz,
    platform: 'android',
    deviceId,
    views: views === null ? null : Math.min(5000, views),
    adViews: adViews === null ? null : Math.min(5000, adViews),
    minutes,
    coverage: Math.round(Math.min(1, Math.max(0, coverage)) * 1000) / 1000,
  };
}

/** Stable fingerprint of a day's values, to detect changes and bump `rev` only when needed. */
export function valuesKey(d: DayValues): string {
  return JSON.stringify([d.localDate, d.tz, d.deviceId, d.views, d.adViews, d.minutes, d.coverage]);
}
