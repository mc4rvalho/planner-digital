import { z } from "zod";
export const transactionSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    amountCents: z.number().int().positive().max(999999999),
    type: z.enum(["income", "expense"]),
    date: z.iso.date(),
    categoryId: z.uuid().nullable(),
    obligationId: z.uuid().nullable().optional(),
    investmentId: z.uuid().nullable().optional(),
  })
  .strict();
export const transactionBatch = z
  .object({ transactions: z.array(transactionSchema).min(1).max(100) })
  .strict();
export const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export type TransactionInput = z.infer<typeof transactionSchema>;

export const obligationSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: z.enum(["fixed", "variable", "debt"]),
    totalCents: z.number().int().positive().max(999999999),
    dueDate: z.iso.date(),
    categoryId: z.uuid().nullable(),
  })
  .strict();
export const obligationCreateSchema = obligationSchema
  .extend({
    months: z.number().int().min(1).max(24).default(1),
  })
  .refine((d) => d.months === 1 || d.kind === "fixed", {
    message: "Only fixed bills may repeat",
  });
export const investmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    targetCents: z.number().int().positive().max(999999999).nullable(),
  })
  .strict();
export type ObligationInput = z.infer<typeof obligationSchema>;
export type InvestmentInput = z.infer<typeof investmentSchema>;
