import type { Daily, TrackingHealth } from 'tracking-android';
import { activityData } from '../src/activity/model';
import { ApiError } from '../src/api/client';
import { aggregateDay, valuesKey } from '../src/sync/aggregate';
import { flush, MemorySyncRepo, stage, type SyncClient } from '../src/sync/engine';

jest.mock('expo-sqlite', () => ({}));

const DEV = '0192f0a4-7c1e-7a3b-9c2d-1e2f3a4b5c6d';
const IG = 'com.instagram.android';
const YT = 'com.google.android.youtube';

const health = (over: Partial<TrackingHealth> = {}): TrackingHealth => ({
  engineVersion: 1,
  implemented: true,
  rulesVersion: 1,
  disclosureAccepted: true,
  serviceEnabled: true,
  serviceRunning: true,
  lastConnectedMs: 0,
  lastEventMs: 0,
  heartbeatMinutesToday: 0,
  usageAccessGranted: true,
  debugBuild: false,
  apps: [
    { package: IG, label: 'IG', installed: true, version: '1', validated: false },
    { package: YT, label: 'YT', installed: true, version: '1', validated: false },
  ],
  ...over,
});

const daily = (over: Partial<Daily> = {}): Daily => ({
  localDate: '2026-10-18',
  heartbeatMinutes: 600,
  coverage: 0.9,
  apps: [
    {
      package: IG,
      views: 20,
      adViews: 2,
      surfaceMs: 600_000,
      unknownMs: 60_000,
      usageMs: 1_500_000,
    },
    { package: YT, views: 10, adViews: 1, surfaceMs: 300_000, unknownMs: 0, usageMs: 900_000 },
  ],
  ...over,
});

describe('aggregateDay (what may leave the phone)', () => {
  it('never sends video counts for unvalidated app versions', () => {
    const a = aggregateDay(daily(), health(), DEV, 'Asia/Kolkata');
    expect(a.views).toBeNull();
    expect(a.adViews).toBeNull();
    expect(a.minutes).toBe(40); // UsageStats: 25 + 15 min
    expect(a.coverage).toBe(1);
  });

  it('sends counts only for validated apps', () => {
    const h = health({
      apps: [
        { package: IG, label: 'IG', installed: true, version: '1', validated: true },
        health().apps[1]!,
      ],
    });
    const a = aggregateDay(daily(), h, DEV, 'Asia/Kolkata');
    expect(a).toMatchObject({ views: 20, adViews: 2, coverage: 0.9 });
  });

  it('falls back to counter minutes without Usage Access, and to null when nothing ran', () => {
    expect(aggregateDay(daily(), health({ usageAccessGranted: false }), DEV, 'UTC').minutes).toBe(
      16,
    );
    const none = aggregateDay(
      daily({ heartbeatMinutes: 0 }),
      health({ usageAccessGranted: false }),
      DEV,
      'UTC',
    );
    expect(none.minutes).toBeNull();
    expect(none.views).toBeNull();
  });

  it('a day with no rows is not tracked, even with Usage Access (never 0 minutes)', () => {
    const empty = aggregateDay(
      { localDate: '2026-01-01', heartbeatMinutes: 0, coverage: 0, apps: [] },
      health(),
      DEV,
      'UTC',
    );
    expect(empty.minutes).toBeNull();
    expect(empty.coverage).toBe(0);
  });

  it('clamps to contract limits', () => {
    const big = daily({
      apps: [
        { package: IG, views: 0, adViews: 0, surfaceMs: 0, unknownMs: 0, usageMs: 3 * 86_400_000 },
      ],
    });
    expect(aggregateDay(big, health(), DEV, 'UTC').minutes).toBe(1440);
  });
});

const day = (localDate: string, minutes: number) => ({
  localDate,
  tz: 'UTC',
  platform: 'android' as const,
  deviceId: DEV,
  views: null,
  adViews: null,
  minutes,
  coverage: 1,
});

let n = 0;
const ids = { uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };

const okClient = (): SyncClient & { calls: Array<{ days: unknown[]; key: string }> } => {
  const calls: Array<{ days: unknown[]; key: string }> = [];
  return {
    calls,
    usageSync: async (days, key) => {
      calls.push({ days, key });
      return {
        results: days.map((d) => ({
          localDate: d.localDate,
          deviceId: d.deviceId,
          status: 'applied' as const,
          serverRev: d.rev,
        })),
      };
    },
  };
};

describe('sync engine', () => {
  it('stages only changed days and bumps rev', async () => {
    const repo = new MemorySyncRepo();
    expect(await stage(repo, [day('2026-10-17', 10), day('2026-10-18', 5)])).toBe(2);
    expect(await stage(repo, [day('2026-10-17', 10), day('2026-10-18', 6)])).toBe(1);
    expect((await repo.getDay('2026-10-18'))!.rev).toBe(2);
    expect(valuesKey(day('a', 1))).not.toBe(valuesKey(day('a', 2)));
  });

  it('sends pending days and marks them synced', async () => {
    const repo = new MemorySyncRepo();
    const c = okClient();
    await stage(repo, [day('2026-10-17', 10)]);
    expect(await flush(repo, c, ids, 1000)).toMatchObject({ kind: 'sent', applied: 1 });
    expect(await repo.pendingDays()).toEqual([]);
    expect(await flush(repo, c, ids, 2000)).toEqual({ kind: 'idle' });
    expect(c.calls).toHaveLength(1);
  });

  it('a network failure keeps the frozen batch and retries with the SAME Idempotency-Key', async () => {
    const repo = new MemorySyncRepo();
    await stage(repo, [day('2026-10-17', 10)]);
    const keys: string[] = [];
    let fail = true;
    const c: SyncClient = {
      usageSync: async (days, key) => {
        keys.push(key);
        if (fail) throw new ApiError(null, 'network', 'offline');
        return {
          results: days.map((d) => ({
            localDate: d.localDate,
            deviceId: d.deviceId,
            status: 'applied' as const,
            serverRev: d.rev,
          })),
        };
      },
    };
    const first = await flush(repo, c, ids, 1000, () => 0);
    expect(first).toMatchObject({ kind: 'deferred', attempts: 1 });
    // Values change meanwhile; the in-flight batch must not change.
    await stage(repo, [day('2026-10-17', 12)]);
    expect(await flush(repo, c, ids, 1001)).toMatchObject({ kind: 'deferred', reason: 'backoff' });
    fail = false;
    expect(await flush(repo, c, ids, 1_000_000)).toMatchObject({ kind: 'sent' });
    expect(keys[0]).toBe(keys[1]);
    // The newer value (rev 2) is still pending and goes in a NEW batch with a new key.
    expect((await repo.pendingDays()).map((d) => d.rev)).toEqual([2]);
    await flush(repo, c, ids, 1_000_001);
    expect(keys[2]).not.toBe(keys[0]);
    expect(await repo.pendingDays()).toEqual([]);
  });

  it('a permanent rejection drops the batch but keeps the data pending', async () => {
    const repo = new MemorySyncRepo();
    await stage(repo, [day('2026-10-17', 10)]);
    const c: SyncClient = {
      usageSync: async () => {
        throw new ApiError(403, 'consent_required', 'off');
      },
    };
    expect(await flush(repo, c, ids, 1)).toEqual({
      kind: 'rejected',
      status: 403,
      code: 'consent_required',
    });
    expect(repo.batch).toBeNull();
    expect(await repo.pendingDays()).toHaveLength(1);
  });

  it('a stale result moves the local rev past the server', async () => {
    const repo = new MemorySyncRepo();
    await stage(repo, [day('2026-10-17', 10)]);
    const c: SyncClient = {
      usageSync: async (days) => ({
        results: days.map((d) => ({
          localDate: d.localDate,
          deviceId: d.deviceId,
          status: 'stale' as const,
          serverRev: 9,
        })),
      }),
    };
    expect(await flush(repo, c, ids, 1)).toMatchObject({ kind: 'sent', stale: 1 });
    expect((await repo.getDay('2026-10-17'))!.rev).toBe(10);
    expect(await repo.pendingDays()).toHaveLength(1);
  });

  it('batches at most 31 days', async () => {
    const repo = new MemorySyncRepo();
    const c = okClient();
    const days = Array.from({ length: 40 }, (_, i) =>
      day(`2026-0${i < 31 ? 8 : 9}-${String((i % 31) + 1).padStart(2, '0')}`, i),
    );
    await stage(repo, days);
    await flush(repo, c, ids, 1);
    expect(c.calls[0]!.days).toHaveLength(31);
    expect(await repo.pendingDays()).toHaveLength(9);
  });
});

it('syncing and restaging local activity neither validates it nor duplicates local hourly counts', async () => {
  const raw = daily();
  const h = health();
  const hourlyViews = Array<number>(24).fill(0);
  hourlyViews[12] = 30;
  const details = {
    available: true,
    days: [{ localDate: raw.localDate, hourlyViews, sessions: [] }],
  };
  const readLocal = () => activityData('daily', 0, raw.localDate, h, () => raw, details);
  const before = readLocal();
  expect(before.views.value).toBe(30);
  expect(before.bars[12]!.value).toBe(30);
  const repo = new MemorySyncRepo();
  const client = okClient();
  await stage(repo, [aggregateDay(raw, h, DEV, 'Asia/Kolkata')]);
  expect(await flush(repo, client, ids, 1000)).toMatchObject({ kind: 'sent' });
  expect(await stage(repo, [aggregateDay(raw, h, DEV, 'Asia/Kolkata')])).toBe(0);
  expect(await flush(repo, client, ids, 2000)).toEqual({ kind: 'idle' });
  expect(client.calls).toHaveLength(1);
  expect(client.calls[0]!.days[0]).toMatchObject({ views: null, adViews: null });
  expect(readLocal()).toEqual(before);
});

it('keeps the original retry body on a partial response without losing successful acknowledgements', async () => {
  const repo = new MemorySyncRepo();
  await stage(repo, [day('2026-10-17', 5), day('2026-10-18', 6)]);
  let body: unknown;
  let key = '';
  let attempts = 0;
  const c: SyncClient = {
    usageSync: async (days, idempotencyKey) => {
      attempts++;
      if (attempts === 1) {
        body = days;
        key = idempotencyKey;
      } else {
        expect(days).toEqual(body);
        expect(idempotencyKey).toBe(key);
      }
      return {
        results: days.slice(0, attempts === 1 ? 1 : 2).map((d) => ({
          localDate: d.localDate,
          deviceId: d.deviceId,
          status: 'applied' as const,
          serverRev: d.rev,
        })),
      };
    },
  };
  const first = await flush(repo, c, ids, 1, () => 0);
  expect(first.kind).toBe('deferred');
  expect((await repo.getDay('2026-10-17'))!.syncedRev).toBe(1);
  expect(await repo.getBatch()).not.toBeNull();
  await flush(repo, c, ids, 100000, () => 0);
  expect(await repo.pendingDays()).toHaveLength(0);
  expect(await repo.getBatch()).toBeNull();
});
