import { Platform , Pressable, View } from 'react-native';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { AccountAllowanceNotice } from '@/sync/AccountAllowanceNotice';
import { storageScope } from '@/db/scope';
import { router } from 'expo-router';
import { AppIcon, Icon } from '@/ui/Icon';
import { Details, T, useTheme } from '@/ui/kit';
import {
  Choices,
  Divider,
  FocusPage,
  layout,
  ProtectionStatus,
  Section,
  SettingRow,
  TextLink,
} from '@/focus/components';
import { useFocusSettings } from '@/focus/useFocusSettings';

const LIMITS = [15, 20, 30, 45, 60, 90, 120];
function AndroidAppPauses() {
  const settings = useFocusSettings();
  const { cfg, health, update } = settings;
  const t = useTheme();
  const apps = health?.apps ?? [];
  const installed = apps.filter((app) => app.installed);
  const other = apps.filter((app) => !app.installed);
  return (
    <FocusPage title="App Pauses" settings={settings}>
      <AccountAllowanceNotice />
      {cfg && (
        <>
          <ProtectionStatus settings={settings} />
          <SettingRow
            label="Pause apps"
            subtitle={
              storageScope().startsWith('account:')
                ? 'Account allowance changes apply next account day after synchronization. Schedules and feed breaks remain on this phone.'
                : 'Use your saved allowance, schedules and feed rules.'
            }
            value={cfg.enabled}
            onChange={(enabled) => update({ enabled })}
          />
          <Section
            title="Choose apps"
            trailing={
              <T v="caption" style={{ color: t.accent }}>
                {cfg.apps.length} selected
              </T>
            }
            surface
          >
            {installed.map((app, index) => {
              const checked = cfg.apps.includes(app.package);
              return (
                <View key={app.package} style={{ gap: 16 }}>
                  {index > 0 && <Divider />}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={app.label}
                    accessibilityState={{ checked }}
                    onPress={() =>
                      update((saved) => ({
                        ...saved,
                        apps: saved.apps.includes(app.package)
                          ? saved.apps.filter((pkg) => pkg !== app.package)
                          : [...saved.apps, app.package],
                      }))
                    }
                    style={({ pressed }) => [
                      layout.row,
                      { minHeight: 56, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <AppIcon name={app.label} size={32} />
                    <View style={layout.copy}>
                      <T style={{ fontWeight: '600' }}>{app.label}</T>
                      <T v="caption" muted>
                        {checked ? 'Selected' : 'Tap to select'}
                      </T>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: checked ? t.accent : t.textMuted,
                        backgroundColor: checked ? t.accent : t.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked && <Icon name="check" size={16} color={t.onAccent} />}
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {!installed.length && (
              <T muted>
                {health
                  ? 'No supported apps are installed. Install one to select it here.'
                  : 'Supported apps could not be checked. App selection requires a supported Android build.'}
              </T>
            )}
            {cfg.apps.some((pkg) => !installed.some((app) => app.package === pkg)) && (
              <T v="caption" muted>
                Saved selections for unavailable apps are kept. Only installed, supported apps can
                be paused.
              </T>
            )}
            {other.length > 0 && (
              <Details title="Other supported apps" icon="play">
                <View style={{ gap: 16, paddingBottom: 8 }}>
                  {other.map((app) => (
                    <View key={app.package} style={layout.row}>
                      <AppIcon name={app.label} size={32} />
                      <View style={layout.copy}>
                        <T v="label">{app.label}</T>
                        <T v="caption" muted>
                          Not installed{cfg.apps.includes(app.package) ? ' · selection saved' : ''}
                        </T>
                      </View>
                    </View>
                  ))}
                </View>
              </Details>
            )}
          </Section>
          <Section
            title="Daily allowance"
            subtitle="A separate allowance for each selected app. Resets at local midnight."
            surface
          >
            <View style={[layout.row, { flexWrap: 'wrap', gap: 8 }]}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <T
                  v="display"
                  style={{
                    color: cfg.dailyMinutes === null ? t.textMuted : t.accent,
                    fontSize: 40,
                    lineHeight: 48,
                  }}
                >
                  {cfg.dailyMinutes === null ? 'Off' : `${cfg.dailyMinutes} min`}
                </T>
                <T v="caption" muted>
                  per app, per day
                </T>
              </View>
              <TextLink
                label={
                  cfg.dailyMinutes === null ? 'Enable daily allowance' : 'Turn off daily allowance'
                }
                onPress={() => update({ dailyMinutes: cfg.dailyMinutes === null ? 30 : null })}
              />
            </View>
            {cfg.dailyMinutes !== null ? (
              <Choices
                label="Daily limit"
                values={
                  LIMITS.includes(cfg.dailyMinutes)
                    ? LIMITS
                    : [...LIMITS, cfg.dailyMinutes].sort((a, b) => a - b)
                }
                value={cfg.dailyMinutes}
                unit="m"
                onChange={(dailyMinutes) => update({ dailyMinutes })}
              />
            ) : (
              <T v="caption" muted>
                Your schedules and other enabled feed rules can still apply.
              </T>
            )}
            <T v="caption" muted>
              Uses the greater of Usage Access app time and observed feed time.
            </T>
          </Section>
          {health?.feedLimitsImplemented ? (
            <>
              <Section
                title="Pause behavior"
                subtitle="Choose where minute limits and focus times apply."
              >
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Pause scope"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {(
                    [
                      {
                        value: true,
                        title: 'Just the feed',
                        subtitle:
                          'Pause detected Reels & Shorts. Other supported screens stay accessible.',
                        icon: 'play',
                      },
                      {
                        value: false,
                        title: 'Whole app',
                        subtitle:
                          'Show an app pause when a selected app reaches its limit or focus time.',
                        icon: 'lock',
                      },
                    ] as const
                  ).map((mode) => {
                    const selected = Boolean(cfg.feedOnly) === mode.value;
                    return (
                      <Pressable
                        key={mode.title}
                        accessibilityRole="radio"
                        accessibilityLabel={mode.title}
                        accessibilityHint={mode.subtitle}
                        accessibilityState={{ selected }}
                        onPress={() => update({ feedOnly: mode.value })}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexBasis: '45%',
                          minWidth: 136,
                          padding: 16,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: selected ? t.accent : t.border,
                          backgroundColor: selected ? t.surfaceRaised : t.surface,
                          gap: 8,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <View style={[layout.row, { justifyContent: 'space-between' }]}>
                          <Icon
                            name={mode.icon}
                            size={20}
                            color={selected ? t.accent : t.textMuted}
                          />
                          {selected && <Icon name="check" size={16} color={t.accent} />}
                        </View>
                        <T
                          v="label"
                          style={{ fontWeight: '700', color: selected ? t.accent : t.text }}
                        >
                          {mode.title}
                        </T>
                        <T v="caption" muted>
                          {mode.subtitle}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
                <T v="caption" muted>
                  Video goals and timed breaks always use detected feeds. System navigation stays
                  available; playback or audio may continue under a pause.
                </T>
              </Section>
              <Section title="Advanced controls" surface>
                <View style={{ gap: 0 }}>
                  <SettingRow
                    label="Daily video goal"
                    subtitle="Pause detected feeds at your saved video goal."
                    icon="target"
                    value={cfg.enforceVideoGoal ?? false}
                    onChange={(enforceVideoGoal) => update({ enforceVideoGoal })}
                  />
                  <TextLink label="Edit daily video goal" onPress={() => router.push('/goals')} />
                </View>
                <Divider />
                <SettingRow
                  label="Timed feed breaks"
                  subtitle="Pause for a moment after a run of videos."
                  icon="clock"
                  value={cfg.breaksEnabled ?? false}
                  onChange={(breaksEnabled) => update({ breaksEnabled })}
                />
                {cfg.breaksEnabled && (
                  <View style={{ gap: 16 }}>
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
                  <Details title="Bypass options" icon="settings">
                    <View style={{ gap: 16, paddingBottom: 8 }}>
                      <T v="caption" muted>
                        Shared across Reels and Shorts each day.
                      </T>
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
                    </View>
                  </Details>
                )}
                <Divider />
                <SettingRow
                  label="Experimental feed detection"
                  subtitle="Try detection on app versions awaiting approval. May miss videos or pause the wrong screen."
                  icon="counter"
                  value={cfg.allowUnvalidatedCounts ?? false}
                  onChange={(allowUnvalidatedCounts) => update({ allowUnvalidatedCounts })}
                />
                <T v="caption" muted>
                  Experimental counts stay ineligible for cloud comparisons.
                </T>
              </Section>
            </>
          ) : (
            <Section title="Feed controls unavailable">
              <T muted>
                Daily video enforcement, feed modes and timed breaks require a supported, updated
                Android build. Saved feed settings are kept.
              </T>
            </Section>
          )}
          <Details title="How app pauses work" icon="help">
            <T muted>
              Whole-app minute and schedule pauses offer three five-minute snoozes per day. Feed
              pauses use your bypass allowance above. Timed breaks resume after their countdown; a
              daily video cap lasts until the next local day. Back, Home and turning protection off
              remain available. Playback and audio may continue under a feed pause.
            </T>
          </Details>
          <TextLink label="Review counting permissions" onPress={() => router.push('/tracking')} />
        </>
      )}
    </FocusPage>
  );
}

export default function AppPauses() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidAppPauses />;
}
