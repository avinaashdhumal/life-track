/**
 * Local-time date helpers. Pure TypeScript.
 *
 * Never use `date.toISOString().split('T')[0]` for a calendar date: that is the UTC date, which is
 * a different day for early-morning times in UTC+ timezones (e.g. 03:00 in India is the previous
 * day in UTC). Everything user-facing in LifeTrack is local time.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in the device's local timezone. */
export function toLocalDateString(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "YYYYMMDD" in local time (used inside alarm ids; must match the native engine's format). */
export function toCompactDateString(date: Date | number): string {
  return toLocalDateString(date).replace(/-/g, '');
}

/** Epoch ms for a local "YYYY-MM-DD" + "HH:mm". */
export function localDateTimeToMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime();
}

/** Local midnight of the day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Adds calendar days in local time (keeps wall-clock time across DST changes). */
export function addLocalDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toLocalDateString(new Date(y, (m || 1) - 1, (d || 1) + days));
}
