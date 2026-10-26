import { createIOSTracking } from '../modules/tracking-android/src/iosAdapter';

function fixture() {
  const values = new Map<string, string>();
  const store = {
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const hooks = { selectScope: jest.fn(), reset: jest.fn() };
  return { create: () => createIOSTracking(store, hooks), hooks };
}

test('iPhone missing observations remain unavailable and never become uploadable zero counts', () => {
  const tracking = fixture().create();
  expect(tracking.runtimeSupport()).toEqual({ counting: false, minutes: false, blocking: false });
  expect(tracking.daily('2026-10-26')).toMatchObject({
    measurementStatus: 'unavailable',
    usageObserved: false,
    apps: [],
  });
  expect(tracking.personalMeasurement('2026-10-26')).toBeNull();
  expect(tracking.accountUsageContributions()).toEqual([]);
  expect(tracking.backupDaily('2026-10-26').apps).toEqual([]);
});

test('account history survives reload, stays isolated and is never exposed as phone observations', () => {
  const f = fixture(),
    tracking = f.create();
  tracking.selectDataScope('account:first');
  const day = {
    localDate: '2026-10-26',
    deviceId: 'android-phone',
    rev: 2,
    views: 40,
    minutes: 12,
  };
  tracking.mergeSyncedDays([day], 'account:first');
  tracking.mergeSyncedDays([{ ...day, rev: 1, views: 900 }], 'account:first');
  expect(f.create().personalMeasurement(day.localDate)).toMatchObject({
    views: 40,
    minutes: 12,
    source: 'account',
    status: 'synced',
  });
  expect(tracking.backupDaily(day.localDate).apps).toEqual([]);
  tracking.selectDataScope('account:second');
  expect(tracking.personalMeasurement(day.localDate)).toBeNull();
  expect(() => tracking.mergeSyncedDays([day], 'account:first')).toThrow('cancelled');
  tracking.selectDataScope('account:first');
  expect(tracking.personalMeasurement(day.localDate)?.views).toBe(40);
  expect(f.hooks.selectScope).toHaveBeenCalledWith('account:second');
});

test('reset clears restored history, advances the restore fence and releases native pauses', () => {
  const f = fixture(),
    tracking = f.create();
  tracking.selectDataScope('account:first');
  tracking.mergeSyncedDays(
    [{ localDate: '2026-10-26', deviceId: 'a', rev: 1, views: 5, minutes: null }],
    'account:first',
  );
  tracking.resetAccountHistory();
  expect(tracking.personalMeasurement('2026-10-26')).toBeNull();
  expect(tracking.accountUsageInfo()).toMatchObject({ resetGeneration: 1, active: false });
  expect(tracking.accountUsageInfo().cutoffMs).toBeGreaterThan(0);
  expect(f.hooks.reset).toHaveBeenCalled();
});
