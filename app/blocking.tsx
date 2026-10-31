import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BlockingConfig, FocusSchedule } from 'tracking-android';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { PRESETS } from '@/billing/blocking';
import { protectionStatus } from '@/billing/protectionStatus';
import { matchesSchedule, scheduleLabel, SCHEDULE_NAMES } from '@/focus/schedules';
import { useFocusSettings, type FocusSettings } from '@/focus/useFocusSettings';
import { AppIcon, Icon, type IconName } from '@/ui/Icon';
import { LoadingState, Notice, T, Toggle } from '@/ui/kit';
import { useReducedMotion } from '@/ui/motion';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

export const LIMITS = [15, 20, 30, 45, 60, 90, 120];
const reveal = FadeIn.duration(220);
const hide = FadeOut.duration(140);
const glide = LinearTransition.duration(220);

/** One plain sentence for the state the user is in. Warnings come from the shared policy. */
export function focusSummary(cfg: BlockingConfig): string {
  if (!cfg.enabled) return 'Your choices are saved for when you turn pauses on.';
  const where = cfg.feedOnly ? 'Reels & Shorts' : 'the app';
  if (cfg.dailyMinutes !== null) return `Pausing ${where} after ${cfg.dailyMinutes} min a day.`;
  if (cfg.schedules.length) return `Pausing ${where} during your focus times.`;
  return 'Pick a daily limit or a focus time below.';
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Reanimated.View layout={glide} style={styles.card}>
      {title && <T style={styles.cardLabel}>{title}</T>}
      {children}
    </Reanimated.View>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      {icon && <Icon name={icon} size={20} color={C.muted} />}
      <View style={{ flex: 1, gap: 2 }}>
        <T style={styles.rowText}>{label}</T>
        {hint && <T style={styles.hint}>{hint}</T>}
      </View>
      <Toggle accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

function Chips<V extends number>({
  label,
  values,
  value,
  format,
  onChange,
}: {
  label: string;
  values: V[];
  value: V;
  format: (v: V) => string;
  onChange: (v: V) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <T style={styles.hint}>{label}</T>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {values.map((v) => {
          const on = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${format(v)}`}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(v)}
              style={({ pressed }) => [
                styles.chip,
                on && styles.chipOn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <T style={{ color: on ? C.brown : C.text, fontWeight: '700', fontSize: 15 }}>
                {format(v)}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The one authored moment: the shield breathes while pauses are on. */
function StatusCard({ settings, fontsLoaded }: { settings: FocusSettings; fontsLoaded: boolean }) {
  const { cfg, health, goal, saving } = settings;
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const on = !!cfg?.enabled;
  useEffect(() => {
    if (!on || reduced) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [on, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.15 + pulse.value * 0.25,
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));
  if (!cfg) return null;
  const status = health ? protectionStatus(cfg, health, goal) : null;
  const needsCounting =
    !!health?.implemented &&
    (!health.disclosureAccepted || !health.serviceEnabled || !health.serviceRunning);
  // "On" is claimed only when the shared readiness policy passes; otherwise say why.
  const message = !on
    ? null
    : !health
      ? 'App pauses need the Android accessibility service in a supported ScrollSnooze build.'
      : needsCounting
        ? 'Turn on counting so ScrollSnooze can pause your feeds.'
        : status?.tone === 'warn'
          ? status.body
          : null;
  const title = !on ? 'Pauses are off' : message ? 'Pauses need attention' : 'Pauses are on';
  return (
    <Reanimated.View layout={glide} style={[styles.card, styles.status]}>
      <View style={styles.row}>
        <View style={styles.shieldWrap}>
          <Reanimated.View
            style={[styles.shieldRing, { backgroundColor: on ? C.accent : '#55524A' }, ring]}
          />
          <View style={[styles.shield, { backgroundColor: on ? C.accent : '#29271F' }]}>
            <Icon name="shield" size={26} color={on ? C.brown : C.muted} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T
            accessibilityRole="header"
            style={{
              color: C.text,
              fontSize: 22,
              lineHeight: 28,
              fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
              fontWeight: fontsLoaded ? '400' : '900',
            }}
          >
            {title}
          </T>
          <T style={styles.hint}>{saving ? 'Saving…' : focusSummary(cfg)}</T>
        </View>
        <Toggle
          accessibilityLabel="App pauses"
          value={on}
          onValueChange={(enabled) => settings.update({ enabled })}
        />
      </View>
      {message && (
        <Reanimated.View entering={reveal} exiting={hide} style={styles.warn}>
          <Icon name="help" size={18} color="#FF8A65" />
          <T style={{ color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{message}</T>
          {needsCounting && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Turn on counting"
              onPress={() => router.push('/disclosure')}
              style={({ pressed }) => [styles.warnAction, { opacity: pressed ? 0.7 : 1 }]}
            >
              <T style={{ color: C.brown, fontWeight: '800', fontSize: 14 }}>Turn on</T>
            </Pressable>
          )}
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

function AndroidFocus() {
  const settings = useFocusSettings();
  const { cfg, health, error, update } = settings;
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const header = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="back" size={22} color={C.text} />
      </Pressable>
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
        Focus
      </T>
    </>
  );

  if (!cfg)
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {error ? (
            <>
              <Notice tone="warn" title="Focus settings could not be loaded" body={error} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={settings.retry}
                style={styles.textButton}
              >
                <T style={{ color: C.accent, fontWeight: '700' }}>Try again</T>
              </Pressable>
            </>
          ) : (
            <LoadingState label="Loading your focus settings…" />
          )}
        </ScrollView>
      </SafeAreaView>
    );

  const apps = (health?.apps ?? []).filter((app) => app.installed);
  const feed = !!health?.feedLimitsImplemented;
  const toggleSchedule = (preset: FocusSchedule, on: boolean) =>
    update((saved) => ({
      ...saved,
      schedules: on
        ? [
            ...saved.schedules,
            { days: preset.days, startMinute: preset.startMinute, endMinute: preset.endMinute },
          ]
        : saved.schedules.filter((s) => !matchesSchedule(s, preset)),
    }));
  const custom = cfg.schedules.filter((s) => !PRESETS.some((p) => matchesSchedule(s, p)));
  const limitValues =
    cfg.dailyMinutes !== null && !LIMITS.includes(cfg.dailyMinutes)
      ? [...LIMITS, cfg.dailyMinutes].sort((a, b) => a - b)
      : LIMITS;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}
        <StatusCard settings={settings} fontsLoaded={!!fontsLoaded} />
        {error && (
          <Reanimated.View entering={reveal}>
            <Notice tone="warn" title="Not saved" body={error} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry save"
              onPress={settings.retrySave}
              style={styles.textButton}
            >
              <T style={{ color: C.accent, fontWeight: '700' }}>Retry save</T>
            </Pressable>
          </Reanimated.View>
        )}

        <Card title="Apps">
          {apps.map((app) => {
            const checked = cfg.apps.includes(app.package);
            return (
              <Pressable
                key={app.package}
                accessibilityRole="checkbox"
                accessibilityLabel={app.label}
                accessibilityState={{ checked }}
                onPress={() =>
                  update((saved) => ({
                    ...saved,
                    apps: checked
                      ? saved.apps.filter((p) => p !== app.package)
                      : [...saved.apps, app.package],
                  }))
                }
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              >
                <AppIcon name={app.label} size={32} />
                <T style={styles.rowText}>{app.label}</T>
                <View style={[styles.check, checked && styles.checkOn]}>
                  {checked && <Icon name="check" size={16} color={C.brown} />}
                </View>
              </Pressable>
            );
          })}
          {!apps.length && (
            <T style={styles.hint}>Install Instagram or YouTube to choose it here.</T>
          )}
        </Card>

        <Card title="Daily limit">
          <ToggleRow
            label="Pause after a daily limit"
            value={cfg.dailyMinutes !== null}
            onChange={(on) => update({ dailyMinutes: on ? 30 : null })}
          />
          {cfg.dailyMinutes !== null && (
            <Reanimated.View entering={reveal} exiting={hide}>
              <Chips
                label="Daily limit"
                values={limitValues}
                value={cfg.dailyMinutes}
                format={(v) => `${v}m`}
                onChange={(dailyMinutes) => update({ dailyMinutes })}
              />
            </Reanimated.View>
          )}
        </Card>

        <Card title="Focus times">
          {PRESETS.map((preset, i) => (
            <ToggleRow
              key={preset.label}
              icon="clock"
              label={SCHEDULE_NAMES[i]!}
              hint={scheduleLabel(preset)}
              value={cfg.schedules.some((s) => matchesSchedule(s, preset))}
              onChange={(on) => toggleSchedule(preset, on)}
            />
          ))}
          {custom.map((schedule, i) => (
            <View key={i} style={styles.row}>
              <Icon name="clock" size={20} color={C.muted} />
              <T style={{ ...styles.rowText, fontSize: 15 }}>{scheduleLabel(schedule)}</T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${scheduleLabel(schedule)}`}
                onPress={() =>
                  update((saved) => ({
                    ...saved,
                    schedules: saved.schedules.filter((s) => !matchesSchedule(s, schedule)),
                  }))
                }
                hitSlop={8}
              >
                <Icon name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
          ))}
        </Card>

        {feed && (
          <>
            <Card title="What to pause">
              <View accessibilityRole="radiogroup" style={styles.segment}>
                {(
                  [
                    { value: true, label: 'Reels & Shorts' },
                    { value: false, label: 'Whole app' },
                  ] as const
                ).map((mode) => {
                  const on = Boolean(cfg.feedOnly) === mode.value;
                  return (
                    <Pressable
                      key={mode.label}
                      accessibilityRole="radio"
                      accessibilityLabel={mode.label}
                      accessibilityState={{ checked: on }}
                      onPress={() => update({ feedOnly: mode.value })}
                      style={[styles.segmentItem, on && styles.segmentOn]}
                    >
                      <T style={{ color: on ? C.brown : C.text, fontWeight: '800', fontSize: 15 }}>
                        {mode.label}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
              <T style={styles.hint}>
                {cfg.feedOnly
                  ? 'Only the Reels and Shorts feed is paused. Detection is experimental and may sometimes miss a video.'
                  : 'The whole app is paused at your limit or focus time.'}
              </T>
            </Card>

            <Card title="Feed breaks">
              <ToggleRow
                icon="target"
                label="Pause at my video goal"
                value={cfg.enforceVideoGoal ?? false}
                onChange={(enforceVideoGoal) => update({ enforceVideoGoal })}
              />
              {cfg.enforceVideoGoal && (
                <Reanimated.View entering={reveal} exiting={hide}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit video goal"
                    onPress={() => router.push('/goals')}
                    style={styles.textButton}
                  >
                    <T style={{ color: C.accent, fontWeight: '700' }}>Edit video goal</T>
                  </Pressable>
                </Reanimated.View>
              )}
              <ToggleRow
                icon="clock"
                label="Short break after a run of videos"
                value={cfg.breaksEnabled ?? false}
                onChange={(breaksEnabled) => update({ breaksEnabled })}
              />
              {cfg.breaksEnabled && (
                <Reanimated.View entering={reveal} exiting={hide} style={{ gap: 16 }}>
                  <Chips
                    label="Break every"
                    values={[10, 25, 50, 100]}
                    value={cfg.breakEveryViews ?? 50}
                    format={(v) => `${v} videos`}
                    onChange={(breakEveryViews) => update({ breakEveryViews })}
                  />
                  <Chips
                    label="Break length"
                    values={[1, 5, 10, 15, 30]}
                    value={cfg.breakMinutes ?? 5}
                    format={(v) => `${v}m`}
                    onChange={(breakMinutes) => update({ breakMinutes })}
                  />
                </Reanimated.View>
              )}
              {(cfg.enforceVideoGoal || cfg.breaksEnabled) && (
                <Reanimated.View entering={reveal} exiting={hide} style={{ gap: 16 }}>
                  <Chips
                    label="Skips allowed per day"
                    values={[0, 1, 3, 5]}
                    value={cfg.maxBypassesPerDay ?? 3}
                    format={(v) => String(v)}
                    onChange={(maxBypassesPerDay) => update({ maxBypassesPerDay })}
                  />
                  <Chips
                    label="Each skip lasts"
                    values={[1, 5, 10, 15]}
                    value={cfg.bypassMinutes ?? 5}
                    format={(v) => `${v}m`}
                    onChange={(bypassMinutes) => update({ bypassMinutes })}
                  />
                </Reanimated.View>
              )}
            </Card>
          </>
        )}

        <T style={{ ...styles.hint, textAlign: 'center' }}>
          Back and Home always work while a pause is showing.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Blocking() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidFocus />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  card: { gap: 14, padding: 18, borderRadius: 20, backgroundColor: '#17160F' },
  cardLabel: { color: C.muted, fontSize: 14, fontWeight: '700' },
  status: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  rowText: { color: C.text, fontSize: 17, flex: 1 },
  hint: { color: C.muted, fontSize: 14, lineHeight: 20 },
  shieldWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  shieldRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  shield: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#2A2015',
  },
  warnAction: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29271F',
  },
  chipOn: { backgroundColor: C.accent },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 24, backgroundColor: '#29271F' },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: C.accent },
  textButton: { minHeight: 44, justifyContent: 'center' },
});
