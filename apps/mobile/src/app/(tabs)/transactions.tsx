import type { MobileTransactionListItem } from "@finhealth/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { getTransactions } from "@/api/transactions";
import { Button, EmptyState, ErrorState, LoadingState, OfflineBanner, Pill } from "@/components/ui";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { formatTransactionDate, signedAmount, typeLabel } from "@/features/transactions/format";
import { colors, commonStyles, radii, spacing, typeColor } from "@/theme/tokens";

const PAGE_SIZE = 25;

function TransactionRow({ transaction }: { transaction: MobileTransactionListItem }) {
  const router = useRouter();
  const amountColor = typeColor(transaction.type);
  const title = transaction.description?.trim() || transaction.category?.name || typeLabel(transaction.type);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/transaction/${transaction.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowMain}>
        <View style={[styles.typeDot, { backgroundColor: amountColor }]} />
        <View style={styles.rowText}>
          <Text selectable numberOfLines={1} style={styles.rowTitle}>{title}</Text>
          <Text selectable numberOfLines={1} style={styles.rowMeta}>
            {transaction.account.name}
            {transaction.type === "TRANSFER" && transaction.toAccount ? ` → ${transaction.toAccount.name}` : ""}
            {transaction.category ? ` · ${transaction.category.name}` : ""}
          </Text>
          <Text selectable style={styles.rowDate}>{formatTransactionDate(transaction.date)}</Text>
        </View>
      </View>
      <View style={styles.rowAmount}>
        <Text selectable style={[styles.amount, { color: amountColor }]}>{signedAmount(transaction.type, transaction.amount, transaction.currency)}</Text>
        <Pill label={typeLabel(transaction.type)} color={`${amountColor}18`} textColor={amountColor} />
      </View>
    </Pressable>
  );
}

function SkeletonRows() {
  return (
    <View style={styles.skeletons}>
      {[0, 1, 2, 3].map((item) => <View key={item} style={styles.skeleton} />)}
    </View>
  );
}

export default function TransactionsScreen() {
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const query = useInfiniteQuery({
    queryKey: ["transactions", { pageSize: PAGE_SIZE }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getTransactions({ page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
  const transactions = query.data?.pages.flatMap((page) => page.transactions) ?? [];

  if (query.isLoading) {
    return <View style={commonStyles.screen}><OfflineBanner isOnline={isOnline} /><LoadingState label="Loading your activity…" /></View>;
  }
  if (query.isError && transactions.length === 0) {
    return (
      <View style={commonStyles.screen}>
        <OfflineBanner isOnline={isOnline} />
        <ErrorState message={query.error instanceof Error ? query.error.message : "Unable to load transactions."} onRetry={() => void query.refetch()} />
      </View>
    );
  }

  return (
    <View style={commonStyles.screen}>
      <OfflineBanner isOnline={isOnline} />
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Text selectable style={commonStyles.title}>Activity</Text>
              <Text selectable style={commonStyles.subtitle}>Your latest money movements.</Text>
            </View>
            <Link href="/transaction/new" asChild>
              <Pressable accessibilityRole="button" style={styles.addButton}>
                <Text selectable style={styles.addButtonText}>＋ Add transaction</Text>
              </Pressable>
            </Link>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No transactions yet"
            description="Add your first income, expense, or transfer to get started."
            action={<Button onPress={() => router.push("/transaction/new")}>Add transaction</Button>}
          />
        }
        ListFooterComponent={query.isFetchingNextPage ? <SkeletonRows /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  headerTitle: { gap: spacing.xs },
  addButton: { alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  row: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
  rowMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.md, minWidth: 0 },
  typeDot: { borderRadius: 999, height: 10, width: 10 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  rowDate: { color: colors.textMuted, fontSize: 11 },
  rowAmount: { alignItems: "flex-end", gap: spacing.xs, marginLeft: spacing.sm },
  amount: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.7 },
  skeletons: { gap: spacing.sm, padding: spacing.lg },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, height: 82 },
});
