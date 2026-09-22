import { decryptAccountRecords } from "@/lib/account-crypto";
import { type AccountTypeValue } from "@/lib/account-types";
import prisma from "@/lib/db";

export async function getAccountsForUser(
  userId: string,
  type?: AccountTypeValue
) {
  try {
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      include: { bankInterestSetting: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true as const,
      data: await decryptAccountRecords(userId, accounts),
    };
  } catch (error) {
    console.error("Get accounts error:", error);
    return { success: false as const, error: "Failed to fetch accounts", data: [] };
  }
}
