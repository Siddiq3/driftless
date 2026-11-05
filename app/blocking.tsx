import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BlockingConfig, FocusSchedule } from 'tracking-android';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { PRESETS } from '@/billing/blocking';
import { protectionStatus } from '@/billing/protectionStatus';
import {
  matchesSchedule,
  nextSchedule,
  scheduleContains,
  scheduleLabel,
  scheduleName,
  SCHEDULE_NAMES,
  timeLabel,
} from '@/focus/schedules';
import { useFocusSettings, type FocusSettings } from '@/focus/useFocusSettings';
import { AppIcon, Icon, type IconName } from '@/ui/Icon';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { LoadingState, Notice, T, Toggle } from '@/ui/kit';
import { useReducedMotion } from '@/ui/motion';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

export const LIMITS = [15, 20, 30, 45, 60, 90, 120];
const reveal = FadeIn.duration(220);
const hide = FadeOut.duration(140);
const glide = LinearTransition.duration(220);
const sentenceIn = FadeIn.duration(320);

/** The live sentence under the status headline; it rewrites itself as settings change.
 * `apps` are the picked apps' labels ("Instagram Reels"), so it never claims an app that isn't chosen. */
export function focusSummary(cfg: BlockingConfig, apps: string[] = []): string {
  if (!apps.length)
    return cfg.enabled
      ? 'Pick an app below to get started.'
      : 'Pick an app below, then turn pauses on.';
  if (!cfg.enabled) return 'Your choices are saved for when you turn pauses on.';
  const names = cfg.feedOnly ? apps : apps.map((label) => label.replace(/ (Reels|Shorts)$/, ''));
  const what = names.join(' and ');
  const when = [
    cfg.dailyMinutes !== null && `after ${cfg.dailyMinutes} min of scrolling a day`,
    cfg.schedules.length === 1 && `during ${focusName(cfg.schedules[0]!)}`,
    cfg.schedules.length > 1 && `during ${cfg.schedules.length} focus times`,
  ].filter(Boolean);
  if (!when.length) return 'Pick a daily limit or a focus time below.';
  return `${what} ${names.length > 1 ? 'pause' : 'pauses'} ${when.join(' and ')}.`;
}

/** Keeps "9:00 AM" together so a time never breaks across lines. */
const keepTimes = (label: string) => label.replace(/ (AM|PM)/g, '\u00A0$1');

function focusName(schedule: FocusSchedule): string {
  const name = scheduleName(schedule);
  return name === 'Saved focus time'
    ? `${timeLabel(schedule.startMinute)} – ${timeLabel(schedule.endMinute)}`
    : name;
}

function appLabels(cfg: BlockingConfig, health: FocusSettings['health']): string[] {
  return cfg.apps.map((p) => health?.apps.find((a) => a.package === p)?.label ?? p);
}

function nextFocusLine(cfg: BlockingConfig): string | null {
  if (!cfg.enabled) return null;
  const now = new Date();
  const active = cfg.schedules.find((s) => scheduleContains(s, now));
  if (active) return `${focusName(active)} is on now, until ${timeLabel(active.endMinute)}.`;
  const next = nextSchedule(cfg.schedules, now);
  if (!next) return null;
  const today = next.start.toDateString() === now.toDateString();
  const day = today ? '' : next.start.toLocaleDateString('en', { weekday: 'short' });
  if (scheduleName(next.schedule) === 'Saved focus time')
    return `Next focus time: ${[day, focusName(next.schedule)].filter(Boolean).join(' ')}.`;
  return `Next: ${focusName(next.schedule)} at ${timeLabel(next.schedule.startMinute)}${day ? ` ${day}` : ''}.`;
}

/** One expandable line of the summary list: its title, current value, and its editor below. */
function Section({
  icon,
  title,
  value,
  open,
  onToggle,
  first,
  children,
}: {
  icon: IconName;
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Reanimated.View layout={glide}>
      {!first && <View style={styles.divider} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHead, pressed && { backgroundColor: '#1F1D16' }]}
      >
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={styles.sectionTitle}>{title}</T>
          <T style={styles.sectionValue}>{value}</T>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={16} color={C.muted} />
        </View>
      </Pressable>
      {open && (
        <Reanimated.View entering={reveal} exiting={hide} style={styles.sectionBody}>
          {children}
        </Reanimated.View>
      )}
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY = 24 * 60;

function TimeStep({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${dir < 0 ? 'earlier' : 'later'}, now ${timeLabel(value)}`}
      onPress={() => onChange((value + dir * 30 + DAY) % DAY)}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={dir < 0 ? 'minus' : 'plus'} size={16} color={C.text} />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <T style={styles.rowText}>{label}</T>
      {step(-1)}
      <T
        style={{
          color: C.text,
          fontWeight: '700',
          fontSize: 16,
          minWidth: 82,
          textAlign: 'center',
        }}
      >
        {timeLabel(value)}
      </T>
      {step(1)}
    </View>
  );
}

/** A focus time of the person's own choosing; overnight ranges (e.g. 11 PM – 6 AM) are fine. */
function AddFocusTime({ onAdd }: { onAdd: (schedule: FocusSchedule) => void }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(18 * 60);
  const [end, setEnd] = useState(21 * 60);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6, 7]);
  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add your own time"
        onPress={() => setOpen(true)}
        style={styles.textButton}
      >
        <T style={{ color: C.accent, fontWeight: '700' }}>+ Add your own time</T>
      </Pressable>
    );
  const valid = start !== end && days.length > 0;
  return (
    <Reanimated.View entering={reveal} style={{ gap: 12 }}>
      <TimeStep label="Starts" value={start} onChange={setStart} />
      <TimeStep label="Ends" value={end} onChange={setEnd} />
      <View accessibilityLabel="Days" style={styles.chips}>
        {DAY_NAMES.map((name, i) => {
          const day = i + 1;
          const on = days.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityLabel={name}
              accessibilityState={{ checked: on }}
              onPress={() => setDays(on ? days.filter((d) => d !== day) : [...days, day].sort())}
              style={({ pressed }) => [
                styles.chip,
                on && styles.chipOn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <T style={{ color: on ? C.brown : C.text, fontWeight: '700', fontSize: 14 }}>
                {name}
              </T>
            </Pressable>
          );
        })}
      </View>
      {start === end && <T style={styles.hint}>Start and end can’t be the same time.</T>}
      {days.length === 0 && <T style={styles.hint}>Pick at least one day.</T>}
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel focus time"
          onPress={() => setOpen(false)}
          style={styles.textButton}
        >
          <T style={{ color: C.muted, fontWeight: '700' }}>Cancel</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save focus time"
          accessibilityState={{ disabled: !valid }}
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            onAdd({ days, startMinute: start, endMinute: end });
            setOpen(false);
          }}
          style={[styles.textButton, { opacity: valid ? 1 : 0.4 }]}
        >
          <T style={{ color: C.accent, fontWeight: '700' }}>Save</T>
        </Pressable>
      </View>
    </Reanimated.View>
  );
}

function Chips<V extends number>({
  label,
  values,
  value,
  format,
  onChange,
  showLabel = true,
}: {
  label: string;
  values: V[];
  value: V;
  format: (v: V) => string;
  onChange: (v: V) => void;
  /** The radio group keeps its spoken label even when the heading above already says it. */
  showLabel?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {showLabel && <T style={styles.hint}>{label}</T>}
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

/** Answers "what happens if I open Reels now?" before any control. */
function StatusPanel({ settings, fontsLoaded }: { settings: FocusSettings; fontsLoaded: boolean }) {
  const { cfg, health, goal, saving } = settings;
  const reduced = useReducedMotion();
  if (!cfg) return null;
  const on = cfg.enabled;
  const status = health ? protectionStatus(cfg, health, goal) : null;
  const needsCounting =
    !!health?.implemented &&
    (!health.disclosureAccepted || !health.serviceEnabled || !health.serviceRunning);
  // The coral state is only for pauses that cannot run; heads-ups stay a quiet note under "on".
  const blocked = !on
    ? null
    : !health
      ? 'App pauses need the Android accessibility service in a supported ScrollSnooze build.'
      : needsCounting
        ? 'Turn on counting so ScrollSnooze can pause your feeds.'
        : status?.title === 'Protection inactive' && cfg.apps.length
          ? status.body
          : null;
  const note =
    !blocked && on && status?.title === 'Protection needs attention' ? status.body : null;
  const message = blocked ?? note;
  const state = !on ? 'off' : blocked || !cfg.apps.length ? 'attention' : 'on';
  const tone = TONES[state];
  const sentence = saving ? 'Saving…' : focusSummary(cfg, appLabels(cfg, health));
  const next = nextFocusLine(cfg);
  return (
    <Reanimated.View layout={glide} style={[styles.panel, { backgroundColor: tone.ground }]}>
      <View style={styles.panelTop}>
        <BrainCharacter pose={tone.pose} size={84} still={reduced} />
        <View style={{ flex: 1, gap: 6 }}>
          <T
            accessibilityRole="header"
            style={{
              color: tone.ink,
              fontSize: 26,
              lineHeight: 30,
              fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
              fontWeight: fontsLoaded ? '400' : '900',
            }}
          >
            {state === 'off'
              ? 'Pauses are off'
              : state === 'attention'
                ? 'Pauses need attention'
                : 'Pauses are on'}
          </T>
          {/* The signature move: the sentence fades into its new wording whenever a setting changes. */}
          <Reanimated.View key={sentence} entering={reduced ? undefined : sentenceIn}>
            <T style={{ color: C.text, fontSize: 15, lineHeight: 21 }}>{sentence}</T>
          </Reanimated.View>
          {next && <T style={{ color: tone.ink, fontSize: 13, fontWeight: '700' }}>{next}</T>}
        </View>
      </View>
      {message && (
        <Reanimated.View entering={reveal} exiting={hide} style={styles.panelNote}>
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
      <View style={styles.panelSwitch}>
        <T style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>App pauses</T>
        <Toggle
          accessibilityLabel="App pauses"
          value={on}
          onValueChange={(enabled) => settings.update({ enabled })}
        />
      </View>
    </Reanimated.View>
  );
}

const TONES = {
  on: { ground: '#33250F', ink: C.accent, pose: 'focused' },
  attention: { ground: '#33201A', ink: '#FFB199', pose: 'fresh' },
  off: { ground: '#17160F', ink: C.text, pose: 'fresh' },
} as const;

type SectionId = 'apps' | 'limit' | 'focus' | 'scope' | 'breaks';

function AndroidFocus() {
  const settings = useFocusSettings();
  const { cfg, health, error, update } = settings;
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  // Nothing is open by default except Apps when none is picked, since nothing can pause without one.
  // Decided once when settings first load, so ticking an app doesn't collapse the row under your finger.
  const [opened, setOpened] = useState<Set<SectionId> | null>(null);
  if (opened === null && cfg) setOpened(new Set<SectionId>(cfg.apps.length ? [] : ['apps']));
  const openSet = opened ?? new Set<SectionId>();
  const toggle = (id: SectionId) =>
    setOpened(() => {
      const next = new Set(openSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const header = (
    <View style={styles.header}>
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
    </View>
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
  const appNames = appLabels(cfg, health).map((label) => label.replace(/ (Reels|Shorts)$/, ''));
  const breaks = [
    cfg.enforceVideoGoal && 'At goal',
    cfg.breaksEnabled && `Every ${cfg.breakEveryViews ?? 50}`,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}
        <StatusPanel settings={settings} fontsLoaded={!!fontsLoaded} />
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

        <View style={styles.list}>
          <Section
            first
            icon="play"
            title="Apps"
            value={appNames.length ? appNames.join(', ') : 'None yet'}
            open={openSet.has('apps')}
            onToggle={() => toggle('apps')}
          >
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
          </Section>

          <Section
            icon="target"
            title="Daily limit"
            value={
              cfg.dailyMinutes !== null ? `${cfg.dailyMinutes} min of Reels & Shorts a day` : 'Off'
            }
            open={openSet.has('limit')}
            onToggle={() => toggle('limit')}
          >
            <ToggleRow
              label="Pause after a daily limit"
              hint="Counts your time on Reels & Shorts"
              value={cfg.dailyMinutes !== null}
              onChange={(on) => update({ dailyMinutes: on ? 30 : null })}
            />
            {cfg.dailyMinutes !== null && (
              <Reanimated.View entering={reveal} exiting={hide}>
                <Chips
                  label="Daily limit"
                  showLabel={false}
                  values={limitValues}
                  value={cfg.dailyMinutes}
                  format={(v) => `${v}m`}
                  onChange={(dailyMinutes) => update({ dailyMinutes })}
                />
              </Reanimated.View>
            )}
          </Section>

          <Section
            icon="clock"
            title="Focus times"
            value={
              cfg.schedules.length === 0
                ? 'None'
                : cfg.schedules.length === 1
                  ? focusName(cfg.schedules[0]!)
                  : `${cfg.schedules.length} on`
            }
            open={openSet.has('focus')}
            onToggle={() => toggle('focus')}
          >
            {PRESETS.map((preset, i) => (
              <ToggleRow
                key={preset.label}
                label={SCHEDULE_NAMES[i]!}
                hint={keepTimes(scheduleLabel(preset))}
                value={cfg.schedules.some((s) => matchesSchedule(s, preset))}
                onChange={(on) => toggleSchedule(preset, on)}
              />
            ))}
            {custom.map((schedule, i) => (
              <View key={i} style={styles.row}>
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
                  style={styles.iconButton}
                >
                  <Icon name="close" size={18} color={C.muted} />
                </Pressable>
              </View>
            ))}
            <AddFocusTime
              onAdd={(schedule) =>
                update((saved) =>
                  saved.schedules.some((s) => matchesSchedule(s, schedule))
                    ? saved
                    : { ...saved, schedules: [...saved.schedules, schedule] },
                )
              }
            />
          </Section>

          {feed && (
            <>
              <Section
                icon="lock"
                title="What to pause"
                value={cfg.feedOnly ? 'Reels & Shorts' : 'Whole app'}
                open={openSet.has('scope')}
                onToggle={() => toggle('scope')}
              >
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
                        <T
                          style={{ color: on ? C.brown : C.text, fontWeight: '800', fontSize: 15 }}
                        >
                          {mode.label}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
                <T style={styles.hint}>
                  {cfg.feedOnly
                    ? 'Only the Reels and Shorts feed is paused. Detection is experimental and may sometimes miss a video.'
                    : 'The whole app is paused once you reach your Reels & Shorts limit, or during a focus time.'}
                </T>
              </Section>

              <Section
                icon="counter"
                title="Feed breaks"
                value={breaks.length ? breaks.join(' · ') : 'Off'}
                open={openSet.has('breaks')}
                onToggle={() => toggle('breaks')}
              >
                <ToggleRow
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
              </Section>
            </>
          )}
        </View>

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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  panel: { gap: 16, padding: 20, borderRadius: 24 },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  panelSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFFFF833',
  },
  list: { borderRadius: 24, backgroundColor: '#17160F', overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68, backgroundColor: '#3A382F' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29271F',
  },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '600' },
  sectionValue: { color: C.muted, fontSize: 15, lineHeight: 20 },
  sectionBody: { gap: 14, paddingLeft: 66, paddingRight: 16, paddingBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  rowText: { color: C.text, fontSize: 17, flex: 1 },
  hint: { color: C.muted, fontSize: 14, lineHeight: 20 },
  panelNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFFFF833',
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  warnAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
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
    minHeight: 48,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29271F',
  },
  chipOn: { backgroundColor: C.accent },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 24, backgroundColor: '#29271F' },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: C.accent },
  textButton: { minHeight: 48, justifyContent: 'center' },
});
