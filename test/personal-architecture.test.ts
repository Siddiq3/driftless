jest.mock('@/db', () => ({ getStorageDb: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('tracking-android', () => ({
  Tracking: {
    dataScope: jest.fn(),
    selectDataScope: jest.fn(),
    importGuestScope: jest.fn(),
    setLimits: jest.fn(),
    setSourceDevice: jest.fn(),
    mergeSyncedDays: jest.fn(),
    daily: jest.fn(),
    health: jest.fn(),
    refreshUsage: jest.fn(),
    personalMeasurement: jest.fn(),
  },
}));
import { Tracking } from 'tracking-android';
import { aggregateDay } from '@/sync/aggregate';
import { createApiClient } from '@/api/client';
import { stage, flush } from '@/sync/engine';
import { sqliteSyncRepo } from '@/sync/sqliteRepo';
import { getStorageDb } from '@/db';
import { migrate, MIGRATIONS } from '@/db/migrations';
import { selectStorageScope, scopedDatabase } from '@/db/scope';
import {
  selectPersonalSession,
  resolvePersonalAccount,
  acknowledgeGuestImports,
} from '@/data/session';
import { hydratePersonalHistory } from '@/data/hydration';
import {
  personalDay,
  personalRawDay,
  refreshPersonalData,
  invalidatePersonalData,
} from '@/data/personal';
import { recordedMeasurement } from '@/data/measurement';
import { loadGoals, saveGoal } from '@/goals/store';
import { sqlite } from './helpers/sqlite';
import type { ApiClient } from '@/api/client';
import type { SQLiteDatabase } from 'expo-sqlite';
let db: SQLiteDatabase;
let close: () => void;
let nativeScope = 'guest:first';
beforeEach(async () => {
  ({ db, close } = sqlite());
  await migrate(db);
  jest.clearAllMocks();
  selectStorageScope('guest:first');
  invalidatePersonalData();
  nativeScope = 'guest:first';
  jest.mocked(getStorageDb).mockResolvedValue(db);
  jest.mocked(Tracking.dataScope).mockImplementation(() => nativeScope);
  jest.mocked(Tracking.selectDataScope).mockImplementation((s) => {
    nativeScope = s;
  });
  jest.mocked(Tracking.health).mockReturnValue({
    usageAccessGranted: true,
    apps: [{ package: 'instagram', installed: true, validated: false }],
  } as unknown as ReturnType<typeof Tracking.health>);
  jest.mocked(Tracking.daily).mockImplementation((d) => ({
    localDate: d!,
    coverage: 0.2,
    heartbeatMinutes: 10,
    apps: [
      {
        package: 'instagram',
        views: 42,
        adViews: 0,
        usageMs: 60000,
        surfaceMs: 30000,
        unknownMs: 0,
      },
    ],
  }));
  jest.mocked(Tracking.personalMeasurement).mockReturnValue(null);
});
afterEach(() => {
  close();
  selectStorageScope('legacy');
});
const id = '00000000-0000-4000-8000-000000000009';
it('guest writes no network and migration is resumed once into its resolved account only', async () => {
  await db.runAsync('INSERT INTO data_scopes(scope) VALUES (?)', 'guest:first');
  await saveGoal(scopedDatabase(db, 'guest:first'), {
    goalId: id,
    metric: 'views',
    dailyLimit: 50,
    enabled: true,
  });
  await selectPersonalSession('google-a');
  const account = await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
  await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
  await acknowledgeGuestImports(account, 'account:a', () => true);
  expect(
    (await db.getAllAsync<{ state: string }>('SELECT state FROM guest_imports')).every(
      (r) => r.state === 'complete',
    ),
  ).toBe(true);
  await selectPersonalSession(null);
  expect(await loadGoals(scopedDatabase(db, nativeScope))).toEqual([]);
  await selectPersonalSession('google-b');
  const b = await resolvePersonalAccount('b', () => true);
  expect(await loadGoals(b)).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'account:a')).toHaveLength(1);
  await selectPersonalSession('google-a');
  expect(nativeScope).toBe('account:a');
  expect(await loadGoals(scopedDatabase(db, nativeScope))).toHaveLength(1);
});
it('old scoped handles cannot read or mutate another account after switching', async () => {
  const old = scopedDatabase(db, 'guest:first');
  selectStorageScope('account:b');
  await expect(loadGoals(old)).rejects.toThrow('account changed');
  await expect(
    saveGoal(old, { goalId: id, metric: 'views', dailyLimit: 40, enabled: true }),
  ).rejects.toThrow('account changed');
});
it('new-device restore deduplicates concurrent reads and merges by device/date/revision', async () => {
  nativeScope = 'account:a';
  selectStorageScope(nativeScope);
  await db.runAsync('INSERT INTO data_scopes(scope,backend_owner) VALUES (?,?)', nativeScope, 'a');
  const account = scopedDatabase(db, nativeScope);
  const today = new Date().toISOString().slice(0, 10);
  const row = {
    localDate: today,
    deviceId: 'remote-device',
    platform: 'android',
    tz: 'UTC',
    views: 5,
    adViews: 0,
    minutes: 2,
    coverage: 1,
    rev: 2,
  };
  const usageHistory = jest.fn().mockResolvedValue({ days: [row] });
  const api = { usageHistory } as unknown as ApiClient;
  await Promise.all([
    hydratePersonalHistory(api, account, 'a', () => true),
    hydratePersonalHistory(api, account, 'a', () => true),
  ]);
  expect(usageHistory).toHaveBeenCalledTimes(1);
  await hydratePersonalHistory(api, account, 'a', () => true);
  expect(usageHistory).toHaveBeenCalledTimes(1);
  expect(await db.getAllAsync('SELECT * FROM daily_cache WHERE scope=?', nativeScope)).toHaveLength(
    1,
  );
  expect(Tracking.mergeSyncedDays).toHaveBeenCalledWith([row], nativeScope);
});
it('discarded hydration cannot populate another account after sign-out', async () => {
  nativeScope = 'account:a';
  selectStorageScope(nativeScope);
  const account = scopedDatabase(db, nativeScope);
  let active = true;
  let finish!: (v: { days: unknown[] }) => void;
  const api = {
    usageHistory: jest.fn(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    ),
  } as unknown as ApiClient;
  const task = hydratePersonalHistory(api, account, 'a', () => active);
  await new Promise<void>((r) => setTimeout(r, 0));
  active = false;
  selectStorageScope('account:b');
  finish({ days: [] });
  await expect(task).rejects.toThrow('cancelled');
  expect(Tracking.mergeSyncedDays).not.toHaveBeenCalled();
});
it('all personal consumers reuse the same experimental measurement without competitive promotion', () => {
  refreshPersonalData();
  const a = personalDay('2026-10-24');
  const b = personalDay('2026-10-24');
  expect(a).toBe(b);
  expect(a.views).toBe(42);
  expect(a.status).toBe('experimental');
  expect(personalRawDay('2026-10-24').apps[0]!.views).toBe(42);
  refreshPersonalData();
  expect(Tracking.refreshUsage).toHaveBeenCalledTimes(1);
  expect(Tracking.daily).toHaveBeenCalledTimes(1);
  expect(recordedMeasurement(personalRawDay('2026-10-24'), Tracking.health()).views).toBe(42);
});
it('forward-only v4 upgrade preserves every legacy record without declaring it guest-owned', async () => {
  const old = sqlite();
  try {
    await migrate(old.db, MIGRATIONS.slice(0, 4));
    await old.db.runAsync('INSERT INTO goals VALUES (?,?,?,?,?)', id, 'views', 75, 1, 6);
    await migrate(old.db);
    expect(await old.db.getAllAsync('SELECT scope,goal_id,rev FROM goals')).toEqual([
      { scope: 'legacy', goal_id: id, rev: 6 },
    ]);
    expect(
      await old.db.getFirstAsync('SELECT backend_owner FROM data_scopes WHERE scope=?', 'legacy'),
    ).toEqual({ backend_owner: null });
  } finally {
    old.close();
  }
});

it('a later guest period can join the same account without reimporting the previous guest period', async () => {
  await selectPersonalSession('google-a');
  await resolvePersonalAccount('a', () => true);
  await selectPersonalSession(null);
  const laterGuest = nativeScope;
  await saveGoal(scopedDatabase(db, laterGuest), {
    goalId: id,
    metric: 'views',
    dailyLimit: 55,
    enabled: true,
  });
  await selectPersonalSession('google-a');
  const account = await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
  await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
  expect(
    await db.getFirstAsync(
      'SELECT target_scope FROM guest_imports WHERE source_scope=?',
      laterGuest,
    ),
  ).toEqual({ target_scope: 'account:a' });
});
it('a failure between native import and the JS copy resumes the journal without duplicate goals', async () => {
  await db.runAsync('INSERT INTO data_scopes(scope) VALUES (?)', 'guest:first');
  await saveGoal(scopedDatabase(db, 'guest:first'), {
    goalId: id,
    metric: 'views',
    dailyLimit: 55,
    enabled: true,
  });
  await selectPersonalSession('google-a');
  await db.execAsync(
    "CREATE TRIGGER fail_import BEFORE INSERT ON goals WHEN NEW.scope='account:a' BEGIN SELECT RAISE(ABORT,'disk full'); END;",
  );
  await expect(resolvePersonalAccount('a', () => true)).rejects.toThrow('disk full');
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'guest:first')).toHaveLength(1);
  await db.execAsync('DROP TRIGGER fail_import');
  const account = await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
  await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(account)).toHaveLength(1);
});
it('hydration requests exactly the retained 400 local dates and excludes older server responses', async () => {
  nativeScope = 'account:a';
  selectStorageScope(nativeScope);
  await db.runAsync('INSERT INTO data_scopes(scope) VALUES (?)', nativeScope);
  const usageHistory = jest.fn().mockResolvedValue({
    days: [
      {
        localDate: '2000-01-01',
        deviceId: 'old',
        tz: 'UTC',
        rev: 1,
        platform: 'android',
        views: 4,
        adViews: 0,
        minutes: 1,
        coverage: 1,
      },
    ],
  });
  await hydratePersonalHistory(
    { usageHistory } as unknown as ApiClient,
    scopedDatabase(db, nativeScope),
    'a',
    () => true,
  );
  const [from, to] = usageHistory.mock.calls[0]!;
  expect((Date.parse(to) - Date.parse(from)) / 86400000 + 1).toBe(400);
  expect(await db.getAllAsync('SELECT * FROM daily_cache')).toHaveLength(0);
  expect(Tracking.mergeSyncedDays).not.toHaveBeenCalled();
});

it('merges a stable goal identity once and preserves unrelated existing cloud goals', async () => {
  await db.runAsync(
    'INSERT INTO data_scopes(scope,identity_key,backend_owner) VALUES (?,?,?)',
    'account:a',
    'google-a',
    'a',
  );
  selectStorageScope('account:a');
  nativeScope = 'account:a';
  await saveGoal(scopedDatabase(db, 'account:a'), {
    goalId: id,
    metric: 'views',
    dailyLimit: 30,
    enabled: true,
  });
  await saveGoal(scopedDatabase(db, 'account:a'), {
    goalId: '00000000-0000-4000-8000-000000000010',
    metric: 'minutes',
    dailyLimit: 20,
    enabled: true,
  });
  await selectPersonalSession(null);
  await saveGoal(scopedDatabase(db, nativeScope), {
    goalId: id,
    metric: 'views',
    dailyLimit: 70,
    enabled: true,
  });
  await selectPersonalSession('google-a');
  const a = await resolvePersonalAccount('a', () => true);
  const goals = await loadGoals(a);
  expect(goals).toHaveLength(2);
  expect(goals.find((g) => g.goalId === id)).toMatchObject({ dailyLimit: 70, rev: 2 });
  await resolvePersonalAccount('a', () => true);
  expect(await loadGoals(a)).toEqual(goals);
});

it('incremental foreground hydration reads recent dates instead of downloading all history again', async () => {
  nativeScope = 'account:a';
  selectStorageScope(nativeScope);
  await db.runAsync(
    'INSERT INTO data_scopes(scope,hydrated_at) VALUES (?,?)',
    nativeScope,
    Date.now() - 16 * 60000,
  );
  const usageHistory = jest.fn().mockResolvedValue({ days: [] });
  await hydratePersonalHistory(
    { usageHistory } as unknown as ApiClient,
    scopedDatabase(db, nativeScope),
    'a',
    () => true,
  );
  const [from, to] = usageHistory.mock.calls[0]!;
  expect((Date.parse(to) - Date.parse(from)) / 86400000).toBeLessThanOrEqual(2);
});

it('restores personal counts into a fresh install without uploading them as competitive views', async () => {
  nativeScope = 'account:a';
  selectStorageScope(nativeScope);
  await db.runAsync('INSERT INTO data_scopes(scope,backend_owner) VALUES (?,?)', nativeScope, 'a');
  const account = scopedDatabase(db, nativeScope);
  const today = new Date().toISOString().slice(0, 10);
  const sourceId = '00000000-0000-4000-8000-000000000001';
  const value = aggregateDay(Tracking.daily(today), Tracking.health(), sourceId, 'UTC');
  expect(value).toMatchObject({ personalViews: 42, views: null, minutes: 1 });
  let backedUp: unknown[] = [];
  const fetchImpl = jest.fn(async (_url, options) => {
    if (options?.method === 'POST') {
      backedUp = JSON.parse(options.body as string).days;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            results: [{ localDate: today, deviceId: sourceId, status: 'applied', serverRev: 1 }],
          }),
        headers: { get: () => null },
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ days: backedUp }),
      headers: { get: () => null },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const api = createApiClient({
    baseUrl: 'https://validation.invalid',
    getAccessToken: async () => 'test',
    fetchImpl,
    platform: 'android',
    appVersion: 'test',
  });
  const repo = sqliteSyncRepo(account);
  await stage(repo, [value]);
  expect(
    (await flush(repo, api, { uuid: () => require('node:crypto').randomUUID() }, Date.now())).kind,
  ).toBe('sent');

  // A new empty database models loss of every installation-local row after uninstall.
  close();
  ({ db, close } = sqlite());
  await migrate(db);
  await db.runAsync('INSERT INTO data_scopes(scope,backend_owner) VALUES (?,?)', nativeScope, 'a');
  const restored = scopedDatabase(db, nativeScope);
  await hydratePersonalHistory(api, restored, 'a', () => true);
  const row = await db.getFirstAsync<{ views: number; minutes: number }>(
    'SELECT views, minutes FROM daily_cache WHERE scope=?',
    nativeScope,
  );
  expect(row).toEqual({ views: 42, minutes: 1 });
  expect(Tracking.mergeSyncedDays).toHaveBeenLastCalledWith(
    [expect.objectContaining({ views: 42, personalViews: 42 })],
    nativeScope,
  );
  expect(backedUp).toEqual([expect.objectContaining({ views: null, personalViews: 42 })]);
});
