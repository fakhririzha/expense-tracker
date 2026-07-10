"use server";

import { auth } from "@/auth";
import { signOut } from "@/auth";
import prisma from "@/lib/db";
import { invalidateUserKey } from "@/lib/user-encryption";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const financialTargetsSchema = z.object({
  retirementTarget: z
    .number()
    .positive("Retirement target must be positive")
    .nullable(),
  monthlyBudget: z
    .number()
    .positive("Overall monthly spending limit must be positive")
    .nullable(),
});

export type FinancialTargetsInput = z.infer<typeof financialTargetsSchema>;

const deleteCurrentUserSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Current password is required"),
});

export type DeleteCurrentUserInput = z.infer<typeof deleteCurrentUserSchema>;

/**
 * Update the authenticated user's optional retirement target and overall monthly spending limit.
 *
 * Blank form values are submitted as null so users can remove a previously
 * configured target.
 */
export async function updateFinancialTargets(data: FinancialTargetsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = financialTargetsSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: validatedFields.data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { success: true };
  } catch (error) {
    console.error("Update financial targets error:", error);
    return { success: false, error: "Failed to update financial targets" };
  }
}

export async function deleteCurrentUser(data: DeleteCurrentUserInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = deleteCurrentUserSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const submittedEmail = validatedFields.data.email.trim().toLowerCase();
    const currentEmail = user.email.trim().toLowerCase();

    if (submittedEmail !== currentEmail) {
      return {
        success: false,
        error: "Entered email does not match your account",
      };
    }

    if (!user.password) {
      return {
        success: false,
        error: "This account cannot be deleted with password confirmation",
      };
    }

    const passwordMatches = await bcrypt.compare(
      validatedFields.data.password,
      user.password
    );

    if (!passwordMatches) {
      return { success: false, error: "Current password is incorrect" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: {
          identifier: user.email,
        },
      });

      await tx.user.delete({
        where: { id: user.id },
      });
    });

    invalidateUserKey(user.id);
    await signOut({
      redirectTo: "/login?accountDeleted=true",
      redirect: false,
    });

    return {
      success: true,
      data: {
        redirectTo: "/login?accountDeleted=true",
      },
    };
  } catch (error) {
    console.error("Delete current user error:", error);
    return { success: false, error: "Failed to delete account" };
  }
}
