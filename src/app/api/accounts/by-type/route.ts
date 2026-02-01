import { auth } from "@/auth";
import prisma from "@/lib/db";
import { NextResponse } from "next/server";

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
