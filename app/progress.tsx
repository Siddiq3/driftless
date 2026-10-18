import { router } from 'expo-router';
import { View } from 'react-native';
import { achievements } from '@/goals/achievements';
import { useProgress } from '@/goals/useProgress';
import { Button, Card, Notice, Screen, T, useTheme, Details } from '@/ui/kit';
import { Wick, wickLabel } from '@/ui/Wick';
import { Icon } from '@/ui/Icon';

const OUTCOME_COPY = {
  kept: 'On track',
  breached: 'Over your goal',
  unknown: 'Not enough data yet',
} as const;

export default function ProgressScreen() {
  const t = useTheme();
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
      <View
        style={{ alignItems: 'center', backgroundColor: t.hero, borderRadius: 30, padding: 24 }}
      >
        <Wick stage={p.wick.stage} glow={p.wick.glow} />
        <T v="title">{wickLabel(p.wick.stage)}</T>
        <T muted>{p.wick.points} days kept so far</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, padding: 16, backgroundColor: t.warm }}>
          <Icon name="flame" />
          <T v="title">{p.streak.current}</T>
          <T v="caption" muted>
            Day streak
          </T>
        </Card>
        <Card style={{ flex: 1, padding: 16 }}>
          <Icon name="trophy" />
          <T v="title">{p.streak.best}</T>
          <T v="caption" muted>
            Best streak
          </T>
        </Card>
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
          <Button kind="secondary" label="Edit goals" onPress={() => router.push('/goals')} />
        </Card>
      )}

      <Card>
        <T v="heading">Milestones</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {badges.map((b) => (
            <View
              key={b.id}
              accessible
              accessibilityLabel={`${b.title}, ${b.earned ? 'earned' : 'locked'}. ${b.detail}`}
              style={{
                flexBasis: '28%',
                flexGrow: 1,
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: b.earned ? t.warm : t.surfaceRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name={b.earned ? 'trophy' : 'lock'}
                  size={28}
                  color={b.earned ? t.accent : t.textMuted}
                />
              </View>
              <T v="caption" muted={!b.earned} style={{ textAlign: 'center' }}>
                {b.title}
              </T>
            </View>
          ))}
        </View>
      </Card>
      <Details title="About milestones" icon="trophy">
        {badges.map((b) => (
          <T key={b.id} v="caption" muted>
            {b.title}: {b.detail}
          </T>
        ))}
      </Details>
      <Button kind="secondary" label="Stats" onPress={() => router.push('/stats')} />
    </Screen>
  );
}
