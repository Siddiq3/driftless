import { useEffect, useState } from 'react';
import { AppState, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { useReducedMotion } from '@/ui/motion';
import { T } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

export const ACCESSIBILITY_STEPS = [
  'Tap “Downloaded apps”',
  'Tap “Driftless”',
  'Turn on the toggle',
  'Select “Allow”',
] as const;
const GuideVideo = requireNativeView<ViewProps & { playing: boolean }>('DriftlessTracking');

/** Silent local video footage: only the instructional panel, without recorded device chrome. */
export function AccessibilityWalkthrough() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const reduced = useReducedMotion();
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return (
    <View>
      <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFF0BD' }}>
        <GuideVideo
          playing={active && !reduced}
          style={{ width: '100%', aspectRatio: 640 / 592 }}
        />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {ACCESSIBILITY_STEPS.map((label, n) => (
          <View
            key={label}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 36 }}
          >
            <View
              style={{
                width: 23,
                height: 23,
                borderRadius: 12,
                backgroundColor: '#FFE8AE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={{ color: C.brown, fontWeight: '800', fontSize: 13 }}>{n + 1}</T>
            </View>
            <T style={{ color: C.text, flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>
              {label}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}
