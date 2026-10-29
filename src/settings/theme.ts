import { StyleSheet } from 'react-native';
import { focusTheme, focusType } from '@/focus/theme';
import { dark } from '@/design-tokens';

export const settingsTheme = {
  ...focusTheme,
  color: { ...focusTheme.color, danger: dark.warning },
  type: focusType,
} as const;
const { color: c, space: s, radius: r, size: z } = settingsTheme;

export const settingsStyles = StyleSheet.create({
  canvas: { flex: 1 },
  screen: { paddingHorizontal: s.xl, paddingTop: s.sm, paddingBottom: s.xxl, gap: s.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  back: { minWidth: z.touch, minHeight: z.touch, alignItems: 'center', justifyContent: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: s.lg, paddingVertical: s.sm },
  avatar: {
    width: z.step,
    height: z.step,
    borderRadius: r.group,
    backgroundColor: c.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: s.xs },
  section: { gap: s.md },
  group: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.group,
    backgroundColor: c.surface,
    paddingHorizontal: s.lg,
  },
  row: {
    minHeight: z.step,
    paddingVertical: s.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  inset: { paddingBottom: s.lg, gap: s.md },
  icon: { width: z.icon, alignItems: 'center' },
  signOut: {
    minHeight: z.touch,
    paddingVertical: s.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  version: { textAlign: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: s.md },
});
