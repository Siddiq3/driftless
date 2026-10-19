import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, T } from '@/ui/kit';
import { appInviteMessage } from './invite';

export function InviteButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button
        kind="secondary"
        label="Invite a friend"
        busy={busy}
        onPress={() => {
          setError(null);
          setBusy(true);
          Share.share({ title: 'Try Driftless', message: appInviteMessage() })
            .catch(() => setError('Could not open sharing. Please try again.'))
            .finally(() => setBusy(false));
        }}
      />
      {error && (
        <T v="caption" muted>
          {error}
        </T>
      )}
    </View>
  );
}
