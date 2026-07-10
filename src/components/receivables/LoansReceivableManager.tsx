"use client";

import Link from "next/link";

import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { ReceivableTransferDialog } from "@/components/receivables/ReceivableTransferDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLoansReceivableHistory,
  useLoansReceivableSummary,
} from "@/hooks/useReceivableQueries";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { HandCoins, History, Landmark, Wallet } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

interface ReceivableTransfer {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  date: Date;
  account: Account;
  toAccount: Account | null;
}

function getTransferDirection(transaction: ReceivableTransfer) {
  if (transaction.toAccount?.type === "LOAN_RECEIVABLE") {
    return "Disbursement";
  }

  if (transaction.account.type === "LOAN_RECEIVABLE") {
    return "Repayment";
  }

  return "Transfer";
}

function getReceivableAccount(transaction: ReceivableTransfer) {
  return transaction.account.type === "LOAN_RECEIVABLE"
    ? transaction.account
    : transaction.toAccount;
}

export function LoansReceivableManager() {
  const { data: summary, isLoading: summaryLoading } = useLoansReceivableSummary();
  const {
    data: history = [],
    isLoading: historyLoading,
  } = useLoansReceivableHistory(50);

  const accounts = (summary?.accounts ?? []) as Account[];
  const activeAccounts = accounts.filter((account) => account.isActive);
  const displayCurrency = summary?.displayCurrency ?? "IDR";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loans Receivable</h1>
          <p className="text-muted-foreground">
            Track principal owed to you from funded loans
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ReceivableTransferDialog mode="disbursement" />
          <ReceivableTransferDialog mode="repayment" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Principal</CardTitle>
            <HandCoins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading
                ? "Loading..."
                : formatCurrency(summary?.totalOutstanding ?? 0, displayCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Current receivable balances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Loans Receivable accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history.length}</div>
            <p className="text-xs text-muted-foreground">
              Latest receivable transfers
            </p>
          </CardContent>
        </Card>
      </div>

      {activeAccounts.length === 0 && !summaryLoading ? (
        <ContextualEmptyState
          title="Add your first receivable"
          description="Track money others owe you."
          icon={<HandCoins className="h-5 w-5" />}
          action={
            <Button asChild>
              <Link href="/dashboard/accounts">Open accounts</Link>
            </Button>
          }
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Receivable Accounts</CardTitle>
          <CardDescription>Current principal by account</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No receivable accounts found.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Outstanding
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>Disbursements and repayments</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No Loans Receivable transfers found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Receivable</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history as ReceivableTransfer[]).map((transaction) => {
                    const direction = getTransferDirection(transaction);
                    const receivableAccount = getReceivableAccount(transaction);

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.date), "yyyy-MM-dd")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={direction === "Repayment" ? "default" : "secondary"}
                          >
                            {direction}
                          </Badge>
                        </TableCell>
                        <TableCell>{receivableAccount?.name ?? "-"}</TableCell>
                        <TableCell>{transaction.account.name}</TableCell>
                        <TableCell>{transaction.toAccount?.name ?? "-"}</TableCell>
                        <TableCell>
                          {transaction.description || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
