/** App introduction text contains no private totals or friend-identification code. Sharing requires sign-in. */
export function appInviteMessage() {
  return 'Try ScrollSnooze with me — a little less scrolling, more room for life. You can track daily activity without an account. Look for ScrollSnooze on Google Play when it’s available.';
}

/** Installed-app deep link; no unconfigured public join domain is advertised. */
export const inviteLink = (code: string) =>
  `driftless://friends?invite=${encodeURIComponent(code)}`;
export const friendInviteMessage = (code: string) =>
  `Join my circle on ScrollSnooze: ${inviteLink(code)}\nOr enter invite code ${code} in Friends. Valid for 7 days.`;
