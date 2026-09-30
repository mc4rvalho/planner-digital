import FinanceManagement from "./FinanceManagement";
import type {
  Category,
  Transaction,
  FinanceDraft as Draft,
  Obligation,
  Investment,
} from "../finance-types";
import { useEffect, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Sparkles,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import { ApiError, request } from "../api";
import { messages, type Locale, type MessageKey } from "../i18n";
import { amountText, parseAmount } from "../money";
import Modal from "./Modal";
type Dashboard = {
  transactions: Transaction[];
  summary: { income: number; expense: number; balance: number; count: number };
  daily: { date: string; income: number; expense: number }[];
  byCategory: { name: string | null; color: string | null; amount: number }[];
};
export default function Finance({
  token,
  locale,
  timezone,
  dateFormat,
  onError,
}: {
  token: string;
  locale: Locale;
  timezone: string;
  dateFormat: string;
  onError: (e: unknown) => void;
}) {
  const t = (k: MessageKey) => messages[locale][k];
  const now = DateTime.now().setZone(timezone);
  const [view, setView] = useState<"overview" | "bills" | "investments">(
    "overview",
  );
  const [obligations, setObligations] = useState<Obligation[]>([]),
    [investments, setInvestments] = useState<Investment[]>([]);
  const [month, setMonth] = useState(now.toFormat("yyyy-MM")),
    [data, setData] = useState<Dashboard | null>(null),
    [categories, setCategories] = useState<Category[]>([]),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [text, setText] = useState(""),
    [reference, setReference] = useState(now.toISODate()!),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState<Draft[] | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [manage, setManage] = useState(false),
    [categoryEdit, setCategoryEdit] = useState<Category | null>(null),
    [categoryName, setCategoryName] = useState(""),
    [color, setColor] = useState("#7963d2");
  const first = DateTime.fromISO(month + "-01");
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  function failure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      onError(e);
      return;
    }
    const codes: Record<string, MessageKey> = {
      PAYMENT_EXCEEDS_BALANCE: "overpayment",
      INVESTMENT_INSUFFICIENT: "insufficientInvestment",
      INVALID_LINK: "error",
    };
    if (e instanceof ApiError && codes[e.message]) {
      setError(t(codes[e.message]));
      return;
    }
    setError(
      e instanceof ApiError && e.message === "CATEGORY_EXISTS"
        ? t("categoryExists")
        : e instanceof ApiError && e.message === "ADD_MORE_DETAILS"
          ? t("moreDetails")
          : e instanceof ApiError && e.message === "AI_NOT_CONFIGURED"
            ? t("aiMissing")
            : e instanceof ApiError && e.status === 503
              ? t("aiUnavailable")
              : t("error"),
    );
  }
  useEffect(() => {
    if (!first.isValid) return;
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    Promise.all([
      request<Obligation[]>(
        "finance/obligations",
        token,
        "GET",
        undefined,
        controller.signal,
      ),
      request<Investment[]>(
        "finance/investments",
        token,
        "GET",
        undefined,
        controller.signal,
      ),
      request<Dashboard>(
        `finance?from=${first.toISODate()}&to=${first.plus({ months: 1 }).toISODate()}`,
        token,
        "GET",
        undefined,
        controller.signal,
      ),
      request<Category[]>(
        "finance/categories",
        token,
        "GET",
        undefined,
        controller.signal,
      ),
    ])
      .then(([o, i, d, c]) => {
        setObligations(o);
        setInvestments(i);
        setData(d);
        setCategories(c);
      })
      .catch((e) => {
        if (!controller.signal.aborted) failure(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, token, reload]);
  function blank() {
    setEditing(null);
    setError("");
    setDrafts([
      {
        description: "",
        amount: "",
        type: "expense",
        date: first.hasSame(now, "month")
          ? now.toISODate()!
          : first.toISODate()!,
        categoryId: null,
      },
    ]);
  }
  function edit(tr: Transaction) {
    setEditing(tr.id);
    setError("");
    setDrafts([
      {
        description: tr.description,
        amount: amountText(tr.amountCents),
        type: tr.type,
        date: tr.date,
        categoryId: tr.categoryId,
        obligationId: tr.obligationId ?? null,
        investmentId: tr.investmentId ?? null,
      },
    ]);
  }
  function patch(i: number, key: keyof Draft, value: string | null) {
    setDrafts((old) =>
      old!.map((d, n) => {
        if (n !== i) return d;
        const next = { ...d, [key]: value };
        if (key === "obligationId" && value) {
          next.investmentId = null;
          next.type = "expense";
          next.categoryId =
            obligations.find((o) => o.id === value)?.categoryId ?? null;
        }
        if (key === "investmentId" && value) next.obligationId = null;
        if (key === "type" && value === "income") next.obligationId = null;
        return next;
      }),
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!drafts) return;
    const inputs = drafts.map(({ amount, ...d }) => ({
      ...d,
      amountCents: parseAmount(amount),
    }));
    if (inputs.some((d) => d.amountCents === null)) {
      setError(t("invalidAmount"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(
        editing ? `finance/transactions/${editing}` : "finance/transactions",
        token,
        editing ? "PATCH" : "POST",
        editing ? inputs[0] : { transactions: inputs },
      );
      setDrafts(null);
      setText("");
      setNotice(t("financeSaved"));
      setReload((n) => n + 1);
    } catch (e) {
      failure(e);
    } finally {
      setSaving(false);
    }
  }
  async function remove(tr: Transaction) {
    if (!confirm(t("deleteTransactionConfirm"))) return;
    setSaving(true);
    try {
      await request(`finance/transactions/${tr.id}`, token, "DELETE");
      setReload((n) => n + 1);
    } catch (e) {
      failure(e);
    } finally {
      setSaving(false);
    }
  }
  async function propose() {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ transactions: Omit<Transaction, "id">[] }>(
        "finance/propose",
        token,
        "POST",
        { text, referenceDate: reference },
      );
      setEditing(null);
      setDrafts(
        result.transactions.map((tr) => ({
          description: tr.description,
          amount: amountText(tr.amountCents),
          type: tr.type,
          date: tr.date,
          categoryId: tr.categoryId,
          obligationId: tr.obligationId ?? null,
          investmentId: tr.investmentId ?? null,
        })),
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(
        categoryEdit
          ? `finance/categories/${categoryEdit.id}`
          : "finance/categories",
        token,
        categoryEdit ? "PATCH" : "POST",
        { name: categoryName, color },
      );
      setCategoryName("");
      setCategoryEdit(null);
      setReload((n) => n + 1);
    } catch (e) {
      failure(e);
    } finally {
      setSaving(false);
    }
  }
  async function removeCategory(c: Category) {
    if (!confirm(t("deleteCategoryConfirm"))) return;
    setSaving(true);
    setError("");
    try {
      await request(`finance/categories/${c.id}`, token, "DELETE");
      if (categoryEdit?.id === c.id) {
        setCategoryEdit(null);
        setCategoryName("");
      }
      setReload((n) => n + 1);
    } catch (e) {
      failure(e);
    } finally {
      setSaving(false);
    }
  }
  const days = Array.from({ length: first.daysInMonth ?? 30 }, (_, i) => {
    const date = first.plus({ days: i }).toISODate()!;
    return (
      data?.daily.find((d) => d.date === date) ?? {
        date,
        income: 0,
        expense: 0,
      }
    );
  });
  const max = Math.max(1, ...days.flatMap((d) => [d.income, d.expense]));
  const step = 600 / days.length;
  let offset = 0;
  const visible =
    data?.transactions.filter((tr) => filter === "all" || tr.type === filter) ??
    [];
  const errorBanner = error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEMPO / BRL</span>
          <h1>{t("finance")}</h1>
          <p>{t("financeSub")}</p>
        </div>
        <button className="primary" onClick={blank}>
          <Plus size={17} />
          {t("newTransaction")}
        </button>
      </div>
      <div className="finance-tabs" role="group" aria-label={t("finance")}>
        {(["overview", "bills", "investments"] as const).map((v) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {t(v === "overview" ? "financeOverview" : v)}
          </button>
        ))}
      </div>
      {!drafts && !manage && errorBanner}
      {notice && (
        <p className="success feature-notice" role="status">
          {notice}
        </p>
      )}
      <section className="ai-card">
        <div className="ai-top">
          <span className="sparkle-box">
            <Sparkles size={22} />
          </span>
          <h2>{t("financeAiTitle")}</h2>
          <span className="ai-badge">GEMINI AI</span>
        </div>
        <textarea
          value={text}
          maxLength={8000}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("financeAiTitle")}
          placeholder={t("financePlaceholder")}
        />
        <div className="ai-bottom">
          <label className="reference-date">
            {t("reference")}
            <input
              type="date"
              value={reference}
              required
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || text.trim().length < 5 || !reference}
            onClick={propose}
          >
            {busy ? t("generating") : t("generate")}
            <Sparkles size={15} />
          </button>
        </div>
        <small className="privacy-note">{t("financePrivacy")}</small>
        <p className="finance-note">{t("financeTextHint")}</p>
      </section>
      <div className="finance-toolbar">
        <div className="period-control">
          <button
            className="icon"
            aria-label={t("previous")}
            onClick={() =>
              setMonth(first.minus({ months: 1 }).toFormat("yyyy-MM"))
            }
          >
            <ChevronLeft size={19} />
          </button>
          <label>
            {t("period")}
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <button
            className="icon"
            aria-label={t("nextPage")}
            onClick={() =>
              setMonth(first.plus({ months: 1 }).toFormat("yyyy-MM"))
            }
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setManage(true);
            setError("");
          }}
        >
          <Tags size={16} />
          {t("manageCategories")}
        </button>
      </div>
      {view === "overview" && (
        <>
          <div className="stats financial-stats">
            {(
              [
                { key: "income", icon: ArrowDownLeft, css: "green" },
                { key: "expense", icon: ArrowUpRight, css: "peach" },
                { key: "balance", icon: Wallet, css: "purple" },
              ] as const
            ).map(({ key, icon: Icon, css }) => (
              <div key={key} className="stat card">
                <span className={`stat-icon ${css}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <small>{t(key === "balance" ? "periodBalance" : key)}</small>
                  <strong>
                    {loading ? "—" : money(data?.summary[key] ?? 0)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
          <p className="finance-note">{t("currencyNote")}</p>
          {loading ? (
            <div className="empty" role="status">
              {t("loading")}
            </div>
          ) : (
            <>
              <div className="finance-charts">
                <section className="card feature-card">
                  <h2>{t("cashFlow")}</h2>
                  <svg
                    className="cash-chart"
                    viewBox="0 0 640 200"
                    role="img"
                    aria-label={`${t("cashFlow")}: ${t("income")} ${money(data?.summary.income ?? 0)}, ${t("expense")} ${money(data?.summary.expense ?? 0)}`}
                  >
                    <line
                      x1="20"
                      x2="620"
                      y1="166"
                      y2="166"
                      stroke="currentColor"
                      opacity=".12"
                    />
                    {days.map((d, i) => (
                      <g key={d.date}>
                        <title>
                          {d.date}: {t("income")} {money(d.income)},{" "}
                          {t("expense")} {money(d.expense)}
                        </title>
                        <rect
                          x={20 + i * step}
                          y={166 - (d.income / max) * 140}
                          width={step * 0.32}
                          height={(d.income / max) * 140}
                          rx="2"
                          fill="#73a891"
                        />
                        <rect
                          x={20 + i * step + step * 0.37}
                          y={166 - (d.expense / max) * 140}
                          width={step * 0.32}
                          height={(d.expense / max) * 140}
                          rx="2"
                          fill="#c99b79"
                        />
                        {(i % 5 === 0 || i === days.length - 1) && (
                          <text
                            x={20 + i * step + step * 0.3}
                            y="187"
                            textAnchor="middle"
                            fill="currentColor"
                            fontSize="10"
                          >
                            {i + 1}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                  <div className="chart-legend">
                    <span>
                      <i style={{ background: "#73a891" }} />
                      {t("income")}
                    </span>
                    <span>
                      <i style={{ background: "#c99b79" }} />
                      {t("expense")}
                    </span>
                  </div>
                  {!data?.summary.count && (
                    <p className="muted">{t("financeEmpty")}</p>
                  )}
                </section>
                <section className="card feature-card">
                  <h2>{t("expensesByCategory")}</h2>
                  <div className="donut-layout">
                    <svg
                      viewBox="0 0 120 120"
                      className="donut"
                      role="img"
                      aria-label={t("expensesByCategory")}
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        opacity=".08"
                        strokeWidth="15"
                      />
                      {data?.byCategory.map((c, i) => {
                        const length =
                          (c.amount / (data.summary.expense || 1)) * 282.743;
                        const prior = offset;
                        offset += length;
                        return (
                          <circle
                            key={i}
                            cx="60"
                            cy="60"
                            r="45"
                            fill="none"
                            stroke={c.color ?? "#aaa2bd"}
                            strokeWidth="15"
                            strokeDasharray={`${length} ${282.743 - length}`}
                            strokeDashoffset={-prior}
                            transform="rotate(-90 60 60)"
                          >
                            <title>
                              {c.name ?? t("uncategorized")}: {money(c.amount)}
                            </title>
                          </circle>
                        );
                      })}
                    </svg>
                    <ul className="category-breakdown">
                      {data?.byCategory.map((c, i) => (
                        <li key={i}>
                          <span>
                            <i style={{ background: c.color ?? "#aaa2bd" }} />
                            {c.name ?? t("uncategorized")}
                          </span>
                          <strong>{money(c.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {!data?.summary.expense && (
                    <p className="muted">{t("financeEmpty")}</p>
                  )}
                </section>
              </div>
              <p className="finance-note">{t("cashFlowHint")}</p>
              <section className="card transactions-card">
                <div className="calendar-toolbar">
                  <h2>
                    {t("transactions")}{" "}
                    <small className="muted">
                      ({data?.summary.count ?? 0})
                    </small>
                  </h2>
                  <select
                    aria-label={t("transactionType")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">{t("allTypes")}</option>
                    <option value="income">{t("income")}</option>
                    <option value="expense">{t("expense")}</option>
                  </select>
                </div>
                {!visible.length ? (
                  <div className="empty">
                    <Wallet size={28} />
                    <p>{t("financeEmpty")}</p>
                  </div>
                ) : (
                  <div className="transaction-list">
                    {visible.map((tr) => (
                      <article className="transaction-row" key={tr.id}>
                        <span
                          className={`stat-icon ${tr.type === "income" ? "green" : "peach"}`}
                        >
                          {tr.type === "income" ? (
                            <ArrowDownLeft size={18} />
                          ) : (
                            <ArrowUpRight size={18} />
                          )}
                        </span>
                        <div className="transaction-copy">
                          <strong>{tr.description}</strong>
                          <small>
                            {DateTime.fromISO(tr.date).toFormat(dateFormat)} ·{" "}
                            {tr.categoryName ?? t("uncategorized")}
                            {tr.obligationId
                              ? ` · ${t("financeLinked")}`
                              : tr.investmentId
                                ? ` · ${t("investments")}`
                                : ""}
                          </small>
                        </div>
                        <strong className={`transaction-amount ${tr.type}`}>
                          {tr.type === "income" ? "+" : "−"}{" "}
                          {money(tr.amountCents)}
                        </strong>
                        <div className="row-actions">
                          <button
                            className="icon"
                            disabled={saving}
                            aria-label={`${t("editTransaction")}: ${tr.description}`}
                            onClick={() => edit(tr)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon"
                            disabled={saving}
                            aria-label={`${t("remove")}: ${tr.description}`}
                            onClick={() => remove(tr)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {(data?.summary.count ?? 0) > 500 && (
                  <p className="finance-note">{t("listLimit")}</p>
                )}
              </section>
            </>
          )}
        </>
      )}
      {view !== "overview" && (
        <FinanceManagement
          view={view}
          token={token}
          locale={locale}
          timezone={timezone}
          dateFormat={dateFormat}
          month={month}
          obligations={obligations}
          investments={investments}
          categories={categories}
          revision={reload}
          changed={() => {
            setReload((n) => n + 1);
            setNotice(t("financeUpdated"));
          }}
          onError={onError}
          onDraft={(d) => {
            setEditing(null);
            setError("");
            setDrafts([d]);
          }}
          onEdit={edit}
          onRemove={remove}
        />
      )}
      {drafts && (
        <Modal
          label={t(editing ? "editTransaction" : "reviewTransactions")}
          closeLabel={t("close")}
          onClose={() => {
            if (!saving) {
              setDrafts(null);
              setError("");
            }
          }}
        >
          <form onSubmit={save}>
            <span className="eyebrow">{t("finance")}</span>
            <h2>{t(editing ? "editTransaction" : "reviewTransactions")}</h2>
            <div className="draft-list">
              {drafts.map((d, i) => (
                <div className="draft" key={i}>
                  <div className="draft-title">
                    <span>{i + 1}</span>
                    {!editing && (
                      <button
                        type="button"
                        className="icon"
                        disabled={saving}
                        aria-label={t("removeSuggestion")}
                        onClick={() =>
                          setDrafts((old) => old!.filter((_, n) => n !== i))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <label>
                    {t("description")}
                    <input
                      required
                      maxLength={160}
                      value={d.description}
                      onChange={(e) => patch(i, "description", e.target.value)}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      {t("amount")}
                      <input
                        inputMode="decimal"
                        required
                        value={d.amount}
                        onChange={(e) => patch(i, "amount", e.target.value)}
                        placeholder="0,00"
                      />
                    </label>
                    <label>
                      {t("transactionType")}
                      <select
                        value={d.type}
                        onChange={(e) => patch(i, "type", e.target.value)}
                      >
                        <option value="income">{t("income")}</option>
                        <option value="expense">{t("expense")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      {t("transactionDate")}
                      <input
                        type="date"
                        required
                        value={d.date}
                        onChange={(e) => patch(i, "date", e.target.value)}
                      />
                    </label>
                    <label>
                      {t("category")}
                      <select
                        value={d.categoryId ?? ""}
                        onChange={(e) =>
                          patch(i, "categoryId", e.target.value || null)
                        }
                      >
                        <option value="">{t("uncategorized")}</option>
                        {categories.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {t("linkedBill")}
                    <select
                      value={d.obligationId ?? ""}
                      disabled={d.type !== "expense"}
                      onChange={(e) =>
                        patch(i, "obligationId", e.target.value || null)
                      }
                    >
                      <option value="">{t("noLink")}</option>
                      {obligations
                        .filter(
                          (o) =>
                            o.remainingCents > 0 || o.id === d.obligationId,
                        )
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title} ·{" "}
                            {DateTime.fromISO(o.dueDate).toFormat(dateFormat)} ·{" "}
                            {t("remaining")}: {money(o.remainingCents)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("linkedInvestment")}
                    <select
                      value={d.investmentId ?? ""}
                      onChange={(e) =>
                        patch(i, "investmentId", e.target.value || null)
                      }
                    >
                      <option value="">{t("noLink")}</option>
                      {investments.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {d.obligationId && (
                    <p className="finance-note">{t("paymentHint")}</p>
                  )}
                </div>
              ))}
            </div>
            {errorBanner}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={() => {
                  setDrafts(null);
                  setError("");
                }}
              >
                {t("cancel")}
              </button>
              <button className="primary" disabled={saving || !drafts.length}>
                {saving ? t("saving") : t("saveTransactions")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {manage && (
        <Modal
          label={t("manageCategories")}
          closeLabel={t("close")}
          onClose={() => {
            if (!saving) {
              setManage(false);
              setError("");
            }
          }}
        >
          <h2>{t("manageCategories")}</h2>
          <div className="managed-categories">
            {!categories.length && (
              <p className="muted">{t("categoryEmpty")}</p>
            )}
            {categories.map((c) => (
              <div className="managed-category" key={c.id}>
                <i style={{ background: c.color }} />
                <strong>{c.name}</strong>
                <button
                  className="icon"
                  disabled={saving}
                  aria-label={`${t("edit")}: ${c.name}`}
                  onClick={() => {
                    setCategoryEdit(c);
                    setCategoryName(c.name);
                    setColor(c.color);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon"
                  disabled={saving}
                  aria-label={`${t("remove")}: ${c.name}`}
                  onClick={() => removeCategory(c)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <form className="category-form" onSubmit={saveCategory}>
            <h3>{t(categoryEdit ? "edit" : "newCategory")}</h3>
            <div className="form-row">
              <label>
                {t("categoryName")}
                <input
                  required
                  maxLength={50}
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </label>
              <label>
                {t("color")}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            </div>
            {errorBanner}
            <div className="modal-actions">
              {categoryEdit && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCategoryEdit(null);
                    setCategoryName("");
                  }}
                >
                  {t("cancel")}
                </button>
              )}
              <button className="primary" disabled={saving}>
                {saving ? t("saving") : t("saveCategory")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
