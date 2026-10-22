jest.mock('tracking-android', () => ({
  Tracking: {
    health: jest.fn(),
    daily: jest.fn(),
    refreshUsage: jest.fn(),
    localActivityDetails: jest.fn(),
    wrappedDetails: jest.fn(),
  },
}));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
import { completePhoneWrap, peakWindow, clock, personality, readPhoneWrap } from '@/wrapped/model';
import { Tracking, type Daily, type TrackingHealth } from 'tracking-android';
import { aggregateDay } from '@/sync/aggregate';
import { latestWrapEnd, summarizeWrap, wrapBounds } from '@siddiq3/driftless-contracts/domain';
const day = (localDate: string, views: number | null, deviceId = 'phone') => ({
  localDate,
  views,
  minutes: views,
  deviceId,
});
const session = (startMs: number, endMs: number) => ({
  package: 'instagram',
  startMs,
  endMs,
  startMinute: 1200,
  endMinute: 1208,
  views: 2,
});

test('completed local periods respect Monday/Sunday and year boundaries', () => {
  expect(latestWrapEnd('daily', '2026-01-01')).toBe('2025-12-31');
  expect(latestWrapEnd('weekly', '2026-10-19')).toBe('2026-10-18');
  expect(latestWrapEnd('weekly', '2026-10-18')).toBe('2026-10-11');
  expect(wrapBounds('weekly', '2026-10-18')).toMatchObject({
    from: '2026-10-12',
    previousFrom: '2026-10-05',
    previousTo: '2026-10-11',
  });
});
test('zero, unknown and partial days remain distinct; only complete periods compare', () => {
  expect(summarizeWrap('daily', '2026-10-18', []).views).toEqual({ value: null, trackedDays: 0 });
  expect(summarizeWrap('daily', '2026-10-18', [day('2026-10-18', 0)]).views).toEqual({
    value: 0,
    trackedDays: 1,
  });
  const partial = summarizeWrap('weekly', '2026-10-18', [
    day('2026-10-18', 10),
    day('2026-10-17', null),
  ]);
  expect(partial.views).toEqual({ value: 10, trackedDays: 1 });
  expect(partial.changePercent).toBeNull();
  expect(
    summarizeWrap('daily', '2026-10-18', [day('2026-10-17', 20), day('2026-10-18', 10)])
      .changePercent,
  ).toBe(-50);
  expect(
    summarizeWrap('daily', '2026-10-18', [day('2026-10-17', 0), day('2026-10-18', 10)])
      .changePercent,
  ).toBeNull();
});
test('device days add once, with unknown device coverage not hidden', () => {
  expect(
    summarizeWrap('daily', '2026-10-18', [
      day('2026-10-18', 10),
      day('2026-10-18', 10),
      day('2026-10-18', 5, 'other'),
    ]).views.value,
  ).toBe(15);
  expect(
    summarizeWrap('daily', '2026-10-18', [day('2026-10-18', 10), day('2026-10-18', null, 'other')])
      .views.value,
  ).toBeNull();
});
test('hourly cards require complete counts; quick returns use real timestamps', () => {
  const hours = Array(24).fill(0);
  hours[20] = 4;
  const recap = completePhoneWrap('daily', '2026-10-18', [day('2026-10-18', 4)], [], {
    available: true,
    days: [
      {
        localDate: '2026-10-18',
        hourlyViews: hours,
        sessions: [session(0, 1000), session(1000 + 5 * 60000, 400000), session(1000000, 1100000)],
      },
    ],
  });
  expect(recap.returnCount).toBe(1);
  expect(recap.hours).toEqual(hours);
  expect(personality(recap).title).toBe('THE NIGHT OWL');
  expect(
    completePhoneWrap('daily', '2026-10-18', [day('2026-10-18', 6)], [], {
      available: true,
      days: [{ localDate: '2026-10-18', hourlyViews: hours, sessions: [] }],
    }).hours,
  ).toBeNull();
});
test('peak never joins non-contiguous midnight ends; clocks handle midnight', () => {
  const hours = Array(24).fill(0);
  hours[0] = 4;
  hours[23] = 5;
  expect(peakWindow(hours)).toEqual({ start: 22, end: 24, percent: 56 });
  expect(peakWindow(Array(24).fill(0))).toBeNull();
  expect(peakWindow(null)).toBeNull();
  expect(clock(1440)).toBe('12am');
  expect(clock(1268)).toBe('9:08pm');
});

test.each(['daily', 'weekly'] as const)(
  '%s local wraps show stored counts, apps and hours without cloud approval',
  (period) => {
    const health = {
      apps: [{ package: 'youtube', label: 'YouTube Shorts', installed: true, validated: false }],
      usageAccessGranted: false,
    } as TrackingHealth;
    const raw: Daily = {
      localDate: '2026-10-21',
      heartbeatMinutes: 1,
      coverage: 0.1,
      apps: [
        { package: 'youtube', views: 6, adViews: 1, surfaceMs: 9000, unknownMs: 0, usageMs: 0 },
      ],
    };
    jest.mocked(Tracking.health).mockReturnValue(health);
    jest
      .mocked(Tracking.daily)
      .mockImplementation((date) =>
        date === raw.localDate
          ? raw
          : { localDate: date!, heartbeatMinutes: 0, coverage: 0, apps: [] },
      );
    jest.mocked(Tracking.localActivityDetails).mockReturnValue({
      available: true,
      days: [
        {
          localDate: raw.localDate,
          hourlyViews: Array.from({ length: 24 }, (_, i) => (i === 8 ? 6 : 0)),
          sessions: [{ ...session(1000, 10000), package: 'youtube', views: 6 }],
        },
      ],
    });
    const recap = readPhoneWrap(period, '2026-10-21');
    expect(recap.views).toEqual({ value: 6, trackedDays: 1 });
    expect(recap.apps).toEqual([{ package: 'youtube', label: 'YouTube Shorts', views: 6 }]);
    expect(recap.hours?.[8]).toBe(6);
    expect(recap.sessions).toHaveLength(1);
    expect(aggregateDay(raw, health, 'phone', 'UTC').views).toBeNull();
  },
);

test('expired heartbeats or a failed usage refresh do not hide retained video counts', () => {
  jest.mocked(Tracking.refreshUsage).mockImplementationOnce(() => {
    throw new Error('permission unavailable');
  });
  jest.mocked(Tracking.health).mockReturnValue({
    apps: [{ package: 'youtube', label: 'YouTube Shorts', installed: false, validated: false }],
    usageAccessGranted: false,
  } as TrackingHealth);
  jest.mocked(Tracking.daily).mockImplementation((date) => ({
    localDate: date!,
    heartbeatMinutes: 0,
    coverage: 0,
    apps:
      date === '2026-10-21'
        ? [{ package: 'youtube', views: 6, adViews: 0, surfaceMs: 0, unknownMs: 0, usageMs: 0 }]
        : [],
  }));
  const recap = readPhoneWrap('daily', '2026-10-21');
  expect(recap.views.value).toBe(6);
  expect(recap.apps[0]?.views).toBe(6);
});

test('hourly totals ignore other dates and reject malformed detail without inventing zero counts', () => {
  const hours = Array.from({ length: 24 }, (_, i) => (i === 8 ? 6 : 0));
  const rows = [day('2026-10-21', 6)];
  expect(
    completePhoneWrap('daily', '2026-10-21', rows, [], {
      available: true,
      days: [
        { localDate: '2026-10-20', hourlyViews: hours, sessions: [] },
        { localDate: '2026-10-21', hourlyViews: hours, sessions: [] },
      ],
    }).hours,
  ).toEqual(hours);
  expect(
    completePhoneWrap('daily', '2026-10-21', rows, [], {
      available: true,
      days: [{ localDate: '2026-10-21', hourlyViews: [6], sessions: [] }],
    }).hours,
  ).toBeNull();
  expect(
    completePhoneWrap('weekly', '2026-10-18', [], [], { available: true, days: [] }).views.value,
  ).toBeNull();
});
