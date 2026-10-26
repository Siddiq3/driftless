import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { useOnboarding } from '@/onboarding/context';
import { useApi } from '@/api/useApi';
import { installReferrer, installReferrerSupported } from '../../modules/battle-links/src';
import { referralCode } from './inviteLinks';
import {
  parseInvite,
  pendingInvite,
  rememberInvite,
  REFERRER_READ,
  finishInstallReferrer,
} from './pendingInvite';
export function BattleInviteCoordinator() {
  const initialCaptured = useRef(false);
  const { load } = useOnboarding();
  const api = useApi();
  const path = usePathname();
  const navigation = useRootNavigationState();
  useEffect(() => {
    let alive = true;
    const capture = async (url: string | null) => {
      const code = url && parseInvite(url);
      if (code) await rememberInvite(code);
    };
    const check = async () => {
      if (!initialCaptured.current) {
        initialCaptured.current = true;
        const url = await Linking.getInitialURL();
        const previous = await SecureStore.getItemAsync('scrollsnooze.battle.initial-url.v1');
        if (url && url !== previous) {
          await capture(url);
          await SecureStore.setItemAsync('scrollsnooze.battle.initial-url.v1', url);
        }
      }
      if (
        Platform.OS === 'android' &&
        installReferrerSupported() &&
        !(await SecureStore.getItemAsync(REFERRER_READ))
      ) {
        try {
          const code = referralCode(await installReferrer());
          await finishInstallReferrer(code);
        } catch {
          /* Transient Play failure is retried on foreground return. */
        }
      }
      const code = await pendingInvite();
      if (
        alive &&
        code &&
        api &&
        navigation?.key &&
        load.state === 'ready' &&
        load.record?.completed &&
        path !== '/battle-invite'
      )
        router.push(`/battle-invite?code=${code}`);
    };
    void check().catch(() => undefined);
    const urls = Linking.addEventListener('url', ({ url }) => {
      void capture(url)
        .then(check)
        .catch(() => undefined);
    });
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check().catch(() => undefined);
    });
    return () => {
      alive = false;
      urls.remove();
      app.remove();
    };
  }, [api, path, navigation?.key, load]);
  return null;
}
