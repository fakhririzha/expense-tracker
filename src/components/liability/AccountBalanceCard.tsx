"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface AccountBalanceCardProps {
  accountName: string;
  accountType: string;
  balance: number;
  currency: string;
  availableBalance?: number;
  highlightInsufficient?: boolean;
  requiredAmount?: number;
  className?: string;
}

export function AccountBalanceCard({
  accountName,
  accountType,
  balance,
  currency,
  availableBalance,
  highlightInsufficient = false,
  requiredAmount,
  className,
}: AccountBalanceCardProps) {
  const displayBalance = availableBalance ?? balance;
  const hasInsufficientFunds =
    highlightInsufficient &&
    requiredAmount !== undefined &&
    displayBalance < requiredAmount;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "BANK":
        return "Bank Account";
      case "LOAN":
        return "Loan Account";
      case "CREDIT_CARD":
        return "Credit Card";
      default:
        return type;
    }
  };

  return (
    <Card
      className={cn(
        "transition-colors",
        hasInsufficientFunds ? "border-destructive bg-destructive/5" : "",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {getAccountTypeLabel(accountType)}
            </p>
            <p className="text-lg font-semibold">{accountName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">
              {formatAmount(displayBalance)}
            </p>
            {availableBalance !== undefined && availableBalance !== balance && (
              <p className="text-xs text-muted-foreground">
                Available: {formatAmount(availableBalance)}
              </p>
            )}
          </div>
        </div>

        {hasInsufficientFunds && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>
              Insufficient funds. Required: {formatAmount(requiredAmount)},
              Available: {formatAmount(displayBalance)}
            </span>
          </div>
        )}

        {!hasInsufficientFunds && requiredAmount !== undefined && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Sufficient funds available</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
