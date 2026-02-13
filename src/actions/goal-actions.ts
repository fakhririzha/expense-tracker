"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Schema for goal validation
const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target must be positive"),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.date().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
});

export type GoalInput = z.infer<typeof goalSchema>;

// Type for goal with progress
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
  accountId: string | null;
  account: {
    id: string;
    name: string;
    currency: string;
  } | null;
  percentage: number;
  remaining: number;
  daysRemaining: number | null;
  monthlyTarget: number | null;
}

// Get all goals for the current user
export async function getGoals() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: goals };
  } catch (error) {
    console.error("Get goals error:", error);
    return { success: false, error: "Failed to fetch goals", data: [] };
  }
}

// Get a single goal by ID
export async function getGoal(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const goal = await prisma.savingsGoal.findFirst({
      where: { id, userId: session.user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!goal) {
      return { success: false, error: "Goal not found" };
    }

    return { success: true, data: goal };
  } catch (error) {
    console.error("Get goal error:", error);
    return { success: false, error: "Failed to fetch goal" };
  }
}

// Create a new goal
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

    // Validate account belongs to user (IDOR prevention)
    const { accountId, ...restData } = validatedFields.data;
    if (accountId) {
      const account = await prisma.financialAccount.findFirst({
        where: {
          id: accountId,
          userId: session.user.id,
        },
      });
      if (!account) {
        return { success: false, error: "Account not found" };
      }
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        ...restData,
        targetDate: validatedFields.data.targetDate || null,
        icon: validatedFields.data.icon || null,
        color: validatedFields.data.color || null,
        description: validatedFields.data.description || null,
        accountId: accountId?.trim() || null,
        userId: session.user.id,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    return { success: true, data: goal };
  } catch (error) {
    console.error("Create goal error:", error);
    return { success: false, error: "Failed to create goal" };
  }
}

// Update an existing goal
export async function updateGoal(id: string, data: Partial<GoalInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input with schema
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

    // Validate account belongs to user (IDOR prevention)
    const sanitizedAccountId = validatedFields.data.accountId?.trim() || null;
    if (sanitizedAccountId) {
      const account = await prisma.financialAccount.findFirst({
        where: {
          id: sanitizedAccountId,
          userId: session.user.id,
        },
      });
      if (!account) {
        return { success: false, error: "Account not found" };
      }
    }

    // Check if goal should be marked as completed
    const newCurrentAmount = validatedFields.data.currentAmount ?? existingGoal.currentAmount;
    const newTargetAmount = validatedFields.data.targetAmount ?? existingGoal.targetAmount;
    const isCompleted = newCurrentAmount >= newTargetAmount;

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        ...validatedFields.data,
        accountId: sanitizedAccountId,
        isCompleted,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    return { success: true, data: goal };
  } catch (error) {
    console.error("Update goal error:", error);
    return { success: false, error: "Failed to update goal" };
  }
}

// Delete a goal
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

// Add progress to a goal
export async function addProgress(id: string, amount: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    // Use transaction to prevent race conditions
    const updatedGoal = await prisma.$transaction(async (tx) => {
      // Fetch goal and validate within transaction
      const goal = await tx.savingsGoal.findFirst({
        where: { id, userId: session.user.id },
      });

      if (!goal) {
        throw new Error("Goal not found");
      }

      // Use atomic increment for currentAmount
      const updated = await tx.savingsGoal.update({
        where: { id, userId: session.user.id },
        data: {
          currentAmount: { increment: amount },
        },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      });

      // Calculate and set isCompleted after atomic change
      const isCompleted = updated.currentAmount >= goal.targetAmount;
      if (isCompleted !== goal.isCompleted) {
        await tx.savingsGoal.update({
          where: { id },
          data: { isCompleted },
        });
        updated.isCompleted = isCompleted;
      }

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    return { success: true, data: updatedGoal };
  } catch (error) {
    console.error("Add progress error:", error);
    if (error instanceof Error && error.message === "Goal not found") {
      return { success: false, error: "Goal not found" };
    }
    return { success: false, error: "Failed to add progress" };
  }
}

// Withdraw progress from a goal
export async function withdrawProgress(id: string, amount: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    // Use transaction to prevent race conditions
    const updatedGoal = await prisma.$transaction(async (tx) => {
      // Fetch goal and validate within transaction
      const goal = await tx.savingsGoal.findFirst({
        where: { id, userId: session.user.id },
      });

      if (!goal) {
        throw new Error("Goal not found");
      }

      if (amount > goal.currentAmount) {
        throw new Error("Cannot withdraw more than current amount");
      }

      // Use atomic decrement for currentAmount
      const updated = await tx.savingsGoal.update({
        where: { id, userId: session.user.id },
        data: {
          currentAmount: { decrement: amount },
        },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      });

      // Calculate and set isCompleted after atomic change
      const isCompleted = updated.currentAmount >= goal.targetAmount;
      if (isCompleted !== goal.isCompleted) {
        await tx.savingsGoal.update({
          where: { id },
          data: { isCompleted },
        });
        updated.isCompleted = isCompleted;
      }

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/goals");

    return { success: true, data: updatedGoal };
  } catch (error) {
    console.error("Withdraw progress error:", error);
    if (error instanceof Error) {
      if (error.message === "Goal not found") {
        return { success: false, error: "Goal not found" };
      }
      if (error.message === "Cannot withdraw more than current amount") {
        return { success: false, error: "Cannot withdraw more than current amount" };
      }
    }
    return { success: false, error: "Failed to withdraw progress" };
  }
}

// Get all goals with their progress
export async function getGoalsSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    const goalsWithProgress: GoalWithProgress[] = goals.map((goal) => {
      const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
      const remaining = goal.targetAmount - goal.currentAmount;

      // Calculate days remaining
      let daysRemaining: number | null = null;
      if (goal.targetDate) {
        const diffTime = goal.targetDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      // Calculate monthly target
      let monthlyTarget: number | null = null;
      if (goal.targetDate && daysRemaining !== null && daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30;
        monthlyTarget = remaining / monthsRemaining;
      }

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
        icon: goal.icon,
        color: goal.color,
        description: goal.description,
        isCompleted: goal.isCompleted,
        accountId: goal.accountId,
        account: goal.account,
        percentage: Math.min(percentage, 100),
        remaining,
        daysRemaining,
        monthlyTarget,
      };
    });

    return { success: true, data: goalsWithProgress };
  } catch (error) {
    console.error("Get goals summary error:", error);
    return { success: false, error: "Failed to fetch goals summary", data: [] };
  }
}

// Get goals statistics
export async function getGoalsStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      select: {
        currentAmount: true,
        targetAmount: true,
        isCompleted: true,
      },
    });

    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const inProgressCount = goals.filter((g) => !g.isCompleted).length;
    const completedCount = goals.filter((g) => g.isCompleted).length;

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
