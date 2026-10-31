import { Redirect } from 'expo-router';

/** App pauses and Focus are one screen now; old links land there. */
export default function AppPauses() {
  return <Redirect href="/blocking" />;
}
