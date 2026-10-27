import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UpdatingMascot } from './UpdatingMascot';
import { SetupButton } from '@/onboarding/Visuals';
import { dark, space } from '@/design-tokens';

export function UpdateRequiredScreen({
  onUpdate,
  busy,
  message,
  inProgress,
}: {
  onUpdate: () => void;
  busy: boolean;
  message: string | null;
  inProgress: boolean;
}) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const { height, width } = useWindowDimensions();
  const compact = height < 600;
  const display = fonts ? styles.displayFont : undefined;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Text style={[styles.brand, display]}>SCROLLSNOOZE</Text>
        <View style={styles.center} accessibilityViewIsModal>
          <UpdatingMascot size={Math.min(compact ? 120 : 224, width - 80)} />
          <Text accessibilityRole="header" style={[styles.title, display]}>
            {'A little refresh.\nA better snooze.'}
          </Text>
          <Text style={styles.description}>
            A new ScrollSnooze update is ready. Update the app to keep going.
          </Text>
          <View style={styles.actions}>
            {message && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.message}
              >
                {message}
              </Text>
            )}
            <SetupButton
              label={inProgress ? 'Continue update' : 'Update on Google Play'}
              onPress={onUpdate}
              busy={busy}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  brand: {
    color: dark.accent,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  displayFont: { fontFamily: 'LilitaOne', fontWeight: '400' },
  center: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  title: {
    color: dark.text,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: space.lg,
  },
  description: {
    color: dark.textMuted,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: space.lg,
  },
  actions: { width: '100%', gap: space.lg, marginTop: space.xxl },
  message: { color: dark.warning, fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
