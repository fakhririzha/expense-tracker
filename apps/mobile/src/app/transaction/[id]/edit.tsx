import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { getTransaction } from "@/api/transactions";
import { ErrorState, LoadingState, ScreenScroll } from "@/components/ui";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { colors, commonStyles } from "@/theme/tokens";

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const query = useQuery({ queryKey: ["transaction", transactionId], queryFn: () => getTransaction(transactionId), enabled: Boolean(transactionId) });

  if (query.isLoading) return <View style={commonStyles.screen}><LoadingState label="Loading transaction…" /></View>;
  if (query.isError || !query.data) return <View style={commonStyles.screen}><ErrorState message={query.error instanceof Error ? query.error.message : "Transaction not found."} onRetry={() => void query.refetch()} /></View>;
  if (!query.data.capabilities.canEdit) {
    return <View style={commonStyles.screen}><Text selectable style={{ color: colors.text, padding: 24 }}>{query.data.capabilities.reason ?? "This transaction cannot be edited on mobile."}</Text></View>;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit transaction" }} />
      <ScreenScroll>
        <TransactionForm mode="edit" transaction={query.data} onSaved={(transaction) => router.replace(`/transaction/${transaction.id}`)} />
      </ScreenScroll>
    </>
  );
}
