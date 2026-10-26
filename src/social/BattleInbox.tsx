import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { ApiClient } from '@/api/client';
import type { Battle } from '@/api/challenges';
import { Button, Card, Notice, T } from '@/ui/kit';
import { useBattleFeed } from './useBattleFeed';

export const invitationLabel: Record<NonNullable<Battle['invitationState']>, string> = {
  pending: 'Invitation pending',
  accepted: 'Battle accepted',
  declined: 'Invitation declined',
  cancelled: 'Battle cancelled',
  expired: 'Battle ended',
  unavailable: 'Battle unavailable',
};
export function BattleInbox({
  api,
  feed: provided,
}: {
  api: ApiClient | null;
  feed?: ReturnType<typeof useBattleFeed>;
}) {
  const local = useBattleFeed(provided ? null : api);
  const feed = provided ?? local;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(api);
  useEffect(() => {
    live.current = api;
    return () => {
      live.current = null;
    };
  }, [api]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const respond = async (battle: Battle, accept: boolean) => {
    if (!api || busy) return;
    const allowed = () => mounted.current && live.current === api;
    setBusy(battle.challengeId);
    setError(null);
    try {
      if (accept) await api.joinChallenge(battle.challengeId, true, allowed);
      else await api.respondBattle(battle.challengeId, 'decline', allowed);
      if (!allowed()) return;
      feed.reload();
      if (accept) router.push(`/challenges?battle=${battle.challengeId}`);
    } catch {
      if (allowed())
        setError('The invitation could not be updated. Retry or refresh Your battles.');
    } finally {
      if (allowed()) setBusy(null);
    }
  };
  return (
    <>
      {!provided && feed.error && (
        <T v="caption" muted>
          {feed.error}
        </T>
      )}
      {error && <Notice title="Invitation not updated" body={error} tone="warn" />}
      {feed.data?.invitations.map((battle) => (
        <Card key={battle.challengeId}>
          <T v="heading">{battle.ownerName ?? 'A friend'} invited you</T>
          <T>{battle.title}</T>
          <T v="caption" muted>
            {battle.startDate} – {battle.endDate} ·{' '}
            {invitationLabel[battle.invitationState ?? 'unavailable']}
          </T>
          {battle.invitationState === 'pending' && (
            <>
              <T v="caption" muted>
                Your battle score is shared only with participants until this battle ends on{' '}
                {battle.endDate} ({battle.tz}). This action does not share your other history or
                change your friend-sharing settings.
              </T>
              <View style={{ gap: 12 }}>
                <Button
                  label="Accept battle"
                  busy={busy === battle.challengeId}
                  onPress={() => void respond(battle, true)}
                />
                <Button
                  kind="secondary"
                  label="Decline"
                  busy={busy === battle.challengeId}
                  onPress={() => void respond(battle, false)}
                />
              </View>
            </>
          )}
        </Card>
      ))}
      {!provided &&
        feed.data?.challenges
          .filter((b) => b.targetUserId)
          .map((battle) => (
            <View key={battle.challengeId} style={{ gap: 4 }}>
              <T v="caption" muted>
                {battle.title} · {invitationLabel[battle.invitationState ?? 'unavailable']}
              </T>
              {battle.invitationState === 'pending' && (
                <T v="caption" muted>
                  Awaiting your friend’s response. Scores appear after acceptance.
                </T>
              )}
            </View>
          ))}
    </>
  );
}
