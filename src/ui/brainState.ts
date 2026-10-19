import type { ProgressState } from '../goals/useProgress';
import { trackingState } from '../tracking/state';

export type BrainMood =
  | 'idle'
  | 'tracking'
  | 'goal-reached'
  | 'high-usage'
  | 'limit-reached'
  | 'unavailable';

/** A goal is an allowance: reaching the cap never earns a celebration. */
export function brainPresentation(s: ProgressState) {
  if (s.state !== 'ok')
    return { mood: 'unavailable' as BrainMood, ratio: null, goal: undefined, remaining: null };
  const status = trackingState(s.health);
  const enabled = s.goals.filter((g) => g.enabled);
  // The highest measured ratio prevents a second goal from hiding a breach.
  const measured = enabled
    .map((goal) => ({ goal, value: s.p.today[goal.metric] }))
    .filter((x) => x.value !== null);
  measured.sort(
    (a, b) => b.value! / Math.max(1, b.goal.dailyLimit) - a.value! / Math.max(1, a.goal.dailyLimit),
  );
  const chosen = measured[0];
  const goal = chosen?.goal ?? enabled[0];
  const ratio = chosen ? chosen.value! / Math.max(1, chosen.goal.dailyLimit) : null;
  const remaining = chosen ? Math.max(0, chosen.goal.dailyLimit - chosen.value!) : null;
  const unavailable = !s.health.implemented || !status.startsWith('tracking');
  let mood: BrainMood = unavailable
    ? 'unavailable'
    : status === 'tracking_unvalidated'
      ? 'idle'
      : 'tracking';
  if (ratio !== null && !unavailable) {
    if (ratio >= 1 || s.p.today.outcome === 'breached') mood = 'limit-reached';
    else if (ratio >= 0.8) mood = 'high-usage';
    else if ([3, 7, 14, 30, 60].includes(s.p.streak.current)) mood = 'goal-reached';
  }
  return { mood, ratio, goal, remaining };
}
