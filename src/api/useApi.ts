import { useMemo } from 'react';
import { useSession } from '../auth/session';
import { APP_VERSION, readEnv } from '../config/env';
import type { ApiClient } from './client';
import { sessionApiClient } from './sessionClient';

/** The signed-in API client, or null when signed out / backend not configured. */
export function useApi(): ApiClient | null {
  const s = useSession();
  const baseUrl = readEnv()?.apiUrl;
  const getToken = s.status === 'signedIn' ? s.getAccessToken : null;
  const isSessionActive = s.status === 'signedIn' ? s.isCurrent : undefined;
  return useMemo(
    () =>
      getToken && baseUrl
        ? sessionApiClient({
            baseUrl,
            getAccessToken: getToken,
            isSessionActive,
            platform: 'android',
            appVersion: APP_VERSION,
          })
        : null,
    [getToken, isSessionActive, baseUrl],
  );
}
