"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Clock3,
  Landmark,
  Lock,
  Wallet,
} from "lucide-react";

import { CloseDepositoDialog } from "@/components/deposito/CloseDepositoDialog";
import { EditDepositoDialog } from "@/components/deposito/EditDepositoDialog";
import { OpenDepositoDialog } from "@/components/deposito/OpenDepositoDialog";
import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
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
import { useDepositoHistory, useDepositoSummary } from "@/hooks/useDepositoQueries";
import {
  DEPOSITO_INTEREST_FREQUENCY_LABELS,
  DEPOSITO_STATUS_LABELS,
  DEPOSITO_TERM_MODE_LABELS,
} from "@/lib/deposito";
import { formatCurrency } from "@/lib/utils";

interface DepositoAccountSummaryItem {
  id: string;
  startDate: Date;
  principalAmount: number;
  interestFrequency: keyof typeof DEPOSITO_INTEREST_FREQUENCY_LABELS;
  interestRate: number;
  taxRate: number | null;
  termMode: keyof typeof DEPOSITO_TERM_MODE_LABELS;
  maturityDate: Date | null;
  nextInterestDate: Date | null;
  status: keyof typeof DEPOSITO_STATUS_LABELS;
  closedAt: Date | null;
  latestInterestPosting: {
    postingDate: Date;
    netInterest: number;
  } | null;
  account: {
    id: string;
    name: string;
    description: string | null;
    balance: number;
    currency: string;
    isActive: boolean;
  };
}

interface DepositoInterestHistoryItem {
  id: string;
  postingDate: Date;
  grossInterest: number;
  taxAmount: number;
  netInterest: number;
  balanceAfter: number;
  transactionDescription: string | null;
  account: {
    name: string;
    currency: string;
  };
}

function formatDateCell(value: Date | null) {
  return value ? format(new Date(value), "yyyy-MM-dd") : "-";
}

function getStatusBadgeVariant(status: DepositoAccountSummaryItem["status"]) {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "MATURED":
      return "secondary";
    case "CLOSED":
      return "outline";
  }
}

export function DepositoManager() {
  const { data: summary, isLoading: summaryLoading } = useDepositoSummary();
  const {
    data: history = [],
    isLoading: historyLoading,
  } = useDepositoHistory(50);
  const [editingDeposito, setEditingDeposito] =
    useState<DepositoAccountSummaryItem | null>(null);
  const [closingDeposito, setClosingDeposito] =
    useState<DepositoAccountSummaryItem | null>(null);

  const depositos = useMemo(
    () => (summary?.depositos ?? []) as DepositoAccountSummaryItem[],
    [summary?.depositos]
  );
  const activeDepositos = useMemo(
    () => depositos.filter((deposito) => deposito.status === "ACTIVE"),
    [depositos]
  );
  const maturedDepositos = useMemo(
    () => depositos.filter((deposito) => deposito.status === "MATURED"),
    [depositos]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deposito Tracker</h1>
          <p className="text-muted-foreground">
            Track locked deposito balances, scheduled interest, and maturity status.
          </p>
        </div>
        <OpenDepositoDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposito Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading
                ? "Loading..."
                : formatCurrency(summary?.totalDepositoValue ?? 0, summary?.displayCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Included in net worth, excluded from liquid cash
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Depositos</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Interest still posting on schedule
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Interest Due</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.nextInterestDate
                ? formatDateCell(summary.nextInterestDate)
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Cron posts due interest daily at 01:00 UTC
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matured Depositos</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.maturedCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for manual close or renewal changes
            </p>
          </CardContent>
        </Card>
      </div>

      {activeDepositos.length === 0 && maturedDepositos.length === 0 && !summaryLoading ? (
        <ContextualEmptyState
          title="Open your first deposito"
          description="Track locked balances and daily interest processing."
          icon={<Landmark className="h-5 w-5" />}
          action={<OpenDepositoDialog />}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Deposito Accounts</CardTitle>
          <CardDescription>
            Current balances, schedules, and maturity state for each deposito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : depositos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No deposito accounts found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deposito</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Balance</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Rate (p.a.)</TableHead>
                    <TableHead>Posting Schedule</TableHead>
                    <TableHead>Next Interest</TableHead>
                    <TableHead>Maturity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositos.map((deposito) => (
                    <TableRow key={deposito.id}>
                      <TableCell className="font-medium">
                        <div>{deposito.account.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Started {formatDateCell(deposito.startDate)}
                        </div>
                        {deposito.account.description ? (
                          <div className="text-xs text-muted-foreground">
                            {deposito.account.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(deposito.status)}>
                          {DEPOSITO_STATUS_LABELS[deposito.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          deposito.account.balance,
                          deposito.account.currency
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          deposito.principalAmount,
                          deposito.account.currency
                        )}
                      </TableCell>
                      <TableCell>
                        {deposito.interestRate.toFixed(2)}% p.a.
                        {deposito.taxRate !== null ? (
                          <div className="text-xs text-muted-foreground">
                            Tax {deposito.taxRate.toFixed(2)}%
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div>
                          {
                            DEPOSITO_INTEREST_FREQUENCY_LABELS[
                              deposito.interestFrequency
                            ]
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {DEPOSITO_TERM_MODE_LABELS[deposito.termMode]}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateCell(deposito.nextInterestDate)}</TableCell>
                      <TableCell>{formatDateCell(deposito.maturityDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {deposito.status !== "CLOSED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingDeposito(deposito)}
                            >
                              Edit
                            </Button>
                          ) : null}
                          {deposito.status !== "CLOSED" &&
                          deposito.account.balance > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => setClosingDeposito(deposito)}
                            >
                              Close
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interest History</CardTitle>
          <CardDescription>
            Ledger-backed interest credits created by the daily deposito cron.
          </CardDescription>
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
              No deposito interest history yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Deposito</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history as DepositoInterestHistoryItem[]).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateCell(item.postingDate)}</TableCell>
                      <TableCell>{item.account.name}</TableCell>
                      <TableCell>
                        {formatCurrency(item.grossInterest, item.account.currency)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.taxAmount, item.account.currency)}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(item.netInterest, item.account.currency)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.balanceAfter, item.account.currency)}
                      </TableCell>
                      <TableCell>
                        {item.transactionDescription || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditDepositoDialog
        deposito={editingDeposito}
        open={editingDeposito !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingDeposito(null);
          }
        }}
      />

      <CloseDepositoDialog
        deposito={closingDeposito}
        open={closingDeposito !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setClosingDeposito(null);
          }
        }}
      />
    </div>
  );
}
