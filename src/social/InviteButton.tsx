import { useState } from 'react';
import { InviteSignInSheet } from '@/auth/InviteSignInSheet';
import { useSession } from '@/auth/session';
import { Share, View } from 'react-native';
import { Button, T } from '@/ui/kit';
import { appInviteMessage } from './invite';

export function InviteButton() {
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button
        kind="secondary"
        label="Invite a friend"
        busy={busy}
        onPress={() => {
          if (session.status !== 'signedIn') {
            setSignInOpen(true);
            return;
          }
          setError(null);
          setBusy(true);
          Share.share({ title: 'Try ScrollSnooze', message: appInviteMessage() })
            .catch(() => setError('Could not open sharing. Please try again.'))
            .finally(() => setBusy(false));
        }}
      />
      {error && (
        <T v="caption" muted>
          {error}
        </T>
      )}
      {signInOpen && <InviteSignInSheet visible onClose={() => setSignInOpen(false)} />}
    </View>
  );
}
