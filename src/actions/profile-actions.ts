"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const financialTargetsSchema = z.object({
  retirementTarget: z
    .number()
    .positive("Retirement target must be positive")
    .nullable(),
  monthlyBudget: z
    .number()
    .positive("Monthly budget target must be positive")
    .nullable(),
});

export type FinancialTargetsInput = z.infer<typeof financialTargetsSchema>;

/**
 * Update the authenticated user's optional retirement and monthly budget targets.
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
