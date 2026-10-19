import { addDays } from '@siddiq3/driftless-contracts/domain';
import type { Daily, TrackingHealth, WrapDetails } from 'tracking-android';
import { aggregateDay } from '@/sync/aggregate';
export type ActivityPeriod = 'daily' | 'weekly';
export function activityBounds(period: ActivityPeriod, offset: number, today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const from =
    period === 'daily'
      ? addDays(today, -offset)
      : addDays(today, -((weekday + 6) % 7) - offset * 7);
  const to = period === 'daily' ? from : addDays(from, 6);
  const dates: string[] = [];
  for (let date = from; date <= to && date <= today; date = addDays(date, 1)) dates.push(date);
  return { from, to, dates };
}
export function activityData(
  period: ActivityPeriod,
  offset: number,
  today: string,
  health: TrackingHealth,
  readDay: (date: string) => Daily,
  details: WrapDetails,
) {
  const bounds = activityBounds(period, offset, today);
  const packages = new Set(health.apps.map((app) => app.package));
  const rows = bounds.dates.map((date) => {
    const raw = readDay(date);
    const day = aggregateDay(raw, health, 'phone', 'UTC');
    if (period === 'daily') {
      // Match the popup's saved supported-app totals, independently of cloud accuracy gates.
      const localViews = raw.apps
        .filter((app) => packages.has(app.package))
        .reduce((sum, app) => sum + app.views, 0);
      return {
        raw,
        day: {
          ...day,
          views:
            packages.size > 0 && (raw.heartbeatMinutes > 0 || localViews > 0) ? localViews : null,
        },
      };
    }
    return { raw, day };
  });
  const total = (key: 'views' | 'minutes') => {
    const known = rows.filter((r) => r.day[key] !== null);
    return {
      value: known.length ? known.reduce((n, r) => n + r.day[key]!, 0) : null,
      days: known.length,
    };
  };
  const views = total('views');
  const minutes = total('minutes');
  const hourly = details.days.find((d) => d.localDate === bounds.from)?.hourlyViews;
  const hours =
    period === 'daily' &&
    details.available &&
    views.value !== null &&
    hourly?.length === 24 &&
    hourly.every((v) => Number.isInteger(v) && v >= 0) &&
    hourly.reduce((a, b) => a + b, 0) === views.value
      ? hourly
      : period === 'daily' && details.available && views.value === 0
        ? Array<number>(24).fill(0)
        : null;
  const bars =
    period === 'daily'
      ? Array.from({ length: 24 }, (_, i) => ({
          key: String(i),
          label: `${i % 12 || 12}${i < 12 ? 'am' : 'pm'}`,
          value: hours?.[i] ?? null,
        }))
      : Array.from({ length: 7 }, (_, i) => {
          const date = addDays(bounds.from, i);
          return {
            key: date,
            label: new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
              weekday: 'short',
              timeZone: 'UTC',
            }),
            value: rows.find((r) => r.day.localDate === date)?.day.views ?? null,
          };
        });
  const apps = health.apps
    .filter((a) => a.installed || rows.some((r) => r.raw.apps.some((d) => d.package === a.package)))
    .map((app) => ({
      ...app,
      views:
        views.value === null || (period !== 'daily' && (!app.installed || !app.validated))
          ? null
          : rows
              .filter((r) => r.day.views !== null)
              .reduce(
                (n, r) => n + (r.raw.apps.find((a) => a.package === app.package)?.views ?? 0),
                0,
              ),
    }))
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  return {
    ...bounds,
    views,
    minutes,
    bars,
    apps,
    hourlyAvailable: hours !== null,
    expectedDays: bounds.dates.length,
  };
}
export type ActivityData = ReturnType<typeof activityData>;
