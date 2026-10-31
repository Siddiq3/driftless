import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Button, Notice, Screen } from '@/ui/kit';
import { WrapStories } from '@/wrapped/Stories';
import { useWrap } from '@/wrapped/useWrap';

export default function Wrapped() {
  const params = useLocalSearchParams<{ end?: string }>();
  const [state, refresh] = useWrap('daily', params.end);
  if (state.state === 'loading')
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel="Reading your wrap" />
      </Screen>
    );
  if (state.state === 'error')
    return (
      <Screen>
        <Notice tone="warn" title={state.message} body="Try reopening your wrap." />
        <Button label="Try again" onPress={refresh} />
        <Button label="Close" kind="secondary" onPress={() => router.back()} />
      </Screen>
    );
  return (
    <View style={{ flex: 1 }}>
      <WrapStories key={`${state.recap.to}-${state.recap.source}`} recap={state.recap} />
    </View>
  );
}
