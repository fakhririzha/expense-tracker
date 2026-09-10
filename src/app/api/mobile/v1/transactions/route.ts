import {
  mobileCreateTransactionSchema,
  transactionListQuerySchema,
} from "@finhealth/contracts";
import { NextResponse } from "next/server";

import { authenticateMobileRequest } from "@/server/auth/mobile-session";
import { toMobileTransaction } from "@/server/mobile-api/transaction-dto";
import {
  getTransactionForUser,
  getTransactionsForUser,
} from "@/server/transactions/transaction-query-service";
import { revalidateTransactionPaths } from "@/server/transactions/transaction-revalidation";
import { createTransactionForUser } from "@/server/transactions/transaction-service";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = transactionListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }

    const result = await getTransactionsForUser(authenticated.userId, {
      ...parsed.data,
      startDate: parsed.data.startDate
        ? new Date(parsed.data.startDate)
        : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ...result.data,
      transactions: result.data.transactions.map((transaction) =>
        toMobileTransaction(transaction)
      ),
    });
  } catch (error) {
    console.error("Mobile transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = mobileCreateTransactionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid transaction" },
        { status: 400 }
      );
    }

    const result = await createTransactionForUser(authenticated.userId, {
      ...parsed.data,
      date: new Date(parsed.data.date),
      description: parsed.data.description ?? undefined,
      location: parsed.data.location ?? undefined,
      toAccountId: parsed.data.toAccountId ?? undefined,
      categoryId: parsed.data.categoryId ?? undefined,
      isRecurring: false,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const detail = await getTransactionForUser(
      authenticated.userId,
      result.data.id
    );
    if (!detail.success) {
      return NextResponse.json({ error: detail.error }, { status: 500 });
    }

    revalidateTransactionPaths();
    return NextResponse.json(toMobileTransaction(detail.data), { status: 201 });
  } catch (error) {
    console.error("Mobile create transaction error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
