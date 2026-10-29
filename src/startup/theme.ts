import { StyleSheet } from 'react-native';
import { dark, MIN_TOUCH, space } from '@/design-tokens';

export const startupTheme = {
  background: dark.bg,
  warm: '#25190F',
  text: dark.text,
  muted: dark.textMuted,
  accent: dark.accent,
  characterSize: 112,
} as const;
export const startupStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: space.xl, alignItems: 'center', justifyContent: 'center' },
  center: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: space.xl,
    paddingVertical: space.xxl,
  },
  character: { width: startupTheme.characterSize, height: startupTheme.characterSize },
  title: {
    color: startupTheme.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    maxWidth: '100%',
  },
  message: {
    color: startupTheme.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    flexShrink: 1,
  },
  help: { gap: space.sm, alignItems: 'center', marginTop: space.lg },
  signOut: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  link: { color: startupTheme.text, fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
});
