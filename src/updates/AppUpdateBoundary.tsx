import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Modal, View } from 'react-native';
import { AppUpdates, type UpdateState } from '../../modules/app-updates-android/src';
import { StartupScreen } from '@/ui/StartupScreen';
import { UPDATE_STARTUP_BUDGET_MS, measureStartup } from '@/startup/timing';
import { useReducedMotion } from '@/ui/motion';
import { UpdateRequiredScreen } from './UpdateRequiredScreen';

/** A late/offline Play result cannot revoke a version already known to be required. */
export function mergeUpdateState(previous: UpdateState, next: UpdateState): UpdateState {
  const requiredVersion = Math.max(previous.requiredVersion, next.requiredVersion);
  return {
    ...next,
    supported: previous.supported || next.supported,
    requiredVersion,
    required: (previous.supported || next.supported) && requiredVersion > next.installedVersion,
  };
}

export function AppUpdateBoundary({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState(AppUpdates.cachedState);
  const [checked, setChecked] = useState(!update.supported);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const opening = useRef(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    mounted.current = true;
    if (!update.supported)
      return () => {
        mounted.current = false;
      };
    let alive = true;
    let running = false;
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const apply = (next: UpdateState) => {
      if (alive) setUpdate((previous) => mergeUpdateState(previous, next));
    };
    const check = async () => {
      if (running) return;
      running = true;
      // Keep an unknown/offline Play check from trapping an otherwise current app at startup.
      // A cached required version remains blocking even if this check fails or times out.
      const request = measureStartup('play-update', () => AppUpdates.check())
        .then((next) => {
          apply(next);
        })
        .catch(() => {
          apply(AppUpdates.cachedState());
        });
      let timer: ReturnType<typeof setTimeout>;
      await Promise.race([
        request,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, UPDATE_STARTUP_BUDGET_MS);
          timeouts.add(timer);
        }),
      ]);
      clearTimeout(timer!);
      timeouts.delete(timer!);
      running = false;
      if (alive) setChecked(true);
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, 60_000);
    return () => {
      alive = false;
      mounted.current = false;
      subscription.remove();
      clearInterval(interval);
      for (const timer of timeouts) clearTimeout(timer);
    };
  }, [update.supported]);
  useEffect(() => {
    if (!update.required) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [update.required]);
  async function startUpdate() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await AppUpdates.startUpdate();
      if (!mounted.current) return;
      // Accepting a Play dialog or opening the store does not prove installation.
      setUpdate((previous) => mergeUpdateState(previous, AppUpdates.cachedState()));
      if (result === 'cancelled')
        setMessage('The update is still needed. Tap below when you’re ready.');
    } catch {
      if (mounted.current)
        setMessage('Google Play could not open. Check your connection and try again.');
    } finally {
      opening.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (update.required)
    return (
      <Modal visible animationType={reduced ? 'none' : 'fade'} onRequestClose={() => {}}>
        <UpdateRequiredScreen
          onUpdate={() => void startUpdate()}
          busy={busy}
          message={message}
          inProgress={update.inProgress}
        />
      </Modal>
    );
  // Keep the same children mounted as the check completes: Google and local storage can
  // prepare behind the blocking modal instead of waiting for Play before they even start.
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={checked ? 'auto' : 'none'}
        accessibilityElementsHidden={!checked}
        importantForAccessibility={checked ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </View>
      {!checked && (
        <Modal visible animationType="none" onRequestClose={() => {}}>
          <StartupScreen message="Opening ScrollSnooze…" />
        </Modal>
      )}
    </View>
  );
}
