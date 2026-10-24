import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { observeStorage } from '@/db/scope';
import { defaultEnd, readPhoneWrap, type Recap } from './model';
import { type WrapPeriod } from '@siddiq3/driftless-contracts/domain';

type State =
  | { state: 'loading' }
  | { state: 'ok'; recap: Recap; cloudUnavailable: boolean }
  | { state: 'error'; message: string };
export function useWrap(period: WrapPeriod) {
  const [state, setState] = useState<State>({ state: 'loading' });
  const generation = useRef(0);
  const read = useCallback(() => {
    const id = ++generation.current;
    setState({ state: 'loading' });
    (async () => {
      const end = defaultEnd(period);
      return { recap: readPhoneWrap(period, end), cloudUnavailable: false };
    })()
      .then((result) => {
        if (generation.current === id) setState({ state: 'ok', ...result });
      })
      .catch(() => {
        if (generation.current === id)
          setState({ state: 'error', message: 'Your wrap could not be read.' });
      });
  }, [period]);
  useFocusEffect(
    useCallback(() => {
      read();
      const unsubscribe = observeStorage(read);
      return () => {
        unsubscribe();
        generation.current++;
      };
    }, [read]),
  );
  return [state, read] as const;
}
