import { Platform } from 'react-native';
import { IOSSetup } from '@/ios/IOSSetup';
import { useOnboarding } from '@/onboarding/context';
import { SetupFlow } from '@/onboarding/SetupFlow';
import { Button, LoadingState, Notice, Screen } from '@/ui/kit';

export default function Onboarding() {
  const setup = useOnboarding();
  if (setup.load.state === 'loading')
    return (
      <Screen>
        <LoadingState label="Preparing your fresh start…" />
      </Screen>
    );
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
  if (Platform.OS === 'ios') return <IOSSetup />;
  return <SetupFlow initial={setup.load.record} />;
}
