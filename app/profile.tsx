import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { useSession } from '@/auth/session';
import { APP_VERSION } from '@/config/env';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { Icon, type IconName } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

const PLAY_ID = 'com.siddiqkolimi.scrollsnooze';
const SIZES: Record<number, string> = { 40: 'Small', 54: 'Medium', 72: 'Large' };

export async function rateOnPlay() {
  try {
    await Linking.openURL(`market://details?id=${PLAY_ID}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_ID}`);
  }
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={22} color={C.muted} />
      <T style={styles.rowText}>{label}</T>
      {value && <T style={{ color: C.muted, fontSize: 16 }}>{value}</T>}
      <Icon name="chevron" size={18} color={C.muted} />
    </Pressable>
  );
}

const Divider = () => <View style={styles.divider} />;

export default function Profile() {
  const session = useSession();
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [size, setSize] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      try {
        setSize(SIZES[Tracking.floatingCountPreferences().size] ?? null);
      } catch {
        setSize(null);
      }
    }, []),
  );
  const android = Platform.OS === 'android';
  const signedIn = session.status === 'signedIn';
  const addWidget = () => {
    try {
      if (!Tracking.widgetSupported() || !Tracking.requestCountWidget())
        setNote('Long-press your home screen, tap Widgets, and add ScrollSnooze.');
    } catch {
      setNote('Long-press your home screen, tap Widgets, and add ScrollSnooze.');
    }
  };
  const title = {
    ...styles.title,
    fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
    fontWeight: fontsLoaded ? ('400' as const) : ('900' as const),
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

        {signedIn ? (
          <View style={styles.account}>
            <T accessibilityRole="header" style={title}>
              {session.displayName ? `Hi, ${session.displayName}` : 'Your account'}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account settings"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.7 : 1 }]}
            >
              <T style={styles.pillText}>Account settings</T>
            </Pressable>
          </View>
        ) : (
          <View style={styles.account}>
            <T accessibilityRole="header" style={title}>
              Login/Create An Account
            </T>
            {session.status === 'signedOut' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Login"
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void session.signIn().finally(() => setBusy(false));
                }}
                style={({ pressed }) => [styles.pill, { opacity: pressed || busy ? 0.7 : 1 }]}
              >
                <T style={styles.pillText}>{busy ? 'Opening…' : 'Login'}</T>
              </Pressable>
            )}
          </View>
        )}

        {android && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Widgets: see your count on your home screen"
            onPress={addWidget}
            style={({ pressed }) => [styles.card, styles.widget, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BrainCharacter size={72} still />
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>Widgets</T>
              <T style={{ color: C.muted, fontSize: 15 }}>See your count on your home screen</T>
            </View>
            <Icon name="chevron" size={18} color={C.muted} />
          </Pressable>
        )}
        {note && <Notice title="Add the widget" body={note} />}

        <View style={styles.card}>
          <Row icon="friends" label="Friends" onPress={() => router.push('/friends')} />
        </View>

        <View style={styles.card}>
          <Row icon="chat" label="Send Feedback" onPress={() => router.push('/help')} />
          {android && (
            <>
              <Divider />
              <Row icon="trophy" label="Rate us on Play Store" onPress={() => void rateOnPlay()} />
            </>
          )}
        </View>

        <View style={styles.card}>
          {!signedIn && (
            <>
              <Row
                icon="lock"
                label="Your data & privacy"
                onPress={() => router.push('/privacy')}
              />
              <Divider />
            </>
          )}
          <Row icon="help" label="Legal" onPress={() => router.push('/legal')} />
        </View>

        {android && Tracking.floatingCountCustomizationSupported() && (
          <View style={styles.card}>
            <Row
              icon="counter"
              label="Counter size"
              value={size ?? undefined}
              onPress={() => router.push('/counter-size')}
            />
          </View>
        )}

        <T style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>
          {`ScrollSnooze · ${APP_VERSION}`}
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  account: { alignItems: 'center', gap: 18, paddingVertical: 14 },
  title: { color: C.text, fontSize: 30, lineHeight: 38, textAlign: 'center' },
  pill: {
    minHeight: 52,
    paddingHorizontal: 28,
    borderRadius: 26,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A372D',
    backgroundColor: C.surface,
  },
  pillText: { color: C.text, fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 18, backgroundColor: '#17160F', overflow: 'hidden' },
  widget: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 64,
    paddingHorizontal: 18,
  },
  rowText: { color: C.text, fontSize: 17, flex: 1 },
  divider: { height: 1, marginLeft: 56, backgroundColor: '#29271F' },
});
