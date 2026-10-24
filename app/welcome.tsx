import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { Button, Notice, T, useTheme } from '@/ui/kit';
import { Dashboard } from '@/ui/Focus';

export default function Welcome() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const t = useTheme();
  return (
    <Dashboard
      guest
      account={
        session.status === 'signedOut' ? (
          <View style={{ backgroundColor: t.surface, borderRadius: 18, padding: 12, gap: 12 }}>
            <T muted>
              Sign in to back up saved goals and daily history automatically. Without an account,
              progress stays on this phone.
            </T>
            <View>
              <Button
                label="Sign in with Google"
                busy={busy}
                accessibilityHint="Opens Google sign-in"
                onPress={() => {
                  setBusy(true);
                  void session.signIn().finally(() => setBusy(false));
                }}
              />
            </View>
            {session.error && (
              <Notice tone="warn" title="Sign-in didn’t complete" body={session.error} />
            )}
          </View>
        ) : undefined
      }
    />
  );
}
