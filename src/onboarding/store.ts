import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { loadGoals, saveGoal } from '../goals/store';
import { SetupRecordSchema, type SetupRecord } from './model';

export const SETUP_KEY = 'first_launch_setup_v1';

export async function readSetup(db: SQLiteDatabase): Promise<SetupRecord | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    SETUP_KEY,
  );
  if (!row) return null;
  try {
    return SetupRecordSchema.parse(JSON.parse(row.value));
  } catch {
    throw new Error('Your saved setup could not be read. Restart setup to continue.');
  }
}

export async function saveSetup(db: SQLiteDatabase, value: SetupRecord): Promise<void> {
  const record = SetupRecordSchema.parse(value);
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    SETUP_KEY,
    JSON.stringify(record),
  );
}

/** Plan and completion marker commit together, so a failed save never skips setup. */
export async function finishSetup(db: SQLiteDatabase, value: SetupRecord) {
  const record = SetupRecordSchema.parse({ ...value, completed: true });
  await db.withExclusiveTransactionAsync(async (txn) => {
    const goals = await loadGoals(txn);
    const existing = goals.find((g) => g.metric === record.plan.metric);
    await saveGoal(txn, {
      goalId: existing?.goalId ?? randomUUID(),
      metric: record.plan.metric,
      dailyLimit: record.plan.dailyLimit,
      enabled: true,
    });
    await saveSetup(txn, record);
  });
  return record;
}

export async function clearSetup(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM settings WHERE key = ?', SETUP_KEY);
}
