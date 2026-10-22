import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/ui/Icon';
import { BrandMark } from '@/ui/BrandMark';
import { Notice, T } from '@/ui/kit';
import { ReelsDemo } from './ReelsDemo';
import { SetupButton, SETUP_COLORS as C } from './Visuals';

/** First-launch product demonstration. These preview numbers never touch tracking or history. */
export function GetStartedScreen({
  fontsLoaded,
  busy,
  error,
  onStart,
}: {
  fontsLoaded: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const display = {
    fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
    fontWeight: fontsLoaded ? ('400' as const) : ('900' as const),
  };
  const heroHeight = Math.min(460, Math.max(240, height * 0.53), (width - 32) * 1.5);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <BrandMark size={34} />
          <T style={{ ...display, color: '#E4C5FF', fontSize: 20, letterSpacing: -0.5 }}>
            SCROLLSNOOZE
          </T>
        </View>
        <View
          accessibilityLabel="App language: English"
          style={{
            borderRadius: 24,
            backgroundColor: '#211C3D',
            paddingHorizontal: 15,
            paddingVertical: 10,
          }}
        >
          <T style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>English</T>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <View style={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
          <ReelsDemo height={heroHeight} />
          <T
            style={{
              ...display,
              fontSize: 29,
              lineHeight: 36,
              color: C.text,
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            See your reels count
          </T>
          <View
            accessibilityLabel="Supports Instagram Reels and YouTube Shorts"
            style={{ flexDirection: 'row', gap: 20, marginTop: 22, opacity: 0.65 }}
          >
            <AppIcon name="Instagram" size={26} />
            <AppIcon name="YouTube" size={26} />
          </View>
          {error && (
            <View style={{ marginTop: 16, width: '100%' }}>
              <Notice tone="warn" title="Please try again" body={error} />
            </View>
          )}
        </View>
      </ScrollView>
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 14,
        }}
      >
        <SetupButton label="Get Started" busy={busy} onPress={onStart} />
      </View>
    </SafeAreaView>
  );
}
