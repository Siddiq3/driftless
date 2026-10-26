import { Platform } from 'react-native';
import { useAccountIncarnation } from '@/auth/account';
import { useMemo } from 'react';
import { useSession } from '../auth/session';
import { APP_VERSION, readEnv } from '../config/env';
import { createApiClient, type ApiClient } from './client';

/** The signed-in API client, or null when signed out / backend not configured. */
export function useApi(): ApiClient | null {
  const s = useSession();
  const incarnation = useAccountIncarnation();
  const env = readEnv();
  const getToken = s.status === 'signedIn' ? s.getAccessToken : null;
  return useMemo(
    () =>
      getToken && env && incarnation
        ? createApiClient({
            baseUrl: env.apiUrl,
            incarnation,
            getAccessToken: getToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            appVersion: APP_VERSION,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getToken, env?.apiUrl, incarnation],
  );
}
