"use client";

import { getPortfolio, getPortfolioSummary, refreshPortfolioPrices } from "@/actions/investment-actions";
import { AddInvestmentDialog } from "@/components/investments/AddInvestmentDialog";
import {
  PortfolioAsset,
  PortfolioTable,
} from "@/components/investments/PortfolioTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

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
 * Loads portfolio data and summary on mount, manages loading and refresh states, and exposes a refresh handler that triggers server-side price updates and reloads data.
 *
 * @returns The Investments page JSX element.
 */
export default function InvestmentsPage() {
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [portfolioResult, summaryResult] = await Promise.all([
        getPortfolio(),
        getPortfolioSummary(),
      ]);

      if (portfolioResult.success && portfolioResult.data) {
        setAssets(portfolioResult.data as PortfolioAsset[]);
        setLastUpdated(new Date());
      }

      if (
        summaryResult.success &&
        "data" in summaryResult &&
        summaryResult.data
      ) {
        setSummary(summaryResult.data as PortfolioSummaryData);
      }
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      // Trigger server-side revalidation
      const result = await refreshPortfolioPrices();
      if (!result.success) {
        setError(result.error ?? "Failed to refresh prices");
        return;
      }
      // Reload data to get fresh prices
      await loadData();
    } catch (error) {
      console.error("Failed to refresh prices:", error);
      setError("Failed to refresh prices");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Investments</h1>
          <p className="text-muted-foreground">
            Track your investment portfolio and performance
          </p>
        </div>
        <AddInvestmentDialog onSuccess={loadData} />
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
              assets={assets}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              lastUpdated={lastUpdated}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}