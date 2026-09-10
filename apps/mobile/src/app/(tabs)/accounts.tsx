import type { MobileAccount } from "@finhealth/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { getAccounts } from "@/api/accounts";
import { ApiError } from "@/api/client";
import { getMe } from "@/api/auth";
import { Button, Card, ErrorState, LoadingState, OfflineBanner, Pill, ScreenScroll, SectionHeader } from "@/components/ui";
import { useAuth } from "@/auth/auth-provider";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { formatMoney } from "@/features/transactions/format";
import { colors, commonStyles, spacing, typeColor } from "@/theme/tokens";

function typeLabel(type: MobileAccount["type"]) {
  return type.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());
}

function AccountCard({ account }: { account: MobileAccount }) {
  return (
    <Card style={{ gap: spacing.sm, opacity: account.isActive ? 1 : 0.65 }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={commonStyles.sectionTitle}>{account.name}</Text>
          <Text selectable style={commonStyles.subtitle}>{typeLabel(account.type)} · {account.currency}</Text>
        </View>
        <Pill label={account.isActive ? "Active" : "Inactive"} color={account.isActive ? colors.primarySoft : colors.surfaceMuted} textColor={account.isActive ? colors.primary : colors.textMuted} />
      </View>
      <Text selectable style={{ color: typeColor(account.type === "LOAN" || account.type === "CREDIT_CARD" ? "EXPENSE" : "INCOME"), fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {formatMoney(account.balance, account.currency)}
      </Text>
    </Card>
  );
}

export default function AccountsScreen() {
  const { user, signOut } = useAuth();
  const isOnline = useNetworkStatus();
  const [loggingOut, setLoggingOut] = useState(false);
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const meQuery = useQuery({ queryKey: ["me"], queryFn: getMe, initialData: user ?? undefined });

  const confirmLogout = () => {
    Alert.alert("Sign out?", "You can sign back in with your FinHealth credentials.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => {
        setLoggingOut(true);
        void signOut().catch((error) => {
          setLoggingOut(false);
          Alert.alert("Unable to sign out", error instanceof ApiError ? error.message : "Try again.");
        });
      } },
    ]);
  };

  if (accountsQuery.isLoading) return <View style={commonStyles.screen}><OfflineBanner isOnline={isOnline} /><LoadingState label="Loading accounts…" /></View>;
  if (accountsQuery.isError) return <View style={commonStyles.screen}><OfflineBanner isOnline={isOnline} /><ErrorState message={accountsQuery.error instanceof Error ? accountsQuery.error.message : "Unable to load accounts."} onRetry={() => void accountsQuery.refetch()} /></View>;

  return (
    <ScreenScroll>
      <OfflineBanner isOnline={isOnline} />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={commonStyles.title}>Accounts</Text>
        <Text selectable style={commonStyles.subtitle}>Balances are always refreshed from FinHealth.</Text>
      </View>
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Your accounts" />
        {(accountsQuery.data?.accounts ?? []).map((account) => <AccountCard key={account.id} account={account} />)}
      </View>
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="Signed in" />
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={commonStyles.value}>{meQuery.data?.name || "FinHealth user"}</Text>
          <Text selectable style={commonStyles.subtitle}>{meQuery.data?.email ?? user?.email ?? ""}</Text>
          <Text selectable style={commonStyles.subtitle}>Base currency: {meQuery.data?.mainCurrency ?? user?.mainCurrency ?? "—"}</Text>
        </View>
        <Button variant="secondary" onPress={confirmLogout} loading={loggingOut} disabled={!isOnline}>Sign out</Button>
      </Card>
    </ScreenScroll>
  );
}
