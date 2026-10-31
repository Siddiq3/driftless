import { Redirect } from 'expo-router';
/** Older saved challenge links return to the leaderboard; there is no separate challenge browser. */
export default function Challenges() {
  return <Redirect href="/friends" />;
}
