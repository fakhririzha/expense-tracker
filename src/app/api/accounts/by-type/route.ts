import { auth } from "@/auth";
import prisma from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Handle GET requests to fetch the authenticated user's active accounts grouped by type.
 *
 * @returns A JSON NextResponse containing `bankAccounts` (active BANK accounts ordered by name) and `liabilityAccounts` (active LOAN and CREDIT_CARD accounts ordered by name) for the authenticated user; returns a 401 JSON response with an error when the user is unauthorized, or a 500 JSON response with an error on failure.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [bankAccounts, liabilityAccounts] = await Promise.all([
      // Fetch active BANK accounts
      prisma.financialAccount.findMany({
        where: {
          userId: session.user.id,
          type: "BANK",
          isActive: true,
        },
        orderBy: { name: "asc" },
      }),
      // Fetch active LOAN and CREDIT_CARD accounts
      prisma.financialAccount.findMany({
        where: {
          userId: session.user.id,
          type: {
            in: ["LOAN", "CREDIT_CARD"],
          },
          isActive: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      bankAccounts,
      liabilityAccounts,
    });
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}