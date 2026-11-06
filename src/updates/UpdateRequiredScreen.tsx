import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UpdatingMascot } from './UpdatingMascot';
import { SetupButton } from '@/onboarding/Visuals';
import { dark, space } from '@/design-tokens';
import { useReducedMotion } from '@/ui/motion';

/** Generic on purpose: this screen ships in the old version, so it can't know what the new one adds. */
const PERKS = ['✨ New features', '🐞 Fixes', '⚡ Smoother'];
const VIOLET = '#B79CFF';

/** The mascot on a breathing purple-and-amber glow with twinkling sparkles, like the pause screen. */
function GlowStage({ size }: { size: number }) {
  const reduced = useReducedMotion();
  // Created once per mount; state (not a ref) keeps render reads within the React rules.
  const [breath] = useState(() => new Animated.Value(0));
  const [twinkle] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.4)));
  useEffect(() => {
    if (reduced) return;
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
      ...twinkle.map((value, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 450),
            Animated.timing(value, { toValue: 1, duration: 700 + i * 250, useNativeDriver: true }),
            Animated.timing(value, {
              toValue: 0.15,
              duration: 700 + i * 250,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduced, breath, twinkle]);
  const stage = size * 1.25;
  const ring = (
    color: string,
    inset: number,
    from: number,
    to: number,
    opacity: [number, number],
  ) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: inset,
        left: inset,
        right: inset,
        bottom: inset,
        borderRadius: stage,
        backgroundColor: color,
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: opacity }),
        transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }],
      }}
    />
  );
  const spark = (i: number, place: object, size: number) => (
    <Animated.Text
      accessible={false}
      style={[
        styles.spark,
        place,
        { fontSize: size, opacity: twinkle[i], transform: [{ scale: twinkle[i] }] },
      ]}
    >
      ✦
    </Animated.Text>
  );
  return (
    <View style={{ width: stage, height: stage, alignItems: 'center', justifyContent: 'center' }}>
      {ring(VIOLET, 0, 0.86, 1, [0.1, 0.22])}
      {ring(dark.accent, stage * 0.18, 1, 0.9, [0.16, 0.08])}
      {spark(0, { top: stage * 0.06, left: stage * 0.1 }, 16)}
      {spark(1, { top: stage * 0.02, right: stage * 0.12 }, 22)}
      {spark(2, { bottom: stage * 0.12, right: stage * 0.04 }, 15)}
      <UpdatingMascot size={size} />
    </View>
  );
}

export function UpdateRequiredScreen({
  onUpdate,
  busy,
  message,
  inProgress,
}: {
  onUpdate: () => void;
  busy: boolean;
  message: string | null;
  inProgress: boolean;
}) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const { height, width } = useWindowDimensions();
  const compact = height < 600;
  const display = fonts ? styles.displayFont : undefined;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Text style={[styles.brand, display]}>SCROLLSNOOZE</Text>
        <View style={styles.center} accessibilityViewIsModal>
          <GlowStage size={Math.min(compact ? 110 : 200, (width - 80) / 1.25)} />
          <Text accessibilityRole="header" style={[styles.title, display]}>
            {'A little refresh.\nA better snooze.'}
          </Text>
          <Text style={styles.description}>
            A new ScrollSnooze update is ready. Update the app to keep going.
          </Text>
          <View style={styles.perks}>
            {PERKS.map((perk) => (
              <Text key={perk} style={styles.perk}>
                {perk}
              </Text>
            ))}
          </View>
          <View style={styles.actions}>
            {message && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.message}
              >
                {message}
              </Text>
            )}
            <SetupButton
              label={inProgress ? 'Continue update' : 'Update on Google Play'}
              onPress={onUpdate}
              busy={busy}
            />
            <Text style={styles.safe}>Your streaks and settings stay safe.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  brand: {
    color: dark.accent,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  displayFont: { fontFamily: 'LilitaOne', fontWeight: '400' },
  center: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  title: {
    color: dark.text,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: space.lg,
  },
  description: {
    color: dark.textMuted,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: space.lg,
  },
  actions: { width: '100%', gap: space.lg, marginTop: space.xxl },
  message: { color: dark.warning, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  perks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  perk: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#29271F',
  },
  safe: { color: dark.textMuted, fontSize: 14, textAlign: 'center' },
  spark: { position: 'absolute', color: dark.accent },
});
