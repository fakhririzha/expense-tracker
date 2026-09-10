import { NextResponse } from "next/server";

import {
  decryptAccountRecords,
  sortAccountsByName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { authenticateMobileRequest } from "@/server/auth/mobile-session";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: authenticated.userId },
      select: {
        id: true,
        nameEncrypted: true,
        type: true,
        currency: true,
        balance: true,
        isActive: true,
      },
    });
    const decrypted = sortAccountsByName(
      await decryptAccountRecords(authenticated.userId, accounts)
    );

    return NextResponse.json({
      accounts: decrypted.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: account.balance,
        isActive: account.isActive,
      })),
    });
  } catch (error) {
    console.error("Mobile accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
