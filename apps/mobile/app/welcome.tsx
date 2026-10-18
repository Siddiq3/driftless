import { useState } from 'react';
import { useSession } from '@/auth/session';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';

export default function Welcome() {
  const s = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <T v="display">Driftless</T>
      <T muted>See how much you drift into short-video feeds, and steer back.</T>

      <Card>
        <T v="heading">Your data stays on your phone</T>
        <T muted>
          Tracking will run on this device and keep only counts — never what you watched, your
          messages or screenshots. Cloud sync is off unless you turn it on.
        </T>
      </Card>

      <Notice
        title="Early build"
        body="Tracking is not available in this version yet. It will be switched on only after it has been tested for accuracy."
      />

      {s.status === 'unconfigured' && (
        <Notice
          tone="warn"
          title="Sign-in is not configured"
          body="This build has no backend configured, so accounts are unavailable."
        />
      )}
      {s.status === 'signedOut' && (
        <>
          {s.error && <Notice tone="warn" title="Sign-in didn't complete" body={s.error} />}
          <Button
            label="Sign in or create account"
            busy={busy}
            accessibilityHint="Opens a secure sign-in page"
            onPress={() => {
              setBusy(true);
              void s.signIn().finally(() => setBusy(false));
            }}
          />
        </>
      )}
    </Screen>
  );
}
