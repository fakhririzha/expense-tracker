import { z } from "zod";

import { accountTypeSchema } from "./account";

export const transactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "LIABILITY_PAYMENT",
]);

export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const mobileTransactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
]);

export type MobileTransactionType = z.infer<
  typeof mobileTransactionTypeSchema
>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const transactionCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  reason: z.string().optional(),
});

export type TransactionCapabilities = z.infer<
  typeof transactionCapabilitiesSchema
>;

export const transactionAccountSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: accountTypeSchema,
});

export const transactionCategorySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});

export const transactionSplitSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  categoryId: z.string().nullable(),
  category: transactionCategorySummarySchema.nullable(),
});

const transactionRecordFields = {
  id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exchangeRate: z.number().positive(),
  type: transactionTypeSchema,
  description: z.string().nullable(),
  location: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googleMapsLink: z.string().nullable(),
  date: isoDateTimeSchema,
  isRecurring: z.boolean(),
  isManagedByDeposito: z.boolean(),
  toAccountId: z.string().nullable(),
  account: transactionAccountSummarySchema,
  toAccount: transactionAccountSummarySchema.nullable().optional(),
  category: transactionCategorySummarySchema.nullable(),
  splits: z.array(transactionSplitSchema),
  capabilities: transactionCapabilitiesSchema,
} as const;

export const mobileTransactionSchema = z.object(transactionRecordFields);
export type MobileTransaction = z.infer<typeof mobileTransactionSchema>;

export const mobileTransactionListItemSchema = mobileTransactionSchema;
export type MobileTransactionListItem = z.infer<
  typeof mobileTransactionListItemSchema
>;

export const mobileTransactionDetailSchema = mobileTransactionSchema;
export type MobileTransactionDetail = z.infer<
  typeof mobileTransactionDetailSchema
>;

export const transactionListQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  type: transactionTypeSchema.optional(),
  startDate: isoDateTimeSchema.optional(),
  endDate: isoDateTimeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .refine((value) => [10, 25, 50, 100].includes(value), {
      message: "Page size must be 10, 25, 50, or 100",
    })
    .default(25),
  sortBy: z.enum(["date", "amount"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

export const mobileTransactionListResponseSchema = z.object({
  transactions: z.array(mobileTransactionListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().positive(),
});

export type MobileTransactionListResponse = z.infer<
  typeof mobileTransactionListResponseSchema
>;

const transactionMutationFields = {
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exchangeRate: z.number().positive(),
  type: mobileTransactionTypeSchema,
  description: z.string().trim().max(10_000).nullish(),
  location: z.string().trim().max(10_000).nullish(),
  date: isoDateTimeSchema,
  accountId: z.string().min(1),
  toAccountId: z.string().min(1).nullish(),
  categoryId: z.string().min(1).nullish(),
} as const;

export const mobileCreateTransactionSchema = z
  .object({
    clientMutationId: z.string().uuid(),
    ...transactionMutationFields,
  })
  .superRefine((value, context) => {
    if (value.type === "TRANSFER" && !value.toAccountId) {
      context.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "Destination account is required for transfers",
      });
    }
    if (value.toAccountId && value.toAccountId === value.accountId) {
      context.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "From and destination accounts must be different",
      });
    }
  });

export type MobileCreateTransaction = z.infer<
  typeof mobileCreateTransactionSchema
>;

export const mobileUpdateTransactionSchema = z
  .object(transactionMutationFields)
  .partial()
  .superRefine((value, context) => {
    if (value.type === "TRANSFER" && !value.toAccountId) {
      context.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "Destination account is required for transfers",
      });
    }
    if (
      value.accountId &&
      value.toAccountId &&
      value.toAccountId === value.accountId
    ) {
      context.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "From and destination accounts must be different",
      });
    }
  });

export type MobileUpdateTransaction = z.infer<
  typeof mobileUpdateTransactionSchema
>;

export const transactionOcrLineItemSchema = z.object({
  description: z.string().nullable(),
  amount: z.number().positive().nullable(),
  categoryId: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const transactionOcrResultSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]).nullable(),
  amount: z.number().positive().nullable(),
  date: isoDateSchema.nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  categoryId: z.string().nullable(),
  lineItems: z.array(transactionOcrLineItemSchema),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string()),
});

export type TransactionOcrResult = z.infer<typeof transactionOcrResultSchema>;

export const transactionOcrResponseSchema = z.object({
  data: transactionOcrResultSchema,
});

export type TransactionOcrResponse = z.infer<
  typeof transactionOcrResponseSchema
>;
