import { useEffect, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { useReducedMotion } from '@/ui/motion';

/** Four authored poses: typing, tapping, blinking, then back to typing. */
export function UpdatingMascot({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = (active: boolean) => {
      clearInterval(timer);
      setFrame(0);
      if (reduced || !active) return;
      timer = setInterval(() => setFrame((value) => (value + 1) % 4), 450);
    };
    update(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => update(state === 'active'));
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [reduced]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="ScrollSnooze brain working on an app update"
      style={{ width: size, height: size, overflow: 'hidden' }}
    >
      <Image
        source={require('../../assets/branding/scrollsnooze/purple/updating-sprite.png')}
        accessible={false}
        fadeDuration={0}
        style={{
          position: 'absolute',
          width: size * 2,
          height: size * 2,
          left: -(frame % 2) * size,
          top: -Math.floor(frame / 2) * size,
        }}
      />
    </View>
  );
}
