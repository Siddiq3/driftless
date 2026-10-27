export const INVITE_CODE = /^[A-HJ-NP-Z2-9]{10}$/;
export function parseBattleInvite(value: string, origins: string[] = []): string | null {
  const input = value.trim();
  if (INVITE_CODE.test(input)) return input;
  try {
    const url = new URL(input);
    if (
      ['driftless:', 'scrollsnooze:'].includes(url.protocol) &&
      url.hostname === 'battle-invite'
    ) {
      const code = url.searchParams.get('code');
      return code && INVITE_CODE.test(code) ? code : null;
    }
    if (url.protocol !== 'https:' || !origins.includes(url.origin)) return null;
    const code = /^\/join\/([A-HJ-NP-Z2-9]{10})\/?$/.exec(url.pathname)?.[1];
    return code ?? null;
  } catch {
    return null;
  }
}
export function referralCode(referrer: string | null) {
  if (!referrer) return null;
  const code = new URLSearchParams(referrer).get('battle_invite');
  return code && INVITE_CODE.test(code) ? code : null;
}
export function battleShareMessage(url: string) {
  return `Join me on ScrollSnooze and let’s find out who scrolls less!\n${url}`;
}
