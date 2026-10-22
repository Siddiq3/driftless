import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Tracking, type BlockingConfig, type TrackingHealth } from 'tracking-android';
import { loadBlocking, PRESETS, saveBlocking } from '@/billing/blocking';
import { getDb } from '@/db';
import { Toggle, Button, Notice, Screen, T, Details, LoadingState } from '@/ui/kit';
import { AppIcon, Icon, type IconName } from '@/ui/Icon';
import { ProtectionNotice } from '@/billing/ProtectionNotice';

const C = {
  surface: '#19152F',
  raised: '#29213F',
  border: '#443659',
  accent: '#C4A0FF',
  muted: '#B9AFCB',
  text: '#F7F2FF',
  amber: '#493078',
};
const LIMITS = [15, 20, 30, 45, 60, 90, 120];

function Group({
  title,
  subtitle,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="heading" style={styles.heading}>
            {title}
          </T>
          {subtitle && (
            <T v="caption" muted>
              {subtitle}
            </T>
          )}
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function Row({
  label,
  subtitle,
  icon = 'clock',
  value,
  onChange,
}: {
  label: string;
  subtitle?: string;
  icon?: IconName;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={C.accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T style={{ fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{label}</T>
        {subtitle && (
          <T v="caption" muted>
            {subtitle}
          </T>
        )}
      </View>
      <Toggle accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

function Choices({
  label,
  values,
  value,
  unit = '',
  onChange,
}: {
  label: string;
  values: readonly number[];
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <T v="caption" muted>
        {label}
      </T>
      <View style={styles.choices}>
        {values.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${choice}${unit}`}
            accessibilityState={{ selected: value === choice }}
            onPress={() => onChange(choice)}
            style={({ pressed }) => [
              styles.choice,
              value === choice && styles.choiceSelected,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <T
              style={{
                color: value === choice ? '#241642' : C.text,
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              {choice}
              {unit}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Blocking() {
  const [cfg, setCfg] = useState<BlockingConfig | null>(null);
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fonts] = useFonts({ LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf') });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDb()
        .then(loadBlocking)
        .then((config) => {
          if (!active) return;
          setHealth(Tracking.health());
          setCfg(config);
          setError(null);
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : 'Try opening this screen again.');
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!cfg)
    return (
      <Screen>
        {error ? (
          <Notice tone="warn" title="App pauses could not be loaded" body={error} />
        ) : (
          <LoadingState label="Loading your focus settings…" />
        )}
      </Screen>
    );
  const update = (next: BlockingConfig) => {
    setError(null);
    setCfg(next);
    void getDb()
      .then((db) => saveBlocking(db, next))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not save app pauses.'),
      );
  };
  const apps = health?.apps ?? [];
  const installed = apps.filter((app) => app.installed);
  const selected = installed.filter((app) => cfg.apps.includes(app.package)).length;

  return (
    <Screen hideHeader contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
        >
          <Icon name="back" size={23} />
        </Pressable>
        <T
          v="title"
          style={{
            flex: 1,
            color: '#C4A0FF',
            fontSize: 25,
            fontFamily: fonts ? 'LilitaOne' : undefined,
            letterSpacing: 0.3,
          }}
        >
          FOCUS
        </T>
        <View style={styles.proBadge}>
          <Icon name="check" size={13} color="#241642" />
          <T v="caption" style={{ color: '#241642', fontWeight: '900' }}>
            INCLUDED
          </T>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: 8 }}>
            <T v="title" style={{ fontSize: 27, lineHeight: 33, color: '#C4A0FF' }}>
              Less scrolling.{'\n'}More living.
            </T>
            <T v="caption" style={{ color: '#D8C5EE' }}>
              Make a little room for your offline life.
            </T>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="shield" size={38} color="#C4A0FF" />
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.masterRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <T style={{ fontWeight: '700', fontSize: 16 }}>App pauses</T>
            <T v="caption" style={{ color: '#D8C5EE' }}>
              Use your saved limits and focus times.
            </T>
          </View>
          <Toggle
            accessibilityLabel="Pause apps"
            value={cfg.enabled}
            onValueChange={(value) => update({ ...cfg, enabled: value })}
          />
        </View>
      </View>
      {error && <Notice tone="warn" title="Could not save your changes" body={error} />}
      <ProtectionNotice config={cfg} />

      <Group
        title="Choose your apps"
        subtitle="Pick where you want a little less scrolling."
        trailing={
          <View style={styles.countBadge}>
            <T v="caption" style={{ color: C.accent }}>
              {selected} selected
            </T>
          </View>
        }
      >
        <View style={styles.appGrid}>
          {installed.map((app) => {
            const checked = cfg.apps.includes(app.package);
            return (
              <Pressable
                key={app.package}
                accessibilityRole="checkbox"
                accessibilityLabel={app.label}
                accessibilityState={{ checked, disabled: !app.installed }}
                disabled={!app.installed}
                onPress={() =>
                  update({
                    ...cfg,
                    apps: checked
                      ? cfg.apps.filter((pkg) => pkg !== app.package)
                      : [...cfg.apps, app.package],
                  })
                }
                style={({ pressed }) => [
                  styles.app,
                  checked && styles.appSelected,
                  { opacity: !app.installed ? 0.5 : pressed ? 0.7 : 1 },
                ]}
              >
                <View style={styles.appTop}>
                  <AppIcon name={app.label} size={32} />
                  <View
                    style={[
                      styles.check,
                      checked && { backgroundColor: C.accent, borderColor: C.accent },
                    ]}
                  >
                    {checked && <Icon name="check" size={13} color="#241642" />}
                  </View>
                </View>
                <T style={{ fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{app.label}</T>
                {!app.installed && (
                  <T v="caption" muted>
                    Not installed
                  </T>
                )}
              </Pressable>
            );
          })}
          {!installed.length && <T muted>Install a supported app to choose it here.</T>}
        </View>
        {apps.some((app) => !app.installed) && (
          <Details title="Other supported apps" icon="play">
            <View style={{ gap: 16, paddingBottom: 16 }}>
              {apps
                .filter((app) => !app.installed)
                .map((app) => (
                  <View
                    key={app.package}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <AppIcon name={app.label} size={28} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <T v="label">{app.label}</T>
                      <T v="caption" muted>
                        Not installed
                      </T>
                    </View>
                  </View>
                ))}
            </View>
          </Details>
        )}
      </Group>

      <Group
        title="Your daily allowance"
        subtitle="A fresh limit for each selected app, every day."
      >
        <View style={styles.allowance}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              flex: 1,
              flexWrap: 'wrap',
            }}
          >
            <T v="display" style={{ fontSize: 40, lineHeight: 48, color: C.accent }}>
              {cfg.dailyMinutes ?? '—'}
            </T>
            <T muted>min / app</T>
          </View>
          <Toggle
            accessibilityLabel="Daily minute limit"
            value={cfg.dailyMinutes !== null}
            onValueChange={(on) => update({ ...cfg, dailyMinutes: on ? 30 : null })}
          />
        </View>
        {cfg.dailyMinutes !== null ? (
          <Choices
            label="Daily limit"
            values={LIMITS}
            value={cfg.dailyMinutes}
            unit="m"
            onChange={(dailyMinutes) => update({ ...cfg, dailyMinutes })}
          />
        ) : (
          <T v="caption" muted>
            Daily limits are off. Your focus times can still apply.
          </T>
        )}
      </Group>

      <Group title="Focus times" subtitle="Let your routine do the reminding.">
        {PRESETS.map((preset, index) => {
          const matches = (schedule: BlockingConfig['schedules'][number]) =>
            schedule.startMinute === preset.startMinute &&
            schedule.endMinute === preset.endMinute &&
            schedule.days.join() === preset.days.join();
          return (
            <Row
              key={preset.label}
              label={['Work hours', 'Wind down', 'Slow mornings'][index]!}
              subtitle={
                ['Mon–Fri · 9 AM – 5 PM', 'Every day · 10 PM – 7 AM', 'Every day · 6 AM – 9 AM'][
                  index
                ]
              }
              value={cfg.schedules.some(matches)}
              onChange={(on) =>
                update({
                  ...cfg,
                  schedules: on
                    ? [
                        ...cfg.schedules,
                        {
                          days: preset.days,
                          startMinute: preset.startMinute,
                          endMinute: preset.endMinute,
                        },
                      ]
                    : cfg.schedules.filter((schedule) => !matches(schedule)),
                })
              }
            />
          );
        })}
      </Group>

      {health?.feedLimitsImplemented ? (
        <Group title="Reels & Shorts" subtitle="Take a pause without leaving the whole app.">
          <View
            style={styles.modes}
            accessibilityRole="radiogroup"
            accessibilityLabel="Pause scope"
          >
            {(
              [
                { value: true, title: 'Just the feed', subtitle: 'Reels & Shorts', icon: 'play' },
                { value: false, title: 'Whole app', subtitle: 'Every screen', icon: 'lock' },
              ] as const
            ).map((mode) => (
              <Pressable
                key={mode.title}
                accessibilityRole="radio"
                accessibilityLabel={mode.title}
                accessibilityState={{ selected: Boolean(cfg.feedOnly) === mode.value }}
                onPress={() => update({ ...cfg, feedOnly: mode.value })}
                style={[styles.mode, Boolean(cfg.feedOnly) === mode.value && styles.appSelected]}
              >
                <Icon name={mode.icon} size={22} color={C.accent} />
                <T style={{ fontSize: 14, fontWeight: '700' }}>{mode.title}</T>
                <T v="caption" muted>
                  {mode.subtitle}
                </T>
              </Pressable>
            ))}
          </View>
          <T v="caption" muted>
            Feed pauses apply to detected feeds in selected apps. Other screens stay available in
            Just the feed mode.
          </T>
          <Row
            label="Daily video goal"
            subtitle="Pause the feed when you reach your saved goal."
            icon="target"
            value={cfg.enforceVideoGoal ?? false}
            onChange={(on) => update({ ...cfg, enforceVideoGoal: on })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit daily video goal"
            onPress={() => router.push('/goals')}
            style={styles.textLink}
          >
            <T v="label" style={{ color: C.accent }}>
              Edit daily video goal
            </T>
            <Icon name="chevron" size={16} />
          </Pressable>
          <Row
            label="Timed feed breaks"
            subtitle="A little reset after a run of videos."
            value={cfg.breaksEnabled ?? false}
            onChange={(on) => update({ ...cfg, breaksEnabled: on })}
          />
          {cfg.breaksEnabled && (
            <View style={styles.nested}>
              <Choices
                label="Break every"
                values={[10, 25, 50, 100]}
                value={cfg.breakEveryViews ?? 50}
                unit=" videos"
                onChange={(breakEveryViews) => update({ ...cfg, breakEveryViews })}
              />
              <Choices
                label="Break duration"
                values={[1, 5, 10, 15, 30]}
                value={cfg.breakMinutes ?? 5}
                unit="m"
                onChange={(breakMinutes) => update({ ...cfg, breakMinutes })}
              />
            </View>
          )}
          {(cfg.enforceVideoGoal || cfg.breaksEnabled) && (
            <Details title="Bypass options" icon="settings">
              <View style={{ gap: 18, paddingBottom: 16 }}>
                <T v="caption" muted>
                  A shared allowance across Reels and Shorts each day.
                </T>
                <Choices
                  label="Bypasses per day"
                  values={[0, 1, 3, 5]}
                  value={cfg.maxBypassesPerDay ?? 3}
                  onChange={(maxBypassesPerDay) => update({ ...cfg, maxBypassesPerDay })}
                />
                <Choices
                  label="Bypass duration"
                  values={[1, 5, 10, 15]}
                  value={cfg.bypassMinutes ?? 5}
                  unit="m"
                  onChange={(bypassMinutes) => update({ ...cfg, bypassMinutes })}
                />
              </View>
            </Details>
          )}
          <Row
            label="Experimental feed detection"
            icon="counter"
            subtitle="Use detection for app versions awaiting approval."
            value={cfg.allowUnvalidatedCounts ?? false}
            onChange={(on) => update({ ...cfg, allowUnvalidatedCounts: on })}
          />
          <T v="caption" muted>
            May miss videos or pause the wrong screen. Counts remain ineligible for cloud
            comparisons.
          </T>
        </Group>
      ) : (
        <Notice
          tone="warn"
          title="Feed limits need an updated Android build"
          body="Install the latest ScrollSnooze build to configure daily video enforcement and timed feed breaks."
        />
      )}

      <Details title="How app pauses work" icon="help">
        <T muted>
          Whole-app minute and schedule pauses offer three five-minute snoozes per day. Feed pauses
          use your bypass allowance above. Timed breaks resume after their countdown; a daily video
          cap lasts until the next local day. Back, Home and turning protection off remain
          available. Playback and audio may continue under a feed pause.
        </T>
      </Details>
      <Button
        kind="secondary"
        label="Review counting permissions"
        onPress={() => router.push('/tracking')}
      />
      <T v="caption" muted style={{ textAlign: 'center', paddingBottom: 8 }}>
        All features are included. Your focus settings are saved on this phone.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 18,
    backgroundColor: C.accent,
  },
  hero: {
    backgroundColor: '#30214B',
    borderRadius: 26,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: '#60467D',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#493078',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#70578E' },
  masterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  group: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 18,
    gap: 18,
    borderWidth: 1,
    borderColor: '#30264E',
  },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.raised,
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  app: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#211C3D',
    padding: 14,
    gap: 10,
  },
  appSelected: { backgroundColor: '#35254D', borderColor: C.accent },
  appTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#74618C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowance: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: { backgroundColor: C.accent, borderColor: C.accent },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mode: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  textLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    alignSelf: 'flex-start',
  },
  nested: { backgroundColor: '#10102B', borderRadius: 16, padding: 14, gap: 18 },
});
