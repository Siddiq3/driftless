import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useApi } from '@/api/useApi';
import { cacheEntitlement, restorePro } from './pro';
import { entitlementGeneration } from './cache';

/** Recover completed pending payments without opening a purchase sheet. Offline errors keep
 * the existing, bounded native cache; no local code extends its verification deadline. */
export function EntitlementRecovery() {
  const api = useApi();
  useEffect(() => {
    if (!api) return;
    let active = true;
    let running = false;
    let lastAttempt = -Infinity;
    const refresh = async () => {
      if (!active || running || Date.now() - lastAttempt < 60000) return;
      running = true;
      lastAttempt = Date.now();
      const generation = entitlementGeneration();
      try {
        const { data } = await api.getMe();
        if (!active || generation !== entitlementGeneration()) return;
        cacheEntitlement(data.entitlement, Date.now(), generation);
        // Re-verify tokens, including payments that completed while the app was backgrounded.
        await restorePro(api);
      } catch {
        // Settings and the explicit Restore action provide user-visible retry feedback.
      } finally {
        running = false;
      }
    };
    void refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 30 * 60000);
    return () => {
      active = false;
      listener.remove();
      clearInterval(timer);
    };
  }, [api]);
  return null;
}
