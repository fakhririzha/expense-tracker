"use server";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { isGoalSourceAccountType } from "@/lib/account-types";
import { computeGoalProgress } from "@/lib/goal-progress";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target must be positive"),
  targetDate: z.date().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  accountIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one account")
    .max(20, "A goal can link at most 20 accounts"),
});

export type GoalInput = z.infer<typeof goalSchema>;

export interface GoalAccountSummary {
  id: string;
  name: string;
  currency: string;
  balance: number;
  balanceInMain: number;
}

export interface GoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  description: string | null;
  isCompleted: boolean;
  accounts: GoalAccountSummary[];
  percentage: number;
  remaining: number;
  daysRemaining: number | null;
  monthlyTarget: number | null;
  mainCurrency: string;
}

const goalAccountInclude = {
  accounts: {
    include: {
      account: {
        select: {
          id: true,
          nameEncrypted: true,
          currency: true,
          balance: true,
          type: true,
          userId: true,
        },
      },
    },
  },
} as const;

type GoalAccountLink = {
  account: {
    id: string;
    nameEncrypted: string;
    currency: string;
    balance: number;
    type: string;
    userId: string;
  };
};

async function getUserMainCurrency(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mainCurrency: true },
  });
  return user?.mainCurrency || "IDR";
}

async function decryptGoalTextFields(
  userId: string,
  goal: {
    name: string;
    nameEncrypted: string | null;
    description: string | null;
    descriptionEncrypted: string | null;
  }
): Promise<{ name: string; description: string | null }> {
  let name = goal.name;
  if (goal.nameEncrypted) {
    try {
      name = await decryptUserField(userId, "savingsGoal.name", goal.nameEncrypted);
    } catch {
      // Fall back to plaintext
    }
  }

  let description = goal.description;
  if (goal.descriptionEncrypted) {
    try {
      description = await decryptUserField(
        userId,
        "savingsGoal.description",
        goal.descriptionEncrypted
      );
    } catch {
      // Fall back to plaintext
    }
  }

  return { name, description };
}

async function mapLinkedAccounts(
  userId: string,
  links: GoalAccountLink[],
  mainCurrency: string
): Promise<GoalAccountSummary[]> {
  const progress = await computeGoalProgress({
    targetAmount: 1,
    mainCurrency,
    accounts: links.map((link) => ({
      id: link.account.id,
      balance: link.account.balance,
      currency: link.account.currency,
    })),
  });

  const contributionById = new Map(
    progress.accounts.map((account) => [account.id, account])
  );

  return Promise.all(
    links.map(async (link) => {
      const contribution = contributionById.get(link.account.id);
      return {
        id: link.account.id,
        name: await decryptAccountName(userId, link.account.nameEncrypted),
        currency: link.account.currency,
        balance: link.account.balance,
        balanceInMain: contribution?.balanceInMain ?? 0,
      };
    })
  );
}

async function buildGoalWithProgress(
  userId: string,
  goal: {
    id: string;
    name: string;
    nameEncrypted: string | null;
    targetAmount: number;
    targetDate: Date | null;
    icon: string | null;
    color: string | null;
    description: string | null;
    descriptionEncrypted: string | null;
    accounts: GoalAccountLink[];
  },
  mainCurrency: string,
  now: Date = new Date()
): Promise<GoalWithProgress> {
  const { name, description } = await decryptGoalTextFields(userId, goal);
  const progress = await computeGoalProgress({
    targetAmount: goal.targetAmount,
    mainCurrency,
    accounts: goal.accounts.map((link) => ({
      id: link.account.id,
      balance: link.account.balance,
      currency: link.account.currency,
    })),
  });

  const accounts: GoalAccountSummary[] = await Promise.all(
    goal.accounts.map(async (link) => {
      const contribution = progress.accounts.find((a) => a.id === link.account.id);
      return {
        id: link.account.id,
        name: await decryptAccountName(userId, link.account.nameEncrypted),
        currency: link.account.currency,
        balance: link.account.balance,
        balanceInMain: contribution?.balanceInMain ?? 0,
      };
    })
  );

  let daysRemaining: number | null = null;
  if (goal.targetDate) {
    const diffTime = goal.targetDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  let monthlyTarget: number | null = null;
  if (goal.targetDate && daysRemaining !== null && daysRemaining > 0) {
    const monthsRemaining = daysRemaining / 30;
    monthlyTarget = progress.remaining / monthsRemaining;
  }

  return {
    id: goal.id,
    name,
    targetAmount: goal.targetAmount,
    currentAmount: progress.currentAmount,
    targetDate: goal.targetDate,
    icon: goal.icon,
    color: goal.color,
    description,
    isCompleted: progress.isCompleted,
    accounts,
    percentage: progress.percentage,
    remaining: progress.remaining,
    daysRemaining,
    monthlyTarget,
    mainCurrency,
  };
}

/**
 * Validate that every account ID belongs to the user and is an eligible goal source type.
 */
async function validateGoalAccounts(
  userId: string,
  accountIds: string[]
): Promise<{ success: true; accountIds: string[] } | { success: false; error: string }> {
  const uniqueIds = [...new Set(accountIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { success: false, error: "Select at least one account" };
  }

  const accounts = await prisma.financialAccount.findMany({
    where: {
      id: { in: uniqueIds },
      userId,
    },
    select: { id: true, type: true },
  });

  if (accounts.length !== uniqueIds.length) {
    return { success: false, error: "One or more accounts were not found" };
  }

  const invalid = accounts.find((account) => !isGoalSourceAccountType(account.type));
  if (invalid) {
    return {
      success: false,
      error: "Goals can only use Bank, Cash, Investment, or Deposito accounts",
    };
  }

  return { success: true, accountIds: uniqueIds };
}

/**
 * Retrieve all savings goals for the authenticated user with linked accounts (no progress metrics).
 */
export async function getGoals() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const mainCurrency = await getUserMainCurrency(session.user.id);
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: goalAccountInclude,
      orderBy: { createdAt: "desc" },
    });

    const data = await Promise.all(
      goals.map(async (goal) => {
        const { name, description } = await decryptGoalTextFields(
          session.user.id,
          goal
        );
        const accounts = await mapLinkedAccounts(
          session.user.id,
          goal.accounts,
          mainCurrency
        );
        return {
          ...goal,
          name,
          description,
          accounts,
        };
      })
    );

    return { success: true, data };
  } catch (error) {
    console.error("Get goals error:", error);
    return { success: false, error: "Failed to fetch goals", data: [] };
  }
}

/**
 * Fetches a savings goal by ID for the authenticated user.
 */
export async function getGoal(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const mainCurrency = await getUserMainCurrency(session.user.id);
    const goal = await prisma.savingsGoal.findFirst({
      where: { id, userId: session.user.id },
      include: goalAccountInclude,
    });

    if (!goal) {
      return { success: false, error: "Goal not found" };
    }

    const { name, description } = await decryptGoalTextFields(session.user.id, goal);
    const accounts = await mapLinkedAccounts(
      session.user.id,
      goal.accounts,
      mainCurrency
    );

    return {
      success: true,
      data: {
        ...goal,
        name,
        description,
        accounts,
      },
    };
  } catch (error) {
    console.error("Get goal error:", error);
    return { success: false, error: "Failed to fetch goal" };
  }
}

/**
 * Create a new savings goal with one or more linked account sources.
 */
export async function createGoal(data: GoalInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = goalSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const accountValidation = await validateGoalAccounts(
      session.user.id,
      validatedFields.data.accountIds
    );
    if (!accountValidation.success) {
      return { success: false, error: accountValidation.error };
    }

    const { name, targetAmount, targetDate, icon, color, description } =
      validatedFields.data;

    const encryptedName = name
      ? await encryptUserField(session.user.id, "savingsGoal.name", name)
      : null;

    const encryptedDescription = description
      ? await encryptUserField(
          session.user.id,
          "savingsGoal.description",
          description
        )
      : null;

    const mainCurrency = await getUserMainCurrency(session.user.id);

    const goal = await prisma.savingsGoal.create({
      data: {
        name,
        targetAmount,
        targetDate: targetDate || null,
        icon: icon || null,
        color: color || null,
        description: description ? null : undefined,
        descriptionEncrypted: encryptedDescription,
        nameEncrypted: encryptedName,
        userId: session.user.id,
        accounts: {
          create: accountValidation.accountIds.map((accountId) => ({
            accountId,
          })),
        },
      },
      include: goalAccountInclude,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    const withProgress = await buildGoalWithProgress(
      session.user.id,
      goal,
      mainCurrency
    );

    return { success: true, data: withProgress };
  } catch (error) {
    console.error("Create goal error:", error);
    return { success: false, error: "Failed to create goal" };
  }
}

/**
 * Update an existing savings goal and replace its linked account sources.
 */
export async function updateGoal(id: string, data: Partial<GoalInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = goalSchema.partial().safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const existingGoal = await prisma.savingsGoal.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingGoal) {
      return { success: false, error: "Goal not found" };
    }

    let validatedAccountIds: string[] | undefined;
    if (validatedFields.data.accountIds !== undefined) {
      const accountValidation = await validateGoalAccounts(
        session.user.id,
        validatedFields.data.accountIds
      );
      if (!accountValidation.success) {
        return { success: false, error: accountValidation.error };
      }
      validatedAccountIds = accountValidation.accountIds;
    }

    let encryptedName: string | null = null;
    let encryptedDescription: string | null = null;

    if (validatedFields.data.name) {
      encryptedName = await encryptUserField(
        session.user.id,
        "savingsGoal.name",
        validatedFields.data.name
      );
    }
    if (validatedFields.data.description !== undefined) {
      encryptedDescription = validatedFields.data.description
        ? await encryptUserField(
            session.user.id,
            "savingsGoal.description",
            validatedFields.data.description
          )
        : null;
    }

    const mainCurrency = await getUserMainCurrency(session.user.id);

    const goal = await prisma.$transaction(async (tx) => {
      if (validatedAccountIds) {
        await tx.savingsGoalAccount.deleteMany({ where: { goalId: id } });
        await tx.savingsGoalAccount.createMany({
          data: validatedAccountIds.map((accountId) => ({
            goalId: id,
            accountId,
          })),
        });
      }

      return tx.savingsGoal.update({
        where: { id },
        data: {
          ...(validatedFields.data.name !== undefined
            ? { name: validatedFields.data.name, nameEncrypted: encryptedName }
            : {}),
          ...(validatedFields.data.targetAmount !== undefined
            ? { targetAmount: validatedFields.data.targetAmount }
            : {}),
          ...(validatedFields.data.targetDate !== undefined
            ? { targetDate: validatedFields.data.targetDate || null }
            : {}),
          ...(validatedFields.data.icon !== undefined
            ? { icon: validatedFields.data.icon || null }
            : {}),
          ...(validatedFields.data.color !== undefined
            ? { color: validatedFields.data.color || null }
            : {}),
          ...(validatedFields.data.description !== undefined
            ? {
                description: validatedFields.data.description ? null : undefined,
                descriptionEncrypted: encryptedDescription,
              }
            : {}),
        },
        include: goalAccountInclude,
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    const withProgress = await buildGoalWithProgress(
      session.user.id,
      goal,
      mainCurrency
    );

    return { success: true, data: withProgress };
  } catch (error) {
    console.error("Update goal error:", error);
    return { success: false, error: "Failed to update goal" };
  }
}

/**
 * Delete a savings goal owned by the current user.
 */
export async function deleteGoal(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const goal = await prisma.savingsGoal.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!goal) {
      return { success: false, error: "Goal not found" };
    }

    await prisma.savingsGoal.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    return { success: true };
  } catch (error) {
    console.error("Delete goal error:", error);
    return { success: false, error: "Failed to delete goal" };
  }
}

/**
 * Retrieve all savings goals with live progress derived from linked account balances.
 */
export async function getGoalsSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const mainCurrency = await getUserMainCurrency(session.user.id);
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: goalAccountInclude,
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const goalsWithProgress = await Promise.all(
      goals.map((goal) =>
        buildGoalWithProgress(session.user.id, goal, mainCurrency, now)
      )
    );

    return { success: true, data: goalsWithProgress };
  } catch (error) {
    console.error("Get goals summary error:", error);
    return { success: false, error: "Failed to fetch goals summary", data: [] };
  }
}

/**
 * Retrieve aggregate statistics for the current user's savings goals (live balances).
 */
export async function getGoalsStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const mainCurrency = await getUserMainCurrency(session.user.id);
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: goalAccountInclude,
    });

    let totalSaved = 0;
    let totalTarget = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    for (const goal of goals) {
      const progress = await computeGoalProgress({
        targetAmount: goal.targetAmount,
        mainCurrency,
        accounts: goal.accounts.map((link) => ({
          id: link.account.id,
          balance: link.account.balance,
          currency: link.account.currency,
        })),
      });

      totalSaved += progress.currentAmount;
      totalTarget += goal.targetAmount;
      if (progress.isCompleted) {
        completedCount += 1;
      } else {
        inProgressCount += 1;
      }
    }

    return {
      success: true,
      data: {
        totalSaved,
        totalTarget,
        inProgressCount,
        completedCount,
        totalGoals: goals.length,
      },
    };
  } catch (error) {
    console.error("Get goals stats error:", error);
    return { success: false, error: "Failed to fetch goals statistics" };
  }
}
