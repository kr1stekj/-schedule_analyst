import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { CalendarMonth } from "./components/CalendarMonth";
import { DayModal } from "./components/DayModal";
import { SummaryModal } from "./components/SummaryModal";
import { parseISODateLocal, toISODateLocal } from "./calendarUtils";
import { loadAll, saveAll } from "./localSchedule";
import { groupScheduleByDate } from "./scheduleApi";
import { buildLocalSummary } from "./summaryUtils";
import type {
  ActivityType,
  LocalScheduleEntry,
  LoginResponse,
  ScheduleApiRow,
  ScheduleSummary,
  SeedResult,
  TOTPSetupResponse,
  UserPublic,
} from "./types";
import "./App.css";

/**
 * Корневой UI: календарь, панель (сессия, типы, регистрация, вход, 2FA), модалка дня.
 * Без user — слоты в localStorage; с user — запросы к /api/schedule.
 */
export default function App() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryStart, setSummaryStart] = useState(toISODateLocal(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [summaryEnd, setSummaryEnd] = useState(toISODateLocal(today));
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [localEntries, setLocalEntries] = useState<Record<string, LocalScheduleEntry[]>>(
    () => loadAll(),
  );
  const [remoteByDate, setRemoteByDate] = useState<Record<string, LocalScheduleEntry[]>>({});

  const [health, setHealth] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);

  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [logEmail, setLogEmail] = useState("");
  const [logPass, setLogPass] = useState("");
  const [logTotp, setLogTotp] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [completeTotp, setCompleteTotp] = useState("");

  const [types, setTypes] = useState<ActivityType[]>([]);
  const [seedInfo, setSeedInfo] = useState<SeedResult | null>(null);

  const [totpSetup, setTotpSetup] = useState<TOTPSetupResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disablePass, setDisablePass] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const setErr = (e: unknown) =>
    setNote({ kind: "err", text: e instanceof Error ? e.message : String(e) });
  const setOk = (text: string) => setNote({ kind: "ok", text });

  const todayISO = useMemo(() => toISODateLocal(new Date()), []);

  // Число слотов по дате — для точек в ячейке календаря
  const entryCountByDay = useMemo(() => {
    const src = user ? remoteByDate : localEntries;
    const c: Record<string, number> = {};
    for (const [k, arr] of Object.entries(src)) {
      c[k] = arr.length;
    }
    return c;
  }, [user, remoteByDate, localEntries]);

  // Загрузка слотов с сервера на видимый месяц (только для залогиненного)
  const fetchRemoteSchedule = useCallback(async () => {
    if (!user) {
      setRemoteByDate({});
      return;
    }
    try {
      const start = new Date(viewYear, viewMonth, 1);
      const end = new Date(viewYear, viewMonth + 1, 0);
      const qs = new URLSearchParams({
        start_date: toISODateLocal(start),
        end_date: toISODateLocal(end),
      });
      const rows = await api<ScheduleApiRow[]>(`/api/schedule?${qs}`);
      setRemoteByDate(groupScheduleByDate(rows));
    } catch (e) {
      setRemoteByDate({});
      setErr(e);
    }
  }, [user, viewYear, viewMonth]);

  useEffect(() => {
    void fetchRemoteSchedule();
  }, [fetchRemoteSchedule]);

  // Автосохранение гостевого расписания при изменении
  useEffect(() => {
    saveAll(localEntries);
  }, [localEntries]);

  // Восстановление профиля по access_token в localStorage
  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const me = await api<UserPublic>("/api/auth/me");
      setUser(me);
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const h = await api<{ status: string }>("/api/health");
        setHealth(h.status);
      } catch {
        setHealth("недоступен");
      }
      await refreshMe();
    })();
  }, [refreshMe]);

  const loadTypes = async () => {
    setBusy(true);
    setNote(null);
    try {
      const list = await api<ActivityType[]>("/api/activity-types");
      setTypes(list);
      setOk(`Типов занятий: ${list.length}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteActivityType = async (id: number, name: string) => {
    if (!user) {
      setErr(new Error("Войди, чтобы удалять типы из БД."));
      return;
    }
    if (
      !confirm(
        `Удалить тип «${name}»? Если есть слоты с этим типом, они перейдут на другой тип той же группы (например Sleeping вместо sleeping).`,
      )
    ) {
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api<void>(`/api/activity-types/${id}`, { method: "DELETE" });
      setOk("Тип удалён.");
      await loadTypes();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const seedTypes = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<SeedResult>("/api/activity-types/seed-from-dataset", {
        method: "POST",
      });
      setSeedInfo(r);
      setOk(`Сид: +${r.inserted}, пропуск ${r.skipped_existing}`);
      await loadTypes();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setBusy(true);
    setNote(null);
    try {
      await api<UserPublic>("/api/auth/register", {
        method: "POST",
        json: { email: regEmail, password: regPass },
      });
      setOk("Регистрация ок — войди.");
      setLogEmail(regEmail);
      setLogPass(regPass);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);
    setNote(null);
    try {
      const body: { email: string; password: string; totp_code?: string } = {
        email: logEmail,
        password: logPass,
      };
      if (logTotp.trim()) body.totp_code = logTotp.trim();
      const r = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        json: body,
      });
      if (r.requires_2fa && r.challenge_token) {
        setChallenge(r.challenge_token);
        setOk("Нужен код 2FA.");
        return;
      }
      if (r.access_token) {
        localStorage.setItem("access_token", r.access_token);
        setChallenge(null);
        setCompleteTotp("");
        setLogTotp("");
        await refreshMe();
        setOk("Вошёл.");
      }
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const complete2fa = async () => {
    if (!challenge) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ access_token: string }>("/api/auth/login/2fa", {
        method: "POST",
        json: { challenge_token: challenge, totp_code: completeTotp.trim() },
      });
      localStorage.setItem("access_token", r.access_token);
      setChallenge(null);
      setCompleteTotp("");
      await refreshMe();
      setOk("2FA ок.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setChallenge(null);
    setTotpSetup(null);
    setNote({ kind: "ok", text: "Вышел." });
  };

  const startTotpSetup = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<TOTPSetupResponse>("/api/auth/2fa/setup", { method: "POST" });
      setTotpSetup(r);
      setOk("QR готов — в приложении введи 6 цифр, не secret.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmTotpSetup = async () => {
    setBusy(true);
    setNote(null);
    try {
      const u = await api<UserPublic>("/api/auth/2fa/confirm-setup", {
        method: "POST",
        json: { code: confirmCode.trim() },
      });
      setUser(u);
      setTotpSetup(null);
      setConfirmCode("");
      setOk("2FA включён.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const submitTotpDisable = async () => {
    setBusy(true);
    setNote(null);
    try {
      const u = await api<UserPublic>("/api/auth/2fa/disable", {
        method: "POST",
        json: { password: disablePass, totp_code: totpDisableCode.trim() },
      });
      setUser(u);
      setDisablePass("");
      setTotpDisableCode("");
      setOk("2FA выкл.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelectedISO(toISODateLocal(n));
  };

  const nextISODate = (iso: string) => {
    const d = parseISODateLocal(iso);
    d.setDate(d.getDate() + 1);
    return toISODateLocal(d);
  };

  const newLocalEntryId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const addLocalEntry = (iso: string, row: Omit<LocalScheduleEntry, "id">) => {
    const id = newLocalEntryId();
    setLocalEntries((prev) => ({
      ...prev,
      [iso]: [...(prev[iso] ?? []), { ...row, id }],
    }));
  };

  const addLocalEntryWithOvernightSplit = (iso: string, row: Omit<LocalScheduleEntry, "id">) => {
    if (row.end > row.start) {
      addLocalEntry(iso, row);
      return;
    }
    addLocalEntry(iso, { ...row, end: "00:00" });
    if (row.end !== "00:00") {
      addLocalEntry(nextISODate(iso), { ...row, start: "00:00" });
    }
  };

  const deleteLocalEntry = (iso: string, id: string) => {
    setLocalEntries((prev) => {
      const next = { ...prev };
      const list = (next[iso] ?? []).filter((e) => e.id !== id);
      if (list.length === 0) delete next[iso];
      else next[iso] = list;
      return next;
    });
  };

  // Добавление слота: API или локальный черновик
  const handleAddEntry = async (iso: string, row: Omit<LocalScheduleEntry, "id">) => {
    try {
      if (user) {
        await api<ScheduleApiRow>("/api/schedule", {
          method: "POST",
          json: {
            schedule_date: iso,
            start_time: row.start,
            end_time: row.end,
            activity_type_name: row.activityTypeName,
            description: row.description || null,
          },
        });
        await fetchRemoteSchedule();
        return;
      }
      addLocalEntryWithOvernightSplit(iso, row);
    } catch (e) {
      setErr(e);
    }
  };

  const handleDeleteEntry = async (iso: string, id: string) => {
    try {
      if (user) {
        const n = Number(id);
        if (Number.isInteger(n) && n > 0) {
          await api<void>(`/api/schedule/${n}`, { method: "DELETE" });
          await fetchRemoteSchedule();
          return;
        }
      }
      deleteLocalEntry(iso, id);
    } catch (e) {
      setErr(e);
    }
  };

  const buildSummary = async () => {
    if (summaryEnd < summaryStart) {
      setErr(new Error("Дата «по» должна быть не раньше даты «с»."));
      return;
    }
    setSummaryLoading(true);
    setNote(null);
    try {
      if (user) {
        const qs = new URLSearchParams({
          start_date: summaryStart,
          end_date: summaryEnd,
        });
        const result = await api<ScheduleSummary>(`/api/schedule/summary?${qs}`);
        setSummary(result);
        return;
      }
      setSummary(buildLocalSummary(localEntries, summaryStart, summaryEnd));
    } catch (e) {
      setErr(e);
    } finally {
      setSummaryLoading(false);
    }
  };

  const selectedEntries =
    selectedISO === null
      ? []
      : user
        ? (remoteByDate[selectedISO] ?? [])
        : (localEntries[selectedISO] ?? []);

  return (
    <div className="app-shell">
      {/* Шапка: название, индикатор API, сворачивание панели */}
      <header className="app-header">
        <div className="app-brand">
          <h1>Schedule</h1>
          <span className="badge">{health === "ok" ? "API" : "API ?"}</span>
        </div>
        <div className="app-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen ? "Скрыть панель" : "Панель"}
          </button>
        </div>
      </header>

      {note && (
        <div className={`app-toast msg ${note.kind === "err" ? "err" : "ok"}`}>
          {note.text}
          <button type="button" className="toast-x" onClick={() => setNote(null)}>
            ×
          </button>
        </div>
      )}

      <div className={`app-body ${panelOpen ? "app-body--with-panel" : ""}`}>
        {/* Основная колонка: календарь */}
        <main className="app-calendar">
          <div className="cal-toolbar card">
            <button type="button" className="btn btn-ghost" onClick={prevMonth}>
              ←
            </button>
            <h2 className="cal-title">{monthLabel}</h2>
            <button type="button" className="btn btn-ghost" onClick={nextMonth}>
              →
            </button>
            <button type="button" className="btn" onClick={goToday}>
              Сегодня
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSummaryOpen(true);
                setSummary(null);
                const first = new Date(viewYear, viewMonth, 1);
                setSummaryStart(toISODateLocal(first));
                setSummaryEnd(toISODateLocal(today));
              }}
            >
              Сводка
            </button>
          </div>

          <div className="card cal-wrap">
            <CalendarMonth
              year={viewYear}
              month={viewMonth}
              todayISO={todayISO}
              entryCountByDay={entryCountByDay}
              selectedISO={selectedISO}
              onPickDay={(iso) => setSelectedISO(iso)}
            />
          </div>

          <p className="cal-hint mono">
            {user
              ? "Вошёл — слоты пишутся в PostgreSQL (/api/schedule). Без входа — только localStorage."
              : "Без входа слоты — черновик в localStorage этого браузера."}
          </p>
        </main>

        {panelOpen && (
          <aside className="app-panel">
            {/* Боковая колонка: сессия, типы, регистрация, вход, 2FA */}
            <section className="card">
              <h2>Сессия</h2>
              {user ? (
                <>
                  <p className="mono">
                    {user.email}{" "}
                    <span className={user.totp_enabled ? "badge badge-ok" : "badge"}>
                      2FA {user.totp_enabled ? "on" : "off"}
                    </span>
                  </p>
                  <button type="button" className="btn btn-ghost" onClick={logout}>
                    Выйти
                  </button>
                </>
              ) : (
                <p className="mono">Не авторизован</p>
              )}
            </section>

            <section className="card">
              <h2>Справочник</h2>
              <div className="row">
                <button type="button" className="btn btn-ghost" onClick={() => void loadTypes()}>
                  Загрузить типы
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void seedTypes()}>
                  Сид CSV
                </button>
              </div>
              {seedInfo && (
                <p className="mono" style={{ marginTop: "0.35rem" }}>
                  +{seedInfo.inserted} / skip {seedInfo.skipped_existing}
                </p>
              )}
              {types.length > 0 && (
                <ul className="list list--short">
                  {types.map((t) => (
                    <li key={t.id}>
                      <span>{t.name}</span>
                      <span className="row" style={{ gap: "0.35rem" }}>
                        <span className="badge">{t.source}</span>
                        {t.source === "user" && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: "0.15rem 0.4rem", fontSize: "0.72rem" }}
                            disabled={busy || !user}
                            onClick={() => void deleteActivityType(t.id, t.name)}
                          >
                            Удалить
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Регистрация</h2>
              <div className="field">
                <label htmlFor="re">email</label>
                <input
                  id="re"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="rp">пароль ≥8</label>
                <input
                  id="rp"
                  type="password"
                  autoComplete="new-password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                />
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void register()}>
                Зарегистрироваться
              </button>
            </section>

            <section className="card">
              <h2>Вход</h2>
              <div className="field">
                <label htmlFor="le">email</label>
                <input
                  id="le"
                  autoComplete="username"
                  value={logEmail}
                  onChange={(e) => setLogEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lp">пароль</label>
                <input
                  id="lp"
                  type="password"
                  autoComplete="current-password"
                  value={logPass}
                  onChange={(e) => setLogPass(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lt">2FA сразу</label>
                <input
                  id="lt"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 цифр"
                  value={logTotp}
                  onChange={(e) => setLogTotp(e.target.value)}
                />
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void login()}>
                Войти
              </button>
              {challenge && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div className="field">
                    <label htmlFor="ct">код 2FA</label>
                    <input
                      id="ct"
                      inputMode="numeric"
                      placeholder="6 цифр из приложения"
                      value={completeTotp}
                      onChange={(e) => setCompleteTotp(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void complete2fa()}
                  >
                    Подтвердить 2FA
                  </button>
                </div>
              )}
            </section>

            {user && (
              <section className="card">
                <h2>2FA</h2>
                {!user.totp_enabled ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void startTotpSetup()}
                    >
                      QR + секрет
                    </button>
                    {totpSetup && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <img
                          className="qr"
                          alt="QR"
                          src={`data:image/png;base64,${totpSetup.qr_png_base64}`}
                        />
                        <div className="field">
                          <label htmlFor="cc">6 цифр из приложения</label>
                          <input
                            id="cc"
                            inputMode="numeric"
                            placeholder="не secret, только код"
                            value={confirmCode}
                            onChange={(e) => setConfirmCode(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void confirmTotpSetup()}
                        >
                          Включить 2FA
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="dp">пароль</label>
                      <input
                        id="dp"
                        type="password"
                        value={disablePass}
                        onChange={(e) => setDisablePass(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="dt">код 2FA</label>
                      <input
                        id="dt"
                        inputMode="numeric"
                        value={totpDisableCode}
                        onChange={(e) => setTotpDisableCode(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void submitTotpDisable()}
                    >
                      Выключить 2FA
                    </button>
                  </>
                )}
              </section>
            )}
          </aside>
        )}
      </div>

      {/* Окно выбранного дня поверх всего */}
      {selectedISO && (
        <DayModal
          iso={selectedISO}
          remote={!!user}
          entries={selectedEntries}
          onClose={() => setSelectedISO(null)}
          onAdd={(row) => handleAddEntry(selectedISO, row)}
          onDelete={(id) => handleDeleteEntry(selectedISO, id)}
        />
      )}

      {summaryOpen && (
        <SummaryModal
          startDate={summaryStart}
          endDate={summaryEnd}
          summary={summary}
          loading={summaryLoading}
          onStartDateChange={setSummaryStart}
          onEndDateChange={setSummaryEnd}
          onBuild={() => void buildSummary()}
          onClose={() => {
            setSummaryOpen(false);
            setSummary(null);
          }}
        />
      )}
    </div>
  );
}
