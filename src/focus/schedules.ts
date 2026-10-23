import type { FocusSchedule } from 'tracking-android';
import { PRESETS } from '@/billing/blocking';

export const SCHEDULE_NAMES = ['Work hours', 'Wind down', 'Slow mornings'] as const;
export const matchesSchedule = (a: FocusSchedule, b: FocusSchedule) =>
  a.startMinute === b.startMinute &&
  a.endMinute === b.endMinute &&
  [...a.days].sort().join() === [...b.days].sort().join();

/** Matches the native policy: the after-midnight portion belongs to the previous start day. */
export function scheduleContains(schedule: FocusSchedule, now: Date): boolean {
  const day = now.getDay() || 7;
  const previous = day === 1 ? 7 : day - 1;
  const minute = now.getHours() * 60 + now.getMinutes();
  if (schedule.startMinute === schedule.endMinute) return false;
  return schedule.startMinute < schedule.endMinute
    ? schedule.days.includes(day) && minute >= schedule.startMinute && minute < schedule.endMinute
    : (schedule.days.includes(day) && minute >= schedule.startMinute) ||
        (schedule.days.includes(previous) && minute < schedule.endMinute);
}

export function timeLabel(minute: number): string {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function scheduleLabel(schedule: FocusSchedule): string {
  const days = [...new Set(schedule.days)].sort();
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const label =
    days.join() === '1,2,3,4,5,6,7'
      ? 'Every day'
      : days.join() === '1,2,3,4,5'
        ? 'Mon–Fri'
        : days.map((day) => names[day - 1]).join(', ');
  return `${label} · ${timeLabel(schedule.startMinute)} – ${timeLabel(schedule.endMinute)}${schedule.endMinute < schedule.startMinute ? ' (next day)' : ''}`;
}
export function scheduleName(schedule: FocusSchedule): string {
  const index = PRESETS.findIndex((preset) => matchesSchedule(preset, schedule));
  return SCHEDULE_NAMES[index] ?? 'Saved focus time';
}
export function nextSchedule(schedules: FocusSchedule[], now: Date) {
  const upcoming: { schedule: FocusSchedule; start: Date }[] = [];
  for (const schedule of schedules) {
    if (schedule.startMinute === schedule.endMinute) continue;
    for (let offset = 0; offset <= 7; offset++) {
      const start = new Date(now);
      start.setDate(start.getDate() + offset);
      start.setHours(Math.floor(schedule.startMinute / 60), schedule.startMinute % 60, 0, 0);
      if (start > now && schedule.days.includes(start.getDay() || 7)) {
        upcoming.push({ schedule, start });
        break;
      }
    }
  }
  return upcoming.sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
}
