import { z } from "zod";

export const accountTypeSchema = z.enum([
  "BANK",
  "CASH",
  "INVESTMENT",
  "DEPOSITO",
  "LOAN",
  "CREDIT_CARD",
  "LOAN_RECEIVABLE",
]);

export type AccountType = z.infer<typeof accountTypeSchema>;

export const mobileAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  balance: z.number().finite(),
  isActive: z.boolean(),
});

export type MobileAccount = z.infer<typeof mobileAccountSchema>;

export const mobileAccountsResponseSchema = z.object({
  accounts: z.array(mobileAccountSchema),
});

export type MobileAccountsResponse = z.infer<
  typeof mobileAccountsResponseSchema
>;
