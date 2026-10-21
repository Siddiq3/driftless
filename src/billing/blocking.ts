import type { SQLiteDatabase } from 'expo-sqlite';
import { Tracking, type BlockingConfig } from 'tracking-android';

const KEY = 'blocking_config';
export const DEFAULT_BLOCKING: BlockingConfig = {
  enabled: false,
  apps: [],
  dailyMinutes: 30,
  schedules: [],
  feedOnly: true,
  enforceVideoGoal: false,
  breaksEnabled: false,
  breakEveryViews: 50,
  breakMinutes: 5,
  maxBypassesPerDay: 3,
  bypassMinutes: 5,
  allowUnvalidatedCounts: false,
};

export async function loadBlocking(db: SQLiteDatabase): Promise<BlockingConfig> {
  const r = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    KEY,
  );
  return r
    ? { ...DEFAULT_BLOCKING, feedOnly: false, ...(JSON.parse(r.value) as Partial<BlockingConfig>) }
    : DEFAULT_BLOCKING;
}

/** Saves locally and mirrors to the native service (which enforces it only with verified Pro). */
export async function saveBlocking(db: SQLiteDatabase, c: BlockingConfig): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    KEY,
    JSON.stringify(c),
  );
  Tracking.setBlocking(c);
}

export const PRESETS: { label: string; days: number[]; startMinute: number; endMinute: number }[] =
  [
    {
      label: 'Work hours (Mon–Fri 9–17)',
      days: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    },
    {
      label: 'Bedtime (every day 22–07)',
      days: [1, 2, 3, 4, 5, 6, 7],
      startMinute: 22 * 60,
      endMinute: 7 * 60,
    },
    {
      label: 'Morning (every day 06–09)',
      days: [1, 2, 3, 4, 5, 6, 7],
      startMinute: 6 * 60,
      endMinute: 9 * 60,
    },
  ];
