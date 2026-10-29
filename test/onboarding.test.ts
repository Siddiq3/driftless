jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
import { v1 } from '@siddiq3/driftless-contracts';
import { sqlite } from './helpers/sqlite';
import { migrate } from '../src/db/migrations';
import { loadGoals } from '../src/goals/store';
import {
  EMPTY_ANSWERS,
  REEL_LIMITS,
  platformSetupPlan,
  platformSetupStep,
  reelsSetupPlan,
  SetupRecordSchema,
  estimateTime,
  activeSetupStep,
  type SetupRecord,
} from '../src/onboarding/model';
import { finishSetup, readSetup, saveSetup, SETUP_KEY } from '../src/onboarding/store';
import { appInviteMessage } from '../src/social/invite';

it('restores platform-appropriate goals without interpreting reel counts as minutes', () => {
  expect(platformSetupPlan('ios', { metric: 'views', dailyLimit: 150 })).toEqual({
    metric: 'minutes',
    dailyLimit: 30,
  });
  expect(platformSetupPlan('ios', { metric: 'minutes', dailyLimit: 45 })).toEqual({
    metric: 'minutes',
    dailyLimit: 45,
  });
  expect(platformSetupPlan('android', { metric: 'views', dailyLimit: 150 })).toEqual({
    metric: 'views',
    dailyLimit: 150,
  });
  expect(platformSetupStep('ios', 12)).toBe(12);
  expect(platformSetupStep('ios', 13)).toBe(15);
  expect(platformSetupStep('ios', 14)).toBe(15);
  expect(platformSetupStep('android', 13)).toBe(13);
});

const initial = (): SetupRecord => ({
  version: 1,
  completed: false,
  step: 0,
  answers: { ...EMPTY_ANSWERS },
  plan: { metric: 'minutes', dailyLimit: 30 },
});
async function fakeDb(fail = false) {
  const f = sqlite();
  await migrate(f.db);
  if (fail)
    await f.db.execAsync(
      "CREATE TRIGGER fail_save BEFORE INSERT ON goals BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
    );
  const run = f.db.runAsync.bind(f.db);
  f.db.runAsync = jest.fn(run) as unknown as typeof f.db.runAsync;
  const tx = f.db.withExclusiveTransactionAsync.bind(f.db);
  f.db.withExclusiveTransactionAsync = jest.fn(tx);
  return {
    ...f,
    stored: async () =>
      (await f.db.getFirstAsync<{ value: string }>('SELECT value FROM settings'))?.value ?? null,
    goal: async () => (await loadGoals(f.db))[0] ?? null,
  };
}

describe('first-launch local setup', () => {
  it('starts incomplete and persists a resumable draft', async () => {
    const f = await fakeDb();
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
    const f = await fakeDb();
    await finishSetup(f.db, initial());
    expect((await readSetup(f.db))?.completed).toBe(true);
    expect(v1.Goal.parse(await f.goal())).toMatchObject({
      metric: 'minutes',
      dailyLimit: 30,
      enabled: true,
      rev: 1,
    });
    expect(f.db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });
  it('does not complete or save a goal after storage failure', async () => {
    const f = await fakeDb(true);
    await expect(finishSetup(f.db, initial())).rejects.toThrow('disk full');
    expect(await f.stored()).toBeNull();
    expect(await f.goal()).toBeNull();
  });
  it.each(REEL_LIMITS)(
    'saves a %i-reel target without login or tracking permissions',
    async (limit) => {
      const f = await fakeDb();
      await finishSetup(f.db, { ...initial(), plan: { metric: 'views', dailyLimit: limit } });
      expect(v1.Goal.parse(await f.goal())).toMatchObject({
        metric: 'views',
        dailyLimit: limit,
        enabled: true,
        rev: 1,
      });
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
