import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, amountText } from "../apps/web/src/money";
import { transactionSchema } from "../apps/api/src/finance/schemas";
test("currency parsing preserves exact cents and rejects ambiguous group separators", () => {
  assert.equal(parseAmount("0,01"), 1);
  assert.equal(parseAmount("82.90"), 8290);
  assert.equal(parseAmount("3500"), 350000);
  assert.equal(parseAmount("0.1"), 10);
  for (const value of [
    "0",
    "-1",
    "1.234",
    "1,234.56",
    "NaN",
    "1e3",
    "99999999",
  ])
    assert.equal(parseAmount(value), null);
  assert.equal(amountText(1234), "12.34");
  assert.equal(amountText(1), "0.01");
});
test("financial inputs reject fractions, invalid dates and injected ownership", () => {
  const data = {
    description: "Bus",
    amountCents: 450,
    type: "expense",
    date: "2026-02-28",
    categoryId: null,
  };
  assert.ok(transactionSchema.safeParse(data).success);
  for (const patch of [
    { amountCents: 4.5 },
    { amountCents: 0 },
    { date: "2026-02-30" },
    { userId: "other" },
    { type: "transfer" },
  ])
    assert.equal(
      transactionSchema.safeParse({ ...data, ...patch }).success,
      false,
    );
});
