import {
  addDays,
  latestWrapEnd,
  localDateOf,
  summarizeWrap,
  wrapBounds,
  type WrapPeriod,
} from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import { Tracking, type WrapSession, type WrapDetails } from 'tracking-android';
import { aggregateDay } from '@/sync/aggregate';
import { currentTimeZone } from '@/sync/run';

export type Recap = Omit<v1.WrapResponse, 'source'> & {
  source: 'phone' | 'synced';
  apps: { package: string; label: string; views: number }[];
  hours: number[] | null;
  sessions: WrapSession[];
  returnCount: number;
};
export function defaultEnd(period: WrapPeriod) {
  return latestWrapEnd(period, localDateOf(Date.now(), currentTimeZone()));
}
/** Uses existing local counts; never needs login or silently uploads session details. */
export function readPhoneWrap(period: WrapPeriod, end: string): Recap {
  const bounds = wrapBounds(period, end);
  const health = Tracking.health();
  Tracking.refreshUsage(30);
  const days = [];
  const appTotals = new Map<string, number>();
  for (let date = bounds.previousFrom; date <= end; date = addDays(date, 1)) {
    const daily = Tracking.daily(date);
    const day = aggregateDay(daily, health, 'this-phone', currentTimeZone());
    days.push(day);
    if (date >= bounds.from && day.views !== null) {
      for (const app of daily.apps)
        if (health.apps.some((a) => a.package === app.package && a.installed && a.validated))
          appTotals.set(app.package, (appTotals.get(app.package) ?? 0) + app.views);
    }
  }
  let details: WrapDetails = { available: false, days: [] };
  try {
    details = Tracking.wrappedDetails(bounds.from, end) ?? details;
  } catch {
    /* Older native binaries retain aggregate recaps. */
  }
  return completePhoneWrap(
    period,
    end,
    days,
    [...appTotals].map(([pkg, views]) => ({
      package: pkg,
      views,
      label: health.apps.find((a) => a.package === pkg)?.label ?? 'App',
    })),
    details,
  );
}
export function completePhoneWrap(
  period: WrapPeriod,
  end: string,
  days: Parameters<typeof summarizeWrap>[2],
  apps: Recap['apps'],
  details: WrapDetails,
): Recap {
  const summary = summarizeWrap(period, end, days);
  const hourly = Array.from({ length: 24 }, (_, i) =>
    details.days.reduce((n, day) => n + (day.hourlyViews[i] ?? 0), 0),
  );
  const measuredDetails = details.available
    ? details.days.filter(
        (d) =>
          d.localDate >= summary.from &&
          d.localDate <= summary.to &&
          days.some((row) => row.localDate === d.localDate && row.views !== null),
      )
    : [];
  const sessions = measuredDetails.flatMap((d) => d.sessions).sort((a, b) => a.startMs - b.startMs);
  let returnCount = 0;
  for (let i = 1; i < sessions.length; i++) {
    const gap = sessions[i]!.startMs - sessions[i - 1]!.endMs;
    if (gap > 0 && gap <= 5 * 60_000) returnCount++;
  }
  // A timestamped subset cannot be used to claim a percentage of all counted videos.
  const hours =
    details.available && hourly.reduce((a, b) => a + b, 0) === summary.views.value ? hourly : null;
  return {
    ...summary,
    source: 'phone',
    apps: apps.sort((a, b) => b.views - a.views),
    hours,
    sessions,
    returnCount,
  };
}
export function peakWindow(hours: number[] | null) {
  if (!hours || hours.reduce((a, b) => a + b, 0) === 0) return null;
  let start = 0;
  let count = 0;
  for (let i = 0; i < 23; i++) {
    const pair = hours[i]! + hours[i + 1]!;
    if (pair > count) {
      start = i;
      count = pair;
    }
  }
  return {
    start,
    end: start + 2,
    percent: Math.round((count / hours.reduce((a, b) => a + b, 0)) * 100),
  };
}
export const clock = (value: number) => {
  const minute = ((value % 1440) + 1440) % 1440;
  return `${Math.floor(minute / 60) % 12 || 12}${minute % 60 ? ':' + String(minute % 60).padStart(2, '0') : ''}${minute < 720 ? 'am' : 'pm'}`;
};
export function personality(recap: Recap) {
  if (recap.returnCount >= 3)
    return {
      title: 'THE BOOMERANG',
      detail: 'A quick break. Then back again.',
      fact: `BACK IN 5 MINUTES · ${recap.returnCount} TIMES`,
    };
  const peak = peakWindow(recap.hours);
  if (
    peak &&
    recap.hours &&
    recap.hours.reduce((sum, count, hour) => sum + (hour >= 20 || hour < 6 ? count : 0), 0) >
      recap.hours.reduce((a, b) => a + b, 0) / 2
  )
    return {
      title: 'THE NIGHT OWL',
      detail: 'Your busiest window came after dark.',
      fact: `${clock(peak.start * 60)}–${clock(peak.end * 60)} · ${peak.percent}% OF VIDEOS`,
    };
  const longest = [...recap.sessions].sort(
    (a, b) => b.endMs - b.startMs - (a.endMs - a.startMs),
  )[0];
  if (longest && longest.endMs - longest.startMs >= 15 * 60_000)
    return {
      title: 'THE DEEP DIVER',
      detail: 'One scroll turned into a longer stay.',
      fact: `${Math.floor((longest.endMs - longest.startMs) / 60_000)} MINUTE RECORDED STREAK`,
    };
  return {
    title: 'THE EXPLORER',
    detail: 'A little here. A little there.',
    fact: `${recap.sessions.length} RECORDED SESSIONS`,
  };
}
