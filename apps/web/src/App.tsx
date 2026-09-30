import { ApiError, request } from "./api";
import type { Preferences, User, Event, Draft } from "./types";
import Modal from "./components/Modal";
import Account from "./components/Account";
import PasswordRecovery from "./components/PasswordRecovery";
import Finance from "./components/Finance";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Pencil,
  UserRound,
  Wallet,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { messages, type Locale, type MessageKey } from "./i18n";
import { monthCells, rangeFor, shiftDate, type View } from "./calendar";
import orbit from "./assets/orbit.svg";
const defaults: Preferences = {
  locale: "pt-BR",
  hourCycle: "h23",
  dateFormat: "dd/MM/yyyy",
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Recife",
  theme: "light",
};
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [token, setTokenValue] = useState("");
  const tokenRef = useRef("");
  function setToken(next: string) {
    tokenRef.current = next;
    setTokenValue(next);
  }
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [page, setPage] = useState<
    "home" | "calendar" | "settings" | "profile" | "finance"
  >("home");
  const [view, setView] = useState<View>("week");
  const [selected, setSelected] = useState(
    DateTime.now().setZone(defaults.timezone).toISODate()!,
  );
  const [events, setEvents] = useState<Event[]>([]),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("reset") ?? "",
  );
  useEffect(() => {
    function openResetLink() {
      const value = new URLSearchParams(window.location.hash.slice(1)).get(
        "reset",
      );
      if (!value) return;
      setToken("");
      setUser(null);
      setForgot(false);
      setResetToken(value);
      setEvents([]);
      setDrafts(null);
      setText("");
      setError("");
      setNotice("");
      setMobile(false);
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    openResetLink();
    window.addEventListener("hashchange", openResetLink);
    return () => window.removeEventListener("hashchange", openResetLink);
  }, []);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [mobile, setMobile] = useState(false),
    [register, setRegister] = useState(false);
  const [settings, setSettings] = useState<Preferences>(defaults);
  const t = (key: MessageKey) => messages[prefs.locale][key];
  const date = DateTime.fromISO(selected, { zone: prefs.timezone }).setLocale(
    prefs.locale,
  );
  const today = DateTime.now().setZone(prefs.timezone).setLocale(prefs.locale);
  const range = rangeFor(date, view);
  const time = (iso: string) =>
    DateTime.fromISO(iso)
      .setZone(prefs.timezone)
      .setLocale(prefs.locale)
      .toFormat(prefs.hourCycle === "h23" ? "HH:mm" : "hh:mm a");
  const dayEvents = events.filter(
    (e) =>
      DateTime.fromISO(e.start).setZone(prefs.timezone).startOf("day") <=
        date.startOf("day") &&
      DateTime.fromISO(e.end).setZone(prefs.timezone) > date.startOf("day"),
  );
  function report(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        setUser(null);
        setToken("");
        setEvents([]);
        setDrafts(null);
        setText("");
        setError(t("expired"));
        return;
      }
      setError(
        e.status === 409
          ? t("conflict")
          : e.message === "AI_NOT_CONFIGURED"
            ? t("aiMissing")
            : e.message === "ADD_MORE_DETAILS"
              ? t("moreDetails")
              : e.status === 503
                ? t("aiUnavailable")
                : t("error"),
      );
    } else setError(t("network"));
  }
  useEffect(() => {
    document.documentElement.lang = prefs.locale;
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setEvents([]);
    request<Event[]>(
      `events?from=${encodeURIComponent(range.start.toISO()!)}&to=${encodeURIComponent(range.end.toISO()!)}`,
      token,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setEvents)
      .catch((e) => {
        if (!controller.signal.aborted) report(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, selected, view, prefs.timezone, reload]);
  function navigate(p: typeof page) {
    setPage(p);
    setMobile(false);
    setError("");
    setNotice("");
  }
  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const senha = String(form.get("password"));
    if (new TextEncoder().encode(senha).length > 72) {
      setError(t("passwordLong"));
      return;
    }
    if (register && String(form.get("name")).trim().length < 2) {
      setError(t("invalidName"));
      return;
    }
    setBusy(true);
    try {
      const data = await request<{ user: User; accessToken: string }>(
        "usuarios/" + (register ? "cadastrar" : "logar"),
        "",
        "POST",
        {
          usuario: String(form.get("email")),
          senha,
          ...(register ? { nome: String(form.get("name")) } : {}),
        },
      );
      setRegister(false);
      setUser(data.user);
      setToken(data.accessToken);
      setPrefs(data.user.preferences);
      setSettings(data.user.preferences);
      setSelected(
        DateTime.now().setZone(data.user.preferences.timezone).toISODate()!,
      );
      setPage("home");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? register
            ? t("registerError")
            : t("credentials")
          : t("network"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function propose() {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ events: Draft[]; source?: string }>(
        "planner/propose",
        token,
        "POST",
        { text, referenceDate: selected },
      );
      setEditingId(null);
      setDrafts(result.events);
      setNotice(result.source === "explicit" ? t("explicitRoutine") : "");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function addEvent() {
    setNotice("");
    setEditingId(null);
    const start = date.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    setError("");
    setDrafts([
      {
        title: "",
        start: start.toISO()!,
        end: start.plus({ hours: 1 }).toISO()!,
        category: "personal",
      },
    ]);
  }
  async function saveDrafts(e: FormEvent) {
    e.preventDefault();
    if (!drafts) return;
    if (
      drafts.some(
        (d) =>
          !d.title.trim() ||
          !Number.isFinite(Date.parse(d.start)) ||
          !Number.isFinite(Date.parse(d.end)) ||
          Date.parse(d.end) <= Date.parse(d.start),
      )
    ) {
      setError(t("invalidDates"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId)
        await request(`events/${editingId}`, token, "PATCH", drafts[0]);
      else await request("events", token, "POST", { events: drafts });
      setDrafts(null);
      setText("");
      setReload((r) => r + 1);
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  async function updateEvent(event: Event) {
    try {
      await request(`events/${event.id}`, token, "PATCH", {
        completed: !event.completed,
      });
      setReload((r) => r + 1);
    } catch (e) {
      report(e);
    }
  }
  async function removeEvent(event: Event) {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await request(`events/${event.id}`, token, "DELETE");
      setReload((r) => r + 1);
    } catch (e) {
      report(e);
    }
  }
  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!DateTime.now().setZone(settings.timezone).isValid) {
      setError(t("invalidTimezone"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const p = await request<Preferences>(
        "preferences",
        token,
        "PATCH",
        settings,
      );
      setPrefs(p);
      setNotice(messages[p.locale].saved);
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  async function toggleTheme() {
    const next = {
      ...prefs,
      theme: prefs.theme === "light" ? ("dark" as const) : ("light" as const),
    };
    setSaving(true);
    setError("");
    try {
      await request("preferences", token, "PATCH", next);
      setPrefs(next);
      setSettings((old) => ({ ...old, theme: next.theme }));
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  function editEvent(event: Event) {
    setEditingId(event.id);
    setError("");
    const { title, start, end, category } = event;
    setDrafts([{ title, start, end, category }]);
  }
  function changeDraft(i: number, key: keyof Draft, value: string) {
    setDrafts((old) =>
      old!.map((d, n) => (n === i ? { ...d, [key]: value } : d)),
    );
  }
  const categories = ["work", "personal", "health", "study"] as const;
  const stats = [
    {
      label: t("events"),
      value: events.length,
      icon: CalendarDays,
      className: "purple",
    },
    {
      label: t("done"),
      value: events.filter((e) => e.completed).length,
      icon: CheckCheck,
      className: "green",
    },
    {
      label: t("planned"),
      value: (
        events.reduce(
          (n, e) =>
            n +
            Math.max(
              0,
              Math.min(Date.parse(e.end), range.end.toMillis()) -
                Math.max(Date.parse(e.start), range.start.toMillis()),
            ),
          0,
        ) / 3600000
      ).toLocaleString(prefs.locale, { maximumFractionDigits: 1 }),
      icon: Clock3,
      className: "peach",
    },
  ];
  const next = events.find(
    (e) => !e.completed && Date.parse(e.end) > Date.now(),
  );
  function renderEvent(e: Event) {
    return (
      <article
        key={e.id}
        className={`event-row ${e.category} ${e.completed ? "completed" : ""}`}
      >
        <button
          className="check-event"
          onClick={() => updateEvent(e)}
          aria-label={t(e.completed ? "undo" : "complete")}
        >
          {e.completed && <Check size={14} />}
        </button>
        <div className="event-copy">
          <strong>{e.title}</strong>
          <span>
            {time(e.start)} – {time(e.end)} · {t(e.category)}
          </span>
        </div>
        <span className={`category ${e.category}`}>{t(e.category)}</span>
        <button
          className="icon"
          onClick={() => editEvent(e)}
          aria-label={t("editEvent")}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon delete"
          onClick={() => removeEvent(e)}
          aria-label={t("delete")}
        >
          <Trash2 size={15} />
        </button>
      </article>
    );
  }
  function renderMonth(month: DateTime, mini = false) {
    return (
      <div className={mini ? "mini-month" : "month-grid"}>
        <div className="week-labels">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>
              {month
                .startOf("week")
                .plus({ days: i })
                .toFormat("ccc")
                .replace(".", "")}
            </span>
          ))}
        </div>
        <div className="month-days">
          {monthCells(month).map((d) => {
            const items = events.filter((e) =>
              DateTime.fromISO(e.start)
                .setZone(prefs.timezone)
                .hasSame(d, "day"),
            );
            return (
              <button
                key={d.toISODate()}
                className={`${d.month !== month.month ? "outside" : ""} ${d.hasSame(today, "day") ? "is-today" : ""} ${d.hasSame(date, "day") ? "is-selected" : ""}`}
                onClick={() => {
                  setSelected(d.toISODate()!);
                  setView("day");
                }}
                aria-label={`${t("viewDay")}: ${d.toFormat(prefs.dateFormat)}`}
              >
                <span>{d.day}</span>
                {!mini &&
                  items.slice(0, 2).map((e) => (
                    <small key={e.id} className={e.category}>
                      {e.title}
                    </small>
                  ))}
                {items.length > 0 &&
                  (mini ? (
                    <i />
                  ) : items.length > 2 ? (
                    <em>+{items.length - 2}</em>
                  ) : null)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (!user)
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <a className="brand" href="/">
            <span className="brand-icon">t</span>tempo
            <span className="brand-dot">.</span>
          </a>
          <div>
            <span className="eyebrow">PLANNER DIGITAL</span>
            <h1>{t("welcome")}</h1>
            <p>{t("welcomeSub")}</p>
            <img src={orbit} alt="" />
            <div className="story-note">
              <Sun size={22} />
              <span>
                {t("focus")}
                <small>{t("focusSub")}</small>
              </span>
            </div>
          </div>
          <span className="auth-tagline">{t("tagline")}</span>
        </section>
        <section className="auth-form-wrap">
          <div className="auth-locale">
            <select
              aria-label={t("language")}
              value={prefs.locale}
              onChange={(e) =>
                setPrefs({ ...prefs, locale: e.target.value as Locale })
              }
            >
              <option value="pt-BR">Português</option>
              <option value="en-US">English</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
          {forgot || resetToken ? (
            <PasswordRecovery
              token={resetToken}
              locale={prefs.locale}
              onBack={() => {
                setForgot(false);
                setResetToken("");
              }}
            />
          ) : (
            <form className="auth-form" onSubmit={authenticate}>
              <span className="eyebrow">TEMPO / {today.year}</span>
              <h2>{t(register ? "register" : "login")}</h2>
              <p>{t("tagline")}</p>
              {register && (
                <label>
                  {t("name")}
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
              )}
              <label>
                {t("email")}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="voce@exemplo.com"
                />
              </label>
              <label>
                {t("password")}
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 10 : 1}
                  maxLength={72}
                  required
                />
              </label>
              {register && <small>{t("passwordHint")}</small>}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary" disabled={busy}>
                {busy ? t("loading") : t(register ? "register" : "login")}
                <ArrowRight size={18} />
              </button>
              <p className="switch-auth">
                {t(register ? "hasAccount" : "noAccount")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRegister(!register);
                    setError("");
                  }}
                >
                  {t(register ? "login" : "register")}
                </button>
              </p>
              {!register && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setForgot(true);
                    setError("");
                  }}
                >
                  {t("forgotPassword")}
                </button>
              )}
              <small className="session-note">{t("sessionNote")}</small>
            </form>
          )}
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="brand" href="#" onClick={() => navigate("home")}>
          <span className="brand-icon">t</span>tempo
          <span className="brand-dot">.</span>
        </a>
        <p className="brand-caption">{t("tagline")}</p>
        <span className="nav-label">{t("workspace")}</span>
        <nav>
          {(
            [
              { id: "home", icon: LayoutDashboard },
              { id: "calendar", icon: CalendarDays },
              { id: "finance", icon: Wallet },
              { id: "profile", icon: UserRound },
              { id: "settings", icon: Settings2 },
            ] as const
          ).map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {t(id)}
              {page === id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="sun-disc">
            <Sun size={25} />
          </div>
          <strong>{t("focus")}</strong>
          <p>{t("focusSub")}</p>
          <span>✦</span>
        </div>
        <div className="profile">
          <div className="avatar">
            {user.photo ? (
              <img src={user.photo} alt="" />
            ) : (
              user.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button
            className="icon"
            aria-label={t("logout")}
            disabled={busy || saving}
            onClick={() => {
              setMobile(false);
              setToken("");
              setUser(null);
              setEvents([]);
              setDrafts(null);
              setText("");
              setError("");
              setNotice("");
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-label={t("close")}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            <span>{t(page)}</span>
            <ChevronRight size={14} />
            <span className="muted">{date.toFormat("LLLL yyyy")}</span>
          </div>
          <div className="top-date">
            <button
              className="icon theme-toggle"
              onClick={toggleTheme}
              disabled={saving}
              title={t(prefs.theme === "light" ? "switchDark" : "switchLight")}
              aria-label={t(
                prefs.theme === "light" ? "switchDark" : "switchLight",
              )}
            >
              {prefs.theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="status-dot" />
            <span>{today.toFormat(prefs.dateFormat)}</span>
            <div className="avatar small">
              {user.photo ? (
                <img src={user.photo} alt="" />
              ) : (
                user.name.slice(0, 1).toUpperCase()
              )}
            </div>
          </div>
        </header>
        <main className="main-content">
          {error && drafts === null && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon"
                onClick={() => setError("")}
                aria-label={t("close")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "finance" ? (
            <Finance
              token={token}
              locale={prefs.locale}
              timezone={prefs.timezone}
              dateFormat={prefs.dateFormat}
              onError={(e) => {
                if (tokenRef.current === token) report(e);
              }}
            />
          ) : page === "profile" ? (
            <Account
              user={user}
              token={token}
              locale={prefs.locale}
              onUser={(next) => {
                if (tokenRef.current === token) setUser(next);
              }}
              onSession={(data) => {
                if (tokenRef.current !== token) return;
                setUser(data.user);
                setToken(data.accessToken);
              }}
              onError={(e) => {
                if (tokenRef.current === token) report(e);
              }}
            />
          ) : page === "settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{t("settings")}</span>
                  <h1>{t("preferences")}</h1>
                  <p>{t("preferencesSub")}</p>
                </div>
              </div>
              <form className="settings-card card" onSubmit={saveSettings}>
                <label>
                  {t("language")}
                  <select
                    value={settings.locale}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        locale: e.target.value as Locale,
                      })
                    }
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </select>
                </label>
                <label>
                  {t("timeFormat")}
                  <select
                    value={settings.hourCycle}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        hourCycle: e.target.value as "h23" | "h12",
                      })
                    }
                  >
                    <option value="h23">24h — 14:30</option>
                    <option value="h12">12h — 02:30 PM</option>
                  </select>
                </label>
                <label>
                  {t("dateFormat")}
                  <select
                    value={settings.dateFormat}
                    onChange={(e) =>
                      setSettings({ ...settings, dateFormat: e.target.value })
                    }
                  >
                    <option value="dd/MM/yyyy">Brasil — DD/MM/AAAA</option>
                    <option value="MM/dd/yyyy">US — MM/DD/YYYY</option>
                    <option value="yyyy-MM-dd">ISO — YYYY-MM-DD</option>
                  </select>
                </label>
                <label>
                  {t("timezone")}
                  <input
                    list="timezones"
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings({ ...settings, timezone: e.target.value })
                    }
                    required
                  />
                  <datalist id="timezones">
                    {[
                      "America/Recife",
                      "America/Sao_Paulo",
                      "America/Manaus",
                      "America/New_York",
                      "Europe/Lisbon",
                      "Europe/Madrid",
                      "Asia/Tokyo",
                      "UTC",
                    ].map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </datalist>
                </label>
                <label>
                  {t("theme")}
                  <select
                    value={settings.theme}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        theme: e.target.value as "light" | "dark",
                      })
                    }
                  >
                    <option value="light">{t("light")}</option>
                    <option value="dark">{t("dark")}</option>
                  </select>
                </label>
                <button className="primary" disabled={saving}>
                  {saving ? t("saving") : t("savePreferences")}
                  <Check size={17} />
                </button>
                {notice && (
                  <p role="status" className="success">
                    {notice}
                  </p>
                )}
              </form>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    <Sun size={14} />
                    {today.toFormat("cccc, d LLLL")}
                  </span>
                  <h1>{page === "home" ? t("greeting") : t("calendar")}</h1>
                  <p>{t("subtitle")}</p>
                </div>
                <button className="primary" onClick={addEvent}>
                  <Plus size={18} />
                  {t("newEvent")}
                </button>
              </div>
              {page === "home" && (
                <section className="ai-card">
                  <div className="ai-top">
                    <span className="sparkle-box">
                      <Sparkles size={22} />
                    </span>
                    <div>
                      <h2>{t("aiTitle")}</h2>
                      <p>{t("aiSubtitle")}</p>
                    </div>
                    <span className="ai-badge">GEMINI AI</span>
                  </div>
                  <textarea
                    aria-label={t("aiTitle")}
                    placeholder={t("placeholder")}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={8000}
                  />
                  <div className="ai-bottom">
                    <span>
                      <Sparkles size={13} />
                      {t("aiNote")}
                    </span>
                    <button
                      className="primary"
                      disabled={busy || text.trim().length < 5}
                      onClick={propose}
                    >
                      {busy ? t("generating") : t("generate")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <small className="privacy-note">
                    {t("privacy")} {t("reference")}:{" "}
                    {date.toFormat(prefs.dateFormat)}.
                  </small>
                </section>
              )}
              <div className="stats">
                {stats.map(({ label, value, icon: Icon, className }) => (
                  <div className="stat card" key={label}>
                    <span className={`stat-icon ${className}`}>
                      <Icon size={21} />
                    </span>
                    <div>
                      <small>
                        {label} · {t(view).toLowerCase()}
                      </small>
                      <strong>{loading ? "—" : value}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className={`planner-layout ${page === "calendar" ? "full" : ""}`}
              >
                <section className="calendar-card card">
                  <div className="calendar-toolbar">
                    <h2>{t("schedule")}</h2>
                    <div className="view-switch">
                      {(["day", "week", "month", "year"] as View[]).map((v) => (
                        <button
                          key={v}
                          className={view === v ? "selected" : ""}
                          onClick={() => setView(v)}
                        >
                          {t(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="date-toolbar">
                    <h3>
                      {view === "day"
                        ? date.toFormat(prefs.dateFormat)
                        : view === "year"
                          ? date.year
                          : date.toFormat("LLLL yyyy")}
                    </h3>
                    <div>
                      <button
                        className="today-button"
                        onClick={() => setSelected(today.toISODate()!)}
                      >
                        {t("today")}
                      </button>
                      <button
                        className="icon"
                        aria-label={t("previous")}
                        onClick={() =>
                          setSelected(shiftDate(date, view, -1).toISODate()!)
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon"
                        aria-label={t("nextPage")}
                        onClick={() =>
                          setSelected(shiftDate(date, view, 1).toISODate()!)
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  {view === "week" && (
                    <div className="week-strip">
                      {Array.from({ length: 7 }, (_, i) =>
                        range.start.plus({ days: i }),
                      ).map((d) => (
                        <button
                          key={d.toISODate()}
                          onClick={() => setSelected(d.toISODate()!)}
                          className={`${d.hasSame(date, "day") ? "selected" : ""} ${d.hasSame(today, "day") ? "today" : ""}`}
                        >
                          <span>{d.toFormat("ccc").replace(".", "")}</span>
                          <strong>{d.day}</strong>
                          <i
                            className={
                              events.some((e) =>
                                DateTime.fromISO(e.start)
                                  .setZone(prefs.timezone)
                                  .hasSame(d, "day"),
                              )
                                ? "has-events"
                                : ""
                            }
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {loading ? (
                    <div className="empty" role="status">
                      {t("loading")}
                    </div>
                  ) : view === "month" ? (
                    renderMonth(date)
                  ) : view === "year" ? (
                    <div className="year-grid">
                      {Array.from({ length: 12 }, (_, i) =>
                        date.set({ month: i + 1, day: 1 }),
                      ).map((m) => (
                        <div key={m.month}>
                          <button
                            className="month-title"
                            onClick={() => {
                              setSelected(m.toISODate()!);
                              setView("month");
                            }}
                          >
                            {m.toFormat("LLLL")}
                          </button>
                          {renderMonth(m, true)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="agenda">
                      <div className="agenda-caption">
                        <span>{date.toFormat("cccc, d LLLL")}</span>
                        <span>
                          {dayEvents.length} {t("events").toLowerCase()}
                        </span>
                      </div>
                      {dayEvents.length ? (
                        dayEvents.map(renderEvent)
                      ) : (
                        <div className="empty">
                          <div className="empty-icon">
                            <Coffee size={27} />
                          </div>
                          <h3>{t("nothing")}</h3>
                          <p>{t("empty")}</p>
                          <button className="text-button" onClick={addEvent}>
                            <Plus size={15} />
                            {t("newEvent")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="calendar-legend">
                    {categories.map((c) => (
                      <span key={c}>
                        <i className={c} />
                        {t(c)}
                      </span>
                    ))}
                  </div>
                </section>
                {page === "home" && (
                  <aside className="right-column">
                    <section className="next-card card">
                      <span className="eyebrow">
                        <span className="status-dot" />
                        {t("next")}
                      </span>
                      {next ? (
                        <>
                          <span className={`category ${next.category}`}>
                            {t(next.category)}
                          </span>
                          <h3>{next.title}</h3>
                          <p>
                            <Clock3 size={14} />
                            {time(next.start)} – {time(next.end)}
                          </p>
                          <small>
                            {DateTime.fromISO(next.start)
                              .setZone(prefs.timezone)
                              .toFormat(prefs.dateFormat)}
                          </small>
                        </>
                      ) : (
                        <>
                          <div className="next-orbit">
                            <img src={orbit} alt="" />
                          </div>
                          <h3>{t("noNext")}</h3>
                          <p>{t("noNextSub")}</p>
                        </>
                      )}
                    </section>
                    <section className="balance-card">
                      <Coffee size={27} />
                      <h3>{t("balance")}</h3>
                      <p>{t("balanceSub")}</p>
                      <div className="balance-line" />
                    </section>
                    <button
                      className="year-link"
                      onClick={() => {
                        setPage("calendar");
                        setView("year");
                      }}
                    >
                      <CalendarDays size={17} />
                      {t("allYear")}
                      <ArrowUpRight size={17} />
                    </button>
                  </aside>
                )}
              </div>
            </>
          )}
          <footer>
            tempo<span>✦</span>
            {t("tagline")}
          </footer>
        </main>
      </div>
      {drafts !== null && (
        <Modal
          closeLabel={t("close")}
          label={t(editingId ? "editEvent" : "review")}
          onClose={() => {
            if (!saving) {
              setDrafts(null);
              setError("");
            }
          }}
        >
          <form onSubmit={saveDrafts}>
            <span className="eyebrow">
              <Sparkles size={15} />
              {t("review")}
            </span>
            <h2>{t(editingId ? "editEvent" : "review")}</h2>
            <p className="muted">{t("reviewSub")}</p>
            {notice === t("explicitRoutine") && !editingId && <p className="success" role="status">{notice}</p>}
            <div className="draft-list">
              {drafts.map((d, i) => (
                <div className="draft" key={i}>
                  <div className="draft-title">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      className="icon"
                      disabled={saving || !!editingId}
                      aria-label={t("removeSuggestion")}
                      onClick={() =>
                        setDrafts((old) => old!.filter((_, n) => n !== i))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label>
                    {t("title")}
                    <input
                      required
                      value={d.title}
                      maxLength={160}
                      onChange={(e) => changeDraft(i, "title", e.target.value)}
                    />
                  </label>
                  <div className="form-row">
                    {(["start", "end"] as const).map((key) => (
                      <label key={key}>
                        {t(key)}
                        <input
                          required
                          type="datetime-local"
                          value={DateTime.fromISO(d[key])
                            .setZone(prefs.timezone)
                            .toFormat("yyyy-MM-dd'T'HH:mm")}
                          onChange={(e) =>
                            changeDraft(
                              i,
                              key,
                              DateTime.fromISO(e.target.value, {
                                zone: prefs.timezone,
                              }).toISO() || "",
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    {t("category")}
                    <select
                      value={d.category}
                      onChange={(e) =>
                        changeDraft(i, "category", e.target.value)
                      }
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {t(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                type="button"
                disabled={saving}
                onClick={() => {
                  setDrafts(null);
                  setError("");
                }}
              >
                {t("cancel")}
              </button>
              <button className="primary" disabled={saving || !drafts.length}>
                {saving ? t("saving") : t("save")}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
