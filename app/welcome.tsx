import { useState } from 'react';
import { useSession } from '@/auth/session';
import { Button, Notice, Screen } from '@/ui/kit';
import { Dashboard } from '@/ui/Focus';

export default function Welcome() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Dashboard guest />
      {session.status === 'unconfigured' && (
        <Notice
          title="Use without an account"
          body="Tracking and goals work on this phone. Sign-in isn’t configured in this build."
        />
      )}
      {session.status === 'signedOut' && (
        <>
          {session.error && (
            <Notice tone="warn" title="Sign-in didn’t complete" body={session.error} />
          )}
          <Button
            label="Sign in"
            busy={busy}
            accessibilityHint="Opens a secure sign-in page"
            onPress={() => {
              setBusy(true);
              void session.signIn().finally(() => setBusy(false));
            }}
          />
        </>
      )}
    </Screen>
  );
}
