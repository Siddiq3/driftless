import type { Daily, TrackingHealth, PersonalMeasurement } from 'tracking-android';
/** Personal display semantics only. Never use this for a competitive upload. */
export function recordedMeasurement(
  daily: Daily,
  health: TrackingHealth,
): Pick<PersonalMeasurement, 'views' | 'minutes' | 'status'> {
  const packages = new Set(health.apps.map((a) => a.package));
  const rows = daily.apps.filter((a) => packages.has(a.package));
  const views = rows.reduce((n, a) => n + a.views, 0);
  const ran = daily.heartbeatMinutes > 0;
  const known = packages.size > 0 && (ran || views > 0);
  const approved = rows
    .filter((r) => r.views > 0)
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
    status: !known
      ? 'unavailable'
      : approved && rows.some((r) => r.views > 0)
        ? 'validated'
        : 'experimental',
  };
}
