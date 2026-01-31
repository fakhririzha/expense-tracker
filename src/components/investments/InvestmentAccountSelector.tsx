"use client";

import { useEffect, useState } from "react";
import { getInvestmentAccountsAction } from "@/actions/investment-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Wallet } from "lucide-react";

interface InvestmentAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

interface InvestmentAccountSelectorProps {
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  showBalance?: boolean;
  label?: string;
  placeholder?: string;
}

/**
 * A dropdown selector component for choosing an INVESTMENT-type financial account.
 * 
 * Features:
 * - Automatically fetches active INVESTMENT accounts for the current user
 * - Displays account balance next to each option
 * - Shows loading state while fetching accounts
 * - Handles error states gracefully
 * - Optional balance display
 * 
 * @param value - The currently selected account ID
 * @param onChange - Callback when selection changes
 * @param disabled - Whether the selector is disabled
 * @param showBalance - Whether to display account balances (default: true)
 * @param label - Custom label text (default: "Investment Account")
 * @param placeholder - Custom placeholder text
 */
export function InvestmentAccountSelector({
  value,
  onChange,
  disabled = false,
  showBalance = true,
  label = "Investment Account",
  placeholder = "Select an investment account",
}: InvestmentAccountSelectorProps) {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getInvestmentAccountsAction();
        if (result.success && result.data) {
          setAccounts(result.data);
        } else {
          setError(result.error || "Failed to load accounts");
          setAccounts([]);
        }
      } catch (err) {
        console.error("Error loading investment accounts:", err);
        setError("An unexpected error occurred");
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, []);

  // Auto-select first account if none selected and accounts available
  useEffect(() => {
    if (!value && accounts.length > 0 && !isLoading) {
      onChange(accounts[0].id);
    }
  }, [accounts, value, isLoading, onChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading accounts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No investment accounts found. Please create an INVESTMENT account first.
      </div>
    );
  }

  const selectedAccount = accounts.find((acc) => acc.id === value);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedAccount && (
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span>{selectedAccount.name}</span>
                {showBalance && (
                  <span className="text-muted-foreground">
                    ({formatCurrency(selectedAccount.balance, selectedAccount.currency)})
                  </span>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center justify-between gap-4 w-full">
                <span>{account.name}</span>
                {showBalance && (
                  <span className="text-muted-foreground text-sm">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedAccount && showBalance && (
        <p className="text-xs text-muted-foreground">
          Available balance: {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
        </p>
      )}
    </div>
  );
}
