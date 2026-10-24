import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { SvgXml } from 'react-native-svg';
import type { ApiClient } from '@/api/client';
import { ensureSocialProfile } from './profile';
import { inviteLink, friendInviteMessage } from './invite';
import { copyIcon, shareIcon } from './shareIcons';

export function FriendInviteSheet({
  visible,
  api,
  displayName,
  onClose,
}: {
  visible: boolean;
  api: ApiClient;
  displayName: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const [invite, setInvite] = useState<{ api: ApiClient; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sharing = useRef(false);
  const current = visible && invite?.api === api ? invite : null;
  const live = useRef({ visible, api });
  useEffect(() => {
    live.current = { visible, api };
    if (!visible) return;
    let active = true;
    const allowed = () => active && live.current.visible && live.current.api === api;
    void (async () => {
      await Promise.resolve();
      if (!allowed()) return;
      setInvite(null);
      setError(null);
      setNote(null);
      await ensureSocialProfile(api, displayName, allowed);
      if (!allowed()) return;
      const result = await api.createInvite();
      if (allowed()) setInvite({ api, code: result.code });
    })().catch((e) => {
      if (allowed())
        setError(
          e instanceof Error && e.message.includes('choose a handle')
            ? 'Your profile is still being prepared. Please try again.'
            : e instanceof Error
              ? e.message
              : 'Your invite could not be created.',
        );
    });
    return () => {
      active = false;
      live.current = { visible: false, api };
    };
  }, [visible, api, displayName, retry]);
  const url = current ? inviteLink(current.code) : null;
  const copy = () => {
    if (!url) return;
    try {
      Clipboard.setString(url);
      setNote('Invite link copied');
    } catch {
      setError('Could not copy the link. Try More to share it.');
    }
  };
  const share = async (target: 'whatsapp' | 'instagram' | 'more') => {
    const allowed = () => live.current.visible && live.current.api === api;
    if (!current || !url || sharing.current || !allowed()) return;
    sharing.current = true;
    setError(null);
    try {
      const message = friendInviteMessage(current.code);
      if (target === 'whatsapp') {
        try {
          await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
        } catch {
          if (allowed()) await Share.share({ message });
        }
      } else if (target === 'instagram') {
        // Instagram does not accept a prefilled text DM. Copy first and let the user paste/send.
        Clipboard.setString(url);
        setNote('Link copied. Paste it into an Instagram message.');
        try {
          await Linking.openURL('instagram://app');
        } catch {
          if (allowed()) await Share.share({ message });
        }
      } else if (allowed()) await Share.share({ message });
    } catch {
      if (live.current.visible && live.current.api === api)
        setError('Could not open sharing. Copy the link or try again.');
    } finally {
      sharing.current = false;
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss invite"
          onPress={onClose}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close invite"
            onPress={onClose}
            style={styles.handleArea}
          >
            <View style={styles.handle} />
          </Pressable>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            <Text
              accessibilityRole="header"
              style={[styles.title, fonts && { fontFamily: 'LilitaOne', fontWeight: '400' }]}
            >
              Invite 5+ friends to enjoy{'\n'}battle more
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                note === 'Invite link copied' ? 'Invite link copied' : 'Copy invite link'
              }
              disabled={!url}
              onPress={copy}
              style={styles.linkPill}
            >
              {url ? (
                <Text numberOfLines={1} ellipsizeMode="middle" style={styles.link}>
                  {url}
                </Text>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator color="#FFD09D" />
                  <Text style={styles.loadingText}>
                    {error ? 'Invite unavailable' : 'Creating your invite…'}
                  </Text>
                </View>
              )}
              <SvgXml xml={copyIcon} width={24} height={24} color="#F7F2FF" />
            </Pressable>
            <View style={styles.options}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share on WhatsApp"
                disabled={!url}
                onPress={() => void share('whatsapp')}
                style={[styles.option, { opacity: url ? 1 : 0.4 }]}
              >
                <View style={[styles.circle, { backgroundColor: '#20D466' }]}>
                  <Image
                    source={require('../../assets/brands/whatsapp.png')}
                    style={styles.whatsapp}
                  />
                </View>
                <Text style={styles.optionLabel}>WhatsApp</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share on Instagram"
                accessibilityHint="Copies the link and opens Instagram so you can paste it in a message"
                disabled={!url}
                onPress={() => void share('instagram')}
                style={[styles.option, { opacity: url ? 1 : 0.4 }]}
              >
                <Image
                  source={require('../../assets/brands/instagram.png')}
                  style={styles.circle}
                />
                <Text style={styles.optionLabel}>Instagram</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More sharing options"
                disabled={!url}
                onPress={() => void share('more')}
                style={[styles.option, { opacity: url ? 1 : 0.4 }]}
              >
                <View style={[styles.circle, { backgroundColor: '#29271F' }]}>
                  <SvgXml xml={shareIcon} width={30} height={30} color="#FFFFFF" />
                </View>
                <Text style={styles.optionLabel}>More</Text>
              </Pressable>
            </View>
            {note && (
              <Text accessibilityLiveRegion="polite" style={styles.note}>
                {note}
              </Text>
            )}
            {error && (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry invite"
                  onPress={() => setRetry((n) => n + 1)}
                  style={styles.retry}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#15140F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  handleArea: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C6C1CA' },
  content: { paddingHorizontal: 26, paddingBottom: 24 },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 36,
    textAlign: 'center',
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 38,
  },
  linkPill: {
    minHeight: 66,
    borderRadius: 40,
    backgroundColor: '#29271F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  link: { flex: 1, color: '#B4B3AA', fontSize: 17, fontWeight: '600' },
  loading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: '#B4B3AA', fontSize: 15 },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 14,
    marginTop: 36,
    marginBottom: 12,
  },
  option: { alignItems: 'center', gap: 10, minWidth: 72 },
  circle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsapp: { width: 48, height: 48, resizeMode: 'contain' },
  optionLabel: { color: '#C4B69D', fontSize: 12 },
  note: { color: '#C4B69D', textAlign: 'center', marginTop: 16, lineHeight: 20 },
  error: { color: '#FFC19C', textAlign: 'center', marginTop: 16, lineHeight: 20 },
  retry: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  retryText: { color: '#FFD09D', fontWeight: '700', fontSize: 16 },
});
