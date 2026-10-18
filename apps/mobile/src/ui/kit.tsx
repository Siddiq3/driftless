import {
  dark,
  light,
  MIN_TOUCH,
  radius,
  space,
  type as typeScale,
  type Theme,
} from '@driftless/design-tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

type Variant = keyof typeof typeScale;

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
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
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
  kind?: 'primary' | 'secondary';
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const primary = kind === 'primary';
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
          backgroundColor: primary ? t.accent : 'transparent',
          borderColor: t.accent,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? t.onAccent : t.accent} />
      ) : (
        <T v="label" style={{ color: primary ? t.onAccent : t.accent, textAlign: 'center' }}>
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
      style={[styles.notice, { borderColor: tone === 'warn' ? t.warning : t.border }]}
    >
      <T v="label">{title}</T>
      <T v="caption" muted>
        {body}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.xl, gap: space.lg, flexGrow: 1 },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
  },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  notice: { borderLeftWidth: 3, paddingLeft: space.md, paddingVertical: space.xs, gap: space.xs },
});
