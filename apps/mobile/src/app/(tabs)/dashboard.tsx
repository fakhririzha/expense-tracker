import type { MobileDashboardResponse } from "@finhealth/contracts";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { getDashboard } from "@/api/dashboard";
import {
  Card,
  ErrorState,
  LoadingState,
  OfflineBanner,
  ScreenScroll,
  SectionHeader,
} from "@/components/ui";
import { formatMoney } from "@/features/transactions/format";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { colors, commonStyles, radii, spacing } from "@/theme/tokens";

function MetricCard({
  label,
  value,
  detail,
  color = colors.text,
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
}) {
  return (
    <Card style={styles.metricCard}>
      <Text selectable style={commonStyles.label}>{label}</Text>
      <Text selectable style={[styles.metricValue, { color }]}>{value}</Text>
      <Text selectable style={styles.metricDetail}>{detail}</Text>
    </Card>
  );
}

function CashFlowComparison({ dashboard }: { dashboard: MobileDashboardResponse }) {
  const { averageMonthlyIncome: income, averageMonthlyExpenses: expenses } =
    dashboard.cashFlow;
  const maximum = Math.max(income, expenses, 1);

  return (
    <Card style={{ gap: spacing.lg }}>
      <SectionHeader title="Average monthly cash flow" />
      <View style={{ gap: spacing.md }}>
        <FlowBar
          label="Income"
          value={income}
          maximum={maximum}
          currency={dashboard.displayCurrency}
          color={colors.income}
        />
        <FlowBar
          label="Expenses"
          value={expenses}
          maximum={maximum}
          currency={dashboard.displayCurrency}
          color={colors.expense}
        />
      </View>
    </Card>
  );
}

function FlowBar({
  label,
  value,
  maximum,
  currency,
  color,
}: {
  label: string;
  value: number;
  maximum: number;
  currency: string;
  color: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.flowHeader}>
        <Text selectable style={commonStyles.value}>{label}</Text>
        <Text selectable style={styles.flowAmount}>{formatMoney(value, currency)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { backgroundColor: color, width: `${Math.max(2, (value / maximum) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const isOnline = useNetworkStatus();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });

  if (query.isLoading) {
    return (
      <View style={commonStyles.screen}>
        <OfflineBanner isOnline={isOnline} />
        <LoadingState label="Loading your dashboard…" />
      </View>
    );
  }
  if (!query.data) {
    return (
      <View style={commonStyles.screen}>
        <OfflineBanner isOnline={isOnline} />
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Unable to load dashboard."}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  const dashboard = query.data;
  const currency = dashboard.displayCurrency;
  const netWorth = dashboard.position.netWorth;

  return (
    <ScreenScroll
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }>
      <OfflineBanner isOnline={isOnline} />
      {query.isError ? (
        <Text selectable style={styles.warning}>
          The latest refresh failed. Showing your previously loaded dashboard.
        </Text>
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={commonStyles.title}>Dashboard</Text>
        <Text selectable style={commonStyles.subtitle}>A quick view of your financial position.</Text>
      </View>

      <MetricCard
        label="Net worth"
        value={netWorth === null ? "Unavailable" : formatMoney(netWorth, currency)}
        detail="Assets minus liabilities"
        color={netWorth !== null && netWorth < 0 ? colors.expense : colors.primary}
      />

      <View style={styles.metricGrid}>
        <MetricCard
          label="Liquid funds"
          value={
            dashboard.position.liquidFunds === null
              ? "Unavailable"
              : formatMoney(dashboard.position.liquidFunds, currency)
          }
          detail="Cash and bank accounts"
          color={colors.income}
        />
        <MetricCard
          label="Total debt"
          value={
            dashboard.position.totalDebt === null
              ? "Unavailable"
              : formatMoney(dashboard.position.totalDebt, currency)
          }
          detail="Loans and credit cards"
          color={colors.expense}
        />
        <MetricCard
          label="Savings rate"
          value={`${dashboard.cashFlow.savingsRate.toFixed(1)}%`}
          detail="Based on six months"
        />
        <MetricCard
          label="Cash runway"
          value={
            dashboard.cashFlow.monthsOfRunway === null
              ? "Unavailable"
              : `${dashboard.cashFlow.monthsOfRunway.toFixed(1)} mo`
          }
          detail="At average spending"
        />
      </View>

      <CashFlowComparison dashboard={dashboard} />

      <Card style={{ gap: spacing.sm }}>
        <SectionHeader title="Financial health" />
        {dashboard.health ? (
          <>
            <View style={styles.healthRow}>
              <View style={styles.healthTier}>
                <Text selectable style={styles.healthTierText}>{dashboard.health.tier}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={commonStyles.sectionTitle}>{dashboard.health.label}</Text>
                <Text selectable style={commonStyles.subtitle}>{dashboard.health.description}</Text>
              </View>
            </View>
            <Text selectable style={styles.metricDetail}>
              Debt-to-wealth: {dashboard.health.debtToWealthRatio.toFixed(1)}%
            </Text>
          </>
        ) : (
          <Text selectable style={commonStyles.subtitle}>
            Health status is unavailable until all asset values can be calculated.
          </Text>
        )}
        {dashboard.valuationWarning ? (
          <Text selectable style={styles.warning}>{dashboard.valuationWarning}</Text>
        ) : null}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl * 2 },
  metricCard: { flex: 1, gap: spacing.sm, minWidth: "46%" },
  metricValue: { fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] },
  metricDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  flowHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  flowAmount: { color: colors.text, fontSize: 13, fontVariant: ["tabular-nums"] },
  track: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, height: 10, overflow: "hidden" },
  fill: { borderRadius: radii.pill, height: "100%" },
  healthRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  healthTier: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 52, justifyContent: "center", width: 52 },
  healthTierText: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  warning: { backgroundColor: colors.warningSoft, borderRadius: radii.md, color: colors.warning, fontSize: 12, lineHeight: 17, padding: spacing.md },
});
