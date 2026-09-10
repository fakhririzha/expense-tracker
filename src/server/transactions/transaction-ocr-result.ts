import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00+07:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return !Number.isNaN(date.getTime()) && date <= today;
  });

const nullableTextSchema = z.string().trim().min(1).nullable();

const ocrLineItemSchema = z.object({
  description: nullableTextSchema,
  amount: z.number().positive().nullable(),
  categoryId: z.string().trim().min(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

const ocrResultSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]).nullable(),
  amount: z.number().positive().nullable(),
  date: dateStringSchema.nullable(),
  description: nullableTextSchema,
  location: nullableTextSchema,
  categoryId: z.string().trim().min(1).nullable(),
  lineItems: z.array(ocrLineItemSchema).default([]),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export type TransactionOcrResult = z.infer<typeof ocrResultSchema>;

function stripJsonFences(content: string): string {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function normalizeParsedResult(
  result: TransactionOcrResult,
  categories: Array<{ id: string; type: string }>
): TransactionOcrResult {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const warnings = [...result.warnings];
  const parentCategory = result.categoryId
    ? categoryById.get(result.categoryId)
    : null;

  let categoryId = result.categoryId;
  if (categoryId && !parentCategory) {
    warnings.push("Ignored an unknown category returned by OCR.");
    categoryId = null;
  } else if (
    categoryId &&
    result.type &&
    parentCategory &&
    parentCategory.type !== result.type
  ) {
    warnings.push("Ignored a category that does not match the detected transaction type.");
    categoryId = null;
  }

  const lineItems = result.lineItems.map((item) => {
    const lineCategory = item.categoryId ? categoryById.get(item.categoryId) : null;
    if (item.categoryId && (!lineCategory || lineCategory.type !== "EXPENSE")) {
      warnings.push("Ignored an unknown or non-expense line-item category returned by OCR.");
      return { ...item, categoryId: null };
    }
    return item;
  });

  return {
    ...result,
    categoryId,
    lineItems,
    warnings: [...new Set(warnings)],
  };
}

export function parseTransactionOcrResult(
  content: string,
  categories: Array<{ id: string; type: string }>
):
  | { success: true; data: TransactionOcrResult }
  | { success: false; error: string } {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFences(content));
  } catch {
    return { success: false, error: "Bill scan response was not valid JSON." };
  }

  const parsed = ocrResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      success: false,
      error: "Bill scan response did not match the expected fields.",
    };
  }

  return {
    success: true,
    data: normalizeParsedResult(parsed.data, categories),
  };
}
