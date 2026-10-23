import {
  matchesSchedule,
  nextSchedule,
  scheduleContains,
  scheduleLabel,
} from '../src/focus/schedules';
const overnight = { days: [5], startMinute: 1320, endMinute: 420 };
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
it('uses the start day for an overnight period and excludes the ending minute', () => {
  expect(scheduleContains(overnight, local(23, 22))).toBe(true); // Friday
  expect(scheduleContains(overnight, local(24, 6, 59))).toBe(true);
  expect(scheduleContains(overnight, local(24, 7))).toBe(false);
  expect(scheduleContains(overnight, local(23, 6))).toBe(false);
  expect(scheduleContains(overnight, local(24, 22))).toBe(false);
});
it('handles Sunday to Monday and ignores zero-length windows', () => {
  expect(scheduleContains({ ...overnight, days: [7] }, local(26, 3))).toBe(true);
  expect(scheduleContains({ days: [1], startMinute: 60, endMinute: 60 }, local(26, 1))).toBe(false);
});
it('finds the next local start across a week boundary', () => {
  const next = nextSchedule([overnight], local(24, 8));
  expect(next?.start).toEqual(local(30, 22));
  expect(nextSchedule([], local(24, 8))).toBeNull();
});
it('preserves days independent of order and labels overnight schedules explicitly', () => {
  expect(matchesSchedule({ ...overnight, days: [1, 5] }, { ...overnight, days: [5, 1] })).toBe(
    true,
  );
  expect(scheduleLabel(overnight)).toBe('Fri · 10:00 PM – 7:00 AM (next day)');
});
