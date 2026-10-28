import { useCallback, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_MOTION as M } from './constants';

/** Asset-agnostic: the original PNG, SVG or Lottie remains the child. */
export function AnimatedCharacter({
  children,
  talking,
  reducedMotion,
}: {
  children: ReactNode;
  talking: boolean;
  reducedMotion: boolean;
}) {
  const phase = useSharedValue(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      const update = (foreground: boolean) => {
        setActive(foreground);
        cancelAnimation(phase);
        phase.set(0);
        if (foreground && !reducedMotion) {
          phase.set(
            withRepeat(
              withTiming(1, {
                duration: talking ? M.talkingHalfCycle : M.bobHalfCycle,
                easing: Easing.inOut(Easing.sin),
              }),
              -1,
              true,
            ),
          );
        }
      };
      update(AppState.currentState === 'active');
      const sub = AppState.addEventListener('change', (state) => update(state === 'active'));
      return () => {
        sub.remove();
        cancelAnimation(phase);
        phase.set(0);
      };
    }, [phase, reducedMotion, talking]),
  );
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -phase.value * (talking ? M.bobDistance / 2 : M.bobDistance) },
      { rotate: `${phase.value * M.idleRotation}deg` },
      { scale: talking ? 1 + phase.value * (M.talkingScale - 1) : 1 },
    ],
  }));
  return (
    <Animated.View style={!reducedMotion && active ? style : undefined}>{children}</Animated.View>
  );
}
