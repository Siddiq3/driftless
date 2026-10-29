/** Startup diagnostics contain stage names and durations only, never account or token data. */
export const UPDATE_STARTUP_BUDGET_MS = 1500;
export const STARTUP_HELP_DELAY_MS = 8000;
type StartupTiming = { stage: string; elapsedMs: number };
const timings: StartupTiming[] = [];
export const getStartupTimings = (): readonly StartupTiming[] =>
  timings.map((timing) => ({ ...timing }));

export async function measureStartup<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await operation();
  } finally {
    const timing = { stage, elapsedMs: Math.max(0, Date.now() - started) };
    timings.push(timing);
    if (timings.length > 32) timings.shift();
    if (__DEV__ && timing.elapsedMs >= 1000) console.info('startup_timing', timing);
  }
}
