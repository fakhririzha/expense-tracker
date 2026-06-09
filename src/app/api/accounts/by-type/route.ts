import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  isAssetAccountType,
  isLiabilityAccountType,
  isLiquidAccountType,
  isLoanReceivableAccountType,
} from "@/lib/account-types";
import { NextResponse } from "next/server";

/**
 * Handle GET requests to fetch the authenticated user's active accounts grouped by type.
 *
 * @returns A JSON NextResponse containing active accounts grouped by common account roles for the authenticated user; returns a 401 JSON response with an error when the user is unauthorized, or a 500 JSON response with an error on failure.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    const bankAccounts = accounts.filter((account) => account.type === "BANK");
    const cashAccounts = accounts.filter((account) => account.type === "CASH");
    const liquidAccounts = accounts.filter((account) => isLiquidAccountType(account.type));
    const assetAccounts = accounts.filter((account) => isAssetAccountType(account.type));
    const liabilityAccounts = accounts.filter((account) => isLiabilityAccountType(account.type));
    const receivableAccounts = accounts.filter((account) =>
      isLoanReceivableAccountType(account.type)
    );

    return NextResponse.json({
      accounts,
      bankAccounts,
      cashAccounts,
      liquidAccounts,
      assetAccounts,
      liabilityAccounts,
      receivableAccounts,
    });
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
