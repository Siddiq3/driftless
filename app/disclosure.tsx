import { Platform, ScrollView } from 'react-native';
import { ScreenTimeScreen } from '@/ios/ScreenTimeScreen';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/ui/kit';
import { SetupButton, SETUP_COLORS as C } from '@/onboarding/Visuals';
import { FullDisclosure, PermissionScreen } from '@/permissions/PermissionScreen';

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Privacy opens this read-only; it never grants or opens anything. */
function ReadOnlyDisclosure() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
      <ScrollView contentContainerStyle={{ gap: 16 }}>
        <T accessibilityRole="header" style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>
          How accessibility counting uses your data
        </T>
        <FullDisclosure />
      </ScrollView>
      <SetupButton label="Close" onPress={leave} />
    </SafeAreaView>
  );
}

function AndroidDisclosure() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === 'read' ? <ReadOnlyDisclosure /> : <PermissionScreen onDone={leave} />;
}

export default function Disclosure() {
  return Platform.OS === 'ios' ? <ScreenTimeScreen /> : <AndroidDisclosure />;
}
