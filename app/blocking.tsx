import { useState } from 'react';
import type { BlockingConfig } from 'tracking-android';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { AccountAllowanceNotice } from '@/sync/AccountAllowanceNotice';
import { PRESETS } from '@/billing/blocking';
import { useFocusSettings } from '@/focus/useFocusSettings';
import { matchesSchedule, scheduleLabel, SCHEDULE_NAMES } from '@/focus/schedules';
import { Button, Notice, Screen, LoadingState } from '@/ui/kit';
import { AppIcon, Icon } from '@/ui/Icon';
import {
  ActionRow,
  AppTile,
  Choices,
  CollapsibleSection,
  FocusCanvas,
  FocusSection,
  FocusText,
  LimitSelector,
  SegmentedControl,
  SettingRow,
  StatusHero,
} from '@/focus/FocusControls';
import { focusTheme as f, focusStyles as s } from '@/focus/theme';

// Retain the preset matching behavior used by the original Focus switches.
const matchesPreset = (
  schedule: BlockingConfig['schedules'][number],
  preset: (typeof PRESETS)[number],
) =>
  schedule.startMinute === preset.startMinute &&
  schedule.endMinute === preset.endMinute &&
  schedule.days.join() === preset.days.join();

function AndroidBlocking() {
  const settings = useFocusSettings();
  const { cfg, health, error, update } = settings;
  const [otherAppsOpen, setOtherAppsOpen] = useState(false);
  if (!cfg)
    return (
      <FocusCanvas>
        <Screen hideHeader backgroundColor={f.color.transparent} contentStyle={s.screen}>
          {error ? (
            <>
              <Notice tone="warn" title="App pauses could not be loaded" body={error} />
              <Button label="Try again" onPress={settings.retry} />
            </>
          ) : (
            <LoadingState label="Loading your focus settings…" />
          )}
        </Screen>
      </FocusCanvas>
    );
  const apps = health?.apps ?? [];
  const installed = apps.filter((app) => app.installed);
  const other = apps.filter((app) => !app.installed);
  const customSchedules = cfg.schedules.filter(
    (schedule) => !PRESETS.some((preset) => matchesSchedule(schedule, preset)),
  );

  return (
    <FocusCanvas>
      <Screen hideHeader backgroundColor={f.color.transparent} contentStyle={s.screen}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [s.touch, { opacity: pressed ? f.opacity.pressed : 1 }]}
          >
            <Icon name="back" size={f.size.icon} color={f.color.text} />
          </Pressable>
          <FocusText variant="title" accessibilityRole="header">
            Focus
          </FocusText>
        </View>
        <AccountAllowanceNotice />
        <StatusHero settings={settings} />
        {error && (
          <View style={s.inline}>
            <Notice tone="warn" title="Could not save your changes" body={error} />
            <Button label="Retry save" onPress={settings.retrySave} />
          </View>
        )}

        <FocusSection title="Apps">
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.appList}>
            {installed.map((app) => (
              <AppTile
                key={app.package}
                label={app.label}
                selected={cfg.apps.includes(app.package)}
                onPress={() =>
                  update((saved) => ({
                    ...saved,
                    apps: saved.apps.includes(app.package)
                      ? saved.apps.filter((pkg) => pkg !== app.package)
                      : [...saved.apps, app.package],
                  }))
                }
              />
            ))}
            <AppTile add label="Add app" onPress={() => setOtherAppsOpen(!otherAppsOpen)} />
          </ScrollView>
          {!installed.length && (
            <FocusText muted>
              {health
                ? 'Install a supported app, then choose it here to start pausing.'
                : 'App selection needs the Android tracking service. Your saved choices are kept.'}
            </FocusText>
          )}
          {installed.length > 0 && !installed.some((app) => cfg.apps.includes(app.package)) && (
            <FocusText muted>Choose an app to start protecting your time.</FocusText>
          )}
          {otherAppsOpen && (
            <CollapsibleSection
              title="Supported apps"
              open={otherAppsOpen}
              onToggle={() => setOtherAppsOpen(false)}
            >
              {other.map((app) => (
                <View key={app.package} style={s.row}>
                  <AppIcon name={app.label} size={f.size.appIcon} />
                  <View style={s.copy}>
                    <FocusText variant="row">{app.label}</FocusText>
                    <FocusText muted>
                      Not installed{cfg.apps.includes(app.package) ? ' · selection saved' : ''}
                    </FocusText>
                  </View>
                </View>
              ))}
              {!other.length && (
                <FocusText muted>
                  {health
                    ? 'All currently supported, installed apps appear above.'
                    : 'Supported apps will appear when the tracking service is available.'}
                </FocusText>
              )}
            </CollapsibleSection>
          )}
        </FocusSection>

        <FocusSection title="Daily limit">
          <LimitSelector
            value={cfg.dailyMinutes}
            onChange={(dailyMinutes) => update({ dailyMinutes })}
          />
        </FocusSection>

        <FocusSection title="Schedule">
          <View style={s.group}>
            {PRESETS.map((preset, index) => (
              <View key={preset.label}>
                {index > 0 && <View style={s.divider} />}
                <SettingRow
                  label={SCHEDULE_NAMES[index]!}
                  icon="clock"
                  subtitle={scheduleLabel(preset)}
                  value={cfg.schedules.some((schedule) => matchesPreset(schedule, preset))}
                  onChange={(on) =>
                    update((saved) => ({
                      ...saved,
                      schedules: on
                        ? [
                            ...saved.schedules,
                            {
                              days: preset.days,
                              startMinute: preset.startMinute,
                              endMinute: preset.endMinute,
                            },
                          ]
                        : saved.schedules.filter((schedule) => !matchesPreset(schedule, preset)),
                    }))
                  }
                />
              </View>
            ))}
          </View>
          {customSchedules.length > 0 && (
            <CollapsibleSection title="Other saved focus times" icon="clock">
              {customSchedules.map((schedule, index) => (
                <View key={index} style={s.inline}>
                  <FocusText>{scheduleLabel(schedule)}</FocusText>
                  <ActionRow
                    label={`Remove custom focus time ${index + 1}`}
                    onPress={() =>
                      update((saved) => ({
                        ...saved,
                        schedules: saved.schedules.filter(
                          (item) => !matchesSchedule(item, schedule),
                        ),
                      }))
                    }
                  />
                </View>
              ))}
            </CollapsibleSection>
          )}
          <ActionRow label="Configure app pauses" onPress={() => router.push('/app-pauses')} />
        </FocusSection>

        {health?.feedLimitsImplemented ? (
          <>
            <FocusSection title="Feed behavior">
              <SegmentedControl
                value={Boolean(cfg.feedOnly)}
                onChange={(feedOnly) => update({ feedOnly })}
              />
              <FocusText muted>
                {cfg.feedOnly
                  ? 'Pause detected Reels & Shorts. Other screens stay available.'
                  : 'Pause every screen in selected apps at your limit or focus time.'}
              </FocusText>
            </FocusSection>
            <CollapsibleSection title="More options" icon="settings">
              <SettingRow
                label="Daily video goal"
                subtitle="Pause the feed at your saved video goal."
                icon="target"
                value={cfg.enforceVideoGoal ?? false}
                onChange={(enforceVideoGoal) => update({ enforceVideoGoal })}
              />
              <ActionRow label="Edit daily video goal" onPress={() => router.push('/goals')} />
              <View style={s.divider} />
              <SettingRow
                label="Timed feed breaks"
                subtitle="A short reset after a run of videos."
                icon="clock"
                value={cfg.breaksEnabled ?? false}
                onChange={(breaksEnabled) => update({ breaksEnabled })}
              />
              {cfg.breaksEnabled && (
                <View style={s.section}>
                  <Choices
                    label="Break every"
                    values={[10, 25, 50, 100]}
                    value={cfg.breakEveryViews ?? 50}
                    unit=" videos"
                    onChange={(breakEveryViews) => update({ breakEveryViews })}
                  />
                  <Choices
                    label="Break duration"
                    values={[1, 5, 10, 15, 30]}
                    value={cfg.breakMinutes ?? 5}
                    unit="m"
                    onChange={(breakMinutes) => update({ breakMinutes })}
                  />
                </View>
              )}
              {(cfg.enforceVideoGoal || cfg.breaksEnabled) && (
                <CollapsibleSection title="Bypass options" icon="settings">
                  <FocusText muted>A shared allowance across Reels and Shorts each day.</FocusText>
                  <Choices
                    label="Bypasses per day"
                    values={[0, 1, 3, 5]}
                    value={cfg.maxBypassesPerDay ?? 3}
                    onChange={(maxBypassesPerDay) => update({ maxBypassesPerDay })}
                  />
                  <Choices
                    label="Bypass duration"
                    values={[1, 5, 10, 15]}
                    value={cfg.bypassMinutes ?? 5}
                    unit="m"
                    onChange={(bypassMinutes) => update({ bypassMinutes })}
                  />
                </CollapsibleSection>
              )}
              <View style={s.betaGroup}>
                <View style={s.beta}>
                  <FocusText variant="badge" muted>
                    Beta
                  </FocusText>
                </View>
                <SettingRow
                  label="Experimental feed detection"
                  icon="counter"
                  subtitle="Try app versions awaiting approval."
                  value={cfg.allowUnvalidatedCounts ?? false}
                  onChange={(allowUnvalidatedCounts) => update({ allowUnvalidatedCounts })}
                />
                <FocusText muted>
                  May miss videos or pause the wrong screen. Experimental counts stay ineligible for
                  cloud comparisons.
                </FocusText>
              </View>
            </CollapsibleSection>
          </>
        ) : (
          <FocusSection title="Feed behavior">
            <FocusText muted>
              Feed modes, daily video enforcement and timed breaks need an updated Android build.
              Your saved feed settings are kept.
            </FocusText>
          </FocusSection>
        )}

        <View style={s.footer}>
          <CollapsibleSection title="How app pauses work" icon="help">
            <FocusText muted>
              Whole-app minute and schedule pauses offer three five-minute snoozes per day. Feed
              pauses use your bypass allowance above. Timed breaks resume after their countdown; a
              daily video cap lasts until the next local day. Back, Home and turning protection off
              remain available. Playback and audio may continue under a feed pause.
            </FocusText>
          </CollapsibleSection>
          <ActionRow
            label="Review counting permissions"
            icon="shield"
            onPress={() => router.push('/tracking')}
          />
        </View>
      </Screen>
    </FocusCanvas>
  );
}

export default function Blocking() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidBlocking />;
}
