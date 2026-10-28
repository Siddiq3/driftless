import { useEffect, useState, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_MOTION as M } from './constants';

export function StaggeredFadeIn({
  children,
  visible,
  index = 0,
  reducedMotion,
}: {
  children: ReactNode;
  visible: boolean;
  index?: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setEntered(visible),
      visible ? (reducedMotion ? M.reducedFade : index * M.optionStagger + M.optionFade) : 0,
    );
    cancelAnimation(progress);
    progress.value = withDelay(
      visible && !reducedMotion ? index * M.optionStagger : 0,
      withTiming(visible ? 1 : 0, {
        duration: reducedMotion ? M.reducedFade : visible ? M.optionFade : M.exitFade,
      }),
    );
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
    };
  }, [index, progress, reducedMotion, visible]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * M.optionLift }],
  }));
  return (
    <Animated.View
      style={style}
      pointerEvents={visible && entered ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible || !entered}
      importantForAccessibility={visible && entered ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}
