"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().optional(),
  color: z.string().optional(),
  isSystem: z.boolean().optional().default(false),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export interface CategoryListItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "INCOME" | "EXPENSE";
  isSystem: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactionCount: number;
  budgetCount: number;
  recurringRuleCount: number;
}

function normalizeOptionalText(value?: string | null) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

async function assertAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Unauthorized" };
  }

  return { success: true as const, userId: session.user.id };
}

export async function getCategories(type?: "INCOME" | "EXPENSE") {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error, data: [] as CategoryListItem[] };
    }

    const [categories, recurringCounts] = await Promise.all([
      prisma.category.findMany({
        where: {
          userId: authResult.userId,
          ...(type ? { type } : {}),
        },
        orderBy: [
          { type: "asc" },
          { name: "asc" },
        ],
        include: {
          _count: {
            select: {
              transactions: true,
              budgetCategories: true,
            },
          },
        },
      }),
      prisma.recurringRule.groupBy({
        by: ["categoryId"],
        where: {
          userId: authResult.userId,
          categoryId: { not: null },
        },
        _count: {
          categoryId: true,
        },
      }),
    ]);

    const recurringCountMap = new Map<string, number>(
      recurringCounts
        .filter((row) => row.categoryId !== null)
        .map((row) => [row.categoryId as string, row._count.categoryId])
    );

    return {
      success: true,
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        isSystem: category.isSystem,
        userId: category.userId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        transactionCount: category._count.transactions,
        budgetCount: category._count.budgetCategories,
        recurringRuleCount: recurringCountMap.get(category.id) ?? 0,
      })),
    };
  } catch (error) {
    console.error("Get categories error:", error);
    return { success: false, error: "Failed to fetch categories", data: [] as CategoryListItem[] };
  }
}

export async function createCategory(data: CategoryInput) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const validatedFields = categorySchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const trimmedName = validatedFields.data.name.trim();
    if (!trimmedName) {
      return { success: false, error: "Name is required" };
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        type: validatedFields.data.type,
        icon: normalizeOptionalText(validatedFields.data.icon) ?? null,
        color: normalizeOptionalText(validatedFields.data.color) ?? null,
        isSystem: validatedFields.data.isSystem ?? false,
        userId: authResult.userId,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true, data: category };
  } catch (error) {
    console.error("Create category error:", error);
    return { success: false, error: "Failed to create category" };
  }
}

export async function updateCategory(id: string, data: Partial<CategoryInput>) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: authResult.userId },
    });

    if (!existingCategory) {
      return { success: false, error: "Category not found" };
    }

    const validatedFields = categorySchema.partial().safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    if (validatedFields.data.name !== undefined && !validatedFields.data.name.trim()) {
      return { success: false, error: "Name is required" };
    }

    const updateData: Record<string, unknown> = {
      ...validatedFields.data,
    };

    if (validatedFields.data.name !== undefined) {
      updateData.name = validatedFields.data.name.trim();
    }

    if (validatedFields.data.icon !== undefined) {
      updateData.icon = normalizeOptionalText(validatedFields.data.icon) ?? null;
    }

    if (validatedFields.data.color !== undefined) {
      updateData.color = normalizeOptionalText(validatedFields.data.color) ?? null;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true, data: category };
  } catch (error) {
    console.error("Update category error:", error);
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    const authResult = await assertAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: authResult.userId },
    });

    if (!existingCategory) {
      return { success: false, error: "Category not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.recurringRule.updateMany({
        where: {
          userId: authResult.userId,
          categoryId: id,
        },
        data: {
          categoryId: null,
        },
      });

      await tx.category.delete({
        where: { id },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/dashboard/recurring");
    revalidatePath("/dashboard/reports");

    return { success: true };
  } catch (error) {
    console.error("Delete category error:", error);
    return { success: false, error: "Failed to delete category" };
  }
}
