import { Redirect, useLocalSearchParams } from 'expo-router';
import { INVITE_CODE } from '@/social/inviteLinks';
import { Notice, Screen } from '@/ui/kit';

/** Verified HTTPS links keep their /join path when the OS opens Expo Router. */
export default function JoinBattle() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (!code || !INVITE_CODE.test(code))
    return (
      <Screen>
        <Notice
          title="Invitation unavailable"
          body="Ask your friend to share a new invitation link."
        />
      </Screen>
    );
  return <Redirect href={{ pathname: '/battle-invite', params: { code } }} />;
}
