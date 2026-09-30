import { DateTime } from "luxon";
import type { Obligation } from "./finance-types";

// Financial weeks are fixed day ranges inside the selected month.
// Calendar date strings are evaluated in UTC so DST cannot shift a due date.
export function financeWeeks(month: string, obligations: Obligation[]) {
  const start = DateTime.fromISO(`${month}-01`, { zone: "UTC" });
  if (!start.isValid) return [];
  return Array.from(
    { length: Math.ceil(start.daysInMonth! / 7) },
    (_, index) => {
      const from = start.plus({ days: index * 7 });
      const to = start.set({
        day: Math.min(index * 7 + 7, start.daysInMonth!),
      });
      const bills = obligations.filter(
        (o) => o.dueDate >= from.toISODate()! && o.dueDate <= to.toISODate()!,
      );
      return {
        number: index + 1,
        from: from.toISODate()!,
        to: to.toISODate()!,
        bills,
        ...bills.reduce(
          (sum, bill) => ({
            total: sum.total + bill.totalCents,
            paid: sum.paid + bill.paidCents,
            remaining: sum.remaining + bill.remainingCents,
          }),
          { total: 0, paid: 0, remaining: 0 },
        ),
      };
    },
  );
}
