jest.mock('@/data/session', () => ({
  resolvePersonalAccount: async () => require('../src/db').getDb(),
  acknowledgeGuestImports: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/data/hydration', () => ({
  hydratePersonalHistory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/sync/push', () => ({ registerPush: jest.fn().mockResolvedValue(false) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('../src/db', () => ({ getDb: jest.fn() }));
jest.mock('tracking-android', () => ({
  Tracking: {
    refreshUsage: jest.fn(),
    health: jest.fn(),
    daily: jest.fn(),
    storedDates: jest.fn(),
  },
}));
import type { SQLiteDatabase } from 'expo-sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Tracking } from 'tracking-android';
import { ApiError, type ApiClient } from '../src/api/client';
import { getDb } from '../src/db';
import { migrate } from '../src/db/migrations';
import { backupAccount } from '../src/sync/accountBackup';
import { claimAccountBackup } from '../src/sync/ownership';
import { saveGoal, loadGoals } from '../src/goals/store';
import { sqlite } from './helpers/sqlite';

let db: SQLiteDatabase;
let close: () => void;
const today = () => new Date().toISOString().slice(0, 10);
const older = () => new Date(Date.now() - 20 * 86400_000).toISOString().slice(0, 10);
const makeApi = (userId = 'account-a') => {
  let consent = false;
  let remote: Awaited<ReturnType<typeof loadGoals>> = [];
  const me = () => ({
    userId,
    profile: { rev: 3, consent: { cloudSync: consent, shareWithFriends: false } },
  });
  return {
    getMe: jest.fn(async () => ({ data: me() })),
    patchMe: jest.fn(async () => {
      consent = true;
      return { data: me() };
    }),
    getGoals: jest.fn(async () => ({ goals: remote, etag: '"g1"' })),
    putGoals: jest.fn(async (goals) => {
      remote = goals;
      return { goals };
    }),
    usageSync: jest.fn(async (days, _key: string) => ({
      results: days.map((d: { localDate: string; deviceId: string; rev: number }) => ({
        localDate: d.localDate,
        deviceId: d.deviceId,
        serverRev: d.rev,
        status: 'applied',
      })),
    })),
  };
};
const useApi = (api: ReturnType<typeof makeApi>) => api as unknown as ApiClient;
beforeEach(async () => {
  ({ db, close } = sqlite());
  await migrate(db);
  jest.mocked(getDb).mockResolvedValue(db);
  jest.clearAllMocks();
  jest.mocked(Tracking.storedDates).mockReturnValue([older(), today()]);
  jest
    .mocked(Tracking.health)
    .mockReturnValue({ apps: [], usageAccessGranted: true } as unknown as ReturnType<
      typeof Tracking.health
    >);
  jest.mocked(Tracking.daily).mockImplementation((d) => ({
    localDate: d!,
    heartbeatMinutes: 0,
    coverage: 0,
    apps: [
      {
        package: 'com.instagram.android',
        views: 12,
        adViews: 0,
        usageMs: 120000,
        surfaceMs: 0,
        unknownMs: 0,
      },
    ],
  }));
});
afterEach(() => close());

it('binds and uploads guest goals and history older than a week without a backup switch', async () => {
  await saveGoal(db, {
    goalId: '00000000-0000-4000-8000-000000000001',
    metric: 'views',
    dailyLimit: 50,
    enabled: true,
  });
  const api = makeApi();
  const result = await backupAccount(useApi(api), () => true);
  expect(result.state).toBe('saved');
  expect(api.patchMe).toHaveBeenCalledWith(
    { consent: { cloudSync: true } },
    3,
    expect.any(Function),
  );
  expect(api.putGoals.mock.calls[0]![0]).toEqual(await loadGoals(db));
  expect(api.usageSync.mock.calls[0]![0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ localDate: older(), minutes: 2, views: null, coverage: 0 }),
    ]),
  );
  expect(
    await db.getFirstAsync("SELECT value FROM settings WHERE key = 'account_backup_owner'"),
  ).toEqual({ value: 'account-a' });
  expect(api.patchMe.mock.invocationCallOrder[0]).toBeLessThan(
    api.usageSync.mock.invocationCallOrder[0]!,
  );
});
it('does not bind or upload anything while account resolution is offline', async () => {
  const api = makeApi();
  api.getMe.mockRejectedValueOnce(new ApiError(null, 'network', 'offline'));
  await expect(backupAccount(useApi(api), () => true)).rejects.toThrow('offline');
  expect(api.patchMe).not.toHaveBeenCalled();
  expect(api.usageSync).not.toHaveBeenCalled();
  expect(
    await db.getFirstAsync("SELECT value FROM settings WHERE key = 'account_backup_owner'"),
  ).toBeNull();
  await expect(backupAccount(useApi(api), () => true)).resolves.toMatchObject({ state: 'saved' });
});
it('preserves a frozen failed batch and refuses to send it through account B', async () => {
  const a = makeApi();
  a.usageSync.mockRejectedValueOnce(new ApiError(null, 'network', 'lost reply'));
  expect((await backupAccount(useApi(a), () => true)).state).toBe('pending');
  const frozen = await db.getFirstAsync('SELECT * FROM sync_batch');
  const b = makeApi('account-b');
  await expect(backupAccount(useApi(b), () => true)).rejects.toThrow('another account');
  expect(b.patchMe).not.toHaveBeenCalled();
  expect(b.getGoals).not.toHaveBeenCalled();
  expect(b.usageSync).not.toHaveBeenCalled();
  expect(await db.getFirstAsync('SELECT * FROM sync_batch')).toEqual(frozen);
  await db.runAsync('UPDATE sync_batch SET next_attempt_at = 0');
  await backupAccount(useApi(a), () => true);
  expect(a.usageSync.mock.calls[1]![0]).toEqual(a.usageSync.mock.calls[0]![0]);
  expect(a.usageSync.mock.calls[1]![1]).toBe(a.usageSync.mock.calls[0]![1]);
});
it('does not adopt an ambiguous legacy queue or delete its rows', async () => {
  await db.runAsync(
    "INSERT INTO sync_batch (id,idempotency_key,days_json,attempts,next_attempt_at) VALUES ('old', 'key', '[]', 0, 0)",
  );
  const api = makeApi();
  await expect(backupAccount(useApi(api), () => true)).rejects.toThrow('no account owner');
  expect(api.patchMe).not.toHaveBeenCalled();
  expect(api.usageSync).not.toHaveBeenCalled();
  expect(await db.getFirstAsync('SELECT id FROM sync_batch')).toEqual({ id: 'old' });
});
it('cancels after owner resolution before enabling backup or importing data', async () => {
  let allowed = true;
  const api = makeApi();
  const original = api.getMe.getMockImplementation()!;
  api.getMe.mockImplementationOnce(async () => {
    const me = await original();
    allowed = false;
    return me;
  });
  await expect(backupAccount(useApi(api), () => allowed)).rejects.toThrow('cancelled');
  expect(api.patchMe).not.toHaveBeenCalled();
  expect(api.getGoals).not.toHaveBeenCalled();
});
it('drops a late usage acknowledgement after sign-out while retaining its retry body', async () => {
  let allowed = true;
  const api = makeApi();
  api.usageSync.mockImplementationOnce(async (days) => {
    allowed = false;
    return {
      results: days.map((d: { localDate: string; deviceId: string; rev: number }) => ({
        localDate: d.localDate,
        deviceId: d.deviceId,
        serverRev: d.rev,
        status: 'applied',
      })),
    };
  });
  await expect(backupAccount(useApi(api), () => allowed)).rejects.toThrow('cancelled');
  expect(await db.getFirstAsync('SELECT id FROM sync_batch')).not.toBeNull();
  expect(
    (await db.getAllAsync<{ synced_rev: number }>('SELECT synced_rev FROM sync_days')).every(
      (d) => d.synced_rev === 0,
    ),
  ).toBe(true);
});
it('serializes separate API clients so only one frozen device-day batch is sent', async () => {
  const a = makeApi();
  const b = makeApi();
  await Promise.all([backupAccount(useApi(a), () => true), backupAccount(useApi(b), () => true)]);
  expect(a.usageSync).toHaveBeenCalledTimes(1);
  expect(b.usageSync).not.toHaveBeenCalled();
});
it('rolls back a failed ownership binding and preserves existing owner evidence', async () => {
  await db.execAsync(
    "CREATE TRIGGER fail_owner BEFORE INSERT ON settings WHEN NEW.key = 'goal_backup_owner' BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
  );
  await expect(claimAccountBackup(db, 'a')).rejects.toThrow('disk full');
  expect(
    await db.getFirstAsync("SELECT * FROM settings WHERE key = 'account_backup_owner'"),
  ).toBeNull();
});

it('retains the owner, device and exact retry payload across closing and reopening SQLite', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'driftless-backup-reopen-'));
  const path = join(folder, 'progress.sqlite');
  let fixture = sqlite(path);
  try {
    await migrate(fixture.db);
    jest.mocked(getDb).mockResolvedValue(fixture.db);
    const a = makeApi();
    a.usageSync.mockRejectedValueOnce(new ApiError(null, 'network', 'lost reply'));
    await backupAccount(useApi(a), () => true);
    const frozen = await fixture.db.getFirstAsync('SELECT * FROM sync_batch');
    const device = await fixture.db.getFirstAsync(
      "SELECT value FROM settings WHERE key = 'device_id'",
    );
    fixture.close();
    fixture = sqlite(path);
    jest.mocked(getDb).mockResolvedValue(fixture.db);
    await migrate(fixture.db);
    const b = makeApi('account-b');
    await expect(backupAccount(useApi(b), () => true)).rejects.toThrow('another account');
    expect(b.usageSync).not.toHaveBeenCalled();
    expect(await fixture.db.getFirstAsync('SELECT * FROM sync_batch')).toEqual(frozen);
    expect(
      await fixture.db.getFirstAsync("SELECT value FROM settings WHERE key = 'device_id'"),
    ).toEqual(device);
    await fixture.db.runAsync('UPDATE sync_batch SET next_attempt_at = 0');
    const resumedA = makeApi();
    await expect(backupAccount(useApi(resumedA), () => true)).resolves.toMatchObject({
      state: 'saved',
    });
    expect(resumedA.usageSync.mock.calls[0]!.slice(0, 2)).toEqual(
      a.usageSync.mock.calls[0]!.slice(0, 2),
    );
    expect(await fixture.db.getFirstAsync('SELECT * FROM sync_batch')).toBeNull();
  } finally {
    fixture.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
it('resumes a guest import larger than one run without duplicating device days', async () => {
  const dates = Array.from({ length: 100 }, (_, i) =>
    new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10),
  ).sort();
  jest.mocked(Tracking.storedDates).mockReturnValue(dates);
  const api = makeApi();
  expect((await backupAccount(useApi(api), () => true)).state).toBe('pending');
  expect(api.usageSync).toHaveBeenCalledTimes(3);
  expect((await backupAccount(useApi(api), () => true)).state).toBe('saved');
  const sent = api.usageSync.mock.calls.flatMap(([days]) => days as { localDate: string }[]);
  expect(sent).toHaveLength(100);
  expect(sent.map((d) => d.localDate).sort()).toEqual(dates);
  await backupAccount(useApi(api), () => true);
  expect(api.usageSync).toHaveBeenCalledTimes(4);
});
it('honors an existing legacy goal owner when adopting its pending usage queue', async () => {
  await db.runAsync("INSERT INTO settings VALUES ('goal_backup_owner', 'account-a')");
  await db.runAsync(
    "INSERT INTO sync_batch (id,idempotency_key,days_json,attempts,next_attempt_at) VALUES ('old', 'key', '[]', 0, 0)",
  );
  await expect(claimAccountBackup(db, 'account-b')).rejects.toThrow('another account');
  await claimAccountBackup(db, 'account-a');
  expect(
    await db.getFirstAsync("SELECT value FROM settings WHERE key = 'account_backup_owner'"),
  ).toEqual({ value: 'account-a' });
  expect(await db.getFirstAsync('SELECT id FROM sync_batch')).toEqual({ id: 'old' });
});
it('cancels an ownership transaction if sign-out occurs while the binding is being written', async () => {
  let allowed = true;
  const run = db.runAsync.bind(db);
  jest.spyOn(db, 'runAsync').mockImplementation(async (...args) => {
    const result = await run(...args);
    if (args[0].includes('INSERT OR IGNORE INTO settings')) allowed = false;
    return result;
  });
  await expect(claimAccountBackup(db, 'account-a', () => allowed)).rejects.toThrow('cancelled');
  expect(
    await db.getAllAsync(
      "SELECT * FROM settings WHERE key IN ('account_backup_owner', 'goal_backup_owner')",
    ),
  ).toEqual([]);
});
