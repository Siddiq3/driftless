import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { INVITE_CODE, parseBattleInvite } from './inviteLinks';
const KEY = 'scrollsnooze.battle.pending.v1';
export function joinBaseUrl(): string | null {
  const extra = Constants.expoConfig?.extra;
  const raw = extra?.joinBaseUrl ?? extra?.websiteUrl ?? 'https://scrollsnooze.vercel.app';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
export const inviteUrl = (code: string) => {
  const base = joinBaseUrl();
  if (!base || !INVITE_CODE.test(code))
    throw new Error('Invite links are not configured for this build.');
  return `${base}/join/${code}?utm_content=duel`;
};
export const parseInvite = (value: string) =>
  parseBattleInvite(
    value,
    [joinBaseUrl()].filter((s): s is string => !!s),
  );
export const REFERRER_READ = 'scrollsnooze.battle.referrer-read.v1';
let writes: Promise<unknown> = Promise.resolve();
function mutate(action: () => Promise<void>) {
  const task = writes.catch(() => undefined).then(action);
  writes = task.catch(() => undefined);
  return task;
}
export function rememberInvite(code: string) {
  if (!INVITE_CODE.test(code)) return Promise.reject(new Error('Invalid invitation'));
  return mutate(() => SecureStore.setItemAsync(KEY, code));
}
export const pendingInvite = () => writes.then(() => SecureStore.getItemAsync(KEY));
export function clearInvite(code: string) {
  return mutate(async () => {
    if ((await SecureStore.getItemAsync(KEY)) !== code) return;
    // A late Play response cannot resurrect an invitation already accepted or dismissed.
    await SecureStore.setItemAsync(REFERRER_READ, 'true');
    await SecureStore.deleteItemAsync(KEY);
  });
}
export function finishInstallReferrer(code: string | null) {
  return mutate(async () => {
    if (await SecureStore.getItemAsync(REFERRER_READ)) return;
    if (code && INVITE_CODE.test(code) && !(await SecureStore.getItemAsync(KEY)))
      await SecureStore.setItemAsync(KEY, code);
    await SecureStore.setItemAsync(REFERRER_READ, 'true');
  });
}
