import { parseInvite, rememberInvite } from '@/social/pendingInvite';
export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const code = parseInvite(path);
  if (!code) return path;
  try {
    await rememberInvite(code);
  } catch {
    /* The route can retry durable saving. */
  }
  return `/battle-invite?code=${code}`;
}
