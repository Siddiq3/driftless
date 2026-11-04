import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { T } from '@/ui/kit';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { wickLabel } from '@/ui/Wick';
import { useProgress } from './useProgress';
import { streakSummary } from './streakCard';

/** Surfaces the streak, Wick stage and achievements that progress() already computes. */
export function StreakCard() {
  const [state] = useProgress();
  if (state.state !== 'ok') return null;
  const hasGoal = state.goals.some((g) => g.enabled);
  if (!hasGoal)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set a daily goal to start a streak"
        onPress={() => router.push('/goals')}
        style={styles.card}
      >
        <View style={styles.row}>
          <BrainCharacter pose="fresh" size={72} still />
          <View style={styles.copy}>
            <T style={styles.title}>Start a streak</T>
            <T style={styles.muted}>
              Set a daily goal and your companion grows with every day you keep it.
            </T>
          </View>
        </View>
      </Pressable>
    );
  const s = streakSummary(state.p);
  const stage = wickLabel(s.stage);
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${s.current} day streak, best ${s.best}. Companion stage ${stage}${s.next ? `, ${s.next.remaining} kept days to ${wickLabel(s.next.stage)}` : ''}.`}
    >
      <View style={styles.row}>
        <BrainCharacter pose={s.pose} size={84} />
        <View style={styles.copy}>
          <View style={styles.streakLine}>
            <T style={styles.flame}>🔥</T>
            <T style={styles.count}>{s.current}</T>
            <T style={styles.unit}>{s.current === 1 ? 'day' : 'days'}</T>
          </View>
          <T style={styles.muted}>{s.headline}</T>
          <T v="caption" style={styles.muted}>
            Best streak: {s.best} {s.best === 1 ? 'day' : 'days'}
          </T>
        </View>
      </View>
      <View style={styles.stage}>
        <View style={styles.stageHead}>
          <T style={styles.stageName}>{stage}</T>
          <T v="caption" style={styles.muted}>
            {s.next
              ? `${s.next.remaining} more kept ${s.next.remaining === 1 ? 'day' : 'days'} to ${wickLabel(s.next.stage)}`
              : 'Final stage reached'}
          </T>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round((s.next?.ratio ?? 1) * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.badges}>
        {s.earned.map((a) => (
          <View key={a.id} style={styles.badge}>
            <T v="caption" style={styles.badgeText}>
              ★ {a.title}
            </T>
          </View>
        ))}
        {s.upcoming && (
          <View style={[styles.badge, styles.locked]}>
            <T v="caption" style={styles.muted}>
              Next: {s.upcoming.detail}
            </T>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#15140F', borderRadius: 22, padding: 18, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  streakLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  flame: { fontSize: 22 },
  count: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: '#FFE1A4' },
  unit: { fontSize: 16, fontWeight: '600', color: '#FFE1A4' },
  muted: { color: '#AAA69A', fontSize: 14 },
  stage: { gap: 8 },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  stageName: { fontWeight: '700', color: '#C4A0FF' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#29271F', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#C4A0FF' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    backgroundColor: '#2E2540',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: '#E6D8FF', fontWeight: '600' },
  locked: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3A3628' },
});
