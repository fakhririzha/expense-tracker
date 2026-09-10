import { mobileUpdateTransactionSchema } from "@finhealth/contracts";
import { NextResponse } from "next/server";

import { authenticateMobileRequest } from "@/server/auth/mobile-session";
import { toMobileTransaction } from "@/server/mobile-api/transaction-dto";
import { getTransactionForUser } from "@/server/transactions/transaction-query-service";
import { revalidateTransactionPaths } from "@/server/transactions/transaction-revalidation";
import {
  deleteTransactionForUser,
  updateTransactionForUser,
} from "@/server/transactions/transaction-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadAuthorizedTransaction(request: Request, id: string) {
  const authenticated = await authenticateMobileRequest(request);
  if (!authenticated) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const transaction = await getTransactionForUser(authenticated.userId, id);
  if (!transaction.success) {
    return {
      response: NextResponse.json(
        { error: transaction.error },
        { status: transaction.error === "Transaction not found" ? 404 : 500 }
      ),
    };
  }

  return { authenticated, transaction: transaction.data };
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const loaded = await loadAuthorizedTransaction(request, id);
  if ("response" in loaded) return loaded.response;
  return NextResponse.json(toMobileTransaction(loaded.transaction));
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const loaded = await loadAuthorizedTransaction(request, id);
    if ("response" in loaded) return loaded.response;

    if (!loaded.transaction.capabilities.canEdit) {
      return NextResponse.json(
        {
          error:
            loaded.transaction.capabilities.reason ??
            "This transaction cannot be edited on mobile.",
        },
        { status: 409 }
      );
    }

    const parsed = mobileUpdateTransactionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid transaction" },
        { status: 400 }
      );
    }

    const update = await updateTransactionForUser(loaded.authenticated.userId, id, {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      description:
        parsed.data.description === null ? "" : parsed.data.description,
      location: parsed.data.location === null ? "" : parsed.data.location,
      toAccountId:
        parsed.data.toAccountId === null ? "" : parsed.data.toAccountId,
      categoryId:
        parsed.data.categoryId === null ? "" : parsed.data.categoryId,
    });
    if (!update.success) {
      return NextResponse.json({ error: update.error }, { status: 400 });
    }

    const detail = await getTransactionForUser(loaded.authenticated.userId, id);
    if (!detail.success) {
      return NextResponse.json({ error: detail.error }, { status: 500 });
    }
    revalidateTransactionPaths();
    return NextResponse.json(toMobileTransaction(detail.data));
  } catch (error) {
    console.error("Mobile update transaction error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const loaded = await loadAuthorizedTransaction(request, id);
    if ("response" in loaded) return loaded.response;

    if (!loaded.transaction.capabilities.canDelete) {
      return NextResponse.json(
        {
          error:
            loaded.transaction.capabilities.reason ??
            "This transaction cannot be deleted on mobile.",
        },
        { status: 409 }
      );
    }

    const result = await deleteTransactionForUser(
      loaded.authenticated.userId,
      id
    );
    if (!result.success) {
      const status =
        result.code === "INTERNAL_ERROR"
          ? 500
          : result.code === "NOT_FOUND"
            ? 404
            : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    revalidateTransactionPaths();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile delete transaction error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
