import type { WickStage } from '@siddiq3/driftless-contracts/domain';
import { useEffect, useState } from 'react';
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

export function Wick({ stage, glow, size }: { stage: WickStage; glow: number; size?: number }) {
  const look = STAGE_LOOK[stage];
  // useState keeps one Animated.Value for the component's lifetime without reading a ref in render.
  const [pulse] = useState(() => new Animated.Value(0));
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

  const s = (size ?? look.size * 2) / 1.8;
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15 + 0.35 * glow, 0.3 + 0.5 * glow],
  });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const float = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Wick, ${look.label} stage, glow ${Math.round(glow * 100)} percent`}
      style={{ width: s * 1.8, height: s * 1.8, alignItems: 'center', justifyContent: 'flex-end' }}
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
      <Animated.Image
        source={require('../../assets/illustrations/wick.png')}
        resizeMode="contain"
        style={{
          width: s * 1.8,
          height: s * 1.8,
          opacity: 0.75 + 0.25 * glow,
          transform: [{ translateY: float }],
        }}
      />
    </View>
  );
}
