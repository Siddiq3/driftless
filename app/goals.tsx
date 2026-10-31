import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { v1 } from '@siddiq3/driftless-contracts';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { getDb } from '@/db';
import { storageScope } from '@/db/scope';
import { ProtectionNotice } from '@/billing/ProtectionNotice';
import {
  ensureNotificationPermission,
  eveningReminderEnabled,
  setEveningReminder,
} from '@/goals/reminders';
import { loadGoals, saveGoal } from '@/goals/store';
import { useProgress } from '@/goals/useProgress';
import { candidateCount } from '@/tracking/candidateCount';
import { Icon } from '@/ui/Icon';
import { Notice, T, Toggle } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

export const STEPS: Record<v1.Goal['metric'], number[]> = {
  minutes: [10, 15, 20, 30, 45, 60, 90, 120],
  views: [10, 20, 30, 50, 75, 100, 150],
};
const COPY: Record<v1.Goal['metric'], { title: string; unit: string }> = {
  views: { title: 'Reels & Shorts', unit: 'videos a day' },
  minutes: { title: 'Time in Instagram & YouTube', unit: 'minutes a day' },
};

/** Next allowed step from the current value, so odd synced values snap into the list. */
export function stepFrom(metric: v1.Goal['metric'], value: number, dir: 1 | -1) {
  const steps = STEPS[metric];
  if (dir > 0) return steps.find((v) => v > value) ?? steps[steps.length - 1]!;
  return [...steps].reverse().find((v) => v < value) ?? steps[0]!;
}

function Stepper({
  label,
  disabled,
  onPress,
  icon,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  icon: 'plus' | 'minus';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.step,
        {
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Icon name={icon} size={24} color={C.text} />
    </Pressable>
  );
}

function GoalCard({
  metric,
  existing,
  used,
  fontsLoaded,
}: {
  metric: v1.Goal['metric'];
  existing?: v1.Goal;
  used: number | null;
  fontsLoaded: boolean;
}) {
  const goalId = useRef(existing?.goalId ?? randomUUID());
  const inFlight = useRef(false);
  const [limit, setLimit] = useState(existing?.dailyLimit ?? (metric === 'minutes' ? 30 : 50));
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [status, setStatus] = useState<{ text: string; warn?: boolean } | null>(null);
  const lastSaved = useRef({ limit, enabled });
  const steps = STEPS[metric];

  const save = async (next: { limit?: number; enabled?: boolean }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const want = { limit: next.limit ?? limit, enabled: next.enabled ?? enabled };
    setLimit(want.limit);
    setEnabled(want.enabled);
    try {
      const db = await getDb();
      const g = await saveGoal(db, {
        goalId: goalId.current,
        metric,
        dailyLimit: want.limit,
        enabled: want.enabled,
      });
      lastSaved.current = { limit: g.dailyLimit, enabled: g.enabled };
      const account = storageScope().startsWith('account:');
      setStatus({ text: account ? 'Saved · Your account limit updates tomorrow' : 'Saved' });
      try {
        const all = await loadGoals(db);
        Tracking.setLimits(
          all.filter((x) => x.enabled).map((x) => ({ metric: x.metric, dailyLimit: x.dailyLimit })),
        );
        if (g.enabled) {
          Tracking.enableGoalAlerts?.();
          void ensureNotificationPermission().catch(() =>
            setStatus({ text: 'Saved · Turn on notifications to get alerts', warn: true }),
          );
        }
      } catch {
        setStatus({ text: 'Saved · Alerts unavailable on this phone', warn: true });
      }
    } catch {
      setLimit(lastSaved.current.limit);
      setEnabled(lastSaved.current.enabled);
      setStatus({ text: 'Not saved. Please try again.', warn: true });
    } finally {
      inFlight.current = false;
    }
  };

  const copy = COPY[metric];
  const ratio = used == null ? null : Math.min(1, used / limit);
  const over = used != null && used >= limit;
  return (
    <View style={[styles.card, !enabled && styles.cardOff]}>
      <View style={styles.cardHead}>
        <T style={styles.cardTitle}>{copy.title}</T>
        <Toggle
          accessibilityLabel={`${copy.title} goal`}
          value={enabled}
          onValueChange={(v) => void save({ enabled: v })}
        />
      </View>

      <View style={styles.stepper}>
        <Stepper
          icon="minus"
          label={`Lower ${copy.title} limit`}
          disabled={limit <= steps[0]!}
          onPress={() => void save({ limit: stepFrom(metric, limit, -1) })}
        />
        <View
          accessible
          accessibilityLabel={`${limit} ${copy.unit}`}
          style={{ alignItems: 'center', minWidth: 120 }}
        >
          <T
            allowFontScaling={false}
            style={{
              ...styles.value,
              fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
              fontWeight: fontsLoaded ? '400' : '900',
            }}
          >
            {String(limit)}
          </T>
          <T style={{ color: C.muted, fontSize: 15 }}>{copy.unit}</T>
        </View>
        <Stepper
          icon="plus"
          label={`Raise ${copy.title} limit`}
          disabled={limit >= steps[steps.length - 1]!}
          onPress={() => void save({ limit: stepFrom(metric, limit, 1) })}
        />
      </View>

      {enabled && (
        <View style={{ gap: 8 }}>
          <View style={styles.track}>
            {ratio != null && (
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(ratio * 100, 2)}%`,
                    backgroundColor: over ? '#FF8A65' : C.accent,
                  },
                ]}
              />
            )}
          </View>
          <T style={{ color: over ? '#FF8A65' : C.muted, fontSize: 14 }}>
            {used == null
              ? 'Today: not measured yet'
              : over
                ? `Today: ${used} of ${limit} · Limit reached`
                : `Today: ${used} of ${limit}`}
          </T>
        </View>
      )}
      {status && (
        <T style={{ color: status.warn ? '#FF8A65' : C.accent, fontSize: 13 }}>{status.text}</T>
      )}
    </View>
  );
}

function EveningReminder() {
  const [on, setOn] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    getDb()
      .then(eveningReminderEnabled)
      .then(setOn)
      .catch(() => setOn(false));
  }, []);
  if (on === null) return null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Icon name="clock" size={22} color={C.muted} />
        <View style={{ flex: 1, gap: 2 }}>
          <T style={styles.cardTitle}>Evening check-in</T>
          <T style={{ color: C.muted, fontSize: 14 }}>A reminder at 9 pm</T>
        </View>
        <Toggle
          accessibilityLabel="Evening check-in reminder"
          value={on}
          onValueChange={(v) => {
            getDb()
              .then((db) => setEveningReminder(db, v))
              .then((result) => {
                setOn(result);
                setNote(
                  v && !result ? 'Turn on notifications for ScrollSnooze in Settings.' : null,
                );
              })
              .catch(() => setNote('Could not change the reminder. Please try again.'));
          }}
        />
      </View>
      {note && <T style={{ color: '#FF8A65', fontSize: 13 }}>{note}</T>}
    </View>
  );
}

export default function Goals() {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [s] = useProgress(1);
  const android = Platform.OS === 'android';
  const ok = s.state === 'ok' ? s : null;
  const find = (m: v1.Goal['metric']) => ok?.goals.find((g) => g.metric === m);
  const views = ok ? (ok.p.today.views ?? candidateCount(ok.daily, ok.health)) : null;
  const minutes = ok ? ok.p.today.minutes : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="back" size={22} color={C.text} />
        </Pressable>
        <View style={{ gap: 6 }}>
          <T
            accessibilityRole="header"
            style={{
              color: C.text,
              fontSize: 32,
              lineHeight: 40,
              fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
              fontWeight: fontsLoaded ? '400' : '900',
            }}
          >
            Daily goals
          </T>
          <T style={{ color: C.muted, fontSize: 15, lineHeight: 22 }}>
            {android
              ? 'Set a daily limit. You’ll get a heads-up at 80% and when you reach it.'
              : 'Set a daily intention for your screen time.'}
          </T>
        </View>

        {s.state === 'error' && (
          <Notice tone="warn" title="Goals could not be loaded" body={s.message} />
        )}
        {ok && (
          <>
            {android && <ProtectionNotice />}
            {android && (
              <GoalCard
                metric="views"
                existing={find('views')}
                used={views}
                fontsLoaded={!!fontsLoaded}
              />
            )}
            <GoalCard
              metric="minutes"
              existing={find('minutes')}
              used={minutes}
              fontsLoaded={!!fontsLoaded}
            />
            <EveningReminder />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  card: { gap: 18, padding: 18, borderRadius: 20, backgroundColor: '#17160F' },
  cardOff: { opacity: 0.75 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: '800', flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29271F',
  },
  value: { color: C.text, fontSize: 56, lineHeight: 64 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#29271F' },
  fill: { height: 8, borderRadius: 4 },
});
