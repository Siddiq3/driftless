import { hasRecordedActivity } from '@/data/measurement';
import type { Daily, TrackingHealth } from 'tracking-android';
/** Local display only. Never used for validated goals, sync or comparisons. */
export function candidateCount(daily: Daily | null, health: TrackingHealth | null): number | null {
  if (!daily || !health) return null;
  const packages = new Set(health.apps.filter((a) => a.installed).map((a) => a.package));
  const rows = daily.apps.filter((a) => packages.has(a.package));
  if (!rows.some((a) => a.surfaceMs > 0 && a.views > 0)) return null;
  return rows.reduce((n, a) => n + a.views, 0);
}

/** Home's app breakdown follows the same local fallback as its headline total. */
export function homeAppCount(
  daily: Daily | null,
  health: TrackingHealth | null,
  packageName: string,
): number | null {
  if (!daily || !health) return null;
  const app = health.apps.find((app) => app.package === packageName);
  if (!app || app.videoDetectionImplemented === false) return null;
  if (daily.personalAppViews && Object.hasOwn(daily.personalAppViews, packageName))
    return daily.personalAppViews[packageName] ?? null;
  const row = daily.apps.find((entry) => entry.package === packageName);
  return row?.views ?? (hasRecordedActivity(daily) ? 0 : null);
}
