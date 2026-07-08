// All agencies are Belgian real estate offices, so the date/time inputs on
// the scheduling forms are always meant as Europe/Brussels wall-clock time —
// regardless of which timezone the server process itself happens to run in
// (Vercel runs Node in UTC, so `new Date("...T21:30:00")` without this would
// silently interpret "21:30" as 21:30 UTC instead of Belgian local time).
const TIME_ZONE = "Europe/Brussels";

/**
 * Converts a `<input type="date">` + `<input type="time">` pair (interpreted
 * as Europe/Brussels wall-clock time) into the correct UTC Date, correctly
 * handling both winter (UTC+1) and summer (UTC+2, DST) offsets.
 */
export function parseScheduledAt(dateStr: string, timeStr: string): Date {
  // Naive parse: treat the input as if it were already UTC.
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naiveUtc.getTime())) return naiveUtc;

  // Re-render that same instant in both Brussels time and UTC, then diff —
  // the difference is exactly Brussels' offset from UTC at that date (DST-aware).
  const asBrusselsTime = new Date(naiveUtc.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const asUtcTime = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtcTime.getTime() - asBrusselsTime.getTime();

  return new Date(naiveUtc.getTime() + offsetMs);
}
