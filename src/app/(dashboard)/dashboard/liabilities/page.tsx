import { Metadata } from "next";
import Link from "next/link";
import { DebtPayoffPlanner } from "@/components/liability/DebtPayoffPlanner";
import { LiabilityPaymentDialog } from "@/components/liability/LiabilityPaymentDialog";
import { LiabilityPaymentHistory } from "@/components/liability/LiabilityPaymentHistory";
import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountsSummary } from "@/actions/account-actions";
import { CreditCard, Landmark } from "lucide-react";

export const metadata: Metadata = {
  title: "Liabilities | Expense Tracker",
  description: "Manage your loans, credit card payments, and debt payoff plan",
};

/**
 * Render the Liabilities page showing total debt, counts of loan and credit card accounts, payment history, and an active liabilities list or a no-liabilities warning.
 *
 * @returns The JSX for the Liabilities page containing summary cards (total debt, loan accounts, credit cards), a payment history section, and either an active liabilities list with per-account balances or a prompt to add liability accounts.
 */
export default async function LiabilitiesPage() {
  const summaryResult = await getAccountsSummary();
  const summary = summaryResult.success ? summaryResult.data : null;

  // Filter liability accounts
  const liabilityAccounts = summary?.accounts?.filter(
    (acc: { type: string }) => acc.type === "LOAN" || acc.type === "CREDIT_CARD"
  ) || [];

  const hasLiabilities = liabilityAccounts.length > 0;
  const totalDebt = liabilityAccounts.reduce(
    (sum: number, acc: { balance: number }) => sum + Math.abs(acc.balance),
    0
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Liabilities</h1>
          <p className="text-muted-foreground">
            Manage and pay off your loans and credit cards
          </p>
        </div>
        <LiabilityPaymentDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDebt.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {liabilityAccounts.length} account(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loan Accounts</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {liabilityAccounts.filter((acc: { type: string }) => acc.type === "LOAN").length}
            </div>
            <p className="text-xs text-muted-foreground">Active loan accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Cards</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {liabilityAccounts.filter((acc: { type: string }) => acc.type === "CREDIT_CARD").length}
            </div>
            <p className="text-xs text-muted-foreground">Active credit cards</p>
          </CardContent>
        </Card>
      </div>

      {/* No liabilities warning */}
      {!hasLiabilities && (
        <ContextualEmptyState
          title="Add your first debt"
          description="Add debts to unlock payment audits and payoff planning."
          icon={<CreditCard className="h-5 w-5" />}
          action={
            <Button asChild>
              <Link href="/dashboard/accounts">Open accounts</Link>
            </Button>
          }
        />
      )}

      {/* Debt payoff planner */}
      <DebtPayoffPlanner />

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            View all your liability payments and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LiabilityPaymentHistory />
        </CardContent>
      </Card>

      {/* Active Liabilities List */}
      {hasLiabilities && (
        <Card>
          <CardHeader>
            <CardTitle>Active Liabilities</CardTitle>
            <CardDescription>
              Overview of your outstanding debts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {liabilityAccounts.map((account: { id: string; name: string; type: string; balance: number; currency: string }) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {account.type === "LOAN" ? (
                      <Landmark className="h-5 w-5 text-blue-500" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-purple-500" />
                    )}
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.type === "LOAN" ? "Loan Account" : "Credit Card"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {Math.abs(account.balance).toLocaleString("id-ID", {
                        style: "currency",
                        currency: account.currency,
                        minimumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {account.balance < 0 ? "Outstanding Balance" : "Paid Off"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
