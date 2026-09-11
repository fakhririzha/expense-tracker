import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, Text, View } from "react-native";

import { deleteTransaction, getTransaction } from "@/api/transactions";
import { ApiError } from "@/api/client";
import { Button, Card, ErrorState, LoadingState, OfflineBanner, Pill, ScreenScroll, SectionHeader } from "@/components/ui";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { formatMoney, formatTransactionDate, signedAmount, typeLabel } from "@/features/transactions/format";
import { colors, commonStyles, spacing, typeColor } from "@/theme/tokens";

function getTrustedMapsLink(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isGoogleMapsHost =
      url.hostname === "google.com" ||
      url.hostname.endsWith(".google.com") ||
      url.hostname === "maps.app.goo.gl";
    return url.protocol === "https:" && isGoogleMapsHost ? value : null;
  } catch {
    return null;
  }
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const query = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: () => getTransaction(transactionId),
    enabled: Boolean(transactionId),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteTransaction(transactionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.removeQueries({ queryKey: ["transaction", transactionId] });
      router.replace("/(tabs)/transactions");
    },
  });

  if (query.isLoading) return <View style={commonStyles.screen}><LoadingState label="Loading transaction…" /></View>;
  if (query.isError || !query.data) {
    return <View style={commonStyles.screen}><ErrorState message={query.error instanceof Error ? query.error.message : "Transaction not found."} onRetry={() => void query.refetch()} /></View>;
  }

  const transaction = query.data;
  const color = typeColor(transaction.type);
  const coordinateMapsLink = transaction.latitude !== null && transaction.longitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${transaction.latitude},${transaction.longitude}`
    : null;
  const mapsLink = coordinateMapsLink ?? getTrustedMapsLink(transaction.googleMapsLink);
  const openMaps = async () => {
    if (!mapsLink) return;
    try {
      await Linking.openURL(mapsLink);
    } catch {
      Alert.alert("Unable to open Maps", "Try again after checking your device settings.");
    }
  };
  const onDelete = () => {
    Alert.alert("Delete transaction?", "The original balance change will be reversed on the server.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Transaction" }} />
      <View style={commonStyles.screen}>
        <OfflineBanner isOnline={isOnline} />
        <ScreenScroll>
          <Card style={{ alignItems: "center", gap: spacing.md }}>
            <Pill label={typeLabel(transaction.type)} color={`${color}18`} textColor={color} />
            <Text selectable style={{ color, fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              {signedAmount(transaction.type, transaction.amount, transaction.currency)}
            </Text>
            <Text selectable style={commonStyles.subtitle}>{formatTransactionDate(transaction.date)}</Text>
          </Card>
          <Card style={{ gap: spacing.lg }}>
            <SectionHeader title="Details" />
            <DetailRow label="From account" value={transaction.account.name} />
            {transaction.toAccount ? <DetailRow label="Destination" value={transaction.toAccount.name} /> : null}
            {transaction.category ? <DetailRow label="Category" value={transaction.category.name} /> : null}
            <DetailRow label="Amount" value={formatMoney(transaction.amount, transaction.currency)} />
            <DetailRow label="Exchange rate" value={String(transaction.exchangeRate)} />
            {transaction.description ? <DetailRow label="Description" value={transaction.description} /> : null}
            {transaction.location ? <DetailRow label="Location" value={transaction.location} /> : null}
            {transaction.latitude !== null && transaction.longitude !== null ? (
              <DetailRow label="Coordinates" value={`${transaction.latitude.toFixed(6)}, ${transaction.longitude.toFixed(6)}`} />
            ) : null}
            {mapsLink ? <Button variant="secondary" onPress={() => void openMaps()}>Open in Maps</Button> : null}
            {transaction.splits.length > 0 ? (
              <View style={{ backgroundColor: colors.warningSoft, borderRadius: 10, padding: spacing.md }}>
                <Text selectable style={{ color: colors.warning, lineHeight: 20 }}>This transaction has itemized split details. Split editing is available on the web app.</Text>
              </View>
            ) : null}
          </Card>
          {!transaction.capabilities.canEdit && transaction.capabilities.reason ? (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>{transaction.capabilities.reason}</Text>
          ) : null}
          <View style={{ gap: spacing.md }}>
            {transaction.capabilities.canEdit ? <Button onPress={() => router.push(`/transaction/${transaction.id}/edit`)}>Edit transaction</Button> : null}
            {transaction.capabilities.canDelete ? <Button variant="danger" onPress={onDelete} loading={deleteMutation.isPending} disabled={!isOnline}>Delete transaction</Button> : null}
            {deleteMutation.error ? <Text selectable style={{ color: colors.danger }}>{deleteMutation.error instanceof ApiError ? deleteMutation.error.message : "Unable to delete transaction."}</Text> : null}
          </View>
        </ScreenScroll>
      </View>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={commonStyles.label}>{label}</Text>
      <Text selectable style={commonStyles.value}>{value}</Text>
    </View>
  );
}
