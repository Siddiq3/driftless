/** Google account name, or a neutral label. Internal handles are never shown. */
export const friendName = (friend: { displayName: string | null }) =>
  friend.displayName || 'ScrollSnooze friend';
export type BattleRow = {
  id: string;
  name: string;
  handle: string;
  views: number | null;
  experimental?: boolean;
  self: boolean;
};
/** Real zero ranks; missing data stays unranked. Equal counts share a competition rank. */
export function rankBattle(rows: BattleRow[]) {
  const sorted = [...rows].sort(
    (a, b) =>
      (a.views ?? Infinity) - (b.views ?? Infinity) ||
      Number(b.self) - Number(a.self) ||
      a.name.localeCompare(b.name),
  );
  let rank = 0,
    previous: number | null = null;
  return sorted.map((row, index) => {
    if (row.views !== null) {
      if (row.views !== previous) rank = index + 1;
      previous = row.views;
    }
    return { ...row, rank: row.views === null ? null : rank };
  });
}
