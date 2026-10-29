import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, LoadingState, Screen, T, Toggle, useTheme } from '@/ui/kit';
import { Icon, type IconName } from '@/ui/Icon';
import { protectionStatus } from '@/billing/protectionStatus';
import type { FocusSettings } from './useFocusSettings';
import { focusTheme, focusType } from './theme';

export const layout = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  copy: { flex: 1, minWidth: 0, gap: 8 },
  surface: { borderRadius: 16, padding: 16, gap: 16 },
  section: { gap: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
});
export function FocusPage({
  title,
  settings,
  children,
}: {
  title: string;
  settings: FocusSettings;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Screen hideHeader contentStyle={layout.page}>
      <View style={layout.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => ({
            minHeight: 48,
            minWidth: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: t.surface,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="back" color={t.text} />
        </Pressable>
        <T v="title" style={{ flex: 1 }}>
          {title}
        </T>
      </View>
      {settings.error && (
        <View accessibilityRole="alert" style={{ gap: 8 }}>
          <T style={{ color: t.warning }}>{settings.error}</T>
          {!settings.cfg ? (
            <Button label="Try again" onPress={settings.retry} />
          ) : (
            <Button label="Try saving again" onPress={settings.retrySave} />
          )}
        </View>
      )}
      {!settings.cfg
        ? !settings.error && <LoadingState label="Loading your focus settings…" />
        : children}
      {settings.cfg && (
        <T v="caption" muted style={{ textAlign: 'center' }}>
          {settings.saving
            ? 'Saving changes…'
            : settings.error
              ? 'Changes not saved'
              : 'Settings saved on this phone'}
        </T>
      )}
    </Screen>
  );
}
export function Section({
  title,
  subtitle,
  trailing,
  children,
  surface = false,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
  surface?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={layout.section}>
      <View style={[layout.row, { flexWrap: 'wrap', gap: 8 }]}>
        <View style={layout.copy}>
          <T v="heading" accessibilityRole="header">
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
      <View style={surface ? [layout.surface, { backgroundColor: t.surface }] : { gap: 16 }}>
        {children}
      </View>
    </View>
  );
}
export function Divider() {
  const t = useTheme();
  return <View style={[layout.divider, { backgroundColor: t.border }]} />;
}
export function SettingRow({
  label,
  subtitle,
  icon,
  value,
  onChange,
}: {
  label: string;
  subtitle: string;
  icon?: IconName;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={[layout.row, { minHeight: 56 }]}>
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: t.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} color={t.textMuted} size={20} />
        </View>
      )}
      <View style={layout.copy}>
        <T style={{ fontWeight: '600' }}>{label}</T>
        <T v="caption" muted>
          {subtitle}
        </T>
      </View>
      <Toggle
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        style={{ minHeight: 48 }}
      />
    </View>
  );
}
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [layout.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <T v="label" style={{ color: t.accent, flexShrink: 1 }}>
        {label}
      </T>
      <Icon name="chevron" size={16} color={t.accent} />
    </Pressable>
  );
}
export function ProtectionStatus({
  settings,
  inline = false,
}: {
  settings: FocusSettings;
  inline?: boolean;
}) {
  const t = useTheme();
  const { cfg, health, goal, goalLoaded, saving, error } = settings;
  if (!cfg) return null;
  const status = error
    ? {
        title: 'Settings need review',
        body: 'Your latest changes could not be confirmed. Review the save message above.',
        tone: 'warn',
      }
    : !health
      ? {
          title: 'Protection unavailable',
          body: 'App pauses need the Android accessibility service in a supported ScrollSnooze build.',
          tone: 'warn',
        }
      : cfg.enforceVideoGoal && !goalLoaded
        ? {
            title: 'Status unavailable',
            body: 'Your daily video goal could not be checked. Reopen this screen to try again.',
            tone: 'warn',
          }
        : protectionStatus(cfg, health, goal);
  const permission =
    health?.implemented &&
    (!health.disclosureAccepted || !health.serviceEnabled || !health.serviceRunning);
  const noApps = !health?.apps.some((app) => app.installed && cfg.apps.includes(app.package));
  const title = saving
    ? 'Saving changes…'
    : error
      ? status.title
      : !cfg.enabled
        ? 'Protection inactive'
        : permission
          ? 'Permission required'
          : health && noApps
            ? 'No apps selected'
            : status.title;
  const color =
    saving || !cfg.enabled ? t.textMuted : status.tone === 'info' ? t.success : t.warning;
  // The Focus hero owns the status heading; show only actionable readiness details inline.
  if (inline) {
    if (!saving && !error && health && (!cfg.enabled || status.tone === 'info')) return null;
    return (
      <View accessibilityLiveRegion="polite" style={{ gap: focusTheme.space.sm }}>
        {title !== 'Protection needs attention' && (
          <T style={{ ...focusType.label, color: focusTheme.color.text }}>{title}</T>
        )}
        <T style={{ ...focusType.body, color: focusTheme.color.muted }}>
          {saving
            ? 'Applying your settings on this phone.'
            : status.body.startsWith(`${title}. `)
              ? status.body.slice(title.length + 2)
              : status.body}
        </T>
        {permission && cfg.enabled && (
          <TextLink label="Review counting permissions" onPress={() => router.push('/tracking')} />
        )}
        {cfg.enabled && cfg.enforceVideoGoal && goalLoaded && goal === null && (
          <TextLink label="Set a daily video goal" onPress={() => router.push('/goals')} />
        )}
      </View>
    );
  }
  return (
    <View
      style={[layout.surface, { backgroundColor: t.surface, gap: 8 }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[layout.row, { gap: 8 }]}>
        <Icon
          name={status.tone === 'info' && !saving ? 'shield' : 'help'}
          size={18}
          color={color}
        />
        <T v="label" style={{ color, fontWeight: '700', flex: 1 }}>
          {title}
        </T>
      </View>
      <T v="caption" muted>
        {saving ? 'Applying your settings on this phone.' : status.body}
      </T>
      {permission && cfg.enabled && (
        <TextLink label="Review counting permissions" onPress={() => router.push('/tracking')} />
      )}
      {cfg.enabled && noApps && health && (
        <T v="caption" muted>
          Choose an installed app in App Pauses.
        </T>
      )}
      {cfg.enabled && cfg.enforceVideoGoal && goalLoaded && goal === null && (
        <TextLink label="Set a daily video goal" onPress={() => router.push('/goals')} />
      )}
    </View>
  );
}
export function Choices({
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
  const t = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <T v="caption" muted>
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {values.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${choice}${unit}`}
            accessibilityState={{ selected: value === choice }}
            onPress={() => onChange(choice)}
            style={({ pressed }) => ({
              minHeight: 48,
              minWidth: 48,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: value === choice ? t.accent : t.surfaceRaised,
              opacity: pressed ? 0.6 : 1,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {value === choice && <Icon name="check" size={14} color={t.onAccent} />}
            <T
              v="label"
              style={{ color: value === choice ? t.onAccent : t.text, fontWeight: '700' }}
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
