import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Wait for the OS before starting: a late preference must never replay the question. */
export function useMotionPreferences() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (mounted) setReducedMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted && !changed) setReducedMotion(value);
      })
      .catch(() => {
        if (mounted && !changed) setReducedMotion(true);
      });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reducedMotion;
}
