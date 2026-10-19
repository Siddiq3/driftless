import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { motion } from '../design-tokens';

/** Default to stillness until the OS preference has resolved. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Native-thread idle motion only while this screen is visible and the app is active. */
export function useIdleMotion(enabled = true) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  useFocusEffect(
    useCallback(() => {
      let loop: Animated.CompositeAnimation | undefined;
      const update = (active: boolean) => {
        loop?.stop();
        value.setValue(0);
        if (!active || reduced || !enabled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: motion.breathe,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(value, {
              toValue: 0,
              duration: motion.breathe,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        );
        loop.start();
      };
      update(AppState.currentState === 'active');
      const sub = AppState.addEventListener('change', (s) => update(s === 'active'));
      return () => {
        loop?.stop();
        sub.remove();
      };
    }, [enabled, reduced, value]),
  );
  return value;
}

/** A short native-driver transition whenever real data or expression changes. */
export function useDataMotion(key: string | number | null) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(1));
  useEffect(() => {
    value.stopAnimation();
    if (reduced) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: motion.update,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [key, reduced, value]);
  return {
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
  };
}
