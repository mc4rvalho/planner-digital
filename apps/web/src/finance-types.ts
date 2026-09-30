export type Category = { id: string; name: string; color: string };
export type Obligation = {
  id: string;
  title: string;
  kind: "fixed" | "variable" | "debt";
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  dueDate: string;
  categoryId: string | null;
  seriesId: string | null;
};
export type Investment = {
  id: string;
  name: string;
  targetCents: number | null;
  contributedCents: number;
  redeemedCents: number;
  balanceCents: number;
};
export type Transaction = {
  id: string;
  description: string;
  amountCents: number;
  type: "income" | "expense";
  date: string;
  categoryId: string | null;
  obligationId?: string | null;
  investmentId?: string | null;
  categoryName?: string | null;
  color?: string;
};
export type FinanceDraft = Omit<
  Transaction,
  "id" | "categoryName" | "color" | "amountCents"
> & { amount: string };
