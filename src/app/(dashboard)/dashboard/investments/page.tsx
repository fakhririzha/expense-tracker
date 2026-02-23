"use client";

import { AddInvestmentDialog } from "@/components/investments/AddInvestmentDialog";
import { RecordSellTradeDialog } from "@/components/investments/RecordSellTradeDialog";
import {
  PortfolioAsset,
  PortfolioTable,
} from "@/components/investments/PortfolioTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { usePortfolio, usePortfolioSummary, useRefreshPortfolioPrices } from "@/hooks/useInvestmentQueries";
import { useState } from "react";

interface PortfolioSummaryData {
  totalValue: number;
  totalCost: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  totalRealizedPnL: number;
  assetCount: number;
}

/**
 * Render the Investments page showing portfolio summary cards and a holdings table.
 *
 * @returns The Investments page JSX element.
 */
export default function InvestmentsPage() {
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();

  const { data: assets = [], isLoading, error: portfolioError } = usePortfolio();
  const { data: summaryData } = usePortfolioSummary();
  const refreshMutation = useRefreshPortfolioPrices();

  const summary = summaryData as PortfolioSummaryData | null | undefined;

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to refresh prices:", error);
    }
  };

  return (
    <div className="space-y-6">
      {(portfolioError || refreshMutation.error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {portfolioError?.message || refreshMutation.error?.message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Investments</h1>
          <p className="text-muted-foreground">
            Track your investment portfolio and performance
          </p>
        </div>
        <div className="flex gap-2">
          <RecordSellTradeDialog onSuccess={() => {}} />
          <AddInvestmentDialog onSuccess={() => {}} />
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Portfolio Value
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalValue)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.assetCount} assets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalCost)}
              </div>
              <p className="text-xs text-muted-foreground">Cost basis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Unrealized P&L
              </CardTitle>
              {summary.totalUnrealizedPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.totalUnrealizedPnL >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {summary.totalUnrealizedPnL >= 0 ? "+" : ""}
                {formatCurrency(summary.totalUnrealizedPnL)}
              </div>
              <p
                className={`text-xs ${
                  summary.totalUnrealizedPnL >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatPercentage(summary.totalUnrealizedPnLPercent)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today&apos;s Change
              </CardTitle>
              {summary.totalDayChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.totalDayChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {summary.totalDayChange >= 0 ? "+" : ""}
                {formatCurrency(summary.totalDayChange)}
              </div>
              <p
                className={`text-xs ${
                  summary.totalDayChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatPercentage(summary.totalDayChangePercent)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Portfolio Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioTable
              assets={assets as PortfolioAsset[]}
              onRefresh={handleRefresh}
              isRefreshing={refreshMutation.isPending}
              lastUpdated={lastUpdated}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}