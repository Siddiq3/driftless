import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/design-tokens';

export type ContentViewport = { width: number; height: number };
export const ContentViewportContext = createContext<ContentViewport | null>(null);

/** Layout policies use logical dp and the measured content viewport, never physical pixels. */
export function responsiveLayout(width: number, height: number, fontScale: number) {
  const compact = height < 740 || fontScale > 1.3;
  return {
    compact,
    stack: width < 360 || fontScale > 1.3,
    gutter: width < 360 ? space.lg : space.xl,
    gap: compact ? space.md : space.xl,
    mascotSize: Math.max(64, Math.min(width - space.xxl, compact ? 120 : 180)),
  };
}

export function useResponsiveLayout() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const content = useContext(ContentViewportContext);
  const width = content?.width ?? Math.max(0, window.width - insets.left - insets.right);
  const height = content?.height ?? Math.max(0, window.height - insets.top - insets.bottom);
  return {
    ...responsiveLayout(width, height, window.fontScale),
    width,
    height,
    fontScale: window.fontScale,
  };
}
