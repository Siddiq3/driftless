jest.mock('@/db', () => ({ getDb: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    resetAccountHistory: jest.fn(),
    forgetAccountUsage: jest.fn(),
    wipeLocalData: jest.fn(),
  },
}));
import { randomUUID } from 'node:crypto';
import * as Notifications from 'expo-notifications';
import { Tracking } from 'tracking-android';
import { getDb } from '@/db';
import { migrate } from '@/db/migrations';
import { scopedDatabase, selectStorageScope } from '@/db/scope';
import { wipePhone, resumePhoneReset } from '@/data/reset';
import { syncGoals } from '@/goals/sync';
import { saveGoal, loadGoals } from '@/goals/store';
import { sqlite } from './helpers/sqlite';

let fixture: ReturnType<typeof sqlite>;
const incarnation = randomUUID(),
  scope = `account:${incarnation}`;
beforeEach(async () => {
  jest.clearAllMocks();
  fixture = sqlite();
  await migrate(fixture.db);
  selectStorageScope(scope);
  jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, scope));
});
afterEach(() => {
  fixture.close();
  selectStorageScope('legacy');
});
it('clears promised local state and cancels the reminder while preserving owner, accounting and frozen retries', async () => {
  const db = await getDb();
  const g = await saveGoal(db, {
    goalId: randomUUID(),
    metric: 'views',
    dailyLimit: 20,
    enabled: true,
  });
  await fixture.db.runAsync(
    'INSERT INTO data_scopes(scope,backend_owner,source_scope,hydrated_at) VALUES (?,?,?,?)',
    scope,
    `stable:${incarnation}`,
    'old',
    99,
  );
  for (const [key, value] of [
    ['evening_reminder', '1'],
    [`account_usage:${scope}:batch`, 'frozen-accounting'],
    [`account_usage:${scope}:reservation`, 'frozen-grant'],
    ['device_id', 'device-a'],
  ] as [string, string][])
    await fixture.db.runAsync('INSERT INTO settings VALUES (?,?)', key, value);
  await fixture.db.runAsync(
    'INSERT INTO sync_batch(scope,id,idempotency_key,days_json,next_attempt_at) VALUES (?,?,?,?,?)',
    scope,
    'batch',
    'original-key',
    'original-body',
    0,
  );
  await wipePhone();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('evening-check-in');
  expect(Tracking.resetAccountHistory).toHaveBeenCalledTimes(1);
  expect(Tracking.forgetAccountUsage).not.toHaveBeenCalled();
  expect(await loadGoals(db)).toEqual([]);
  expect(await fixture.db.getFirstAsync('SELECT * FROM sync_batch')).toMatchObject({
    idempotency_key: 'original-key',
    days_json: 'original-body',
  });
  expect(
    await fixture.db.getFirstAsync('SELECT * FROM data_scopes WHERE scope=?', scope),
  ).toMatchObject({ backend_owner: `stable:${incarnation}`, source_scope: null, hydrated_at: 0 });
  expect(
    await fixture.db.getFirstAsync(
      'SELECT value FROM settings WHERE key=?',
      `account_usage:${scope}:batch`,
    ),
  ).toEqual({ value: 'frozen-accounting' });
  expect(
    await fixture.db.getFirstAsync("SELECT value FROM settings WHERE key='evening_reminder'"),
  ).toBeNull();
  const api = {
    getGoals: jest.fn().mockResolvedValue({ goals: [g], etag: '"1"' }),
    putGoals: jest.fn(),
  };
  await syncGoals(api, incarnation);
  expect(await loadGoals(db)).toEqual([]);
  expect(api.putGoals).not.toHaveBeenCalled();
  const fresh = await saveGoal(db, {
    goalId: randomUUID(),
    metric: 'minutes',
    dailyLimit: 15,
    enabled: true,
  });
  await syncGoals(api, incarnation);
  expect(api.putGoals).toHaveBeenCalledWith(
    expect.arrayContaining([g, fresh]),
    '"1"',
    expect.any(Function),
  );
});
it('stops before native data changes when the account changes while notification cancellation is pending', async () => {
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockImplementationOnce(async () => {
    selectStorageScope(`account:${randomUUID()}`);
  });
  await expect(wipePhone()).rejects.toThrow('Account changed');
  expect(Tracking.resetAccountHistory).not.toHaveBeenCalled();
  expect(Tracking.wipeLocalData).not.toHaveBeenCalled();
});
it('keeps a failed notification cancellation visible instead of claiming a complete reset', async () => {
  jest
    .mocked(Notifications.cancelScheduledNotificationAsync)
    .mockRejectedValueOnce(new Error('notification failure'));
  await expect(wipePhone()).rejects.toThrow('notification failure');
  expect(Tracking.wipeLocalData).not.toHaveBeenCalled();
});
it('recovers a native reset followed by interrupted app-database cleanup without rewriting frozen requests', async () => {
  const db = await getDb();
  await saveGoal(db, { goalId: randomUUID(), metric: 'views', dailyLimit: 20, enabled: true });
  await fixture.db.runAsync(
    'INSERT INTO settings VALUES (?,?)',
    `account_usage:${scope}:batch`,
    'immutable',
  );
  await fixture.db.execAsync(
    "CREATE TRIGGER fail_reset BEFORE DELETE ON goals BEGIN SELECT RAISE(ABORT,'interrupted'); END;",
  );
  await expect(wipePhone()).rejects.toThrow('interrupted');
  expect(
    await fixture.db.getFirstAsync("SELECT value FROM settings WHERE key='phone_reset_pending'"),
  ).not.toBeNull();
  await fixture.db.execAsync('DROP TRIGGER fail_reset');
  Object.assign(Tracking, { dataScope: jest.fn(() => scope) });
  await resumePhoneReset(fixture.db);
  expect(await loadGoals(db)).toEqual([]);
  expect(
    await fixture.db.getFirstAsync("SELECT value FROM settings WHERE key='phone_reset_pending'"),
  ).toBeNull();
  expect(
    await fixture.db.getFirstAsync(
      'SELECT value FROM settings WHERE key=?',
      `account_usage:${scope}:batch`,
    ),
  ).toEqual({ value: 'immutable' });
});
