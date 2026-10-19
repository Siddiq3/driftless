import {
  EMPTY_ANSWERS,
  REEL_LIMITS,
  reelsSetupPlan,
  SetupRecordSchema,
  estimateTime,
  activeSetupStep,
  type SetupRecord,
} from '../src/onboarding/model';
import { finishSetup, readSetup, saveSetup, SETUP_KEY } from '../src/onboarding/store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { appInviteMessage } from '../src/social/invite';

const initial = (): SetupRecord => ({
  version: 1,
  completed: false,
  step: 0,
  answers: { ...EMPTY_ANSWERS },
  plan: { metric: 'minutes', dailyLimit: 30 },
});
function fakeDb(fail = false) {
  let stored: string | null = null;
  let goal: unknown[] | null = null;
  const db = {
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('FROM settings') ? (stored === null ? null : { value: stored }) : null,
    ),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) => {
      if (fail) throw new Error('disk full');
      if (sql.includes('INTO goals')) goal = args;
      if (sql.includes('INTO settings')) stored = args[1] as string;
    }),
    withExclusiveTransactionAsync: jest.fn(async (fn: (db: unknown) => Promise<void>) => {
      const previous = { stored, goal };
      try {
        await fn(db);
      } catch (e) {
        stored = previous.stored;
        goal = previous.goal;
        throw e;
      }
    }),
  };
  return { db: db as unknown as SQLiteDatabase, stored: () => stored, goal: () => goal };
}

describe('first-launch local setup', () => {
  it('starts incomplete and persists a resumable draft', async () => {
    const f = fakeDb();
    expect(await readSetup(f.db)).toBeNull();
    const value = { ...initial(), step: 4 };
    await saveSetup(f.db, value);
    expect(await readSetup(f.db)).toEqual(value);
    expect(f.db.runAsync).toHaveBeenCalledWith(
      expect.any(String),
      SETUP_KEY,
      JSON.stringify(value),
    );
  });
  it('saves the real goal and completion together without login', async () => {
    const f = fakeDb();
    await finishSetup(f.db, initial());
    expect((await readSetup(f.db))?.completed).toBe(true);
    expect(f.goal()).toEqual(['setup-minutes', 'minutes', 30, 1, 1]);
    expect(f.db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });
  it('does not complete or save a goal after storage failure', async () => {
    const f = fakeDb(true);
    await expect(finishSetup(f.db, initial())).rejects.toThrow('disk full');
    expect(f.stored()).toBeNull();
    expect(f.goal()).toBeNull();
  });
  it.each(REEL_LIMITS)(
    'saves a %i-reel target without login or tracking permissions',
    async (limit) => {
      const f = fakeDb();
      await finishSetup(f.db, { ...initial(), plan: { metric: 'views', dailyLimit: limit } });
      expect(f.goal()).toEqual(['setup-views', 'views', limit, 1, 1]);
      expect((await readSetup(f.db))?.plan).toEqual({ metric: 'views', dailyLimit: limit });
    },
  );
  it('defaults to reels and migrates legacy minutes drafts without reinterpreting minutes as reels', () => {
    expect(reelsSetupPlan()).toEqual({ metric: 'views', dailyLimit: 50 });
    expect(reelsSetupPlan(initial().plan)).toEqual({ metric: 'views', dailyLimit: 50 });
    expect(reelsSetupPlan({ metric: 'views', dailyLimit: 100 })).toEqual({
      metric: 'views',
      dailyLimit: 100,
    });
  });
  it('rejects invalid persisted answers and limits', () => {
    expect(SetupRecordSchema.safeParse({ ...initial(), step: 100 }).success).toBe(false);
    expect(
      SetupRecordSchema.safeParse({ ...initial(), plan: { metric: 'minutes', dailyLimit: 0 } })
        .success,
    ).toBe(false);
  });
  it('does not invent an estimate from skipped answers', () => {
    expect(estimateTime(EMPTY_ANSWERS, initial().plan)).toBeNull();
  });
  it('estimates scrolling time without money values', () => {
    expect(estimateTime({ ...EMPTY_ANSWERS, usage: '1to3' }, initial().plan)).toEqual({
      hoursPerDay: 2,
      hoursPerWeek: 14,
      possibleMinutesPerDay: 90,
    });
  });
  it('skips the retired income question on next, back and resume', () => {
    expect(activeSetupStep(7)).toBe(8);
    expect(activeSetupStep(7, 'back')).toBe(6);
    expect(activeSetupStep(8)).toBe(8);
  });
  it('drops legacy income answers when reading a saved setup', () => {
    const record = SetupRecordSchema.parse({
      ...initial(),
      answers: { ...EMPTY_ANSWERS, income: '50000' },
    });
    expect(record.answers).not.toHaveProperty('income');
    expect(estimateTime({ ...record.answers, usage: '1to3' }, record.plan)).not.toHaveProperty(
      'annualTimeValue',
    );
  });
  it('does not calculate time saved from a video cap', () => {
    expect(
      estimateTime({ ...EMPTY_ANSWERS, usage: '1to3' }, { metric: 'views', dailyLimit: 50 })
        ?.possibleMinutesPerDay,
    ).toBeNull();
  });
  it('guest sharing contains no credentials, totals, or fabricated friend code', () => {
    const message = appInviteMessage();
    expect(message).toContain('without an account');
    expect(message).not.toMatch(/https?:|token|invite code|views today/i);
  });
});
