import { ContentViewportContext, useResponsiveLayout, type ContentViewport } from './responsive';
import { dark, MIN_TOUCH, radius, space, type as typeScale, type Theme } from '../design-tokens';
import { useState, type ReactNode } from 'react';
import { Icon, iconForMark, type IconName } from './Icon';
import { router, usePathname } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
  '/history': { title: 'History', mark: '▤' },
  '/stats': { title: 'Your activity', mark: '↗' },
  '/goals': { title: 'Daily goals', mark: '◎' },
  '/blocking': { title: 'Focus', mark: 'Ⅱ' },
  '/friends': { title: 'Friends', mark: '♡' },
  '/challenges': { title: 'War', mark: '⚑' },
  '/privacy': { title: 'Privacy', mark: '◇' },
  '/disclosure': { title: 'Enable counting', mark: '▥' },
  '/pro': { title: 'Feature access', mark: '✦' },
  '/settings': { title: 'Settings', mark: '◇' },
};

/** Text that always respects the user's font scale (dynamic type). */
export function T({
  v = 'body',
  muted,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
  allowFontScaling = true,
}: {
  v?: Variant;
  muted?: boolean;
  style?: TextStyle;
  children: ReactNode;
  accessibilityRole?: 'header' | 'text';
  accessibilityLabel?: string;
  allowFontScaling?: boolean;
}) {
  const t = useTheme();
  const s = typeScale[v];
  const fontSize = style?.fontSize ?? s.size;
  const lineHeight = style?.lineHeight ?? Math.round((fontSize * s.lineHeight) / s.size);
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={
        accessibilityRole ?? (v === 'display' || v === 'title' ? 'header' : 'text')
      }
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={2}
      style={[
        {
          flexShrink: 1,
          minWidth: 0,
          color: muted ? t.textMuted : t.text,
          fontSize,
          lineHeight,
          fontWeight: s.weight,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  topBanner,
  tabBarStyle,
  contentStyle,
  hideHeader = false,
  hideTabs = false,
  backgroundColor,
}: {
  children: ReactNode;
  topBanner?: ReactNode;
  tabBarStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  hideHeader?: boolean;
  hideTabs?: boolean;
  backgroundColor?: string;
}) {
  const t = useTheme();
  const path = usePathname();
  const layout = useResponsiveLayout();
  const [viewport, setViewport] = useState<ContentViewport | null>(null);
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
    { label: 'Today', mark: '◉', href: '/welcome', active: ['/welcome', '/home', '/tracking'] },
    { label: 'War', mark: '⚔', href: '/friends', active: ['/friends', '/challenges'] },
    {
      label: 'Progress',
      mark: '↗',
      href: '/progress',
      active: ['/progress', '/history', '/stats'],
    },
  ] as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: backgroundColor ?? t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ContentViewportContext.Provider value={viewport}>
          <ScrollView
            style={{ flex: 1 }}
            onLayout={({ nativeEvent: { layout: bounds } }) => {
              const next = { width: Math.min(bounds.width, 680), height: bounds.height };
              setViewport((previous) =>
                previous?.width === next.width && previous.height === next.height ? previous : next,
              );
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.screen,
              { padding: layout.gutter, gap: layout.gap },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {topBanner}
            {details && !hideHeader && (
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
                <T v="title" style={{ flex: 1, letterSpacing: -0.6 }}>
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
        </ContentViewportContext.Provider>
      </KeyboardAvoidingView>
      {!hideTabs && (primary || path === '/challenges') && (
        <View
          style={[
            styles.tabs,
            {
              backgroundColor: backgroundColor ?? (path === '/progress' ? t.bg : t.surface),
              borderColor: backgroundColor ?? (path === '/progress' ? t.bg : t.border),
            },
            tabBarStyle,
          ]}
        >
          {tabs.map((tab) => {
            const selected = tab.active.some((p) => p === path);
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => router.replace(tab.href === '/welcome' ? '/' : tab.href)}
                style={styles.tab}
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
                    textAlign: 'center',
                    alignSelf: 'stretch',
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

/** Use inside Modal; one safe-area owner and one bounded scrolling body. */
export function ModalContent({
  children,
  style,
  onClose,
  centered = false,
  dismissLabel = 'Dismiss dialog',
}: {
  children: ReactNode;
  style?: ViewStyle;
  onClose: () => void;
  centered?: boolean;
  dismissLabel?: string;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000B' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View
          style={{
            flex: 1,
            justifyContent: centered ? 'center' : 'flex-end',
            padding: centered ? 16 : 0,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            style={{
              flexGrow: 0,
              maxHeight: '90%',
              width: '100%',
              maxWidth: 560,
              alignSelf: 'center',
              borderRadius: 30,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View accessibilityViewIsModal style={style}>
              {children}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Open section for related content without a repeated dashboard container. */
export function Section({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          paddingTop: 16,
          paddingBottom: 0,
          gap: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
        },
        style,
      ]}
    >
      {children}
    </View>
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
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
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
            fontWeight: '600',
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
        { backgroundColor: t.surface, borderColor: tone === 'warn' ? t.warning : t.border },
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
    <View>
      <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.lg }}>
        <ActivityIndicator color={t.accent} accessibilityLabel={label} />
        <T muted>{label}</T>
      </View>
    </View>
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
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: t.border,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 52,
          paddingVertical: 12,
        }}
      >
        <Icon name={icon} size={22} />
        <T v="label" style={{ flex: 1 }}>
          {title}
        </T>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={18} color={t.textMuted} />
        </View>
      </Pressable>
      {open && <View style={{ paddingBottom: 20, gap: 14 }}>{children}</View>}
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
        paddingVertical: space.lg,
        gap: space.xs,
      }}
    >
      <T
        v="display"
        accessibilityRole="text"
        style={{ color: t.accent, fontSize: 48, lineHeight: 58, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </T>
      <T v="label" muted>
        {label}
      </T>
      {detail && (
        <T v="caption" muted>
          {detail}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 20,
    gap: space.lg,
    flexGrow: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: 4,
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
    borderLeftWidth: 2,
    borderRadius: radius.sm,
    padding: space.lg,
    gap: space.xs,
  },
});
