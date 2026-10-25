jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ data: 'disposable-test-push-token' }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('@/db', () => ({ getDb: jest.fn() }));
jest.mock('tracking-android', () => ({
  Tracking: {
    installAccountUsage: jest.fn(),
    setSourceDevice: jest.fn(),
    refreshUsage: jest.fn(),
    accountUsageContributions: jest.fn(),
    ackAccountUsage: jest.fn(),
    accountUsageInfo: jest.fn(),
  },
}));
import { randomUUID } from 'node:crypto';
import { Tracking } from 'tracking-android';
import { getDb } from '@/db';
import { migrate } from '@/db/migrations';
import { scopedDatabase, selectStorageScope } from '@/db/scope';
import { syncAccountUsage } from '@/sync/accountUsage';
import { registerPush } from '@/sync/push';
import type { ApiClient } from '@/api/client';
import { sqlite } from './helpers/sqlite';

const incarnation = randomUUID(),
  scope = `account:${incarnation}`,
  periodId = `${incarnation}:2026-10-25`;
let fixture: ReturnType<typeof sqlite>;
let api: ReturnType<typeof client>;
const response = () => ({
  policy: {
    incarnation,
    tz: 'UTC',
    rev: 1,
    activeFromMs: 1,
    policies: [{ effectiveDate: '2026-10-25', limits: { views: 20 } }],
  },
  snapshot: {
    incarnation,
    periodId,
    localDate: '2026-10-25',
    limits: { views: 20 },
    devices: {},
    allocated: {},
    used: {},
  },
  serverTimeMs: 1000,
});
const client = () => ({
  incarnation,
  registerDevice: jest.fn().mockResolvedValue({}),
  getAccountUsage: jest.fn().mockImplementation(async () => response()),
  getGoals: jest
    .fn()
    .mockResolvedValue({ goals: [{ metric: 'views', dailyLimit: 20, enabled: true }] }),
  configureAccountUsage: jest.fn(),
  reconcileAccountUsage: jest.fn(),
  reserveAccountUsage: jest.fn().mockImplementation(async () => response()),
});
const sync = (allowed = () => true) => syncAccountUsage(api as unknown as ApiClient, allowed);
const read = async (name: string) =>
  (
    await fixture.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key=?',
      `account_usage:${scope}:${name}`,
    )
  )?.value;
beforeEach(async () => {
  jest.clearAllMocks();
  fixture = sqlite();
  await migrate(fixture.db);
  selectStorageScope(scope);
  jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, scope));
  api = client();
  jest.mocked(Tracking.accountUsageContributions).mockReturnValue([]);
  jest.mocked(Tracking.accountUsageInfo).mockReturnValue({
    active: true,
    tz: 'UTC',
    status: 'reserved_stale',
    cutoffMs: 0,
    resetGeneration: 0,
    nowMs: 1000,
  });
});
afterEach(() => {
  fixture.close();
  selectStorageScope('legacy');
});
it('keeps a lost-response grant frozen under its original operation ID', async () => {
  api.reserveAccountUsage.mockRejectedValueOnce(new Error('lost response'));
  await expect(sync()).rejects.toThrow('lost response');
  const frozen = await read('reservation');
  expect(frozen).toBeDefined();
  await sync();
  expect(api.reserveAccountUsage.mock.calls[1][0]).toEqual(JSON.parse(frozen!));
  expect(await read('reservation')).toBeUndefined();
});
it('retries the same immutable accounting batch and acknowledges only the sent revisions', async () => {
  const sent = {
    incarnation,
    periodId,
    localDate: '2026-10-25',
    deviceId: randomUUID(),
    rev: 2,
    resetGeneration: 0,
    apps: {},
  };
  jest.mocked(Tracking.accountUsageContributions).mockReturnValue([sent]);
  api.reconcileAccountUsage.mockRejectedValueOnce(new Error('offline'));
  await expect(sync()).rejects.toThrow('offline');
  const frozen = await read('batch');
  // More local recording/reset after the failed request cannot rewrite its frozen body.
  jest
    .mocked(Tracking.accountUsageContributions)
    .mockReturnValue([{ ...sent, rev: 5, resetGeneration: 1 }]);
  api.reconcileAccountUsage.mockResolvedValue({
    results: [{ periodId, deviceId: sent.deviceId, rev: 2 }],
  });
  await sync();
  const batch = JSON.parse(frozen!);
  expect(api.reconcileAccountUsage.mock.calls[1].slice(0, 2)).toEqual([batch.body, batch.key]);
  expect(Tracking.ackAccountUsage).toHaveBeenCalledWith(sent.localDate, 2);
  expect(await read('batch')).toBeUndefined();
});
it('retains partially acknowledged frozen bodies and fences delayed replies after switching accounts', async () => {
  const sent = {
    incarnation,
    periodId,
    localDate: '2026-10-25',
    deviceId: randomUUID(),
    rev: 4,
    resetGeneration: 0,
    apps: {},
  };
  jest.mocked(Tracking.accountUsageContributions).mockReturnValue([sent]);
  api.reconcileAccountUsage.mockResolvedValueOnce({ results: [] });
  await sync();
  const frozen = await read('batch');
  expect(frozen).toBeDefined();
  expect(Tracking.ackAccountUsage).not.toHaveBeenCalled();
  api.reconcileAccountUsage.mockImplementationOnce(async () => {
    selectStorageScope(`account:${randomUUID()}`);
    return { results: [{ periodId, deviceId: sent.deviceId, rev: 4 }] };
  });
  await expect(sync()).rejects.toThrow('cancelled');
  expect(Tracking.ackAccountUsage).not.toHaveBeenCalled();
  expect(await read('batch')).toBe(frozen);
});
it('does not adopt an old incarnation batch and does not use cleared local goals as policy', async () => {
  const oldScope = `account:${randomUUID()}`;
  await fixture.db.runAsync(
    'INSERT INTO settings VALUES (?,?)',
    `account_usage:${oldScope}:batch`,
    'old-frozen-body',
  );
  const message = await sync();
  expect(api.configureAccountUsage).not.toHaveBeenCalled(); // server goal still owns the account limit
  expect(api.reconcileAccountUsage).not.toHaveBeenCalled();
  expect(message).toContain('reserved stale');
  expect(
    await fixture.db.getFirstAsync(
      'SELECT value FROM settings WHERE key=?',
      `account_usage:${oldScope}:batch`,
    ),
  ).toEqual({ value: 'old-frozen-body' });
});
it('stops a mismatched client before making requests', async () => {
  api.incarnation = randomUUID();
  await expect(sync()).rejects.toThrow('scope mismatch');
  expect(api.registerDevice).not.toHaveBeenCalled();
});
it('does not spend the device-registration rate limit on every foreground credit refresh', async () => {
  for (let i = 0; i < 5; i++) await sync();
  expect(api.registerDevice).toHaveBeenCalledTimes(1);
});

it('caches unchanged push registrations per incarnation rather than consuming the minute refresh rate limit', async () => {
  for (let i = 0; i < 5; i++) await registerPush(api as unknown as ApiClient);
  expect(api.registerDevice).toHaveBeenCalledTimes(1);
  const fresh = `account:${randomUUID()}`;
  selectStorageScope(fresh);
  jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, fresh));
  const freshApi = client();
  await registerPush(freshApi as unknown as ApiClient);
  expect(freshApi.registerDevice).toHaveBeenCalledTimes(1);
});
