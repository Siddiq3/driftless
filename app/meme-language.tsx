import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking, type MemeLanguage } from 'tracking-android';
import { Icon } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';
import { MEME_LANGUAGES } from '@/settings/memeLanguage';

function read(): MemeLanguage {
  try {
    return Tracking.memePreferences().language;
  } catch {
    return 'auto';
  }
}

export default function MemeLanguageScreen() {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [language, setLanguage] = useState(read);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => setLanguage(read()), []));
  const choose = (value: MemeLanguage) => {
    try {
      Tracking.setMemeLanguage(value);
      setError(null);
    } catch {
      setError('This setting could not be saved. Please try again.');
    }
    setLanguage(read());
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
          Meme language
        </T>
        <T style={{ color: C.muted, fontSize: 15 }}>
          The language of the meme breaks you see on Reels and Shorts.
        </T>

        <View style={styles.card}>
          {MEME_LANGUAGES.map(({ value, label }, i) => {
            const selected = language === value;
            return (
              <View key={value}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => choose(value)}
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
        {error && <Notice tone="warn" title="Not saved" body={error} />}
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
