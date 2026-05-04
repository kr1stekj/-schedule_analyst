import type { ScheduleSummary } from "../types";
import { formatMinutes } from "../summaryUtils";

type Props = {
  startDate: string;
  endDate: string;
  summary: ScheduleSummary | null;
  loading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onBuild: () => void | Promise<void>;
  onClose: () => void;
};

export function SummaryModal({
  startDate,
  endDate,
  summary,
  loading,
  onStartDateChange,
  onEndDateChange,
  onBuild,
  onClose,
}: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card summary-modal"
        role="dialog"
        aria-modal
        aria-labelledby="summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="summary-title">Сводка</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <div className="field">
              <label htmlFor="summary-start">с даты</label>
              <input
                id="summary-start"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="summary-end">по дату</label>
              <input
                id="summary-end"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className="btn" disabled={loading} onClick={() => void onBuild()}>
            {loading ? "Считаю..." : "Показать"}
          </button>
          <p className="mono" style={{ marginTop: "0.5rem" }}>
            Пустые дни не учитываются.
          </p>

          {summary && (
            <div className="summary">
              <div className="summary-stats">
                <div>
                  <span className="mono">Дней</span>
                  <strong>{summary.days_total}</strong>
                </div>
                <div>
                  <span className="mono">Занято в день</span>
                  <strong>{formatMinutes(summary.average_scheduled_minutes_per_day)}</strong>
                </div>
                <div>
                  <span className="mono">Свободно в день</span>
                  <strong>{formatMinutes(summary.average_free_minutes_per_day)}</strong>
                </div>
                <div>
                  <span className="mono">Свободно всего</span>
                  <strong>{formatMinutes(summary.total_free_minutes)}</strong>
                </div>
              </div>

              <h3 className="modal-sub">По занятиям</h3>
              {summary.activities.length === 0 ? (
                <p className="mono">За этот период слотов нет.</p>
              ) : (
                <ul className="summary-list">
                  {summary.activities.map((a) => (
                    <li key={a.activity_type_name}>
                      <div>
                        <strong>{a.activity_type_name}</strong>
                        <div className="mono">
                          {a.entries_count} раз(а), {a.days_count} дн., частота{" "}
                          {a.frequency_per_day}/день
                        </div>
                      </div>
                      <div className="summary-list-time">
                        <strong>{formatMinutes(a.total_minutes)}</strong>
                        <span className="mono">{formatMinutes(a.average_minutes_per_day)}/день</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="modal-sub">Все записи</h3>
              {summary.entries.length > 0 && (
                <ul className="summary-list summary-list--entries">
                  {summary.entries.map((e, idx) => (
                    <li key={`${e.schedule_date}-${e.start_time}-${idx}`}>
                      <div>
                        <strong>
                          {e.schedule_date} {e.start_time}–{e.end_time}
                        </strong>{" "}
                        <span className="badge">{e.activity_type_name}</span>
                        <div className="mono">{e.description || "—"}</div>
                      </div>
                      <div className="summary-list-time">
                        <strong>{formatMinutes(e.duration_minutes)}</strong>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
