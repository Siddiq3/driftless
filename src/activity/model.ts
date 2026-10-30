import { addDays } from '@siddiq3/driftless-contracts/domain';
import type { Daily, TrackingHealth, WrapDetails, PersonalMeasurement } from 'tracking-android';
import { recordedMeasurement } from '@/data/measurement';
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
  readMeasurement?: (date: string) => Pick<PersonalMeasurement, 'views' | 'minutes'>,
) {
  const bounds = activityBounds(period, offset, today);
  const rows = bounds.dates.map((date) => {
    const raw = readDay(date);
    return {
      raw,
      day: { localDate: date, ...(readMeasurement?.(date) ?? recordedMeasurement(raw, health)) },
    };
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
  // Hourly records belong to this phone; restored/account totals can be larger.
  const localViews = rows.length === 1 ? recordedMeasurement(rows[0]!.raw, health).views : null;
  const hours =
    period === 'daily' &&
    details.available &&
    localViews !== null &&
    hourly?.length === 24 &&
    hourly.every((v) => Number.isInteger(v) && v >= 0) &&
    hourly.reduce((a, b) => a + b, 0) === localViews
      ? hourly
      : period === 'daily' && details.available && localViews === 0
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
        views.value === null || !app.installed
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
