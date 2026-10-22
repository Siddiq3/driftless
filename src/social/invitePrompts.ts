export const INVITE_PROMPTS = [
  { label: 'Invite your Bestie', emoji: '🫶' },
  { label: 'Invite your Crush', emoji: '❤️' },
  { label: 'Invite your Roomie', emoji: '🛋️' },
  { label: 'Invite your Work Bestie', emoji: '💻' },
  { label: 'Invite your Gym Bro', emoji: '💪' },
  { label: 'Invite your Duo', emoji: '🎮' },
  { label: 'Invite your Meme Dealer', emoji: '😂' },
  { label: 'Invite your Reels Plug', emoji: '📲' },
  { label: 'Invite your Chaos Twin', emoji: '🔥' },
  { label: 'Invite your Yap Partner', emoji: '🗣️' },
  { label: 'Invite your Pookie', emoji: '🎀' },
  { label: 'Invite your Day One', emoji: '🤞' },
  { label: 'Invite your Main Character', emoji: '✨' },
  { label: 'Invite your Certified Yapper', emoji: '🎤' },
  { label: 'Invite your Midnight Scroller', emoji: '🌙' },
  { label: 'Invite your Group Chat MVP', emoji: '🏆' },
  { label: 'Invite your Study Buddy', emoji: '📚' },
  { label: 'Invite your Vibe Check', emoji: '😎' },
  { label: 'Invite your Tea Spiller', emoji: '☕' },
  { label: 'Invite your Comfort Person', emoji: '🧸' },
] as const;

export type InvitePrompt = (typeof INVITE_PROMPTS)[number];

/** Four unique invites fill the five-row board alongside You. */
export function shuffledInvitePrompts(previous: readonly InvitePrompt[] = []): InvitePrompt[] {
  const pool = [...INVITE_PROMPTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const selected = pool.slice(0, 4);
  if (selected.every((row, index) => row.label === previous[index]?.label)) {
    selected.push(selected.shift()!);
  }
  return selected;
}
