import type { PersonalDailyAggregate } from '@/api/personalUsage';
import type { Daily, TrackingHealth } from 'tracking-android';

export type DayValues = Omit<PersonalDailyAggregate, 'rev'>;

/**
 * Turns one local day of native data into the aggregate that may leave the phone.
 *
 * Honesty rules (D-019, PRODUCT_SPEC §4):
 *  - `personalViews` preserves recorded personal totals, independently of competitive eligibility.
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
  currentDay = true,
): DayValues {
  const validated = new Set(
    health.apps
      .filter((a) =>
        daily.measurementStatus
          ? daily.measurementStatus === 'validated'
          : currentDay && a.installed && a.validated,
      )
      .map((a) => a.package),
  );
  const counterRan = daily.heartbeatMinutes > 0;
  const supported = new Set(health.apps.map((app) => app.package));
  const personalRows = daily.apps.filter((app) => supported.has(app.package));
  const recordedViews = personalRows.reduce((total, app) => total + app.views, 0);
  const personalViews =
    personalRows.length > 0 && (counterRan || recordedViews > 0)
      ? Math.min(100_000, recordedViews)
      : null;

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
  if ((daily.usageObserved ?? health.usageAccessGranted) && hasRows)
    minutes = Math.floor(usageMs / 60_000);
  else if (counterRan) minutes = Math.floor(counterMs / 60_000);
  if (minutes !== null) minutes = Math.min(1440, Math.max(0, minutes));

  const coverage =
    views !== null
      ? daily.coverage
      : currentDay && health.usageAccessGranted && hasRows
        ? 1
        : daily.coverage;

  return {
    localDate: daily.localDate,
    tz: daily.recordedTz ?? tz,
    platform: 'android',
    deviceId,
    personalViews,
    ...(personalViews === null ||
    recordedViews > 100_000 ||
    personalRows.some(
      (app) =>
        app.views > 0 &&
        app.package !== 'com.instagram.android' &&
        app.package !== 'com.google.android.youtube',
    )
      ? {}
      : {
          personalAppViews: Object.fromEntries(
            [...supported]
              .filter(
                (pkg) => pkg === 'com.instagram.android' || pkg === 'com.google.android.youtube',
              )
              .map((pkg) => [
                pkg,
                personalRows
                  .filter((app) => app.package === pkg)
                  .reduce((sum, app) => sum + app.views, 0),
              ]),
          ),
        }),
    views: views === null ? null : Math.min(5000, views),
    adViews: adViews === null ? null : Math.min(5000, adViews),
    minutes,
    coverage: Math.round(Math.min(1, Math.max(0, coverage)) * 1000) / 1000,
  };
}

/** Stable fingerprint of a day's values, to detect changes and bump `rev` only when needed. */
export function valuesKey(d: DayValues): string {
  return JSON.stringify([
    d.localDate,
    d.tz,
    d.deviceId,
    d.views,
    d.adViews,
    d.minutes,
    d.coverage,
    d.personalViews ?? null,
    Object.entries(d.personalAppViews ?? {}).sort(),
  ]);
}
