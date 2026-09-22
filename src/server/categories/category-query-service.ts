import prisma from "@/lib/db";

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

export async function getCategoriesForUser(
  userId: string,
  type?: "INCOME" | "EXPENSE"
) {
  try {
    const [categories, recurringCounts] = await Promise.all([
      prisma.category.findMany({
        where: {
          userId,
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
          userId,
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
      success: true as const,
      data: categories.map((category): CategoryListItem => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type as CategoryListItem["type"],
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
    return {
      success: false as const,
      error: "Failed to fetch categories",
      data: [] as CategoryListItem[],
    };
  }
}
