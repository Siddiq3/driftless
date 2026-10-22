import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { Dashboard } from '@/ui/Focus';

export default function Home() {
  const session = useSession();
  if (session.status !== 'signedIn') return <Redirect href="/welcome" />;
  return <Dashboard />;
}
