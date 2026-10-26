import { useApi } from '@/api/useApi';
import { useLocalSearchParams } from 'expo-router';
import { BattleAcceptance } from '@/social/BattleAcceptance';
import { INVITE_CODE } from '@/social/inviteLinks';
import { Notice, Screen } from '@/ui/kit';
export default function BattleInvite() {
  const api = useApi();
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (!code || !INVITE_CODE.test(code))
    return (
      <Screen>
        <Notice
          title="Invitation unavailable"
          body="Open the invitation link your friend shared."
        />
      </Screen>
    );
  return <BattleAcceptance key={`${api?.incarnation ?? 'guest'}:${code}`} code={code} />;
}
