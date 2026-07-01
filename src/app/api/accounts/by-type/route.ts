import { auth } from "@/auth";
import { decryptAccountRecords, sortAccountsByName } from "@/lib/account-crypto";
import prisma from "@/lib/db";
import {
  isDepositoAccountType,
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
    });
    const decryptedAccounts = sortAccountsByName(
      await decryptAccountRecords(session.user.id, accounts)
    );

    const bankAccounts = decryptedAccounts.filter((account) => account.type === "BANK");
    const cashAccounts = decryptedAccounts.filter((account) => account.type === "CASH");
    const liquidAccounts = decryptedAccounts.filter((account) =>
      isLiquidAccountType(account.type)
    );
    const assetAccounts = decryptedAccounts.filter((account) =>
      isAssetAccountType(account.type)
    );
    const liabilityAccounts = decryptedAccounts.filter((account) =>
      isLiabilityAccountType(account.type)
    );
    const receivableAccounts = decryptedAccounts.filter((account) =>
      isLoanReceivableAccountType(account.type)
    );
    const depositoAccounts = decryptedAccounts.filter((account) =>
      isDepositoAccountType(account.type)
    );

    return NextResponse.json({
      accounts: decryptedAccounts,
      bankAccounts,
      cashAccounts,
      liquidAccounts,
      assetAccounts,
      liabilityAccounts,
      receivableAccounts,
      depositoAccounts,
    });
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
