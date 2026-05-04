import type { LocalScheduleEntry, ScheduleSummary } from "./types";

const DAY_MINUTES = 24 * 60;
const DEFAULT_SLEEP_MINUTES = 8 * 60;
const SLEEP_NAMES = new Set(["sleep", "sleeps", "sleeping", "slept", "сон", "спать"]);

function minutesFromHHMM(time: string): number {
  const [h, m] = time.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function isSleepActivity(name: string): boolean {
  return SLEEP_NAMES.has(name.trim().toLowerCase());
}

export function durationMinutes(start: string, end: string): number {
  const s = minutesFromHHMM(start);
  let e = minutesFromHHMM(end);
  if (e <= s) e += DAY_MINUTES;
  return e - s;
}

export function formatMinutes(total: number): string {
  const minutes = Math.round(total);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function buildLocalSummary(
  entriesByDate: Record<string, LocalScheduleEntry[]>,
  startDate: string,
  endDate: string,
): ScheduleSummary {
  const activities = new Map<
    string,
    { minutes: number; entries: number; days: Set<string> }
  >();
  const entries: ScheduleSummary["entries"] = [];
  const datesWithEntries = new Set<string>();
  const datesWithSleep = new Set<string>();
  let totalScheduled = 0;

  for (const [date, rows] of Object.entries(entriesByDate)) {
    if (date < startDate || date > endDate) continue;
    for (const row of rows) {
      const duration = durationMinutes(row.start, row.end);
      const name = row.activityTypeName || "—";
      datesWithEntries.add(date);
      totalScheduled += duration;
      if (isSleepActivity(name)) {
        datesWithSleep.add(date);
      }
      const bucket = activities.get(name) ?? { minutes: 0, entries: 0, days: new Set<string>() };
      bucket.minutes += duration;
      bucket.entries += 1;
      bucket.days.add(date);
      activities.set(name, bucket);
      entries.push({
        schedule_date: date,
        start_time: row.start,
        end_time: row.end,
        activity_type_name: name,
        description: row.description || null,
        duration_minutes: duration,
      });
    }
  }

  const daysTotal = datesWithEntries.size;
  const averageDivisor = Math.max(1, daysTotal);
  const daysWithoutSleep = [...datesWithEntries].filter(
    (date) => !datesWithSleep.has(date),
  ).length;
  const totalPossible = daysTotal * DAY_MINUTES;
  const totalFree = Math.max(
    0,
    totalPossible - totalScheduled - daysWithoutSleep * DEFAULT_SLEEP_MINUTES,
  );
  return {
    start_date: startDate,
    end_date: endDate,
    days_total: daysTotal,
    total_scheduled_minutes: totalScheduled,
    average_scheduled_minutes_per_day: Number((totalScheduled / averageDivisor).toFixed(2)),
    total_free_minutes: totalFree,
    average_free_minutes_per_day: Number((totalFree / averageDivisor).toFixed(2)),
    activities: [...activities.entries()]
      .map(([activity_type_name, data]) => {
        const activityDays = Math.max(1, data.days.size);
        return {
          activity_type_name,
          total_minutes: data.minutes,
          average_minutes_per_day: Number((data.minutes / activityDays).toFixed(2)),
          entries_count: data.entries,
          days_count: data.days.size,
          frequency_per_day: Number((data.entries / activityDays).toFixed(2)),
        };
      })
      .sort((a, b) => b.total_minutes - a.total_minutes || a.activity_type_name.localeCompare(b.activity_type_name)),
    entries: entries.sort((a, b) =>
      a.schedule_date === b.schedule_date
        ? a.start_time.localeCompare(b.start_time)
        : a.schedule_date.localeCompare(b.schedule_date),
    ),
  };
}
