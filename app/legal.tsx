import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { websiteLinks } from '@/config/website';
import { Icon, type IconName } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

/** The published website pages, shown inside the app so they're always current. */
export default function Legal() {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const links = websiteLinks();
  const items: { icon: IconName; label: string; doc: 'terms' | 'privacy' }[] = [
    { icon: 'help', label: 'Terms of Use', doc: 'terms' },
    { icon: 'lock', label: 'Privacy Policy', doc: 'privacy' },
  ];
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
          Legal
        </T>
        {!links && (
          <Notice tone="warn" title="Unavailable" body="The website address isn’t configured." />
        )}
        <View style={styles.card}>
          {items.map(({ icon, label, doc }, i) => (
            <View key={label}>
              {i > 0 && <View style={styles.divider} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={!links}
                onPress={() => router.push({ pathname: '/legal-doc', params: { doc } })}
                style={({ pressed }) => [styles.row, { opacity: pressed || !links ? 0.6 : 1 }]}
              >
                <Icon name={icon} size={22} color={C.muted} />
                <T style={{ color: C.text, fontSize: 17, flex: 1 }}>{label}</T>
                <Icon name="chevron" size={18} color={C.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
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
  divider: { height: 1, marginLeft: 56, backgroundColor: '#29271F' },
});
