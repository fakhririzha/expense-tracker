import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { transactionKeys } from "@/hooks/query-keys";
import { normalizeTransactionListQueryParams } from "@/lib/transaction-list-query-params";
import { getTransactionsForUser } from "@/server/transactions/transaction-query-service";

import { TransactionsPageClient } from "./TransactionsPageClient";

interface TransactionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const queryParams = normalizeTransactionListQueryParams(resolvedSearchParams);
  const transactionResult = await getTransactionsForUser(
    session.user.id,
    queryParams
  );
  const queryClient = new QueryClient();

  if (transactionResult.success) {
    queryClient.setQueryData(
      transactionKeys.list(queryParams),
      transactionResult.data
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TransactionsPageClient />
    </HydrationBoundary>
  );
}
