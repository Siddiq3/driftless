import { useResponsiveLayout } from './responsive';
import { Notice, Button, Details, Screen, T, useTheme } from '@/ui/kit';
import { Platform, Animated, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { BrainCompanion } from './BrainCompanion';
import { BrandMark } from './BrandMark';
import { AppIcon, Icon, iconForMark, type IconName } from './Icon';
import { useProgress, type ProgressState } from '@/goals/useProgress';
import { CountingPermissionBanner } from '@/permissions/CountingPermissionBanner';
import { brainPresentation, countBrainMood } from './brainState';
import { useDataMotion } from './motion';
import { trackingState } from '@/tracking/state';
import { candidateCount, homeAppCount } from '@/tracking/candidateCount';
import { homeCountMessage, homeCountStyles } from './homeCount';

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
      style={[{ maxWidth: '100%' }, transition]}
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
          textAlign: 'center',
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

export function FocusHero({ state, refresh }: { state: ProgressState; refresh: () => void }) {
  const t = useTheme();
  const layout = useResponsiveLayout();
  const data = state.state === 'ok' ? state.p : null;
  const brain = brainPresentation(state);
  const characterMood = countBrainMood(state);
  const health = state.state === 'ok' ? state.health : null;
  const status = health ? trackingState(health) : null;
  const active = health?.implemented && status?.startsWith('tracking');
  const unit = brain.goal?.metric === 'minutes' ? 'min' : 'videos';
  const phrase =
    state.state === 'loading'
      ? 'Waking up…'
      : state.state === 'error'
        ? 'Let’s reconnect.'
        : characterMood === 'drained'
          ? 'Brain battery low. Let’s take five.'
          : characterMood === 'unknown'
            ? 'Ready when you are.'
            : 'Small break. Big brain energy.';
  const daily = state.state === 'ok' ? state.daily : null;
  const experimental = data?.today.views === null ? candidateCount(daily, health) : null;
  const total = data?.today.views ?? experimental;
  const emptyCount = homeCountMessage(state.state, total, Boolean(active), Platform.OS);
  return (
    <>
      <View style={[styles.hero, { gap: layout.gap }]}>
        <BrainCompanion
          initialQuote={phrase}
          quoteMood={characterMood === 'drained' ? 'drained' : 'happy'}
          pose={characterMood === 'drained' ? 'drained' : 'fresh'}
          size={layout.mascotSize}
          still={brain.mood === 'unavailable'}
        />
        {emptyCount ? (
          <View style={homeCountStyles.empty}>
            <T style={homeCountStyles.title}>{emptyCount.title}</T>
            <T muted style={homeCountStyles.detail}>
              {emptyCount.detail}
            </T>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <AnimatedCount
              value={total}
              approximate={
                experimental !== null || data?.today.measurementStatus === 'experimental'
              }
            />
            <T v="label" muted style={{ textAlign: 'center', fontSize: 14 }}>
              Short videos today
            </T>
          </View>
        )}
      </View>
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
              borderRadius: 32,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            {health?.apps
              .filter((app) => app.installed)
              .map((app, index) => {
                const count = homeAppCount(daily, health, app.package);
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
                      paddingHorizontal: 14,
                      minHeight: 48,
                      maxWidth: '100%',
                      flexShrink: 1,
                      marginVertical: 4,
                      borderLeftWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                      borderLeftColor: t.border,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <AppIcon name={app.label} size={26} />
                    <T
                      v="heading"
                      muted={count === null || count === 0}
                      style={count === null || count === 0 ? homeCountStyles.appEmpty : undefined}
                    >
                      {count === null
                        ? 'Pending'
                        : count === 0
                          ? 'Not yet'
                          : count.toLocaleString()}
                    </T>
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
                  {Platform.OS === 'ios' ? 'Choose apps →' : 'Supported apps →'}
                </T>
              </Pressable>
            )}
          </View>
          {active && (
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
  const [state, refresh] = useProgress(61, true);
  const health = state.state === 'ok' ? state.health : null;
  return (
    <Screen
      topBanner={<CountingPermissionBanner health={health} />}
      contentStyle={styles.homeContent}
      tabBarStyle={{ backgroundColor: t.bg, borderTopWidth: 0, paddingTop: 6, paddingBottom: 6 }}
    >
      <View style={styles.brand}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={30} />
          <T v="title" style={{ letterSpacing: -0.8 }}>
            ScrollSnooze
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
      {Platform.OS === 'ios' && (
        <Notice
          title="Screen Time on iPhone"
          body="iPhone activity is not counted as Reels or Shorts. Open app pauses to choose apps privately and start or resume a pause."
        />
      )}
      {account && <View style={{ paddingTop: 8 }}>{account}</View>}
      <HomeActivity>
        <FocusHero state={state} refresh={refresh} />
      </HomeActivity>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Focus and app pauses"
        onPress={() => router.push('/blocking')}
        style={({ pressed }) => [
          styles.focusLink,
          { backgroundColor: '#783F00', opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={styles.proBadge}>
          <Icon name="shield" size={24} color="#2C1A08" />
        </View>
        <T v="label" style={{ flex: 1, fontWeight: '600' }}>
          Focus & app pauses
        </T>
        <Icon name="chevron" size={18} />
      </Pressable>
    </Screen>
  );
}

function HomeActivity({ children }: { children: ReactNode }) {
  const layout = useResponsiveLayout();
  return (
    <View
      style={[styles.homeActivity, { paddingVertical: layout.compact ? 8 : 16, gap: layout.gap }]}
    >
      {children}
    </View>
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
  homeContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 0 },
  homeActivity: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 56,
  },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 18 },
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    borderRadius: 14,
  },
  proBadge: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 28,
    backgroundColor: '#FFE1A4',
    alignItems: 'center',
    justifyContent: 'center',
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
