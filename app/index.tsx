import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/auth/session';
import { Button, Notice, Screen } from '@/ui/kit';
import { useOnboarding } from '@/onboarding/context';

export default function Index() {
  const s = useSession();
  const setup = useOnboarding();
  if (setup.load.state === 'error')
    return (
      <Screen>
        <Notice tone="warn" title="Setup could not be loaded" body={setup.load.message} />
        <Button label="Try again" onPress={setup.reload} />
        <Button
          kind="secondary"
          label="Restart setup"
          onPress={() => void setup.restart().catch(setup.reload)}
        />
      </Screen>
    );
  if (s.status === 'loading' || setup.load.state === 'loading') {
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel="Loading" />
      </Screen>
    );
  }
  if (setup.load.state === 'ready' && !setup.load.record?.completed)
    return <Redirect href="/onboarding" />;
  return <Redirect href={s.status === 'signedIn' ? '/home' : '/welcome'} />;
}
