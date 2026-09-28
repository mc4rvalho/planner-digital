import { z } from "zod";
import { DateTime } from "luxon";
export const eventSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    category: z
      .enum(["work", "personal", "health", "study"])
      .default("personal"),
  })
  .strict()
  .refine((e) => Date.parse(e.end) > Date.parse(e.start), {
    message: "End must be after start",
  });
export const batchSchema = z
  .object({ events: z.array(eventSchema).min(1).max(100) })
  .strict();
export const preferencesSchema = z
  .object({
    locale: z.enum(["pt-BR", "en-US", "es-ES"]),
    hourCycle: z.enum(["h23", "h12"]),
    dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
    timezone: z.string().refine((s) => DateTime.now().setZone(s).isValid),
    theme: z.enum(["light", "dark"]),
  })
  .strict();
export const proposalSchema = z
  .object({
    text: z.string().trim().min(5).max(8000),
    referenceDate: z.iso.date(),
  })
  .strict();
export type PlannerEvent = z.infer<typeof eventSchema>;
export function hasOverlap(a: PlannerEvent, b: PlannerEvent) {
  return (
    Date.parse(a.start) < Date.parse(b.end) &&
    Date.parse(b.start) < Date.parse(a.end)
  );
}
