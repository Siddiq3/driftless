import type { WickStage } from '@siddiq3/driftless-contracts/domain';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { palette } from '../design-tokens';

/**
 * Wick — Driftless's original lantern-brain mascot. A small flame-shaped body whose halo brightens
 * with goal adherence. It never "rots": the lowest state is a dim, intact ember.
 */
const STAGE_LOOK: Record<WickStage, { body: string; halo: string; size: number; label: string }> = {
  ember: { body: '#B8742A', halo: palette.amber600, size: 88, label: 'Ember' },
  spark: { body: '#D48A2E', halo: palette.amber600, size: 96, label: 'Spark' },
  flicker: { body: palette.amber600, halo: palette.amber400, size: 104, label: 'Flicker' },
  glow: { body: palette.amber400, halo: palette.amber400, size: 112, label: 'Glow' },
  beacon: { body: '#FFC970', halo: '#FFE3A8', size: 120, label: 'Beacon' },
  aurora: { body: '#FFD98A', halo: palette.sage400, size: 128, label: 'Aurora' },
};

export function wickLabel(stage: WickStage): string {
  return STAGE_LOOK[stage].label;
}

export function Wick({ stage, glow }: { stage: WickStage; glow: number }) {
  const look = STAGE_LOOK[stage];
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const s = look.size;
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15 + 0.35 * glow, 0.3 + 0.5 * glow],
  });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const sway = pulse.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Wick, ${look.label} stage, glow ${Math.round(glow * 100)} percent`}
      style={{ width: s * 1.8, height: s * 1.9, alignItems: 'center', justifyContent: 'flex-end' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          bottom: s * 0.05,
          width: s * 1.7,
          height: s * 1.7,
          borderRadius: s,
          backgroundColor: look.halo,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      {/* wick thread */}
      <Animated.View
        style={{
          width: 4,
          height: s * 0.22,
          borderRadius: 2,
          backgroundColor: '#5A4632',
          marginBottom: -2,
          transform: [{ rotate: sway }],
        }}
      />
      {/* body: a soft drop, rounder at the bottom */}
      <View
        style={{
          width: s,
          height: s * 1.1,
          backgroundColor: look.body,
          borderTopLeftRadius: s * 0.5,
          borderTopRightRadius: s * 0.5,
          borderBottomLeftRadius: s * 0.55,
          borderBottomRightRadius: s * 0.55,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: s * 0.25,
        }}
      >
        <View style={{ flexDirection: 'row', gap: s * 0.22, marginTop: s * 0.08 }}>
          <View
            style={{
              width: s * 0.1,
              height: s * 0.14,
              borderRadius: s,
              backgroundColor: palette.night900,
            }}
          />
          <View
            style={{
              width: s * 0.1,
              height: s * 0.14,
              borderRadius: s,
              backgroundColor: palette.night900,
            }}
          />
        </View>
        <View
          style={{
            width: s * 0.22,
            height: s * 0.08,
            borderBottomLeftRadius: s,
            borderBottomRightRadius: s,
            backgroundColor: palette.night900,
            marginTop: s * 0.08,
            opacity: 0.25 + 0.75 * glow,
          }}
        />
      </View>
    </View>
  );
}
