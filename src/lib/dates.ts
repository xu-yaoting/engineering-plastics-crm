/**
 * Whole days since a full timestamp (e.g. an activity date-time). Null when missing or invalid.
 */
export function daysSince(date?: string | null): number | null {
  if (!date) return null;
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calendar days since the date part of an ISO value, counted from local midnight.
 * Null when missing or invalid.
 */
export function calendarDaysSince(date?: string | null): number | null {
  if (!date) return null;
  const then = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}
