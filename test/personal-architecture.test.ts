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
    installAccountHistory: jest.fn(),
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
import { storageScope, selectStorageScope, scopedDatabase } from '@/db/scope';
import { selectPersonalSession, resolvePersonalAccount } from '@/data/session';
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
const firstIncarnation = '00000000-0000-4000-8000-000000000001';
const secondIncarnation = '00000000-0000-4000-8000-000000000002';
it('sign-in quarantines legacy and guest data; only the verified incarnation selects its dataset', async () => {
  await saveGoal(scopedDatabase(db, 'guest:first'), {
    goalId: id,
    metric: 'views',
    dailyLimit: 50,
    enabled: true,
  });
  await db.runAsync('UPDATE data_scopes SET backend_owner=? WHERE scope=?', 'a', 'legacy');
  await db.runAsync(
    'INSERT INTO goals(scope,goal_id,metric,daily_limit,enabled,rev) VALUES (?,?,?,?,?,?)',
    'legacy',
    id,
    'views',
    80,
    1,
    3,
  );
  await selectPersonalSession('google-a');
  expect(storageScope()).toMatch(/^pending:/);
  expect(nativeScope).toMatch(/^guest:/);
  const account = await resolvePersonalAccount('a', firstIncarnation, () => true);
  expect(await loadGoals(account)).toEqual([]);
  await saveGoal(account, { goalId: id, metric: 'views', dailyLimit: 10, enabled: true });
  await selectPersonalSession(null);
  await selectPersonalSession('google-a');
  expect(storageScope()).toMatch(/^pending:/);
  expect(nativeScope).toMatch(/^guest:/);
  const same = await resolvePersonalAccount('a', firstIncarnation, () => true);
  expect(await loadGoals(same)).toHaveLength(1);
  const fresh = await resolvePersonalAccount('a', secondIncarnation, () => true);
  expect(await loadGoals(fresh)).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'legacy')).toHaveLength(1);
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'guest:first')).toHaveLength(1);
  expect(Tracking.importGuestScope).not.toHaveBeenCalled();
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

it('a later guest period cannot be adopted by the same stable account', async () => {
  await resolvePersonalAccount('a', firstIncarnation, () => true);
  await selectPersonalSession(null);
  const guest = nativeScope;
  await saveGoal(scopedDatabase(db, guest), {
    goalId: id,
    metric: 'views',
    dailyLimit: 55,
    enabled: true,
  });
  await selectPersonalSession('google-a');
  const account = await resolvePersonalAccount('a', firstIncarnation, () => true);
  expect(await loadGoals(account)).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', guest)).toHaveLength(1);
  expect(await db.getAllAsync('SELECT * FROM guest_imports')).toEqual([]);
});

it('an interrupted binding retries safely without exposing a different owner dataset', async () => {
  let allowed = false;
  await expect(resolvePersonalAccount('a', firstIncarnation, () => allowed)).rejects.toThrow(
    'cancelled',
  );
  allowed = true;
  const account = await resolvePersonalAccount('a', firstIncarnation, () => allowed);
  await saveGoal(account, { goalId: id, metric: 'views', dailyLimit: 55, enabled: true });
  await expect(resolvePersonalAccount('b', firstIncarnation, () => true)).rejects.toThrow(
    'quarantined',
  );
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

it('fresh incarnation cannot adopt old frozen batches, pending operations or import journals', async () => {
  const old = await resolvePersonalAccount('a', firstIncarnation, () => true);
  const repo = sqliteSyncRepo(old);
  const day = aggregateDay(Tracking.daily('2026-10-24'), Tracking.health(), id, 'UTC');
  await stage(repo, [day]);
  const offline = { usageSync: jest.fn().mockRejectedValue(new Error('offline')) };
  await flush(repo, offline, { uuid: () => id }, Date.now());
  const frozen = await db.getAllAsync(
    'SELECT * FROM sync_batch WHERE scope=?',
    `account:${firstIncarnation}`,
  );
  expect(frozen).toHaveLength(1);
  await db.runAsync(
    'INSERT INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
    'legacy',
    `account:${firstIncarnation}`,
  );
  await selectPersonalSession('google-a');
  const fresh = await resolvePersonalAccount('a', secondIncarnation, () => true);
  expect(
    await db.getAllAsync('SELECT * FROM sync_batch WHERE scope=?', `account:${secondIncarnation}`),
  ).toEqual([]);
  expect(
    await db.getAllAsync('SELECT * FROM sync_days WHERE scope=?', `account:${secondIncarnation}`),
  ).toEqual([]);
  expect(
    await db.getAllAsync('SELECT * FROM sync_batch WHERE scope=?', `account:${firstIncarnation}`),
  ).toEqual(frozen);
  await expect(loadGoals(old)).rejects.toThrow();
  expect(await loadGoals(fresh)).toEqual([]);
  expect(Tracking.importGuestScope).not.toHaveBeenCalled();
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
    if (String(_url).includes('/usage/account/history'))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ days: [], serverTimeMs: Date.now() }),
        headers: { get: () => null },
      } as unknown as Response;
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

it('captures current guest goals before scope change and imports them exactly once at verified bootstrap', async () => {
  await saveGoal(scopedDatabase(db, nativeScope), {
    goalId: id,
    metric: 'views',
    dailyLimit: 50,
    enabled: true,
  });
  await selectPersonalSession(null); // persist the available guest session
  await selectPersonalSession('google-a');
  const account = await resolvePersonalAccount('a', firstIncarnation, () => true, true);
  expect(await loadGoals(account)).toMatchObject([{ goalId: id, dailyLimit: 50 }]);
  await resolvePersonalAccount('a', firstIncarnation, () => true, true);
  expect(await loadGoals(account)).toHaveLength(1);
  expect(await db.getAllAsync('SELECT * FROM goals WHERE scope=?', 'guest:first')).toHaveLength(1);
  expect(await db.getAllAsync('SELECT * FROM guest_imports')).toEqual([
    { source_scope: 'guest:first', target_scope: `account:${firstIncarnation}`, state: 'copied' },
  ]);
  await selectPersonalSession(null);
  expect(nativeScope).not.toBe('guest:first');
  await selectPersonalSession('google-b');
  const other = await resolvePersonalAccount('b', secondIncarnation, () => true, true);
  expect(await loadGoals(other)).toEqual([]);
});

it('sign-out before account resolution restores the unclaimed guest dataset', async () => {
  await selectPersonalSession(null);
  await selectPersonalSession('google-a');
  await selectPersonalSession(null);
  expect(nativeScope).toBe('guest:first');
});

it('a failed native copy leaves a durable bound journal and resumes only for that incarnation', async () => {
  await selectPersonalSession(null);
  await selectPersonalSession('google-a');
  jest.mocked(Tracking.importGuestScope).mockImplementationOnce(() => {
    throw new Error('fixture native failure');
  });
  await expect(resolvePersonalAccount('a', firstIncarnation, () => true, true)).rejects.toThrow(
    'native failure',
  );
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'bound' });
  await resolvePersonalAccount('a', firstIncarnation, () => true, true);
  expect(await db.getFirstAsync('SELECT state FROM guest_imports')).toEqual({ state: 'copied' });
  await selectPersonalSession('google-a');
  await resolvePersonalAccount('a', secondIncarnation, () => true, true);
  expect(Tracking.importGuestScope).not.toHaveBeenCalledWith(
    'guest:first',
    `account:${secondIncarnation}`,
    false,
  );
});
