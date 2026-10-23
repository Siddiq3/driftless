import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { PRESETS } from '@/billing/blocking';
import { T, useTheme } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { useFocusSettings } from '@/focus/useFocusSettings';
import {
  Divider,
  FocusPage,
  layout,
  ProtectionStatus,
  Section,
  SettingRow,
} from '@/focus/components';
import {
  matchesSchedule,
  nextSchedule,
  scheduleContains,
  scheduleLabel,
  scheduleName,
  SCHEDULE_NAMES,
  timeLabel,
} from '@/focus/schedules';
import { protectionStatus } from '@/billing/protectionStatus';

export default function Focus() {
  const settings = useFocusSettings();
  const { cfg, health, goal, goalLoaded, now, update, saving } = settings;
  const t = useTheme();
  const current = cfg?.schedules.find((schedule) => scheduleContains(schedule, now));
  const next = cfg ? nextSchedule(cfg.schedules, now) : null;
  const ready =
    cfg &&
    health &&
    (!cfg.enforceVideoGoal || goalLoaded) &&
    !saving &&
    !settings.error &&
    protectionStatus(cfg, health, goal).tone === 'info';
  const active = ready && current;
  return (
    <FocusPage title="Focus" settings={settings}>
      {cfg && (
        <>
          <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
            <T v="caption" style={{ color: active ? t.success : t.textMuted, fontWeight: '700' }}>
              {active ? 'FOCUS TIME NOW' : 'YOUR ROUTINE, YOUR PACE'}
            </T>
            <T v="title">
              {active
                ? scheduleName(current!)
                : current
                  ? 'A focus time is scheduled now'
                  : next
                    ? 'Your next pause is planned'
                    : 'No focus times enabled'}
            </T>
            <T muted>
              {active
                ? `Scheduled until ${timeLabel(current!.endMinute)}. Rules apply to your selected apps.`
                : current
                  ? 'App pauses need attention before this schedule can protect your time.'
                  : next
                    ? `${scheduleName(next.schedule)} · ${next.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeLabel(next.schedule.startMinute)}${!cfg.enabled ? '. Turn on App pauses to use it.' : '.'}`
                    : 'Choose a routine below to plan a break from selected apps.'}
            </T>
          </View>
          <ProtectionStatus settings={settings} />
          <Section
            title="Focus times"
            subtitle="Local time on this phone. Overnight schedules continue into the next day."
            surface
          >
            {PRESETS.map((preset, index) => (
              <View key={preset.label} style={{ gap: 16 }}>
                {index > 0 && <Divider />}
                <SettingRow
                  label={SCHEDULE_NAMES[index]!}
                  subtitle={scheduleLabel(preset)}
                  icon={index === 0 ? 'target' : index === 1 ? 'lock' : 'clock'}
                  value={cfg.schedules.some((s) => matchesSchedule(s, preset))}
                  onChange={(on) =>
                    update((saved) => ({
                      ...saved,
                      schedules: on
                        ? saved.schedules.some((s) => matchesSchedule(s, preset))
                          ? saved.schedules
                          : [
                              ...saved.schedules,
                              {
                                days: [...preset.days],
                                startMinute: preset.startMinute,
                                endMinute: preset.endMinute,
                              },
                            ]
                        : saved.schedules.filter((s) => !matchesSchedule(s, preset)),
                    }))
                  }
                />
              </View>
            ))}
            {cfg.schedules
              .filter((s) => !PRESETS.some((preset) => matchesSchedule(s, preset)))
              .map((schedule, index) => (
                <View key={index} style={{ gap: 16 }}>
                  <Divider />
                  <T v="label">Saved focus time</T>
                  <T v="caption" muted>
                    {scheduleLabel(schedule)}
                  </T>
                </View>
              ))}
          </Section>
          <Section
            title="App pauses"
            subtitle="Choose what to pause and how much time to allow."
            surface
          >
            <SettingRow
              label="Pause apps"
              subtitle="Apply your saved limits and focus times."
              icon="shield"
              value={cfg.enabled}
              onChange={(enabled) => update({ enabled })}
            />
            <Divider />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Configure app pauses"
              onPress={() => router.push('/app-pauses')}
              style={({ pressed }) => [layout.row, { minHeight: 56, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={layout.copy}>
                <T style={{ fontWeight: '600' }}>Apps & limits</T>
                <T v="caption" muted>
                  {cfg.apps.length} selected ·{' '}
                  {cfg.dailyMinutes === null
                    ? 'No daily minute limit'
                    : `${cfg.dailyMinutes} min per app daily`}
                </T>
              </View>
              <Icon name="chevron" color={t.accent} />
            </Pressable>
          </Section>
        </>
      )}
    </FocusPage>
  );
}
