jest.mock('@/db', () => ({ getDb: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
import { getDb } from '@/db';
import { selectStorageScope, scopedDatabase } from '@/db/scope';
import { migrate } from '@/db/migrations';
import { createBattle } from '@/social/battleRequests';
import type { ApiClient } from '@/api/client';
import { sqlite } from './helpers/sqlite';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
const incarnation = '00000000-0000-4000-8000-000000000001',
  scope = `account:${incarnation}`;
const body = {
  title: 'Scroll battle',
  metric: 'fewest_views' as const,
  startDate: '2026-10-26',
  endDate: '2026-11-01',
  tz: 'UTC',
  maxMembers: 2,
  targetUserId: '00000000-0000-4000-8000-000000000002',
  scoreConsent: true as const,
};
it('lost response persists the original intent across database reopen and concurrent retries', async () => {
  const file = `/private/tmp/battle-request-${randomUUID()}.db`;
  let fixture = sqlite(file);
  selectStorageScope(scope);
  try {
    await migrate(fixture.db);
    jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, scope));
    const createChallenge = jest
      .fn()
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValue({ challengeId: randomUUID() });
    const api = { incarnation, createChallenge } as unknown as ApiClient;
    await expect(createBattle(api, body, () => true)).rejects.toThrow('lost response');
    const original = createChallenge.mock.calls[0][0];
    fixture.close();
    fixture = sqlite(file);
    await migrate(fixture.db);
    jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, scope));
    await Promise.all([
      createBattle(api, { ...body, startDate: '2026-10-27' }, () => true),
      createBattle(api, body, () => true),
    ]);
    expect(createChallenge).toHaveBeenCalledTimes(2);
    expect(createChallenge.mock.calls[1][0]).toEqual(original);
    expect(
      await fixture.db.getAllAsync("SELECT * FROM settings WHERE key LIKE 'battle_create:%'"),
    ).toEqual([]);
  } finally {
    fixture.close();
    unlinkSync(file);
    selectStorageScope('legacy');
  }
});
it('does not issue a previous account request under a different incarnation', async () => {
  const fixture = sqlite();
  selectStorageScope(scope);
  try {
    await migrate(fixture.db);
    jest.mocked(getDb).mockResolvedValue(scopedDatabase(fixture.db, scope));
    const createChallenge = jest.fn();
    await expect(
      createBattle(
        { incarnation: 'different', createChallenge } as unknown as ApiClient,
        body,
        () => true,
      ),
    ).rejects.toThrow('Account changed');
    await expect(
      createBattle({ incarnation, createChallenge } as unknown as ApiClient, body, () => false),
    ).rejects.toThrow('Account changed');
    expect(createChallenge).not.toHaveBeenCalled();
  } finally {
    fixture.close();
    selectStorageScope('legacy');
  }
});
