import { Stack, useRouter } from "expo-router";

import { TransactionForm } from "@/features/transactions/transaction-form";
import { ScreenScroll } from "@/components/ui";

export default function NewTransactionScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: "New transaction" }} />
      <ScreenScroll>
        <TransactionForm mode="create" onSaved={(transaction) => router.replace(`/transaction/${transaction.id}`)} />
      </ScreenScroll>
    </>
  );
}
