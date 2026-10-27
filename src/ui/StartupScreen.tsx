import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { dark, MIN_TOUCH, radius, space } from '@/design-tokens';

/** Shared cold-start surface: no navigation, account requests or artificial progress. */
export function StartupScreen({ onSignOut }: { onSignOut?: () => void }) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.brand}>
          <Text style={[styles.wordmark, fonts && styles.brandFont]}>SCROLLSNOOZE</Text>
          <Text style={styles.tagline}>A little less scroll. A little more you.</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.halo}>
            <View style={styles.characterBackground}>
              <Image
                source={require('../../assets/branding/scrollsnooze/purple/icon-master.png')}
                style={styles.character}
                accessible={false}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text accessibilityRole="header" style={[styles.title, fonts && styles.brandFont]}>
            A little pause…
          </Text>
          <Text style={styles.description}>Getting your progress ready.</Text>
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={dark.accent} accessibilityLabel="Opening ScrollSnooze" />
            <Text style={styles.statusText}>Opening ScrollSnooze</Text>
          </View>
        </View>
        <View style={styles.footer}>
          {onSignOut && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={onSignOut}
              style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxxl,
    alignItems: 'center',
  },
  brand: { alignItems: 'center', gap: space.sm, paddingTop: space.lg },
  wordmark: {
    color: dark.accent,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  brandFont: { fontFamily: 'LilitaOne', fontWeight: '400' },
  tagline: { color: dark.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  center: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxl,
  },
  halo: {
    width: 184,
    height: 184,
    borderRadius: radius.pill,
    backgroundColor: dark.hero,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xxl,
  },
  characterBackground: {
    width: 148,
    height: 148,
    borderRadius: radius.pill,
    backgroundColor: dark.warm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: { width: 120, height: 120 },
  title: { color: dark.text, fontSize: 32, lineHeight: 42, fontWeight: '800', textAlign: 'center' },
  description: {
    color: dark.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: space.sm,
  },
  status: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: dark.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    marginTop: space.xxl,
  },
  statusText: {
    color: dark.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    flexShrink: 1,
  },
  footer: { minHeight: MIN_TOUCH, alignItems: 'center' },
  signOut: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
  },
  signOutText: {
    color: dark.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
});
