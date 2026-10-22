import { WrapEntry } from '@/wrapped/Entry';
import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import { Button, Details, T, useTheme } from './kit';
import { BrainCharacter } from './BrainCharacter';
import { BrandMark } from './BrandMark';
import { AppIcon, Icon, iconForMark, type IconName } from './Icon';
import { useProgress } from '@/goals/useProgress';
import { brainPresentation } from './brainState';
import { useDataMotion } from './motion';
import { trackingState } from '@/tracking/state';
import { candidateCount } from '@/tracking/candidateCount';

export function AnimatedCount({
  value,
  approximate = false,
}: {
  value: number | null;
  approximate?: boolean;
}) {
  const transition = useDataMotion(value);
  const t = useTheme();
  return (
    <Animated.View
      style={transition}
      accessible
      accessibilityLabel={
        value === null
          ? 'Count unavailable'
          : `${value} short videos${approximate ? ', on this phone' : ''}`
      }
    >
      <T
        accessibilityRole="text"
        style={{
          fontSize: 60,
          lineHeight: 70,
          fontWeight: '900',
          letterSpacing: -3,
          color: t.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value === null ? '—' : value.toLocaleString()}
      </T>
    </Animated.View>
  );
}

export function FocusHero() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const [state, refresh] = useProgress(61, true);
  const data = state.state === 'ok' ? state.p : null;
  const brain = brainPresentation(state);
  const health = state.state === 'ok' ? state.health : null;
  const status = health ? trackingState(health) : null;
  const active = health?.implemented && status?.startsWith('tracking');
  const unit = brain.goal?.metric === 'minutes' ? 'min' : 'videos';
  const phrase =
    state.state === 'loading'
      ? 'Waking up…'
      : state.state === 'error'
        ? 'Let’s reconnect.'
        : {
            idle: 'Finding your rhythm.',
            tracking: 'Room to breathe.',
            'goal-reached': 'Look at you grow.',
            'high-usage': 'Pause with me?',
            'limit-reached': 'Let’s take a breather.',
            unavailable: 'Ready when you are.',
          }[brain.mood];
  const daily = state.state === 'ok' ? state.daily : null;
  const experimental = data?.today.views === null ? candidateCount(daily, health) : null;
  return (
    <>
      <View style={styles.hero}>
        <View
          style={{
            backgroundColor: t.accent,
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}
        >
          <T v="label" style={{ color: t.onAccent, textAlign: 'center', fontWeight: '600' }}>
            {phrase}
          </T>
        </View>
        <BrainCharacter
          pose={brain.mood === 'high-usage' || brain.mood === 'limit-reached' ? 'tired' : 'wave'}
          size={Math.min(width - 72, height < 760 ? 140 : 160)}
          still={brain.mood === 'unavailable'}
        />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AnimatedCount
            value={data?.today.views ?? experimental}
            approximate={experimental !== null}
          />
          <T v="label" muted>
            Short videos today
          </T>
          {state.state === 'ok' &&
            data?.today.views === null &&
            experimental === null &&
            !active && (
              <T v="caption" muted>
                Counting is off
              </T>
            )}
        </View>
      </View>
      {experimental !== null && (
        <Details title="About your count">
          <T v="caption" muted>
            This count is recorded on your phone. App-version accuracy has not been approved for
            goal results, weekly summaries or cloud comparisons yet.
          </T>
        </Details>
      )}
      {state.state === 'error' && (
        <>
          <Button label="Try again" onPress={refresh} />
          <Details title="Activity unavailable">
            <T v="caption" muted>
              {state.message}
            </T>
          </Details>
        </>
      )}
      {state.state === 'ok' && (
        <>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignSelf: 'center',
              justifyContent: 'center',
              backgroundColor: t.surfaceRaised,
              borderRadius: 28,
              paddingHorizontal: 12,
              gap: 4,
            }}
          >
            {health?.apps
              .filter((app) => app.installed)
              .map((app) => {
                const count =
                  app.validated && (daily?.heartbeatMinutes ?? 0) > 0
                    ? (daily?.apps.find((a) => a.package === app.package)?.views ?? 0)
                    : null;
                return (
                  <Pressable
                    key={app.package}
                    accessibilityRole="button"
                    accessibilityLabel={`${app.label}: ${count === null ? 'count unavailable' : `${count} videos`}. Open Counter`}
                    onPress={() => router.push('/tracking')}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      paddingHorizontal: 10,
                      minHeight: 52,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <AppIcon name={app.label} size={26} />
                    <T v="heading">{count === null ? '—' : count.toLocaleString()}</T>
                  </Pressable>
                );
              })}
            {!health?.apps.some((app) => app.installed) && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/tracking')}
                style={styles.textAction}
              >
                <T v="label" muted>
                  Supported apps →
                </T>
              </Pressable>
            )}
          </View>
          {!active ? (
            <Button label="Enable counting" onPress={() => router.push('/tracking')} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                brain.remaining === null
                  ? 'Set or review daily goals'
                  : `${brain.remaining} ${unit} left of ${brain.goal?.dailyLimit}. Review daily goals`
              }
              onPress={() => router.push('/goals')}
              style={[styles.goalLink, { borderColor: t.border }]}
            >
              <Icon name="target" size={18} color={t.success} />
              <T v="label" muted>
                {brain.remaining === null
                  ? brain.goal
                    ? 'Review daily goal'
                    : 'Set a daily goal'
                  : `${brain.remaining} ${unit} left today`}
              </T>
              <Icon name="chevron" size={16} color={t.textMuted} />
            </Pressable>
          )}
        </>
      )}
    </>
  );
}

/** Compact, open introduction for task screens, with meaningful original vector symbols. */
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
    <View style={{ paddingVertical: 4, gap: 12, alignItems: 'center', flexDirection: 'row' }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: t.warm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={art === 'friends' ? 'friends' : art === 'focus' ? 'target' : 'flame'}
          size={24}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T v="heading">
          {title ??
            (art === 'focus'
              ? 'Find your focus.'
              : art === 'friends'
                ? 'Better, together.'
                : 'Small goals. Real change.')}
        </T>
        {subtitle && (
          <T v="caption" muted>
            {subtitle}
          </T>
        )}
      </View>
    </View>
  );
}

export function Dashboard({ guest = false, account }: { guest?: boolean; account?: ReactNode }) {
  const t = useTheme();
  return (
    <>
      <View style={styles.brand}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={34} />
          <T v="title" style={{ letterSpacing: -0.8 }}>
            driftless.
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={guest ? 'Privacy' : 'Settings'}
          onPress={() => router.push(guest ? '/privacy' : '/settings')}
          style={styles.iconButton}
        >
          <Icon name={guest ? 'shield' : 'settings'} size={23} color={t.textMuted} />
        </Pressable>
      </View>
      {account}
      <FocusHero />
      <WrapEntry prompt />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Focus and app pauses. Requires Pro."
        onPress={() => router.push('/blocking')}
        style={({ pressed }) => [
          styles.focusLink,
          { backgroundColor: t.warm, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Icon name="lock" size={20} />
        <T v="label" style={{ flex: 1, fontWeight: '600' }}>
          Focus & app pauses
        </T>
        <T v="caption" style={{ color: t.accent, fontWeight: '700' }}>
          PRO
        </T>
        <Icon name="chevron" size={18} />
      </Pressable>
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
        { borderColor: t.border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Icon name={iconForMark(mark)} size={23} />
      <View style={{ flex: 1, gap: 3 }}>
        <T v="label" style={{ fontWeight: '600' }}>
          {title}
        </T>
        {body && (
          <T v="caption" muted>
            {body}
          </T>
        )}
      </View>
      <Icon name="chevron" size={18} color={t.textMuted} />
    </Pressable>
  );
}

// Kept for consumers outside the current routes; uses the same open navigation treatment.
export function FeatureTile({
  label,
  icon = 'target',
  onPress,
}: {
  label: string;
  art?: 'focus' | 'friends' | 'wick';
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <Icon name={icon} />
      <T v="label">{label}</T>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 4 },
  textAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  goalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 48,
  },
  focusLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 56,
    borderRadius: 18,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    gap: 16,
    minHeight: 72,
  },
});
