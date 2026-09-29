import { z } from "zod";
export const transactionSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    amountCents: z.number().int().positive().max(999999999),
    type: z.enum(["income", "expense"]),
    date: z.iso.date(),
    categoryId: z.uuid().nullable(),
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
