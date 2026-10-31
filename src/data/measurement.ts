import type { Daily, TrackingHealth, PersonalMeasurement } from 'tracking-android';
/** A day is known only from recorded activity; Usage Access minutes say nothing about the counter. */
export function hasRecordedActivity(daily: Daily): boolean {
  return daily.apps.some((a) => a.views > 0 || a.adViews > 0 || a.surfaceMs > 0 || a.unknownMs > 0);
}

/** Personal display semantics only. Never use this for a competitive upload. */
export function recordedMeasurement(
  daily: Daily,
  health: TrackingHealth,
): Pick<PersonalMeasurement, 'views' | 'minutes' | 'status'> {
  const packages = new Set(health.apps.map((a) => a.package));
  const rows = daily.apps.filter((a) => packages.has(a.package));
  const views = rows.reduce((n, a) => n + a.views, 0);
  const ran = hasRecordedActivity(daily);
  const known = packages.size > 0 && ran;
  const approved = rows
    .filter((r) => hasRecordedActivity({ ...daily, apps: [r] }))
    .every((r) => health.apps.some((a) => a.package === r.package && a.validated));
  const minutes = rows.length
    ? health.usageAccessGranted
      ? Math.floor(rows.reduce((n, a) => n + a.usageMs, 0) / 60000)
      : ran
        ? Math.floor(rows.reduce((n, a) => n + a.surfaceMs + a.unknownMs, 0) / 60000)
        : null
    : null;
  return {
    views: known ? views : null,
    minutes,
    // A recorded zero on an approved app version is a real, verified zero.
    status: !known ? 'unavailable' : approved ? 'validated' : 'experimental',
  };
}
