import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { requireNativeView } from 'expo';
import { AppState, View, type ViewProps } from 'react-native';
import { useReducedMotion } from '@/ui/motion';

const ReelsVideo = requireNativeView<ViewProps & { source: 'reels'; playing: boolean }>(
  'DriftlessTracking',
);

/** The approved continuous MP4, played locally. Preview counts never enter real history. */
export function ReelsDemo({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return (
    <View
      style={{
        height,
        width: height * (9 / 16),
        maxWidth: '100%',
        alignSelf: 'center',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#090909',
      }}
    >
      <ReelsVideo
        source="reels"
        playing={focused && active && !reduced}
        style={{ width: '100%', height: '100%' }}
        accessibilityLabel="Video preview: six reels swipe upward and the count increases"
      />
    </View>
  );
}
