import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, WalletCards } from "lucide-react";
import Link from "next/link";

interface MonthlyBudgetStatusProps {
  monthlyBudget: number | null;
  currentMonthExpenses: number | null;
  currency: string;
}

export function MonthlyBudgetStatus({
  monthlyBudget,
  currentMonthExpenses,
  currency,
}: MonthlyBudgetStatusProps) {
  if (!monthlyBudget || monthlyBudget <= 0) {
    return (
      <Card className="bg-secondary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold font-heading">
            Monthly Budget
          </CardTitle>
          <WalletCards className="h-6 w-6 opacity-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-bold">
            Set a monthly budget target to track this month&apos;s spending.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/profile">Set Budget Target</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (currentMonthExpenses === null) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold font-heading">
            Monthly Budget
          </CardTitle>
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </CardHeader>
        <CardContent>
          <p className="text-sm font-bold text-muted-foreground">
            Current-month spending is unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }

  const percentageUsed = (currentMonthExpenses / monthlyBudget) * 100;
  const remaining = monthlyBudget - currentMonthExpenses;
  const isOverBudget = remaining < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold font-heading">
          Monthly Budget
        </CardTitle>
        <WalletCards
          className={`h-6 w-6 ${
            isOverBudget ? "text-destructive" : "text-green-600"
          }`}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-3xl font-black tracking-tight">
            {formatCurrency(currentMonthExpenses, currency)}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            of {formatCurrency(monthlyBudget, currency)} this month
          </p>
        </div>
        <div className="space-y-1">
          <Progress value={Math.min(percentageUsed, 100)} className="h-3" />
          <div className="flex justify-between gap-3 text-xs font-bold">
            <span>{percentageUsed.toFixed(1)}% used</span>
            <span className={isOverBudget ? "text-destructive" : ""}>
              {isOverBudget
                ? `${formatCurrency(Math.abs(remaining), currency)} over`
                : `${formatCurrency(remaining, currency)} left`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
