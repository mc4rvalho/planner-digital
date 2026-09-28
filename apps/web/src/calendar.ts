import { DateTime } from "luxon";
export type View = "day" | "week" | "month" | "year";
export function rangeFor(date: DateTime, view: View) {
  const start = date.startOf(view);
  return {
    start,
    end: start.plus(
      view === "day"
        ? { days: 1 }
        : view === "week"
          ? { weeks: 1 }
          : view === "month"
            ? { months: 1 }
            : { years: 1 },
    ),
  };
}
export function monthCells(date: DateTime) {
  const first = date.startOf("month").startOf("week");
  return Array.from({ length: 42 }, (_, i) => first.plus({ days: i }));
}
export function shiftDate(date: DateTime, view: View, direction: number) {
  return date.plus(
    view === "day"
      ? { days: direction }
      : view === "week"
        ? { weeks: direction }
        : view === "month"
          ? { months: direction }
          : { years: direction },
  );
}
