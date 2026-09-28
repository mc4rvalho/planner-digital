import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { rangeFor, monthCells, shiftDate } from "../apps/web/src/calendar";
import {
  eventSchema,
  batchSchema,
  preferencesSchema,
  hasOverlap,
} from "../apps/api/src/planner/schemas";
import { messages } from "../apps/web/src/i18n";
test("leap year and current year boundaries are calculated dynamically", () => {
  assert.equal(rangeFor(DateTime.fromISO("2024-02-15"), "month").end.day, 1);
  assert.equal(
    rangeFor(DateTime.fromISO("2024-02-15"), "month").end.diff(
      rangeFor(DateTime.fromISO("2024-02-15"), "month").start,
      "days",
    ).days,
    29,
  );
  assert.equal(
    rangeFor(DateTime.now(), "year").start.year,
    new Date().getFullYear(),
  );
  assert.equal(
    shiftDate(DateTime.fromISO("2026-12-31"), "day", 1).toISODate(),
    "2027-01-01",
  );
});
test("DST days preserve timezone boundaries instead of assuming 24 hours", () => {
  const spring = rangeFor(
    DateTime.fromISO("2026-03-08", { zone: "America/New_York" }),
    "day",
  );
  assert.equal(spring.end.diff(spring.start, "hours").hours, 23);
  const fall = rangeFor(
    DateTime.fromISO("2026-11-01", { zone: "America/New_York" }),
    "day",
  );
  assert.equal(fall.end.diff(fall.start, "hours").hours, 25);
});
test("month grid starts Monday and includes year boundaries", () => {
  const cells = monthCells(DateTime.fromISO("2027-01-01"));
  assert.equal(cells.length, 42);
  assert.equal(cells[0].weekday, 1);
  assert.equal(cells[0].year, 2026);
});
const event = {
  title: "Study",
  start: "2026-09-28T10:00:00-03:00",
  end: "2026-09-28T11:00:00-03:00",
  category: "study" as const,
};
test("event validation rejects reversed times, unzoned values and unknown ownership fields", () => {
  assert.ok(eventSchema.safeParse(event).success);
  assert.equal(
    eventSchema.safeParse({ ...event, end: event.start }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({ ...event, start: "2026-09-28T10:00:00" }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({ ...event, userId: "someone-else" }).success,
    false,
  );
  assert.equal(batchSchema.safeParse({ events: [] }).success, false);
});
test("conflicts allow adjacent events and compare actual instants", () => {
  assert.equal(
    hasOverlap(event, {
      ...event,
      start: event.end,
      end: "2026-09-28T12:00:00-03:00",
    }),
    false,
  );
  assert.equal(
    hasOverlap(event, {
      ...event,
      start: "2026-09-28T13:30:00Z",
      end: "2026-09-28T14:30:00Z",
    }),
    true,
  );
});
test("preferences reject invalid zones; translations cover identical keys", () => {
  assert.equal(
    preferencesSchema.safeParse({
      locale: "pt-BR",
      hourCycle: "h23",
      dateFormat: "dd/MM/yyyy",
      timezone: "invalid/timezone",
      theme: "light",
    }).success,
    false,
  );
  for (const dictionary of Object.values(messages))
    assert.deepEqual(
      Object.keys(dictionary).sort(),
      Object.keys(messages["pt-BR"]).sort(),
    );
});
