/** Сетка месяца (6×7 с понедельника): число, подсветки, счётчик слотов. */
import { buildMonthGrid, toISODateLocal, weekdayShort } from "../calendarUtils";

type Props = {
  year: number;
  month: number;
  todayISO: string;
  entryCountByDay: Record<string, number>;
  selectedISO: string | null;
  onPickDay: (iso: string) => void;
};

export function CalendarMonth({
  year,
  month,
  todayISO,
  entryCountByDay,
  selectedISO,
  onPickDay,
}: Props) {
  const cells = buildMonthGrid(year, month);

  return (
    <div className="cal">
      <div className="cal-weekdays">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="cal-weekday">
            {weekdayShort(i)}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map(({ date, inMonth }) => {
          const iso = toISODateLocal(date);
          const n = entryCountByDay[iso] ?? 0;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedISO;
          return (
            <button
              key={iso}
              type="button"
              className={[
                "cal-cell",
                !inMonth ? "cal-cell--muted" : "",
                isToday ? "cal-cell--today" : "",
                isSelected ? "cal-cell--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onPickDay(iso)}
            >
              <span className="cal-cell-num">{date.getDate()}</span>
              {n > 0 && (
                <span className="cal-cell-dots" aria-label={`${n} записей`}>
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                    <span key={i} className="cal-dot" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
