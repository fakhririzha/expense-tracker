"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";
import {
  PERSONAL_ASSET_CATEGORIES,
  type PersonalAssetCategory,
  type PersonalAssetRecord,
  type PersonalAssetSummary,
  type PersonalAssetValuationRecord,
} from "@/types/personal-assets";

const categorySchema = z.enum(PERSONAL_ASSET_CATEGORIES);

const personalAssetSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: categorySchema,
  currentValue: z.number().min(0, "Value cannot be negative"),
  currency: z.string().trim().min(3, "Currency is required").max(3),
  valuedAt: z.date(),
  purchaseDate: z.date().nullable().optional(),
  purchasePrice: z.number().min(0, "Purchase price cannot be negative").nullable().optional(),
  purchaseCurrency: z.string().trim().min(3).max(3).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const personalAssetUpdateSchema = personalAssetSchema
  .omit({ currentValue: true, currency: true, valuedAt: true })
  .partial();

const valuationSchema = z.object({
  value: z.number().min(0, "Value cannot be negative"),
  currency: z.string().trim().min(3, "Currency is required").max(3),
  valuedAt: z.date(),
});

const archiveSchema = z.object({
  disposedAt: z.date(),
});

export type PersonalAssetInput = z.infer<typeof personalAssetSchema>;
export type PersonalAssetUpdateInput = z.infer<typeof personalAssetUpdateSchema>;
export type PersonalAssetValuationInput = z.infer<typeof valuationSchema>;

function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

function validateDates(dates: Array<Date | null | undefined>): string | null {
  return dates.some((date) => date && isFutureDate(date))
    ? "Dates cannot be in the future"
    : null;
}

function normalizeCurrency(currency: string): string {
  return currency.toUpperCase();
}

function revalidatePersonalAssetPaths(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assets");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/data");
}

async function decryptPersonalAsset(
  userId: string,
  asset: PersonalAssetRecord & {
    nameEncrypted?: string | null;
    notesEncrypted?: string | null;
  }
): Promise<PersonalAssetRecord> {
  let name = asset.name;
  let notes = asset.notes;

  if (asset.nameEncrypted) {
    try {
      name = await decryptUserField(userId, "personalAsset.name", asset.nameEncrypted);
    } catch {
      // Keep the required plaintext fallback for existing development data.
    }
  }

  if (asset.notesEncrypted) {
    try {
      notes = await decryptUserField(userId, "personalAsset.notes", asset.notesEncrypted);
    } catch {
      // Keep the plaintext fallback when encrypted data cannot be read.
    }
  }

  return {
    ...asset,
    name,
    notes,
  };
}

async function getNormalizedValue(
  value: number,
  currency: string,
  displayCurrency: string
): Promise<number> {
  if (currency === displayCurrency) return value;
  const rate = await getExchangeRate(currency, displayCurrency);
  return value * (rate ?? 1);
}

export async function getPersonalAssets(params?: {
  status?: "active" | "archived" | "all";
  category?: PersonalAssetCategory;
}): Promise<{ success: boolean; data: PersonalAssetRecord[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const status = params?.status ?? "active";
    const assets = await prisma.personalAsset.findMany({
      where: {
        userId: session.user.id,
        ...(status === "active" ? { disposedAt: null } : {}),
        ...(status === "archived" ? { disposedAt: { not: null } } : {}),
        ...(params?.category ? { category: params.category } : {}),
      },
      include: {
        _count: {
          select: { valuations: true },
        },
      },
      orderBy: [{ disposedAt: "asc" }, { updatedAt: "desc" }],
    });

    const decryptedAssets = await Promise.all(
      assets.map((asset) => decryptPersonalAsset(session.user.id, asset))
    );

    return { success: true, data: decryptedAssets };
  } catch (error) {
    console.error("Get personal assets error:", error);
    return { success: false, data: [], error: "Failed to fetch personal assets" };
  }
}

export async function getPersonalAssetSummary(): Promise<{
  success: boolean;
  data?: PersonalAssetSummary;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const [user, activeAssets, archivedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { mainCurrency: true },
      }),
      prisma.personalAsset.findMany({
        where: { userId: session.user.id, disposedAt: null },
        select: { currentValue: true, currency: true, category: true },
      }),
      prisma.personalAsset.count({
        where: { userId: session.user.id, disposedAt: { not: null } },
      }),
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    let totalValue = 0;
    for (const asset of activeAssets) {
      totalValue += await getNormalizedValue(
        asset.currentValue,
        asset.currency,
        user.mainCurrency
      );
    }

    return {
      success: true,
      data: {
        totalValue,
        activeCount: activeAssets.length,
        archivedCount,
        categoryCount: new Set(activeAssets.map((asset) => asset.category)).size,
        displayCurrency: user.mainCurrency,
      },
    };
  } catch (error) {
    console.error("Get personal asset summary error:", error);
    return { success: false, error: "Failed to fetch personal asset summary" };
  }
}

export async function getPersonalAssetValuations(
  assetId: string
): Promise<{ success: boolean; data: PersonalAssetValuationRecord[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const asset = await prisma.personalAsset.findFirst({
      where: { id: assetId, userId: session.user.id },
      select: { id: true },
    });

    if (!asset) {
      return { success: false, data: [], error: "Asset not found" };
    }

    const valuations = await prisma.personalAssetValuation.findMany({
      where: { assetId, userId: session.user.id },
      orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }],
    });

    return { success: true, data: valuations };
  } catch (error) {
    console.error("Get personal asset valuations error:", error);
    return { success: false, data: [], error: "Failed to fetch valuation history" };
  }
}

export async function createPersonalAsset(data: PersonalAssetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = personalAssetSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const dateError = validateDates([parsed.data.valuedAt, parsed.data.purchaseDate]);
    if (dateError) return { success: false, error: dateError };

    const currency = normalizeCurrency(parsed.data.currency);
    const purchaseCurrency = parsed.data.purchaseCurrency
      ? normalizeCurrency(parsed.data.purchaseCurrency)
      : null;
    const encryptedName = await encryptUserField(
      session.user.id,
      "personalAsset.name",
      parsed.data.name
    );
    const encryptedNotes = parsed.data.notes
      ? await encryptUserField(session.user.id, "personalAsset.notes", parsed.data.notes)
      : null;

    const asset = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.personalAsset.create({
        data: {
          name: parsed.data.name,
          nameEncrypted: encryptedName,
          category: parsed.data.category,
          currentValue: parsed.data.currentValue,
          currency,
          currentValuedAt: parsed.data.valuedAt,
          purchaseDate: parsed.data.purchaseDate ?? null,
          purchasePrice: parsed.data.purchasePrice ?? null,
          purchaseCurrency,
          notes: parsed.data.notes ? null : undefined,
          notesEncrypted: encryptedNotes,
          userId: session.user.id,
        },
      });

      await tx.personalAssetValuation.create({
        data: {
          value: parsed.data.currentValue,
          currency,
          valuedAt: parsed.data.valuedAt,
          assetId: created.id,
          userId: session.user.id,
        },
      });

      return created;
    });

    revalidatePersonalAssetPaths();
    return { success: true, data: asset };
  } catch (error) {
    console.error("Create personal asset error:", error);
    return { success: false, error: "Failed to create personal asset" };
  }
}

export async function updatePersonalAsset(
  id: string,
  data: PersonalAssetUpdateInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existing = await prisma.personalAsset.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) return { success: false, error: "Asset not found" };

    const parsed = personalAssetUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const dateError = validateDates([parsed.data.purchaseDate]);
    if (dateError) return { success: false, error: dateError };

    const updateData: Prisma.PersonalAssetUpdateInput = {
      ...parsed.data,
      purchaseCurrency: parsed.data.purchaseCurrency
        ? normalizeCurrency(parsed.data.purchaseCurrency)
        : parsed.data.purchaseCurrency,
    };

    if (parsed.data.name !== undefined) {
      updateData.nameEncrypted = await encryptUserField(
        session.user.id,
        "personalAsset.name",
        parsed.data.name
      );
    }

    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes ? null : parsed.data.notes;
      updateData.notesEncrypted = parsed.data.notes
        ? await encryptUserField(session.user.id, "personalAsset.notes", parsed.data.notes)
        : null;
    }

    const asset = await prisma.personalAsset.update({
      where: { id },
      data: updateData,
    });

    revalidatePersonalAssetPaths();
    return { success: true, data: asset };
  } catch (error) {
    console.error("Update personal asset error:", error);
    return { success: false, error: "Failed to update personal asset" };
  }
}

export async function recordPersonalAssetValuation(
  id: string,
  data: PersonalAssetValuationInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = valuationSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    if (isFutureDate(parsed.data.valuedAt)) {
      return { success: false, error: "Valuation date cannot be in the future" };
    }

    const currency = normalizeCurrency(parsed.data.currency);
    const valuation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const asset = await tx.personalAsset.findFirst({
        where: { id, userId: session.user.id },
      });
      if (!asset) throw new Error("Asset not found");
      if (asset.disposedAt) throw new Error("Archived assets cannot be revalued");

      const created = await tx.personalAssetValuation.create({
        data: {
          value: parsed.data.value,
          currency,
          valuedAt: parsed.data.valuedAt,
          assetId: asset.id,
          userId: session.user.id,
        },
      });

      if (parsed.data.valuedAt >= asset.currentValuedAt) {
        await tx.personalAsset.update({
          where: { id: asset.id },
          data: {
            currentValue: created.value,
            currency: created.currency,
            currentValuedAt: created.valuedAt,
          },
        });
      }

      return created;
    });

    revalidatePersonalAssetPaths();
    return { success: true, data: valuation };
  } catch (error) {
    console.error("Record personal asset valuation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record valuation",
    };
  }
}

export async function archivePersonalAsset(id: string, data: { disposedAt: Date }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    if (isFutureDate(parsed.data.disposedAt)) {
      return { success: false, error: "Disposal date cannot be in the future" };
    }

    const result = await prisma.personalAsset.updateMany({
      where: { id, userId: session.user.id, disposedAt: null },
      data: { disposedAt: parsed.data.disposedAt },
    });
    if (result.count === 0) return { success: false, error: "Active asset not found" };

    revalidatePersonalAssetPaths();
    return { success: true };
  } catch (error) {
    console.error("Archive personal asset error:", error);
    return { success: false, error: "Failed to archive personal asset" };
  }
}

export async function restorePersonalAsset(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await prisma.personalAsset.updateMany({
      where: { id, userId: session.user.id, disposedAt: { not: null } },
      data: { disposedAt: null },
    });
    if (result.count === 0) return { success: false, error: "Archived asset not found" };

    revalidatePersonalAssetPaths();
    return { success: true };
  } catch (error) {
    console.error("Restore personal asset error:", error);
    return { success: false, error: "Failed to restore personal asset" };
  }
}

export async function deletePersonalAsset(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const asset = await prisma.personalAsset.findFirst({
      where: { id, userId: session.user.id },
      select: { disposedAt: true },
    });
    if (!asset) return { success: false, error: "Asset not found" };
    if (!asset.disposedAt) {
      return { success: false, error: "Archive the asset before deleting it permanently" };
    }

    await prisma.personalAsset.delete({ where: { id } });
    revalidatePersonalAssetPaths();
    return { success: true };
  } catch (error) {
    console.error("Delete personal asset error:", error);
    return { success: false, error: "Failed to delete personal asset" };
  }
}
