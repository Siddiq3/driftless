import type { Daily, TrackingHealth } from 'tracking-android';
/** Local display only. Never used for validated goals, sync or comparisons. */
export function candidateCount(daily: Daily | null, health: TrackingHealth | null): number | null {
  if (!daily || !health || daily.heartbeatMinutes <= 0) return null;
  const packages = new Set(health.apps.filter((a) => a.installed).map((a) => a.package));
  const rows = daily.apps.filter((a) => packages.has(a.package));
  if (!rows.some((a) => a.surfaceMs > 0 && a.views > 0)) return null;
  return rows.reduce((n, a) => n + a.views, 0);
}
