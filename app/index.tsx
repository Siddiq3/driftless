import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/ui/kit';

export default function Index() {
  const s = useSession();
  if (s.status === 'loading') {
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel="Loading" />
      </Screen>
    );
  }
  return <Redirect href={s.status === 'signedIn' ? '/home' : '/welcome'} />;
}
