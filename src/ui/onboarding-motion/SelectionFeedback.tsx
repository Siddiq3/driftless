import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_MOTION as M } from './constants';

export function SelectionFeedback({
  children,
  label,
  selected,
  disabled,
  multi,
  onPress,
  reducedMotion,
  style,
  accent,
  indicatorColor,
  indicator,
}: {
  children: ReactNode;
  label: string;
  selected: boolean;
  disabled: boolean;
  multi?: boolean;
  onPress: () => void;
  reducedMotion: boolean;
  style: ViewStyle;
  accent: string;
  indicatorColor: string;
  indicator: ReactNode;
}) {
  const scale = useSharedValue(1);
  const selection = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    selection.set(withTiming(selected ? 1 : 0, { duration: M.indicatorFade }));
    return () => cancelAnimation(selection);
  }, [selected, selection]);
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: selection.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: reducedMotion ? 1 : selection.value }],
  }));
  const ring: ViewStyle = {
    width: 18,
    height: 18,
    borderRadius: multi ? 4 : 9,
    borderWidth: 1.5,
    borderColor: indicatorColor,
    justifyContent: 'center',
    alignItems: 'center',
  };
  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          if (!reducedMotion)
            scale.set(
              withSequence(
                withTiming(M.selectionScale, { duration: M.selectionDown }),
                withTiming(1, { duration: M.selectionUp }),
              ),
            );
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress();
        }}
        style={style}
      >
        <View style={ring} accessible={false} importantForAccessibility="no-hide-descendants">
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: ring.borderRadius,
                borderWidth: ring.borderWidth,
                borderColor: accent,
                // The outer ring supplies the layout. This layer crossfades its color.
                margin: -1.5,
              },
              ringStyle,
            ]}
          />
          <Animated.View style={checkStyle}>{indicator}</Animated.View>
        </View>
        {children}
      </Pressable>
    </Animated.View>
  );
}
