import type { MobileAccount } from "@finhealth/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";

import { getAccounts } from "@/api/accounts";
import { ApiError } from "@/api/client";
import { getMe } from "@/api/auth";
import { getDashboard } from "@/api/dashboard";
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

function SummaryMetric({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text selectable style={commonStyles.label}>{label}</Text>
      <Text selectable style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function AccountsScreen() {
  const { user, signOut } = useAuth();
  const isOnline = useNetworkStatus();
  const [loggingOut, setLoggingOut] = useState(false);
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
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

  const dashboard = dashboardQuery.data;
  const refreshAll = async () => {
    await Promise.all([accountsQuery.refetch(), dashboardQuery.refetch(), meQuery.refetch()]);
  };

  return (
    <ScreenScroll
      refreshControl={
        <RefreshControl
          refreshing={accountsQuery.isRefetching || dashboardQuery.isRefetching}
          onRefresh={() => void refreshAll()}
          tintColor={colors.primary}
        />
      }>
      <OfflineBanner isOnline={isOnline} />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={commonStyles.title}>Accounts</Text>
        <Text selectable style={commonStyles.subtitle}>Balances are always refreshed from FinHealth.</Text>
      </View>
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="Account summary" />
        {dashboard ? (
          <View style={styles.summaryGrid}>
            <SummaryMetric
              label="Net worth"
              value={dashboard.position.netWorth === null ? "Unavailable" : formatMoney(dashboard.position.netWorth, dashboard.displayCurrency)}
              color={dashboard.position.netWorth !== null && dashboard.position.netWorth < 0 ? colors.expense : colors.primary}
            />
            <SummaryMetric
              label="Total assets"
              value={dashboard.position.totalAssets === null ? "Unavailable" : formatMoney(dashboard.position.totalAssets, dashboard.displayCurrency)}
              color={colors.income}
            />
            <SummaryMetric
              label="Liquid funds"
              value={dashboard.position.liquidFunds === null ? "Unavailable" : formatMoney(dashboard.position.liquidFunds, dashboard.displayCurrency)}
            />
            <SummaryMetric
              label="Total debt"
              value={dashboard.position.totalDebt === null ? "Unavailable" : formatMoney(dashboard.position.totalDebt, dashboard.displayCurrency)}
              color={colors.expense}
            />
          </View>
        ) : dashboardQuery.isError ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={commonStyles.subtitle}>The account summary is temporarily unavailable.</Text>
            <Button variant="ghost" onPress={() => void dashboardQuery.refetch()}>Retry summary</Button>
          </View>
        ) : (
          <Text selectable style={commonStyles.subtitle}>Calculating your financial position…</Text>
        )}
        {dashboard?.valuationWarning ? <Text selectable style={styles.warning}>{dashboard.valuationWarning}</Text> : null}
      </Card>
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

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  summaryMetric: { backgroundColor: colors.surfaceMuted, borderRadius: 12, flex: 1, gap: spacing.xs, minWidth: "46%", padding: spacing.md },
  summaryValue: { fontSize: 17, fontVariant: ["tabular-nums"], fontWeight: "800" },
  warning: { backgroundColor: colors.warningSoft, borderRadius: 10, color: colors.warning, fontSize: 12, lineHeight: 17, padding: spacing.md },
});
