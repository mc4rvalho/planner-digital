import { DateTime } from "luxon";
import { batchSchema, type PlannerEvent } from "./schemas";

// Only accept a fully explicit daily timetable. Never silently drop an unparsed line.
export function parseExplicitRoutine(
  text: string,
  referenceDate: string,
  timezone: string,
): PlannerEvent[] | null {
  const lines = text
    .trim()
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 100) return null;
  const base = DateTime.fromISO(referenceDate, { zone: timezone });
  if (!base.isValid) return null;
  const events: PlannerEvent[] = [];
  const time = "(\\d{1,2})(?:(?:h|:)(\\d{2})?|\\s*horas?)";
  const pattern = new RegExp(
    `^(.+?)\\s+(?:das|de|às|as)\\s+${time}\\s+(?:até|ate|a|às|as)(?:\\s+(?:às|as))?\\s+${time}\\s*[.!]?$`,
    "i",
  );
  for (const line of lines) {
    const match = pattern.exec(line);
    if (!match) return null;
    const [, title, sh, sm, eh, em] = match;
    // Dates and recurrence need semantic interpretation; don't guess their meaning.
    if (
      /\b(amanh[ãa]|hoje|ontem|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|semana|mensal|diariamente|diario|diaria|quinzenal|anual|todos|todas|todo|toda|cada|dias|dia|mes|meses)\b|\d{1,4}[\/-]\d/.test(
        title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
      )
    )
      return null;
    const start = base.set({
      hour: +sh,
      minute: +(sm ?? 0),
      second: 0,
      millisecond: 0,
    });
    const end = base.set({
      hour: +eh,
      minute: +(em ?? 0),
      second: 0,
      millisecond: 0,
    });
    if (
      +sh > 23 ||
      +eh > 23 ||
      +(sm ?? 0) > 59 ||
      +(em ?? 0) > 59 ||
      start.hour !== +sh ||
      end.hour !== +eh ||
      start.minute !== +(sm ?? 0) ||
      end.minute !== +(em ?? 0) ||
      end <= start
    )
      return null;
    events.push({
      title: title.trim(),
      start: start.toISO()!,
      end: end.toISO()!,
      category: /estud|study/i.test(title) ? "study" : "personal",
    });
  }
  return batchSchema.safeParse({ events }).success ? events : null;
}
