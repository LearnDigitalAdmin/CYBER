/**
 * How a schedule is written into DelegateSchedulePayload.schedule. The contract only says `at: string` and `days?: number[]`;
 * this file is the ONE place the desk decides what they mean, so the products' schedule_sms must be told the same convention:
 *   - every time is Africa/Nairobi wall-clock time (UTC+3, no daylight saving)
 *   - once:    at = "YYYY-MM-DDTHH:mm"        (no days)
 *   - daily:   at = "HH:mm"                   (no days)
 *   - weekly:  at = "HH:mm", days = ISO weekdays, 1 = Monday … 7 = Sunday
 *   - monthly: at = "HH:mm", days = days of the month, 1–31
 */
export type ScheduleKind = "once" | "daily" | "weekly" | "monthly";
export const SCHEDULE_KINDS: readonly ScheduleKind[] = ["once", "daily", "weekly", "monthly"];
export const SCHEDULE_TIMEZONE = "Africa/Nairobi";
const NAIROBI_OFFSET_MS = 3 * 3_600_000;
/** A one-off message must be at least this far ahead, so it cannot be due before the product has stored it. */
export const MIN_LEAD_MS = 5 * 60_000;

export interface ScheduleInput { kind: ScheduleKind; date: string; time: string; days: number[] }
export interface BuiltSchedule { kind: ScheduleKind; at: string; days?: number[] }
export type ScheduleResult = { ok: true; schedule: BuiltSchedule } | { ok: false; error: string };

/** "YYYY-MM-DDTHH:mm" for the current moment in Nairobi. */
export const nairobiNow = (nowMs: number): string => new Date(nowMs + NAIROBI_OFFSET_MS).toISOString().slice(0, 16);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAYS: readonly { n: number; label: string }[] = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 7, label: "Sun" },
];

export function buildSchedule(i: ScheduleInput, nowMs: number): ScheduleResult {
  if (!TIME.test(i.time)) return { ok: false, error: "Choose the time to send" };
  if (i.kind === "once") {
    if (!DATE.test(i.date) || Number.isNaN(Date.parse(`${i.date}T00:00:00Z`))) return { ok: false, error: "Choose the date to send" };
    const at = `${i.date}T${i.time}`;
    const earliest = nairobiNow(nowMs + MIN_LEAD_MS);
    if (at < earliest) return { ok: false, error: "Choose a time at least 5 minutes from now (Nairobi time)" };
    return { ok: true, schedule: { kind: "once", at } };
  }
  if (i.kind === "daily") return { ok: true, schedule: { kind: "daily", at: i.time } };
  const days = [...new Set(i.days)].sort((a, b) => a - b);
  const max = i.kind === "weekly" ? 7 : 31;
  if (days.length === 0) return { ok: false, error: i.kind === "weekly" ? "Choose at least one day of the week" : "Choose at least one day of the month" };
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > max)) return { ok: false, error: "One of the chosen days is not valid" };
  return { ok: true, schedule: { kind: i.kind, at: i.time, days } };
}

/** Plain-language summary shown before the agent pays. */
export function describeSchedule(s: BuiltSchedule): string {
  const name = (n: number) => WEEKDAYS.find((d) => d.n === n)?.label ?? String(n);
  switch (s.kind) {
    case "once": return `Once, on ${s.at.slice(0, 10)} at ${s.at.slice(11)} (Nairobi time)`;
    case "daily": return `Every day at ${s.at} (Nairobi time)`;
    case "weekly": return `Every ${(s.days ?? []).map(name).join(", ")} at ${s.at} (Nairobi time)`;
    case "monthly": return `On day ${(s.days ?? []).join(", ")} of each month at ${s.at} (Nairobi time)`;
  }
}
