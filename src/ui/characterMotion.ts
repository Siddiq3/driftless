import { useCallback, useState } from 'react';
import { Animated, AppState, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useReducedMotion } from './motion';

export type CharacterEmotion = 'fresh' | 'focused' | 'tired' | 'drained' | 'wrapped' | 'privacy';
export const EXPRESSION_TIMING = {
  fresh: { wait: 3000, close: 95, hold: 45, open: 150, breathe: 2400, lift: 5 },
  focused: { wait: 4800, close: 0, hold: 0, open: 0, breathe: 3400, lift: 2 },
  tired: { wait: 4200, close: 220, hold: 220, open: 360, breathe: 3200, lift: 2 },
  drained: { wait: 4800, close: 280, hold: 320, open: 460, breathe: 3800, lift: 1 },
  wrapped: { wait: 3600, close: 120, hold: 60, open: 180, breathe: 2800, lift: 3 },
  privacy: { wait: 4000, close: 130, hold: 70, open: 190, breathe: 3000, lift: 2 },
} as const;

/** Facial animation stops on blur, backgrounding, still mode and Reduce Motion. */
export function useCharacterExpression(emotion: CharacterEmotion, enabled: boolean) {
  const reduced = useReducedMotion();
  const [blink] = useState(() => new Animated.Value(0));
  const [expression] = useState(() => new Animated.Value(0));
  const [frame, setFrame] = useState({ blink: 0, expression: 0 });
  useFocusEffect(
    useCallback(() => {
      const timing = EXPRESSION_TIMING[emotion];
      let animation: Animated.CompositeAnimation | undefined;
      const blinkListener = blink.addListener(({ value }) =>
        setFrame((old) => ({ ...old, blink: value })),
      );
      const expressionListener = expression.addListener(({ value }) =>
        setFrame((old) => ({ ...old, expression: value })),
      );
      const update = (active: boolean) => {
        animation?.stop();
        blink.setValue(0);
        expression.setValue(0);
        if (!active || !enabled || reduced || emotion === 'focused') return;
        const step = (value: Animated.Value, toValue: number, duration: number) =>
          Animated.timing(value, {
            toValue,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false, // SVG geometry, not a whole-image transform.
            isInteraction: false,
          });
        animation = Animated.loop(
          Animated.sequence([
            Animated.delay(timing.wait),
            step(blink, 1, timing.close),
            Animated.delay(timing.hold),
            step(blink, 0, timing.open),
            Animated.delay(900),
            step(expression, 1, emotion === 'tired' ? 850 : 650),
            step(expression, 0, emotion === 'tired' ? 1100 : 900),
            Animated.delay(700),
          ]),
        );
        animation.start();
      };
      update(AppState.currentState === 'active');
      const subscription = AppState.addEventListener('change', (state) =>
        update(state === 'active'),
      );
      return () => {
        animation?.stop();
        subscription.remove();
        blink.removeListener(blinkListener);
        expression.removeListener(expressionListener);
        blink.setValue(0);
        expression.setValue(0);
      };
    }, [blink, emotion, enabled, expression, reduced]),
  );
  return enabled && !reduced ? frame : { blink: 0, expression: 0 };
}
