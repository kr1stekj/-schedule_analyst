/** Преобразование ответа GET /api/schedule в словарь «дата → слоты UI». */
import type { LocalScheduleEntry, ScheduleApiRow } from "./types";

export function groupScheduleByDate(rows: ScheduleApiRow[]): Record<string, LocalScheduleEntry[]> {
  const m: Record<string, LocalScheduleEntry[]> = {};
  for (const r of rows) {
    const iso = r.schedule_date;
    const entry: LocalScheduleEntry = {
      id: String(r.id),
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
      activityTypeName: r.activity_type_name,
      description: r.description ?? "",
    };
    if (!m[iso]) m[iso] = [];
    m[iso].push(entry);
  }
  return m;
}
