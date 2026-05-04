/** Модальное окно одного дня: список слотов + форма добавления. */
import { useState } from "react";
import type { LocalScheduleEntry } from "../types";
import { parseISODateLocal } from "../calendarUtils";

type Props = {
  iso: string;
  entries: LocalScheduleEntry[];
  /** true — данные с сервера (PostgreSQL), false — localStorage */
  remote: boolean;
  onClose: () => void;
  onAdd: (e: Omit<LocalScheduleEntry, "id">) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

export function DayModal({ iso, entries, remote, onClose, onAdd, onDelete }: Props) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [typeName, setTypeName] = useState("Working");
  const [desc, setDesc] = useState("");

  const d = parseISODateLocal(iso);
  const title = d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal
        aria-labelledby="day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="day-title">{title}</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <h3 className="modal-sub">
            Интервалы —{" "}
            {remote
              ? "аккаунт (PostgreSQL)"
              : "черновик (localStorage, только этот браузер)"}
          </h3>
          {entries.length === 0 ? (
            <p className="mono">Пока пусто — добавь слот ниже.</p>
          ) : (
            <ul className="day-entry-list">
              {entries.map((e) => (
                <li key={e.id}>
                  <div>
                    <strong>
                      {e.start}–{e.end}
                    </strong>{" "}
                    <span className="badge">{e.activityTypeName}</span>
                    <div className="mono">{e.description || "—"}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void Promise.resolve(onDelete(e.id))}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="modal-sub">Добавить</h3>
          <div className="field-row">
            <div className="field">
              <label htmlFor="ds">с</label>
              <input
                id="ds"
                type="time"
                value={start}
                onChange={(ev) => setStart(ev.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="de">до</label>
              <input id="de" type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="dt">вид занятия (текст)</label>
            <input
              id="dt"
              value={typeName}
              onChange={(ev) => setTypeName(ev.target.value)}
              placeholder="Working, Eating, …"
            />
          </div>
          <div className="field">
            <label htmlFor="dd">что делаешь</label>
            <textarea
              id="dd"
              value={desc}
              onChange={(ev) => setDesc(ev.target.value)}
              placeholder="конспект, зал, созвон…"
            />
          </div>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void (async () => {
                await Promise.resolve(
                  onAdd({
                    start,
                    end,
                    activityTypeName: typeName.trim() || "—",
                    description: desc.trim(),
                  }),
                );
                setDesc("");
              })()
            }
          >
            Добавить интервал
          </button>
        </div>
      </div>
    </div>
  );
}
