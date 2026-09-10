import { z } from "zod";

export const categoryTransactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
]);

export type CategoryTransactionType = z.infer<
  typeof categoryTransactionTypeSchema
>;

export const mobileCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  type: categoryTransactionTypeSchema,
});

export type MobileCategory = z.infer<typeof mobileCategorySchema>;

export const mobileCategoriesResponseSchema = z.object({
  categories: z.array(mobileCategorySchema),
});

export type MobileCategoriesResponse = z.infer<
  typeof mobileCategoriesResponseSchema
>;
