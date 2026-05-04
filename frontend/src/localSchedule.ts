/** Чтение/запись черновика расписания гостя в localStorage. */
import type { LocalScheduleEntry } from "./types";

const KEY = "schedule_local_entries_v1";

export function loadAll(): Record<string, LocalScheduleEntry[]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalScheduleEntry[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAll(data: Record<string, LocalScheduleEntry[]>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
