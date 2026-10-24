import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSession } from './session';

/** Keeps the invitation context visible while using the existing Google identity flow. */
export function InviteSignInSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const [busy, setBusy] = useState(false);
  const [buttonBounds, setButtonBounds] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (visible && session.status === 'signedIn') onClose();
  }, [visible, session.status, onClose]);

  const signIn = async () => {
    if (pending.current) return;
    setError(null);
    if (session.status !== 'signedOut' || !session.googleSupported) {
      setError(
        'Google sign-in is not available in this build. You can keep using ScrollSnooze without an account.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await session.signIn();
    } catch {
      setError('Google sign-in could not complete. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const privacy = () => {
    onClose();
    router.push('/privacy');
  };
  const message = error ?? (session.status === 'signedOut' ? session.error : null);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      navigationBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sign-in"
          onPress={onClose}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sign-in"
            onPress={onClose}
            style={styles.handleArea}
          >
            <View style={styles.handle} />
          </Pressable>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            <Pressable accessibilityRole="button" onPress={privacy} style={styles.help}>
              <Text style={styles.link}>Need help?</Text>
            </Pressable>
            <Text
              accessibilityRole="header"
              style={[styles.title, fonts && { fontFamily: 'LilitaOne', fontWeight: '400' }]}
            >
              Login or Create an account{'\n'}to invite a friend
            </Text>
            <Text style={styles.link}>
              Signing in also backs up saved goals and daily history to your account automatically.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              accessibilityHint="Opens Google sign-in to create or access your ScrollSnooze account"
              accessibilityState={{ busy, disabled: busy || session.status === 'loading' }}
              disabled={busy || session.status === 'loading'}
              onPress={() => void signIn()}
              onLayout={({ nativeEvent: { layout } }) =>
                setButtonBounds((previous) =>
                  previous.width === layout.width && previous.height === layout.height
                    ? previous
                    : { width: layout.width, height: layout.height },
                )
              }
              style={({ pressed }) => [styles.googleButton, { opacity: pressed || busy ? 0.8 : 1 }]}
            >
              {buttonBounds.width > 0 && (
                <Svg
                  pointerEvents="none"
                  accessible={false}
                  width={buttonBounds.width}
                  height={buttonBounds.height}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', top: 0, left: 0 }}
                >
                  <Defs>
                    <LinearGradient id="inviteGoogle" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#C4A0FF" />
                      <Stop offset="1" stopColor="#FFB66D" />
                    </LinearGradient>
                  </Defs>
                  <Rect width={100} height={100} fill="url(#inviteGoogle)" />
                </Svg>
              )}
              {busy ? (
                <ActivityIndicator color="#241642" />
              ) : (
                <>
                  <Text style={styles.googleText}>Continue With Google</Text>
                  <Image
                    source={require('../../assets/brands/google.png')}
                    style={styles.googleIcon}
                    accessibilityIgnoresInvertColors
                  />
                </>
              )}
            </Pressable>
            {message && (
              <Text accessibilityRole="alert" style={styles.error}>
                {message}
              </Text>
            )}
            <Text style={styles.legal}>By continuing, you acknowledge our</Text>
            <Pressable accessibilityRole="link" onPress={privacy} style={styles.privacy}>
              <Text style={[styles.link, styles.privacyText]}>Privacy Policy</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000D6', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#17132E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  handleArea: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C6C1CA' },
  content: { paddingHorizontal: 26, paddingBottom: 14 },
  help: { alignSelf: 'flex-end', minHeight: 48, justifyContent: 'center', marginBottom: 16 },
  link: { color: '#B9AFCB', fontSize: 15, textDecorationLine: 'underline', fontWeight: '600' },
  title: {
    color: '#F7F2FF',
    fontSize: 27,
    lineHeight: 36,
    textAlign: 'center',
    fontWeight: '900',
    marginBottom: 36,
  },
  googleButton: {
    backgroundColor: '#FFD292',
    minHeight: 66,
    borderRadius: 40,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  googleText: {
    color: '#241642',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  googleIcon: { width: 28, height: 28, resizeMode: 'contain' },
  legal: { color: '#B9AFCB', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 30 },
  privacy: { minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3 },
  privacyText: { fontSize: 15 },
  error: { color: '#FFC19C', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16 },
});
