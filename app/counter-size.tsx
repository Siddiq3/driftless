import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { Icon } from '@/ui/Icon';
import { Notice, T, Toggle } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

export const SIZES = [
  { label: 'Small', size: 40 },
  { label: 'Medium', size: 54 },
  { label: 'Large', size: 72 },
] as const;

function read() {
  try {
    const { size, pausedUntil } = Tracking.floatingCountPreferences();
    return {
      enabled: Tracking.floatingCountEnabled(),
      size,
      paused: pausedUntil > Date.now(),
      allowed: Tracking.health().disclosureAccepted,
    };
  } catch {
    return { enabled: false, size: 54, paused: false, allowed: false };
  }
}

export default function CounterSize() {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [prefs, setPrefs] = useState(read);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => setPrefs(read()), []));
  const change = (fn: () => void) => {
    try {
      fn();
      setError(null);
    } catch {
      setError('This setting could not be saved. Please try again.');
    }
    setPrefs(read());
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="back" size={22} color={C.text} />
        </Pressable>
        <T
          accessibilityRole="header"
          style={{
            color: C.text,
            fontSize: 32,
            lineHeight: 40,
            fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
            fontWeight: fontsLoaded ? '400' : '900',
          }}
        >
          Counter size
        </T>

        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Preview of the ${SIZES.find((s) => s.size === prefs.size)?.label ?? ''} counter on a Reel`}
          style={styles.preview}
        >
          <Image
            source={require('../assets/illustrations/demo-reel-waterfall.jpg')}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          {prefs.enabled && (
            <View style={styles.badge}>
              <BrainCharacter size={prefs.size} still />
              <View style={styles.badgeCount}>
                <T allowFontScaling={false} style={{ color: C.brown, fontWeight: '900' }}>
                  12
                </T>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <T style={styles.rowText}>Show counter on Reels & Shorts</T>
            <Toggle
              accessibilityLabel="Show counter on Reels and Shorts"
              value={prefs.enabled}
              disabled={!prefs.allowed}
              onValueChange={(on) => change(() => Tracking.setFloatingCountEnabled(on))}
            />
          </View>
        </View>

        <View style={[styles.card, !prefs.enabled && { opacity: 0.5 }]}>
          {SIZES.map(({ label, size }, i) => {
            const selected = prefs.size === size;
            return (
              <View key={size}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected, disabled: !prefs.enabled }}
                  disabled={!prefs.enabled}
                  onPress={() => change(() => Tracking.setFloatingCountSize(size))}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <T style={styles.rowText}>{label}</T>
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {prefs.paused && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show the counter again now"
            onPress={() => change(() => Tracking.resumeFloatingCount())}
            style={({ pressed }) => [styles.card, styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <T style={styles.rowText}>Hidden for now · Show again</T>
            <Icon name="chevron" size={18} color={C.muted} />
          </Pressable>
        )}
        {!prefs.allowed && (
          <Notice title="Counting is off" body="Turn on counting to use the counter." />
        )}
        {error && <Notice tone="warn" title="Not saved" body={error} />}
        <T style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
          Long-press the counter on a Reel to move it.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  preview: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#15140F',
  },
  badge: { position: 'absolute', top: 18, right: 18, alignItems: 'center' },
  badgeCount: {
    marginTop: -6,
    minWidth: 28,
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 6,
    backgroundColor: '#FFE8AE',
  },
  card: { borderRadius: 18, backgroundColor: '#17160F', overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 64,
    paddingHorizontal: 18,
  },
  rowText: { color: C.text, fontSize: 17, flex: 1 },
  divider: { height: 1, marginLeft: 18, backgroundColor: '#29271F' },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.accent },
});
