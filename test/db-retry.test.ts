jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../src/db/migrations', () => ({ migrate: jest.fn() }));
jest.mock('../src/goals/store', () => ({ repairGoalIds: jest.fn() }));
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from '../src/db/migrations';
import { repairGoalIds } from '../src/goals/store';
import { getDb } from '../src/db';

it('closes a failed database initialization and retries repair without a poisoned cached promise', async () => {
  const failed = { execAsync: jest.fn(), closeAsync: jest.fn().mockResolvedValue(undefined) };
  const ready = { execAsync: jest.fn(), closeAsync: jest.fn() };
  jest
    .mocked(openDatabaseAsync)
    .mockResolvedValueOnce(failed as unknown as SQLiteDatabase)
    .mockResolvedValue(ready as unknown as SQLiteDatabase);
  jest
    .mocked(repairGoalIds)
    .mockRejectedValueOnce(new Error('disk full'))
    .mockResolvedValue(undefined);
  await expect(getDb()).rejects.toThrow('disk full');
  expect(failed.closeAsync).toHaveBeenCalledTimes(1);
  expect(await getDb()).toBe(ready);
  expect(await getDb()).toBe(ready);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  expect(migrate).toHaveBeenCalledTimes(2);
  expect(repairGoalIds).toHaveBeenCalledTimes(2);
  expect(ready.closeAsync).not.toHaveBeenCalled();
});
