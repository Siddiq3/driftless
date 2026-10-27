import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Button, Notice, Screen } from '@/ui/kit';
import { WrapStories } from '@/wrapped/Stories';
import { useWrap } from '@/wrapped/useWrap';

export default function Wrapped() {
  const params = useLocalSearchParams<{ period?: string; end?: string }>();
  const period = params.period === 'weekly' ? 'weekly' : 'daily';
  const [state, refresh] = useWrap(period, params.end);
  if (state.state === 'loading')
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel="Reading your wrap" />
        <Button label="Close" kind="secondary" onPress={() => router.back()} />
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
      {state.cloudUnavailable && (
        <Notice
          tone="warn"
          title="Synced totals unavailable"
          body="Showing this phone. Reopen Wrapped to retry."
        />
      )}
      <WrapStories
        key={`${state.recap.period}-${state.recap.to}-${state.recap.source}`}
        recap={state.recap}
      />
    </View>
  );
}
