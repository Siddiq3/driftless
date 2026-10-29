import { StyleSheet } from 'react-native';
import { space, type } from '@/design-tokens';

/** Presentation only: unknown observations remain null in tracking and scoring. */
export function homeCountMessage(
  state: 'loading' | 'error' | 'ok',
  count: number | null,
  countingActive: boolean,
) {
  if (state === 'loading')
    return { title: 'Getting today ready', detail: 'Checking your activity…' };
  if (state === 'error')
    return { title: 'Let’s reconnect', detail: 'Your activity couldn’t be loaded.' };
  if (count !== null && count > 0) return null;
  if (count === 0) return { title: 'A fresh start', detail: 'No short videos recorded today.' };
  return countingActive
    ? { title: 'Ready when you are', detail: 'Your count will appear when activity is available.' }
    : { title: 'Your day starts here', detail: 'Enable counting to see your activity.' };
}

export const homeCountStyles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  title: {
    fontSize: type.title.size,
    lineHeight: type.title.lineHeight,
    fontWeight: type.title.weight,
    textAlign: 'center',
  },
  detail: { fontSize: type.label.size, lineHeight: type.label.lineHeight, textAlign: 'center' },
  appEmpty: {
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    fontWeight: type.label.weight,
  },
});
