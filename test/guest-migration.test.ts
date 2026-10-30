jest.mock('@/db', () => ({ getStorageDb: jest.fn(), getDb: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('@/sync/push', () => ({ registerPush: jest.fn().mockResolvedValue(false) }));
jest.mock('@/sync/accountUsage', () => ({
  syncAccountUsage: jest.fn().mockResolvedValue('Ready'),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    dataScope: jest.fn(),
    selectDataScope: jest.fn(),
    setLimits: jest.fn(),
    importGuestScope: jest.fn(),
    refreshUsage: jest.fn(),
    health: jest.fn(),
    storedDates: jest.fn(),
    daily: jest.fn(),
    setSourceDevice: jest.fn(),
    mergeSyncedDays: jest.fn(),
  },
}));
import { Tracking } from 'tracking-android';
import { getStorageDb, getDb } from '@/db';
import { migrate } from '@/db/migrations';
import { storageScope, selectStorageScope, scopedDatabase } from '@/db/scope';
import { selectPersonalSession, resolvePersonalAccount } from '@/data/session';
import { saveGoal } from '@/goals/store';
import { backupAccount } from '@/sync/accountBackup';
import type { ApiClient } from '@/api/client';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { sqlite } from './helpers/sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
const incarnation = '00000000-0000-4000-8000-000000000001';
const goalId = '00000000-0000-4000-8000-000000000002';
const target = `account:${incarnation}`;
let db: SQLiteDatabase, close: () => void, native: string, filename: string;
const today = () => new Date().toISOString().slice(0, 10);
let serverDays: any[], serverGoals: any[];
let failUpload = false,
  failRead = false;
let api: ApiClient;
beforeEach(async () => {
  filename = `/private/tmp/scrollsnooze-guest-${randomUUID()}.db`;
  ({ db, close } = sqlite(filename));
  await migrate(db);
  jest.clearAllMocks();
  native = 'guest:current';
  selectStorageScope(native);
  jest.mocked(getStorageDb).mockResolvedValue(db);
  jest.mocked(getDb).mockImplementation(async () => scopedDatabase(db, storageScope()));
  jest.mocked(Tracking.dataScope).mockImplementation(() => native);
  jest.mocked(Tracking.selectDataScope).mockImplementation((s) => {
    native = s;
  });
  jest.mocked(Tracking.health).mockReturnValue({
    usageAccessGranted: true,
    apps: [{ package: 'com.instagram.android', installed: true, validated: false }],
  } as never);
  jest.mocked(Tracking.storedDates).mockReturnValue([today()]);
  jest.mocked(Tracking.daily).mockImplementation((d) => ({
    localDate: d!,
    coverage: 1,
    heartbeatMinutes: 5,
    apps:
      d === today()
        ? [
            {
              package: 'com.instagram.android',
              views: 50,
              adViews: 0,
              usageMs: 120000,
              surfaceMs: 120000,
              unknownMs: 0,
            },
          ]
        : [],
  }));
  failUpload = false;
  failRead = false;
  serverDays = [];
  serverGoals = [];
  api = {
    incarnation,
    getMe: jest.fn(async () => ({
      data: {
        userId: 'fixture-owner',
        incarnation,
        profile: { rev: 1, consent: { cloudSync: true } },
      },
    })),
    getGoals: jest.fn(async () => ({ goals: serverGoals, etag: '"1"' })),
    putGoals: jest.fn(async (goals) => {
      serverGoals = goals;
      return { goals };
    }),
    usageSync: jest.fn(async (days) => {
      if (failUpload) throw new Error('offline');
      for (const d of days) {
        const old = serverDays.find(
          (r) => r.deviceId === d.deviceId && r.localDate === d.localDate,
        );
        if (!old) serverDays.push(d);
        else if (old.rev < d.rev) Object.assign(old, d);
      }
      return {
        results: days.map((d: { localDate: string; deviceId: string; rev: number }) => ({
          localDate: d.localDate,
          deviceId: d.deviceId,
          serverRev: d.rev,
          status: 'applied',
        })),
      };
    }),
    usageHistory: jest.fn(async () => {
      if (failRead) throw new Error('download failed');
      return { days: serverDays };
    }),
  } as unknown as ApiClient;
  await selectPersonalSession(null);
  await saveGoal(scopedDatabase(db, native), {
    goalId,
    metric: 'views',
    dailyLimit: 50,
    enabled: true,
  });
  await selectPersonalSession('google-fixture');
  await resolvePersonalAccount('fixture-owner', incarnation, () => true, true);
});
afterEach(() => {
  close();
  unlinkSync(filename);
  selectStorageScope('legacy');
});
it('50 guest Reels and goals survive upload/readback and concurrent repeat backup', async () => {
  await Promise.all([backupAccount(api, () => true), backupAccount(api, () => true)]);
  expect(serverDays).toHaveLength(1);
  expect(serverDays[0].personalViews).toBe(50);
  expect(serverGoals).toMatchObject([{ goalId, dailyLimit: 50 }]);
  expect(await db.getFirstAsync('SELECT views FROM daily_cache WHERE scope=?', target)).toEqual({
    views: 50,
  });
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'verified' });
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'guest:current')).toHaveLength(
    1,
  );
});
it('registration/import followed by upload failure preserves source and retries the same batch', async () => {
  failUpload = true;
  expect((await backupAccount(api, () => true)).state).toBe('pending');
  const frozen = await db.getFirstAsync('SELECT days_json,idempotency_key FROM sync_batch');
  expect(frozen).toBeTruthy();
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'copied' });
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'guest:current')).toHaveLength(
    1,
  );
  failUpload = false;
  await db.runAsync('UPDATE sync_batch SET next_attempt_at=0');
  await backupAccount(api, () => true);
  expect(serverDays).toHaveLength(1);
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'verified' });
});
it('lost readback never acknowledges the guest source and resumes without duplicating remote records', async () => {
  failRead = true;
  await expect(backupAccount(api, () => true)).rejects.toThrow('download failed');
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'copied' });
  failRead = false;
  await backupAccount(api, () => true);
  expect(serverDays).toHaveLength(1);
  expect(serverGoals).toHaveLength(1);
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'verified' });
});
it('existing remote device history is preserved alongside the guest device identity', async () => {
  serverDays.push({
    localDate: today(),
    deviceId: '00000000-0000-4000-8000-000000000003',
    platform: 'android',
    tz: 'UTC',
    views: null,
    personalViews: 7,
    adViews: null,
    minutes: 1,
    coverage: 1,
    rev: 1,
  });
  await backupAccount(api, () => true);
  await backupAccount(api, () => true);
  expect(serverDays).toHaveLength(2);
  expect(
    await db.getFirstAsync('SELECT SUM(views) AS views FROM daily_cache WHERE scope=?', target),
  ).toEqual({ views: 57 });
});

it('reopens its durable import journal after process termination and finishes readback once', async () => {
  failRead = true;
  await expect(backupAccount(api, () => true)).rejects.toThrow('download failed');
  close();
  ({ db, close } = sqlite(filename));
  await migrate(db);
  jest.mocked(getStorageDb).mockResolvedValue(db);
  await selectPersonalSession('google-fixture');
  await resolvePersonalAccount('fixture-owner', incarnation, () => true, true);
  failRead = false;
  await backupAccount(api, () => true);
  expect(serverDays).toHaveLength(1);
  expect(serverGoals).toHaveLength(1);
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'verified' });
});

it('keeps auth-window recording in the current guest source while JS remains quarantined', async () => {
  await selectPersonalSession(null);
  const guest = native;
  await selectPersonalSession('google-fixture');
  expect(storageScope()).toMatch(/^pending:/);
  expect(native).toBe(guest);
  const pending = await db.getFirstAsync<{ source_scope: string }>(
    'SELECT source_scope FROM data_scopes WHERE scope=?',
    storageScope(),
  );
  expect(pending?.source_scope).toBe(guest);
  const beforeSelections = jest.mocked(Tracking.selectDataScope).mock.calls.length;
  await resolvePersonalAccount('fixture-owner', incarnation, () => true, true);
  expect(Tracking.importGuestScope).toHaveBeenCalledWith(guest, target, false);
  const selections = jest.mocked(Tracking.selectDataScope).mock.invocationCallOrder;
  const imports = jest.mocked(Tracking.importGuestScope).mock.invocationCallOrder;
  const targetSelection = jest
    .mocked(Tracking.selectDataScope)
    .mock.calls.findIndex(([scope], index) => index >= beforeSelections && scope === target);
  expect(targetSelection).toBeGreaterThanOrEqual(0);
  expect(selections[targetSelection]).toBeLessThan(imports.at(-1)!);
});

it('does not verify a migration if server readback loses its platform breakdown', async () => {
  jest.mocked(Tracking.health).mockReturnValue({
    usageAccessGranted: true,
    apps: [
      { package: 'com.instagram.android', installed: true, validated: false },
      { package: 'com.google.android.youtube', installed: true, validated: false },
    ],
  } as never);
  jest.mocked(api.usageHistory).mockImplementation(async () => ({
    days: serverDays.map(({ personalAppViews: _omitted, ...rest }) => rest),
  }));
  await expect(backupAccount(api, () => true)).rejects.toThrow('awaiting server verification');
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'copied' });
  jest.mocked(api.usageHistory).mockImplementation(async () => ({ days: serverDays }));
  await backupAccount(api, () => true);
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'verified' });
  expect(serverDays).toHaveLength(1);
});
