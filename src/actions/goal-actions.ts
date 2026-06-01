"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";

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

/**
 * Retrieve all savings goals belonging to the authenticated user, including each goal's basic account info.
 *
 * If the user is not authenticated the function returns a failure result with an empty `data` array.
 *
 * @returns An object with `success: true` and `data` containing an array of savings goals (each including its associated account `id`, `name`, and `currency`) on success; otherwise `success: false`, an `error` message, and `data` as an empty array.
 */
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

    // Decrypt sensitive fields
    const decryptedGoals = await Promise.all(
      goals.map(async (goal) => {
        // Use encrypted name if available, otherwise fall back to plaintext
        let finalName = goal.name;
        if (goal.nameEncrypted) {
          try {
            finalName = await decryptUserField(
              session.user.id,
              "savingsGoal.name",
              goal.nameEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        // Use encrypted description if available, otherwise fall back to plaintext
        let finalDescription = goal.description;
        if (goal.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "savingsGoal.description",
              goal.descriptionEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        return {
          ...goal,
          name: finalName,
          description: finalDescription,
        };
      })
    );

    return { success: true, data: decryptedGoals };
  } catch (error) {
    console.error("Get goals error:", error);
    return { success: false, error: "Failed to fetch goals", data: [] };
  }
}

/**
 * Fetches a savings goal by ID for the authenticated user.
 *
 * @param id - The ID of the savings goal to retrieve.
 * @returns An object with `success: true` and `data` containing the goal (including associated account info: `id`, `name`, `currency`) when found; otherwise `success: false` and `error` with a message.
 */
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

    // Decrypt sensitive fields
    let finalName = goal.name;
    if (goal.nameEncrypted) {
      try {
        finalName = await decryptUserField(
          session.user.id,
          "savingsGoal.name",
          goal.nameEncrypted
        );
      } catch {
        // Fall back to plaintext
      }
    }

    let finalDescription = goal.description;
    if (goal.descriptionEncrypted) {
      try {
        finalDescription = await decryptUserField(
          session.user.id,
          "savingsGoal.description",
          goal.descriptionEncrypted
        );
      } catch {
        // Fall back to plaintext
      }
    }

    return {
      success: true,
      data: {
        ...goal,
        name: finalName,
        description: finalDescription,
      },
    };
  } catch (error) {
    console.error("Get goal error:", error);
    return { success: false, error: "Failed to fetch goal" };
  }
}

/**
 * Create a new savings goal for the authenticated user.
 *
 * @param data - Goal fields validated against `goalSchema`; optional `accountId` must belong to the current user
 * @returns An object with `success: true` and the created goal under `data` on success; `success: false` and an `error` message on failure
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

    // Encrypt sensitive fields
    const encryptedName = restData.name
      ? await encryptUserField(session.user.id, "savingsGoal.name", restData.name)
      : null;
    
    const encryptedDescription = restData.description
      ? await encryptUserField(session.user.id, "savingsGoal.description", restData.description)
      : null;

    const goal = await prisma.savingsGoal.create({
      data: {
        ...restData,
        targetDate: validatedFields.data.targetDate || null,
        icon: validatedFields.data.icon || null,
        color: validatedFields.data.color || null,
        // Nullify optional plaintext after encryption
        description: validatedFields.data.description ? null : undefined,
        descriptionEncrypted: encryptedDescription,
        // Keep plaintext name (required field), also store encrypted
        nameEncrypted: encryptedName,
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

/**
 * Update an existing savings goal for the authenticated user.
 *
 * Validates input, ensures any provided `accountId` belongs to the user, computes the goal's completion status from the current and target amounts, updates the goal record, and revalidates dashboard caches.
 *
 * @param id - The ID of the goal to update
 * @param data - Partial goal fields to apply
 * @returns An object with `success: true` and the updated goal under `data` on success, or `success: false` and an `error` message on failure
 */
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

    // Encrypt sensitive fields if provided
    let encryptedName: string | null = null;
    let encryptedDescription: string | null = null;
    
    if (validatedFields.data.name) {
      encryptedName = await encryptUserField(session.user.id, "savingsGoal.name", validatedFields.data.name);
    }
    if (validatedFields.data.description !== undefined) {
      encryptedDescription = validatedFields.data.description
        ? await encryptUserField(session.user.id, "savingsGoal.description", validatedFields.data.description)
        : null;
    }

    const updateData: Record<string, unknown> = {
      ...validatedFields.data,
      accountId: sanitizedAccountId,
    };
    
    // If name is being updated, also store encrypted version
    if (validatedFields.data.name) {
      updateData.nameEncrypted = encryptedName;
    }
    // If description is being updated, nullify plaintext and store encrypted
    if (validatedFields.data.description !== undefined) {
      updateData.description = validatedFields.data.description ? null : undefined;
      updateData.descriptionEncrypted = encryptedDescription;
    }

    // Check if goal should be marked as completed
    const newCurrentAmount = validatedFields.data.currentAmount ?? existingGoal.currentAmount;
    const newTargetAmount = validatedFields.data.targetAmount ?? existingGoal.targetAmount;
    const isCompleted = newCurrentAmount >= newTargetAmount;

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        ...updateData,
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

/**
 * Delete a savings goal owned by the current user.
 *
 * @param id - The ID of the goal to delete
 * @returns `{ success: true }` on successful deletion; `{ success: false, error: string }` when unauthorized, the goal is not found, or deletion fails
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
 * Atomically adds a positive amount to a goal's currentAmount and updates its completion status.
 *
 * Performs the increment inside a transaction, updates the goal's `isCompleted` flag if needed,
 * and revalidates the dashboard cache paths.
 *
 * @param id - The ID of the goal to update
 * @param amount - A positive number to add to the goal's current amount
 * @returns An object with `success: true` and the updated goal (including `account` info) on success,
 *          or `success: false` and an `error` message on failure (e.g., "Unauthorized", "Amount must be positive", "Goal not found", or "Failed to add progress")
 */
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

/**
 * Withdraws a positive amount from the specified goal and updates its completion status.
 *
 * Revalidates dashboard caches and returns the updated goal including its `account` relation.
 *
 * @param id - The ID of the goal to withdraw from.
 * @param amount - The positive amount to subtract from the goal's `currentAmount`.
 * @returns The updated goal object (includes `account` with `id`, `name`, `currency`) on success; otherwise an error object with `success: false` and an `error` message such as `"Goal not found"` or `"Cannot withdraw more than current amount"`.
 */
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

/**
 * Retrieve all savings goals for the authenticated user, each augmented with progress metrics.
 *
 * Computes per-goal progress fields including `percentage` (capped at 100), `remaining`, `daysRemaining` (if a target date is set, clamped to zero), and `monthlyTarget` (estimated remaining per 30-day month when applicable).
 *
 * @returns An object where `success` is `true` and `data` is an array of `GoalWithProgress` on success; otherwise `success` is `false`, `error` contains a message, and `data` is an empty array.
 */
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

    // Decrypt sensitive fields for each goal
    const decryptedGoals = await Promise.all(
      goals.map(async (goal) => {
        let finalName = goal.name;
        if (goal.nameEncrypted) {
          try {
            finalName = await decryptUserField(
              session.user.id,
              "savingsGoal.name",
              goal.nameEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        let finalDescription = goal.description;
        if (goal.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "savingsGoal.description",
              goal.descriptionEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        return {
          ...goal,
          name: finalName,
          description: finalDescription,
        };
      })
    );

    const goalsWithProgress: GoalWithProgress[] = decryptedGoals.map((goal) => {
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

/**
 * Retrieve aggregate statistics for the current user's savings goals.
 *
 * @returns An object with `success: true` and a `data` object containing aggregate metrics when the operation succeeds; otherwise `success: false` and an `error` message.
 *
 * `data` fields:
 * - `totalSaved` - Sum of all goals' `currentAmount`.
 * - `totalTarget` - Sum of all goals' `targetAmount`.
 * - `inProgressCount` - Number of goals that are not completed.
 * - `completedCount` - Number of goals marked as completed.
 * - `totalGoals` - Total number of goals for the user.
 */
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