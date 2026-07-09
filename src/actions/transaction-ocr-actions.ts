"use server";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { z } from "zod";

const MAX_IMAGE_SIZE = 1 * 1024 * 1024;
const DAILY_OCR_LIMIT = 2;
const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const IMAGE_EXTENSION_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

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
export type ScanTransactionBillResult =
  | { success: true; data: TransactionOcrResult }
  | { success: false; error: string };

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

function getChatConfig() {
  const endpoint = process.env.CHAT_API_ENDPOINT?.trim();
  const apiKey = process.env.CHAT_API_KEY?.trim();
  const model = process.env.CHAT_API_MODEL?.trim();

  if (!endpoint || !apiKey || !model) {
    return {
      success: false as const,
      error:
        "Bill scan is not configured. Set CHAT_API_ENDPOINT, CHAT_API_KEY, and CHAT_API_MODEL.",
    };
  }

  return { success: true as const, endpoint, apiKey, model };
}

function stripJsonFences(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function getImageMimeType(file: File) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return file.type;
  }

  const fileName = file.name.toLowerCase();
  const extension = Object.keys(IMAGE_EXTENSION_TYPES).find((item) =>
    fileName.endsWith(item)
  );
  return extension ? IMAGE_EXTENSION_TYPES[extension] : null;
}

function getJakartaDayBounds(now = new Date()) {
  const jakartaDate = new Date(now.getTime() + JAKARTA_UTC_OFFSET_MS);
  const startUtcMs =
    Date.UTC(
      jakartaDate.getUTCFullYear(),
      jakartaDate.getUTCMonth(),
      jakartaDate.getUTCDate()
    ) - JAKARTA_UTC_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}

async function imageFileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = getImageMimeType(file) ?? "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function buildPrompt(
  categories: Array<{ id: string; name: string; icon: string | null; type: string }>
) {
  return [
    "You extract transaction fields from a receipt or bill image for a personal finance app.",
    "Return JSON only. Do not use Markdown, comments, code fences, or prose.",
    "Optimize for Indonesian and English receipts, IDR totals, and Asia/Jakarta dates.",
    "Prefer the final payable total over subtotal, tax-only, discount-only, change, or cash tendered amounts.",
    "Do not guess missing fields. Use null and add a short warning instead.",
    "Never return TRANSFER. Only use EXPENSE, INCOME, or null for type.",
    "Use only categoryId values from this category list. If uncertain, use null.",
    "For lineItems, include itemized rows only when visible. Use EXPENSE category IDs for line items.",
    "Schema: {\"type\":\"EXPENSE\"|\"INCOME\"|null,\"amount\":number|null,\"date\":\"YYYY-MM-DD\"|null,\"description\":string|null,\"location\":string|null,\"categoryId\":string|null,\"lineItems\":[{\"description\":string|null,\"amount\":number|null,\"categoryId\":string|null,\"confidence\":number|null}],\"confidence\":number|null,\"warnings\":string[]}.",
    `Categories: ${JSON.stringify(categories)}`,
  ].join("\n");
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

async function reserveOcrUsage(userId: string, imageBytes: number) {
  const { start, end } = getJakartaDayBounds();

  return prisma.$transaction(
    async (tx) => {
      const todayCount = await tx.ocrUsageEvent.count({
        where: {
          userId,
          processedAt: {
            gte: start,
            lt: end,
          },
        },
      });

      if (todayCount >= DAILY_OCR_LIMIT) {
        return {
          success: false as const,
          error:
            "Daily bill scan limit reached. You can scan up to 2 bill photos per day.",
        };
      }

      await tx.ocrUsageEvent.create({
        data: {
          userId,
          imageBytes,
        },
      });

      return { success: true as const };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function scanTransactionBill(
  formData: FormData
): Promise<ScanTransactionBillResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const config = getChatConfig();
    if (!config.success) {
      return { success: false, error: config.error };
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return { success: false, error: "Please choose a bill photo to scan." };
    }

    if (!getImageMimeType(image)) {
      return {
        success: false,
        error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image.",
      };
    }

    if (image.size >= MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: "Compressed bill photo must be smaller than 1 MB.",
      };
    }

    const usage = await reserveOcrUsage(session.user.id, image.size);
    if (!usage.success) {
      return usage;
    }

    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        type: true,
      },
    });

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(categories) },
              {
                type: "image_url",
                image_url: {
                  url: await imageFileToDataUrl(image),
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Bill scan failed with status:", response.status, await response.text());
      return {
        success: false,
        error: `Bill scan failed with status ${response.status}.`,
      };
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { success: false, error: "Bill scan returned an unreadable response." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(content));
    } catch {
      return { success: false, error: "Bill scan response was not valid JSON." };
    }

    const parsed = ocrResultSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { success: false, error: "Bill scan response did not match the expected fields." };
    }

    return {
      success: true,
      data: normalizeParsedResult(parsed.data, categories),
    };
  } catch (error) {
    console.error("Scan transaction bill error:", error);
    return { success: false, error: "Failed to scan bill photo." };
  }
}
