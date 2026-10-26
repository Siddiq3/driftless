import { useState } from 'react';
import { router } from 'expo-router';
import { useOnboarding } from '@/onboarding/context';
import { EMPTY_ANSWERS, LAST_STEP } from '@/onboarding/model';
import { Button, Notice } from '@/ui/kit';
import { ScreenTimeScreen } from './ScreenTimeScreen';

export function IOSSetup() {
  const setup = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setup.finish({
        version: 1,
        completed: true,
        step: LAST_STEP,
        answers: EMPTY_ANSWERS,
        plan: { metric: 'minutes', dailyLimit: 30 },
      });
      router.replace('/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScreenTimeScreen
      introduction
      footer={
        <>
          <Notice
            title="Start with a 30-minute intention"
            body="Your daily minute goal is saved locally. Automatic measurement and enforcement of this goal are not available in this version."
          />
          {error && <Notice tone="warn" title="Setup could not be saved" body={error} />}
          <Button label="Continue to ScrollSnooze" busy={busy} onPress={() => void finish()} />
        </>
      }
    />
  );
}
