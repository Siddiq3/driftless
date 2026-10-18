import { router } from 'expo-router';
import { View } from 'react-native';
import { achievements } from '@/goals/achievements';
import { useProgress } from '@/goals/useProgress';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';
import { Wick, wickLabel } from '@/ui/Wick';

const OUTCOME_COPY = {
  kept: 'On track',
  breached: 'Over your goal',
  unknown: 'Not enough data yet',
} as const;

export default function ProgressScreen() {
  const [s] = useProgress();
  if (s.state === 'loading') return <Screen>{null}</Screen>;
  if (s.state === 'error') {
    return (
      <Screen>
        <Notice tone="warn" title="Progress could not be read" body={s.message} />
      </Screen>
    );
  }
  const { p, goals } = s;
  const badges = achievements(p);
  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <Wick stage={p.wick.stage} glow={p.wick.glow} />
        <T v="title">{wickLabel(p.wick.stage)}</T>
        <T muted>{p.wick.points} days kept so far</T>
      </View>

      {goals.filter((g) => g.enabled).length === 0 ? (
        <Card>
          <T v="heading">Set a daily goal</T>
          <T muted>Wick grows with every day you stay within your goal.</T>
          <Button label="Set a goal" onPress={() => router.push('/goals')} />
        </Card>
      ) : (
        <Card>
          <T v="heading">Today: {OUTCOME_COPY[p.today.outcome]}</T>
          <T muted>
            {p.today.minutes === null ? 'Minutes not tracked' : `${p.today.minutes} min`}
            {p.today.views === null ? '' : ` · ${p.today.views} videos`}
          </T>
          <T muted>
            Streak: {p.streak.current} day{p.streak.current === 1 ? '' : 's'} · best {p.streak.best}
          </T>
          <Button kind="secondary" label="Edit goals" onPress={() => router.push('/goals')} />
        </Card>
      )}

      <Card>
        <T v="heading">Milestones</T>
        {badges.map((b) => (
          <T key={b.id} muted>
            {b.earned ? '★' : '☆'} {b.title} — {b.detail}
          </T>
        ))}
      </Card>
      <Button kind="secondary" label="Stats" onPress={() => router.push('/stats')} />
    </Screen>
  );
}
