import { dark, MIN_TOUCH, radius, space, type as typeScale, type Theme } from '../design-tokens';
import { useState, type ReactNode } from 'react';
import { Icon, iconForMark, type IconName } from './Icon';
import { router, usePathname } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  View,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
  type SwitchProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function useTheme(): Theme {
  return dark;
}

type Variant = keyof typeof typeScale;

const PAGE_DETAILS: Record<string, { title: string; mark: string }> = {
  '/tracking': { title: 'Counter', mark: '▥' },
  '/progress': { title: 'Your Wick', mark: '✦' },
  '/history': { title: 'History', mark: '▤' },
  '/stats': { title: 'Progress', mark: '↗' },
  '/goals': { title: 'Daily goals', mark: '◎' },
  '/blocking': { title: 'Focus', mark: 'Ⅱ' },
  '/friends': { title: 'Friends', mark: '♡' },
  '/challenges': { title: 'Challenges', mark: '⚑' },
  '/privacy': { title: 'Privacy', mark: '◇' },
  '/disclosure': { title: 'Enable counting', mark: '▥' },
  '/pro': { title: 'Driftless Pro', mark: '✦' },
  '/settings': { title: 'Settings', mark: '◇' },
};

/** Text that always respects the user's font scale (dynamic type). */
export function T({
  v = 'body',
  muted,
  style,
  children,
  accessibilityRole,
}: {
  v?: Variant;
  muted?: boolean;
  style?: TextStyle;
  children: ReactNode;
  accessibilityRole?: 'header' | 'text';
}) {
  const t = useTheme();
  const s = typeScale[v];
  return (
    <Text
      accessibilityRole={
        accessibilityRole ?? (v === 'display' || v === 'title' ? 'header' : 'text')
      }
      maxFontSizeMultiplier={2}
      style={[
        {
          color: muted ? t.textMuted : t.text,
          fontSize: s.size,
          lineHeight: s.lineHeight,
          fontWeight: s.weight,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  const path = usePathname();
  const primary = [
    '/welcome',
    '/home',
    '/tracking',
    '/progress',
    '/history',
    '/stats',
    '/friends',
  ].includes(path);
  const details = PAGE_DETAILS[path];
  const tabs = [
    { label: 'Home', mark: '◉', href: '/welcome', active: ['/welcome', '/home'] },
    { label: 'Counter', mark: '▥', href: '/tracking', active: ['/tracking'] },
    { label: 'Wick', mark: '✦', href: '/progress', active: ['/progress'] },
    { label: 'History', mark: '▤', href: '/history', active: ['/history', '/stats'] },
    { label: 'Circle', mark: '♡', href: '/friends', active: ['/friends', '/challenges'] },
  ] as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        {details && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            {!primary && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={{ minWidth: 48, minHeight: 48, justifyContent: 'center' }}
              >
                <Icon name="back" />
              </Pressable>
            )}
            <T v="title" style={{ flex: 1 }}>
              {details.title}
            </T>
            <Icon
              name={path === '/settings' ? 'settings' : iconForMark(details.mark)}
              color={t.textMuted}
            />
          </View>
        )}
        {children ?? <LoadingState />}
      </ScrollView>
      {(primary || path === '/challenges') && (
        <View style={[styles.tabs, { backgroundColor: t.surface, borderColor: t.border }]}>
          {tabs.map((tab) => {
            const selected = tab.active.some((p) => p === path);
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => router.replace(tab.href === '/welcome' ? '/' : tab.href)}
                style={[styles.tab, { backgroundColor: selected ? t.hero : 'transparent' }]}
              >
                <Icon
                  name={iconForMark(tab.mark)}
                  size={23}
                  color={selected ? t.accent : t.textMuted}
                />
                <T
                  v="caption"
                  style={{
                    color: selected ? t.accent : t.textMuted,
                    fontWeight: selected ? '700' : '400',
                  }}
                >
                  {tab.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  busy,
  kind = 'primary',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const primary = kind === 'primary';
  const danger = kind === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? t.accent : t.surfaceRaised,
          borderColor: danger ? t.warning : primary ? t.accent : t.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? t.onAccent : t.accent} />
      ) : (
        <T
          v="label"
          style={{
            color: danger ? t.warning : primary ? t.onAccent : t.accent,
            textAlign: 'center',
          }}
        >
          {label}
        </T>
      )}
    </Pressable>
  );
}

/** Honest status row: used for loading, empty, offline, error and "not available yet" states. */
export function Notice({
  title,
  body,
  tone = 'info',
}: {
  title: string;
  body: string;
  tone?: 'info' | 'warn';
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.notice,
        { backgroundColor: t.surfaceRaised, borderColor: tone === 'warn' ? t.warning : t.border },
      ]}
    >
      <T v="label">{title}</T>
      {body ? (
        <T v="caption" muted>
          {body}
        </T>
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'Getting things ready…' }: { label?: string }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.lg }}>
        <ActivityIndicator color={t.accent} accessibilityLabel={label} />
        <T muted>{label}</T>
      </View>
    </Card>
  );
}

/** Progressive disclosure keeps setup explanations and secondary data out of the main view. */
export function Details({
  title,
  icon = 'help',
  children,
  initiallyOpen = false,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.border,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 18 }}
      >
        <Icon name={icon} size={22} />
        <T v="label" style={{ flex: 1 }}>
          {title}
        </T>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={18} color={t.textMuted} />
        </View>
      </Pressable>
      {open && <View style={{ padding: 18, paddingTop: 0, gap: 14 }}>{children}</View>}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  mark = '✦',
}: {
  title: string;
  body: string;
  mark?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.md }}>
      <Icon name={iconForMark(mark)} size={40} color={t.accent} />
      <T v="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T muted style={{ textAlign: 'center' }}>
        {body}
      </T>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <T v="label">{label}</T>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={t.textMuted}
        selectionColor={t.accent}
        style={[
          {
            minHeight: 52,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.bg,
            color: t.text,
            borderRadius: radius.sm,
            padding: space.lg,
            fontSize: 16,
          },
          props.style,
        ]}
      />
    </View>
  );
}

export function Toggle(props: SwitchProps) {
  const t = useTheme();
  return (
    <Switch
      {...props}
      trackColor={{ false: t.border, true: t.accent }}
      thumbColor={props.value ? t.onAccent : t.textMuted}
    />
  );
}

export function MetricPanel({
  value,
  label,
  detail,
}: {
  value: string | number;
  label: string;
  detail?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        padding: space.xl,
        borderRadius: radius.md,
        backgroundColor: t.accent,
        gap: space.xs,
      }}
    >
      <T v="display" accessibilityRole="text" style={{ color: t.onAccent }}>
        {value}
      </T>
      <T v="label" style={{ color: t.onAccent }}>
        {label}
      </T>
      {detail && (
        <T v="caption" style={{ color: t.onAccent }}>
          {detail}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: space.xxl,
    gap: space.lg,
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  tabs: {
    flexDirection: 'row',
    padding: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    borderRadius: radius.md,
    gap: 2,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: space.lg,
    gap: space.xs,
  },
});
