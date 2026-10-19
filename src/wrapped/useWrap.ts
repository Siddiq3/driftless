import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApi } from '@/api/useApi';
import { defaultEnd, readPhoneWrap, type Recap } from './model';
import { latestWrapEnd, localDateOf, type WrapPeriod } from '@siddiq3/driftless-contracts/domain';

type State =
  | { state: 'loading' }
  | { state: 'ok'; recap: Recap; cloudUnavailable: boolean }
  | { state: 'error'; message: string };
export function useWrap(period: WrapPeriod) {
  const api = useApi();
  const [state, setState] = useState<State>({ state: 'loading' });
  const generation = useRef(0);
  const read = useCallback(() => {
    const id = ++generation.current;
    setState({ state: 'loading' });
    (async () => {
      const end = defaultEnd(period);
      const local = readPhoneWrap(period, end);
      if (local.views.value !== null || local.minutes.value !== null || !api)
        return { recap: local, cloudUnavailable: false };
      try {
        const { data } = await api.getMe();
        if (!data.profile.consent.cloudSync) return { recap: local, cloudUnavailable: false };
        const cloudEnd = latestWrapEnd(period, localDateOf(Date.now(), data.profile.tz));
        const cloud = await api.wrapped(period, cloudEnd);
        return {
          recap: { ...cloud, apps: [], hours: null, sessions: [], returnCount: 0 } as Recap,
          cloudUnavailable: false,
        };
      } catch {
        return { recap: local, cloudUnavailable: true };
      }
    })()
      .then((result) => {
        if (generation.current === id) setState({ state: 'ok', ...result });
      })
      .catch(() => {
        if (generation.current === id)
          setState({ state: 'error', message: 'Your wrap could not be read.' });
      });
  }, [api, period]);
  useFocusEffect(
    useCallback(() => {
      read();
      return () => {
        generation.current++;
      };
    }, [read]),
  );
  return [state, read] as const;
}
