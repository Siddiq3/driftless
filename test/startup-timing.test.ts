import { getStartupTimings, measureStartup } from '@/startup/timing';

it('records only stage duration and preserves the result or rejection of startup operations', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  const now = jest.spyOn(Date, 'now');
  try {
    now.mockReturnValueOnce(100).mockReturnValueOnce(150);
    await expect(measureStartup('fixture-storage', async () => 'ready')).resolves.toBe('ready');
    expect(getStartupTimings().at(-1)).toEqual({ stage: 'fixture-storage', elapsedMs: 50 });
    const failure = new Error('private detail');
    now.mockReturnValueOnce(100).mockReturnValueOnce(1600);
    await expect(
      measureStartup('fixture-profile', async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(getStartupTimings().at(-1)).toEqual({ stage: 'fixture-profile', elapsedMs: 1500 });
    expect(JSON.stringify(getStartupTimings())).not.toContain('private detail');
    const copy = getStartupTimings() as { stage: string; elapsedMs: number }[];
    copy.at(-1)!.stage = 'mutated';
    expect(getStartupTimings().at(-1)!.stage).toBe('fixture-profile');
  } finally {
    now.mockRestore();
    log.mockRestore();
  }
});
