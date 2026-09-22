import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { accountKeys, categoryKeys } from "@/hooks/query-keys";
import { getAccountsForUser } from "@/server/accounts/account-query-service";
import { getCategoriesForUser } from "@/server/categories/category-query-service";

export default async function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const queryClient = new QueryClient();
  const [accountsResult, categoriesResult] = await Promise.all([
    getAccountsForUser(session.user.id),
    getCategoriesForUser(session.user.id),
  ]);

  if (accountsResult.success) {
    queryClient.setQueryData(accountKeys.list(), accountsResult.data);
  }

  if (categoriesResult.success) {
    queryClient.setQueryData(categoryKeys.list(), categoriesResult.data);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
