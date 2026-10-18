import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space } from '../design-tokens';
import { T, useTheme } from './kit';
import { Wick } from './Wick';
import { Icon, iconForMark, type IconName } from './Icon';
import { Illustration } from './Illustration';
import { useProgress } from '@/goals/useProgress';

export function FocusHero() {
  const t = useTheme();
  const [state] = useProgress(7);
  const data = state.state === 'ok' ? state.p : null;
  const count = data?.today.views;
  return (
    <View style={styles.hero}>
      <View style={[styles.halo, { backgroundColor: t.warm }]} />
      <Wick stage={data?.wick.stage ?? 'ember'} glow={data?.wick.glow ?? 0} size={230} />
      <View style={[styles.count, { backgroundColor: t.accent }]}>
        <Icon name="play" color={t.onAccent} size={24} />
        <T
          v="display"
          accessibilityRole="text"
          style={{ color: t.onAccent, fontSize: 48, lineHeight: 56 }}
        >
          {count == null ? '—' : count.toLocaleString()}
        </T>
        <T v="label" style={{ color: t.onAccent }}>
          Reels & Shorts today
        </T>
      </View>
      {state.state === 'loading' && (
        <T v="caption" muted>
          Loading your count…
        </T>
      )}
      {state.state === 'error' && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/tracking')}>
          <T v="caption" style={{ color: t.warning }}>
            Check tracking status
          </T>
        </Pressable>
      )}
      {state.state === 'ok' && count == null && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/tracking')}>
          <T v="caption" muted>
            No confirmed count · Set up tracking
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function VisualBanner({
  art,
  title,
  subtitle,
}: {
  art: 'focus' | 'friends' | 'wick';
  title?: string;
  subtitle?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: t.hero,
        borderRadius: radius.lg,
        padding: 16,
        gap: 4,
      }}
    >
      <Illustration name={art} size={180} />
      {title && (
        <T v="title" style={{ textAlign: 'center' }}>
          {title}
        </T>
      )}
      {subtitle && (
        <T v="caption" muted style={{ textAlign: 'center' }}>
          {subtitle}
        </T>
      )}
    </View>
  );
}

export function FeatureTile({
  label,
  art,
  icon,
  onPress,
}: {
  label: string;
  art?: 'focus' | 'friends' | 'wick';
  icon?: IconName;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {art ? (
        <Illustration name={art} size={112} />
      ) : (
        <View style={{ height: 112, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon ?? 'chart'} size={48} />
        </View>
      )}
      <T v="label" style={{ textAlign: 'center', fontWeight: '600' }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Dashboard({ guest = false }: { guest?: boolean }) {
  const t = useTheme();
  return (
    <>
      <View style={styles.brand}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="flame" size={26} />
          <T v="title">driftless</T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={guest ? 'Privacy' : 'Settings'}
          onPress={() => router.push(guest ? '/privacy' : '/settings')}
          style={styles.iconButton}
        >
          <Icon name={guest ? 'shield' : 'settings'} size={22} color={t.textMuted} />
        </Pressable>
      </View>
      <FocusHero />
      <View style={styles.grid}>
        <FeatureTile label="Focus" art="focus" onPress={() => router.push('/blocking')} />
        <FeatureTile label="Friends" art="friends" onPress={() => router.push('/friends')} />
        <FeatureTile label="Daily goals" icon="target" onPress={() => router.push('/goals')} />
        <FeatureTile label="Progress" icon="chart" onPress={() => router.push('/stats')} />
      </View>
    </>
  );
}

export function ActionCard({
  title,
  body,
  mark,
  onPress,
}: {
  title: string;
  body?: string;
  mark: string;
  onPress: () => void;
  warm?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, body].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Icon name={iconForMark(mark)} />
      <T v="label" style={{ flex: 1 }}>
        {title}
      </T>
      <Icon name="chevron" size={18} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  halo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 16, opacity: 0.5 },
  count: {
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: 'center',
    gap: 0,
    marginTop: -30,
    minWidth: 210,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 120,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
    minHeight: 64,
  },
});
