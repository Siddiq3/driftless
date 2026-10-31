import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { websiteLinks } from '@/config/website';
import { Icon } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { SETUP_COLORS as C } from '@/onboarding/Visuals';

const DOCS = {
  terms: { title: 'Terms of Use', key: 'terms' },
  privacy: { title: 'Privacy Policy', key: 'privacy' },
} as const;

/** Removes the website's navigation, which would lead out of this screen, and uses app colors. */
const APP_LOOK = [
  'header.wrap,footer,.skip,.toc{display:none!important}',
  'html,body{background:#0B0B08!important}',
  '.document-page{background:#17160F!important;border-color:#29271F!important;box-shadow:none!important}',
  '.callout{background:#29271F!important;border-color:#29271F!important}',
  '.callout strong,.legal a,.pagehero a{color:#FFD18E!important}',
  '.legal h2{color:#FFD18E!important}',
  '.document-page .eyebrow{display:none!important}',
].join('');
const HIDE_SITE_CHROME = `(function(){var s=document.createElement('style');
s.textContent=${JSON.stringify(APP_LOOK)};
document.documentElement.appendChild(s);})();true;`;

/** Only the exact published page renders here; every other link leaves for the system. */
export function staysInApp(requestUrl: string, pageUrl: string): boolean {
  try {
    const a = new URL(requestUrl);
    const b = new URL(pageUrl);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const entry = doc === 'terms' || doc === 'privacy' ? DOCS[doc] : null;
  const url = entry ? websiteLinks()?.[entry.key] : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
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
            fontSize: 26,
            lineHeight: 32,
            flex: 1,
            fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
            fontWeight: fontsLoaded ? '400' : '900',
          }}
        >
          {entry?.title ?? 'Legal'}
        </T>
      </View>
      {!url || failed ? (
        <View style={styles.message}>
          <Notice
            tone="warn"
            title="Page not available"
            body="Check your connection and try again."
          />
          {url && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => {
                setFailed(false);
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
              style={styles.retry}
            >
              <T style={{ color: C.accent, fontWeight: '700' }}>Try again</T>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            key={attempt}
            source={{ uri: url }}
            style={styles.web}
            originWhitelist={['https://*']}
            injectedJavaScriptBeforeContentLoaded={HIDE_SITE_CHROME}
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            onShouldStartLoadWithRequest={(request) => {
              if (staysInApp(request.url, url)) return true;
              void Linking.openURL(request.url).catch(() => undefined);
              return false;
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color={C.accent} accessibilityLabel="Loading page" />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  web: { flex: 1, backgroundColor: C.bg },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  message: { padding: 20, gap: 12 },
  retry: { minHeight: 48, justifyContent: 'center' },
});
