import { useEffect, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import { Plus, Pencil, Trash2, ReceiptText, TrendingUp } from "lucide-react";
import { ApiError, request } from "../api";
import { messages, type Locale, type MessageKey } from "../i18n";
import { amountText, parseAmount } from "../money";
import type {
  Category,
  Obligation,
  Investment,
  Transaction,
  FinanceDraft,
} from "../finance-types";
import Modal from "./Modal";
import { financeWeeks } from "../finance-weeks";

type BillForm = {
  id?: string;
  title: string;
  kind: Obligation["kind"];
  amount: string;
  dueDate: string;
  categoryId: string;
  months: number;
  weeks: number;
  repeat: "once" | "weekly" | "monthly";
};
type InvestmentForm = { id?: string; name: string; target: string };
export default function FinanceManagement({
  view,
  token,
  locale,
  timezone,
  dateFormat,
  month,
  obligations,
  investments,
  categories,
  revision,
  changed,
  onError,
  onDraft,
  onEdit,
  onRemove,
}: {
  view: "bills" | "investments";
  token: string;
  locale: Locale;
  timezone: string;
  dateFormat: string;
  month: string;
  obligations: Obligation[];
  investments: Investment[];
  categories: Category[];
  revision: number;
  changed: () => void;
  onError: (e: unknown) => void;
  onDraft: (draft: FinanceDraft) => void;
  onEdit: (transaction: Transaction) => void;
  onRemove: (transaction: Transaction) => void;
}) {
  const t = (key: MessageKey) => messages[locale][key];
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  const today = DateTime.now().setZone(timezone).toISODate()!;
  const [billView, setBillView] = useState<"weekly" | "list">("weekly");
  const [scope, setScope] = useState("month"),
    [bill, setBill] = useState<BillForm | null>(null),
    [investment, setInvestment] = useState<InvestmentForm | null>(null);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null),
    [history, setHistory] = useState<Transaction[] | null>(null);
  const filtered = obligations.filter(
    (o) =>
      scope === "all" ||
      (scope === "open" ? o.remainingCents > 0 : o.dueDate.startsWith(month)),
  );
  const weekly = billView === "weekly" && scope === "month";
  const groups = weekly
    ? financeWeeks(month, filtered)
    : [
        {
          number: 0,
          from: "",
          to: "",
          bills: filtered,
          total: 0,
          paid: 0,
          remaining: 0,
        },
      ];
  const repeatCount = bill
    ? bill.repeat === "weekly"
      ? bill.weeks
      : bill.repeat === "monthly"
        ? bill.months
        : 1
    : 0;
  const duePreview =
    bill &&
    Number.isInteger(repeatCount) &&
    repeatCount >= 1 &&
    repeatCount <= 52
      ? Array.from({ length: repeatCount }, (_, i) =>
          DateTime.fromISO(bill.dueDate, { zone: "UTC" })
            .plus(bill.repeat === "weekly" ? { weeks: i } : { months: i })
            .toFormat(dateFormat),
        )
      : [];
  const totals = filtered.reduce(
    (a, o) => ({
      total: a.total + o.totalCents,
      paid: a.paid + o.paidCents,
      remaining: a.remaining + o.remainingCents,
    }),
    { total: 0, paid: 0, remaining: 0 },
  );
  function fail(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      onError(e);
      return;
    }
    setError(
      t(
        e instanceof ApiError && e.message === "BELOW_PAID_AMOUNT"
          ? "belowPaid"
          : e instanceof ApiError && e.message === "HAS_LINKED_TRANSACTIONS"
            ? "linkedHistory"
            : "error",
      ),
    );
  }
  useEffect(() => {
    setExpanded(null);
    setError("");
  }, [view]);
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    setHistory(null);
    request<Transaction[]>(
      `finance/${view === "bills" ? "obligations" : "investments"}/${expanded}/transactions`,
      token,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setHistory)
      .catch((e) => {
        if (!controller.signal.aborted) fail(e);
      });
    return () => controller.abort();
  }, [expanded, view, revision, token]);
  async function saveBill(e: FormEvent) {
    e.preventDefault();
    if (!bill) return;
    const amount = parseAmount(bill.amount);
    if (amount === null) {
      setError(t("invalidAmount"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(
        bill.id ? `finance/obligations/${bill.id}` : "finance/obligations",
        token,
        bill.id ? "PATCH" : "POST",
        {
          title: bill.title,
          kind: bill.kind,
          totalCents: amount,
          dueDate: bill.dueDate,
          categoryId: bill.categoryId || null,
          ...(bill.id
            ? {}
            : {
                months:
                  bill.repeat === "monthly" && bill.kind === "fixed"
                    ? bill.months
                    : 1,
                weeks: bill.repeat === "weekly" ? bill.weeks : 1,
              }),
        },
      );
      setBill(null);
      changed();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  async function saveInvestment(e: FormEvent) {
    e.preventDefault();
    if (!investment) return;
    const target = investment.target.trim()
      ? parseAmount(investment.target)
      : null;
    if (investment.target.trim() && target === null) {
      setError(t("invalidAmount"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(
        investment.id
          ? `finance/investments/${investment.id}`
          : "finance/investments",
        token,
        investment.id ? "PATCH" : "POST",
        { name: investment.name, targetCents: target },
      );
      setInvestment(null);
      changed();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    if (!confirm(t("removeBillConfirm"))) return;
    setSaving(true);
    setError("");
    try {
      await request(
        `finance/${view === "bills" ? "obligations" : "investments"}/${id}`,
        token,
        "DELETE",
      );
      setExpanded(null);
      changed();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  const historyPanel = (id: string) =>
    expanded === id && (
      <div className="payment-history">
        <h3>{t("history")}</h3>
        {!history ? (
          <p>{t("loading")}</p>
        ) : !history.length ? (
          <p className="muted">{t("financeEmpty")}</p>
        ) : (
          history.map((tr) => (
            <div className="history-row" key={tr.id}>
              <div>
                <strong>{tr.description}</strong>
                <small>
                  {DateTime.fromISO(tr.date).toFormat(dateFormat)} ·{" "}
                  {t(tr.type === "expense" ? "expense" : "income")}
                </small>
              </div>
              <strong>{money(tr.amountCents)}</strong>
              <button
                className="icon"
                aria-label={`${t("editTransaction")}: ${tr.description}`}
                onClick={() => onEdit(tr)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon"
                aria-label={`${t("remove")}: ${tr.description}`}
                onClick={() => onRemove(tr)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    );
  return (
    <>
      <section className="management-intro">
        <div>
          <h2>{t(view)}</h2>
          <p className="muted">
            {t(view === "bills" ? "billSummaryHint" : "investmentsHint")}
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setError("");
            if (view === "bills")
              setBill({
                title: "",
                kind: "fixed",
                amount: "",
                dueDate: month === today.slice(0, 7) ? today : month + "-01",
                categoryId: "",
                months: 1,
                weeks: 4,
                repeat: "once",
              });
            else setInvestment({ name: "", target: "" });
          }}
        >
          <Plus size={17} />
          {t(view === "bills" ? "newBill" : "newInvestment")}
        </button>
      </section>
      {!bill && !investment && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view === "bills" ? (
        <>
          <div className="finance-tabs" aria-label={t("bills")}>
            <button
              type="button"
              className={weekly ? "active" : ""}
              aria-pressed={weekly}
              onClick={() => {
                setBillView("weekly");
                setScope("month");
              }}
            >
              {t("weeklyView")}
            </button>
            <button
              type="button"
              className={!weekly ? "active" : ""}
              aria-pressed={!weekly}
              onClick={() => setBillView("list")}
            >
              {t("listView")}
            </button>
          </div>
          {weekly && <p className="finance-note">{t("weeklyHint")}</p>}
          <label className="bill-scope">
            {t("billScope")}
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="month">{t("dueThisMonth")}</option>
              <option value="open">{t("allOpen")}</option>
              <option value="all">{t("allBills")}</option>
            </select>
          </label>
          <div className="stats management-totals">
            {(
              [
                ["plannedTotal", totals.total],
                ["paidTotal", totals.paid],
                ["remaining", totals.remaining],
              ] as const
            ).map(([label, value]) => (
              <div className="card stat" key={label}>
                <div>
                  <small>{t(label)}</small>
                  <h2>{money(value)}</h2>
                </div>
              </div>
            ))}
          </div>
          {!filtered.length && (
            <div className="card empty">
              <ReceiptText />
              <p>{t("noBills")}</p>
            </div>
          )}
          {groups.map((group) => (
            <section
              className={weekly ? "finance-week" : undefined}
              key={group.number}
              aria-label={
                weekly ? `${t("financeWeek")} ${group.number}` : undefined
              }
            >
              {weekly && (
                <>
                  <div className="finance-week-heading">
                    <h3>
                      {t("financeWeek")} {group.number}
                    </h3>
                    <span>
                      {DateTime.fromISO(group.from).toFormat(dateFormat)} –{" "}
                      {DateTime.fromISO(group.to).toFormat(dateFormat)}
                    </span>
                  </div>
                  <dl className="finance-week-totals">
                    <div>
                      <dt>{t("plannedTotal")}</dt>
                      <dd>{money(group.total)}</dd>
                    </div>
                    <div>
                      <dt>{t("paidTotal")}</dt>
                      <dd>{money(group.paid)}</dd>
                    </div>
                    <div>
                      <dt>{t("remaining")}</dt>
                      <dd>{money(group.remaining)}</dd>
                    </div>
                  </dl>
                  {!group.bills.length && (
                    <p className="muted">{t("emptyWeek")}</p>
                  )}
                </>
              )}
              <div className="obligation-grid">
                {group.bills.map((o) => {
                  const status =
                    o.remainingCents === 0
                      ? "paid"
                      : o.paidCents > 0
                        ? "partial"
                        : "pending";
                  const isOverdue = o.remainingCents > 0 && o.dueDate < today;
                  return (
                    <article className="card obligation-card" key={o.id}>
                      <div className="obligation-heading">
                        <div>
                          <small>
                            {t(o.kind)} ·{" "}
                            {DateTime.fromISO(o.dueDate).toFormat(dateFormat)}
                          </small>
                          <h3>{o.title}</h3>
                        </div>
                        <span
                          className={`payment-status ${isOverdue ? "overdue" : status}`}
                        >
                          {isOverdue ? `${t("overdue")} · ` : ""}
                          {t(status)}
                        </span>
                      </div>
                      <div className="bill-values">
                        <div>
                          <small>{t("plannedTotal")}</small>
                          <strong>{money(o.totalCents)}</strong>
                        </div>
                        <div>
                          <small>{t("paidTotal")}</small>
                          <strong>{money(o.paidCents)}</strong>
                        </div>
                        <div>
                          <small>{t("remaining")}</small>
                          <strong>{money(o.remainingCents)}</strong>
                        </div>
                      </div>
                      <progress
                        value={o.paidCents}
                        max={o.totalCents}
                        aria-label={`${o.title}: ${t("paidTotal")}`}
                      />
                      <div className="obligation-actions">
                        <button
                          className="secondary"
                          disabled={saving || o.remainingCents === 0}
                          onClick={() =>
                            onDraft({
                              description: o.title,
                              amount: amountText(o.remainingCents),
                              date: today,
                              type: "expense",
                              categoryId: o.categoryId,
                              obligationId: o.id,
                              investmentId: null,
                            })
                          }
                        >
                          {t("payBill")}
                        </button>
                        <button
                          className="text-button"
                          aria-expanded={expanded === o.id}
                          onClick={() =>
                            setExpanded(expanded === o.id ? null : o.id)
                          }
                        >
                          {t("history")}
                        </button>
                        <button
                          className="icon"
                          aria-label={`${t("editBill")}: ${o.title}`}
                          disabled={saving}
                          onClick={() => {
                            setError("");
                            setBill({
                              id: o.id,
                              title: o.title,
                              kind: o.kind,
                              amount: amountText(o.totalCents),
                              dueDate: o.dueDate,
                              categoryId: o.categoryId ?? "",
                              months: 1,
                              weeks: 4,
                              repeat: "once",
                            });
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon"
                          aria-label={`${t("remove")}: ${o.title}`}
                          disabled={saving}
                          onClick={() => remove(o.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {historyPanel(o.id)}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      ) : (
        <>
          <div className="stats management-totals">
            {(
              [
                ["contributions", "contributedCents"],
                ["redemptions", "redeemedCents"],
                ["investedBalance", "balanceCents"],
              ] as const
            ).map(([label, key]) => (
              <div className="card stat" key={key}>
                <div>
                  <small>{t(label)}</small>
                  <h2>
                    {money(investments.reduce((sum, i) => sum + i[key], 0))}
                  </h2>
                </div>
              </div>
            ))}
          </div>
          {!investments.length && (
            <div className="card empty">
              <TrendingUp />
              <p>{t("noInvestments")}</p>
            </div>
          )}
          <div className="obligation-grid">
            {investments.map((i) => (
              <article className="card obligation-card" key={i.id}>
                <div className="obligation-heading">
                  <h3>{i.name}</h3>
                  <TrendingUp size={22} />
                </div>
                <div className="investment-balance">
                  <small>{t("investedBalance")}</small>
                  <strong>{money(i.balanceCents)}</strong>
                </div>
                {i.targetCents && (
                  <>
                    <small>
                      {money(i.balanceCents)} / {money(i.targetCents)}
                    </small>
                    <progress
                      value={Math.min(i.balanceCents, i.targetCents)}
                      max={i.targetCents}
                      aria-label={t("investmentTarget")}
                    />
                  </>
                )}
                <div className="obligation-actions">
                  {(["expense", "income"] as const).map((type) => (
                    <button
                      key={type}
                      className="secondary"
                      disabled={
                        saving || (type === "income" && i.balanceCents === 0)
                      }
                      onClick={() =>
                        onDraft({
                          description: `${t(type === "expense" ? "contribution" : "redemption")} — ${i.name}`,
                          amount: "",
                          date: today,
                          type,
                          categoryId: null,
                          obligationId: null,
                          investmentId: i.id,
                        })
                      }
                    >
                      {t(type === "expense" ? "contribution" : "redemption")}
                    </button>
                  ))}
                  <button
                    className="text-button"
                    aria-expanded={expanded === i.id}
                    onClick={() => setExpanded(expanded === i.id ? null : i.id)}
                  >
                    {t("history")}
                  </button>
                  <button
                    className="icon"
                    aria-label={`${t("editInvestment")}: ${i.name}`}
                    disabled={saving}
                    onClick={() => {
                      setError("");
                      setInvestment({
                        id: i.id,
                        name: i.name,
                        target: i.targetCents ? amountText(i.targetCents) : "",
                      });
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon"
                    aria-label={`${t("remove")}: ${i.name}`}
                    disabled={saving}
                    onClick={() => remove(i.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {historyPanel(i.id)}
              </article>
            ))}
          </div>
        </>
      )}
      {bill && (
        <Modal
          label={t(bill.id ? "editBill" : "newBill")}
          closeLabel={t("close")}
          onClose={() => {
            if (!saving) setBill(null);
          }}
        >
          <form onSubmit={saveBill}>
            <h2>{t(bill.id ? "editBill" : "newBill")}</h2>
            <label>
              {t("billName")}
              <input
                required
                maxLength={160}
                value={bill.title}
                onChange={(e) => setBill({ ...bill, title: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                {t("billKind")}
                <select
                  value={bill.kind}
                  onChange={(e) =>
                    setBill({
                      ...bill,
                      kind: e.target.value as BillForm["kind"],
                      repeat:
                        e.target.value !== "fixed" && bill.repeat === "monthly"
                          ? "once"
                          : bill.repeat,
                    })
                  }
                >
                  {(["fixed", "variable", "debt"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("totalDue")}
                <input
                  required
                  inputMode="decimal"
                  value={bill.amount}
                  onChange={(e) => setBill({ ...bill, amount: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t("dueDate")}
                <input
                  required
                  type="date"
                  value={bill.dueDate}
                  onChange={(e) =>
                    setBill({ ...bill, dueDate: e.target.value })
                  }
                />
              </label>
              <label>
                {t("category")}
                <select
                  value={bill.categoryId}
                  onChange={(e) =>
                    setBill({ ...bill, categoryId: e.target.value })
                  }
                >
                  <option value="">{t("uncategorized")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t("dueWeek")}
              <select
                disabled={!bill.dueDate}
                value={String(Math.ceil(Number(bill.dueDate.slice(-2)) / 7))}
                onChange={(e) => {
                  const chosen = financeWeeks(
                    bill.dueDate.slice(0, 7),
                    [],
                  ).find((w) => w.number === Number(e.target.value));
                  if (chosen) setBill({ ...bill, dueDate: chosen.from });
                }}
              >
                {financeWeeks(bill.dueDate.slice(0, 7), []).map((w) => (
                  <option value={w.number} key={w.number}>
                    {t("financeWeek")} {w.number} ·{" "}
                    {DateTime.fromISO(w.from).toFormat(dateFormat)} –{" "}
                    {DateTime.fromISO(w.to).toFormat(dateFormat)}
                  </option>
                ))}
              </select>
            </label>
            <p className="finance-note">{t("dueWeekHint")}</p>
            {!bill.id && (
              <>
                <label>
                  {t("billRepeat")}
                  <select
                    value={bill.repeat}
                    onChange={(e) =>
                      setBill({
                        ...bill,
                        repeat: e.target.value as BillForm["repeat"],
                      })
                    }
                  >
                    <option value="once">{t("repeatOnce")}</option>
                    <option value="weekly">{t("repeatWeekly")}</option>
                    {bill.kind === "fixed" && (
                      <option value="monthly">{t("repeatMonthly")}</option>
                    )}
                  </select>
                </label>
                {bill.repeat !== "once" && (
                  <label>
                    {t(
                      bill.repeat === "weekly" ? "repeatWeeks" : "repeatMonths",
                    )}
                    <input
                      type="number"
                      min={1}
                      max={bill.repeat === "weekly" ? 52 : 24}
                      required
                      value={
                        bill.repeat === "weekly" ? bill.weeks : bill.months
                      }
                      onChange={(e) =>
                        setBill({
                          ...bill,
                          [bill.repeat === "weekly" ? "weeks" : "months"]:
                            Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
                {bill.repeat !== "once" && (
                  <div className="recurrence-preview">
                    <strong>
                      {t("recurrenceTotal")}:{" "}
                      {money(
                        (parseAmount(bill.amount) ?? 0) * duePreview.length,
                      )}
                    </strong>
                    <p>
                      {t("duePreview")}: {duePreview.join(" · ")}
                    </p>
                  </div>
                )}
              </>
            )}
            <p className="finance-note">
              {t(
                bill.repeat === "weekly"
                  ? "weeklyRepeatHint"
                  : bill.repeat === "monthly"
                    ? "repeatHint"
                    : "singleBillHint",
              )}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={() => setBill(null)}
              >
                {t("cancel")}
              </button>
              <button className="primary" disabled={saving}>
                {t(saving ? "saving" : "saveBill")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {investment && (
        <Modal
          label={t(investment.id ? "editInvestment" : "newInvestment")}
          closeLabel={t("close")}
          onClose={() => {
            if (!saving) setInvestment(null);
          }}
        >
          <form onSubmit={saveInvestment}>
            <h2>{t(investment.id ? "editInvestment" : "newInvestment")}</h2>
            <label>
              {t("investmentName")}
              <input
                required
                maxLength={100}
                value={investment.name}
                onChange={(e) =>
                  setInvestment({ ...investment, name: e.target.value })
                }
              />
            </label>
            <label>
              {t("investmentTarget")}
              <input
                inputMode="decimal"
                value={investment.target}
                onChange={(e) =>
                  setInvestment({ ...investment, target: e.target.value })
                }
              />
            </label>
            <p className="finance-note">{t("investmentsHint")}</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={() => setInvestment(null)}
              >
                {t("cancel")}
              </button>
              <button className="primary" disabled={saving}>
                {t(saving ? "saving" : "saveInvestment")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
