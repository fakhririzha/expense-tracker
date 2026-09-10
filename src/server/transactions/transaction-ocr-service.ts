import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import {
  getJakartaDayBounds,
  hasRemainingOcrQuota,
} from "@/server/transactions/transaction-ocr-policy";
import {
  parseTransactionOcrResult,
  type TransactionOcrResult,
} from "@/server/transactions/transaction-ocr-result";
import {
  getOcrImageMimeType,
  validateOcrImageFile,
} from "@/server/transactions/transaction-ocr-validation";

const DEFAULT_DAILY_OCR_LIMIT = 2;
export type { TransactionOcrResult };
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

function getDailyOcrLimit(): number {
  const configuredLimit = Number.parseInt(process.env.DAILY_OCR_LIMIT ?? "", 10);

  return Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_DAILY_OCR_LIMIT;
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

async function imageFileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = getOcrImageMimeType(file) ?? "application/octet-stream";
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

async function reserveOcrUsage(userId: string, imageBytes: number) {
  const { start, end } = getJakartaDayBounds();
  const dailyOcrLimit = getDailyOcrLimit();

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

      if (!hasRemainingOcrQuota(todayCount, dailyOcrLimit)) {
        return {
          success: false as const,
          error:
            `Daily bill scan limit reached. You can scan up to ${dailyOcrLimit} bill photos per day.`,
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

export async function scanTransactionBillForUser(
  userId: string,
  formData: FormData
): Promise<ScanTransactionBillResult> {
  try {
    const config = getChatConfig();
    if (!config.success) {
      return { success: false, error: config.error };
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return { success: false, error: "Please choose a bill photo to scan." };
    }

    const fileValidation = validateOcrImageFile(image);
    if (!fileValidation.success) return fileValidation;

    const usage = await reserveOcrUsage(userId, image.size);
    if (!usage.success) {
      return usage;
    }

    const categories = await prisma.category.findMany({
      where: { userId },
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
      signal: AbortSignal.timeout(30_000),
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
      console.error("Bill scan provider request failed with status:", response.status);
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

    return parseTransactionOcrResult(content, categories);
  } catch (error) {
    console.error("Scan transaction bill error:", error);
    return { success: false, error: "Failed to scan bill photo." };
  }
}
