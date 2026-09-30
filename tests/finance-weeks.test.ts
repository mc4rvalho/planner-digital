import { test } from "node:test";
import assert from "node:assert/strict";
import { financeWeeks } from "../apps/web/src/finance-weeks";
import type { Obligation } from "../apps/web/src/finance-types";
const bill = (
  dueDate: string,
  totalCents = 20000,
  paidCents = 0,
): Obligation => ({
  id: dueDate,
  title: "Adias",
  kind: "debt",
  dueDate,
  totalCents,
  paidCents,
  remainingCents: totalCents - paidCents,
  categoryId: null,
  seriesId: null,
});
test("financial weeks partition every date once, including leap years and month-end", () => {
  for (const [month, days] of [
    ["2026-02", 28],
    ["2028-02", 29],
    ["2026-04", 30],
    ["2026-10", 31],
  ] as const) {
    const bills = Array.from({ length: days }, (_, i) =>
      bill(`${month}-${String(i + 1).padStart(2, "0")}`),
    );
    const weeks = financeWeeks(month, bills);
    assert.equal(weeks.length, Math.ceil(days / 7));
    assert.equal(weeks.flatMap((w) => w.bills).length, days);
    assert.equal(weeks.at(-1)!.to, `${month}-${days}`);
    assert.equal(
      new Set(weeks.flatMap((w) => w.bills.map((b) => b.id))).size,
      days,
    );
  }
});
test("weekly totals follow due dates and partial payments without mixing months", () => {
  const bills = [
    bill("2026-10-01", 40000, 30000),
    bill("2026-10-08"),
    bill("2026-10-15"),
    bill("2026-10-22"),
    bill("2026-11-01"),
  ];
  const weeks = financeWeeks("2026-10", bills);
  assert.deepEqual(
    weeks.map((w) => w.remaining),
    [10000, 20000, 20000, 20000, 0],
  );
  assert.equal(weeks[0].paid, 30000);
  const edited = financeWeeks(
    "2026-10",
    bills.map((b) =>
      b.dueDate === "2026-10-08" ? { ...b, dueDate: "2026-10-16" } : b,
    ),
  );
  assert.equal(edited[1].total, 0);
  assert.equal(edited[2].total, 40000);
  assert.deepEqual(financeWeeks("invalid", bills), []);
});
