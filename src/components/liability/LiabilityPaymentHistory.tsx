"use client";

import { useLiabilityPaymentHistory } from "@/hooks/useLiabilityQueries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface LiabilityPaymentHistoryProps {
  accountId?: string;
  limit?: number;
}

/**
 * Displays liability payment history for a given account and handles loading, error, empty, and populated states.
 *
 * @param accountId - Optional account identifier used to filter the fetched payments.
 * @param limit - Maximum number of payments to fetch. Defaults to 20.
 * @returns The rendered liability payment history UI (skeleton while loading, error panel on failure, empty message when no data, or a table of payments).
 */
export function LiabilityPaymentHistory({
  accountId,
  limit = 20,
}: LiabilityPaymentHistoryProps) {
  const { data: payments = [], isLoading: loading, error: queryError, refetch: loadPayments } = useLiabilityPaymentHistory(accountId, limit);
  const error = queryError ? (queryError instanceof Error ? queryError.message : "An error occurred while loading payments") : null;

  function getStatusBadge(status: string) {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "ROLLED_BACK":
        return (
          <Badge variant="destructive">
            <RotateCcw className="mr-1 h-3 w-3" />
            Rolled Back
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => loadPayments()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No liability payments found.</p>
        <p className="text-sm">Payments you make will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>From Account</TableHead>
            <TableHead>To Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow
              key={payment.id}
              className={
                payment.liabilityPaymentAudit?.isRolledBack ? "opacity-50" : ""
              }
            >
              <TableCell>{format(new Date(payment.date), "yyyy-MM-dd")}</TableCell>
              <TableCell className="font-mono text-xs">
                {payment.referenceNumber || "-"}
              </TableCell>
              <TableCell>{payment.account.name}</TableCell>
              <TableCell>{payment.toAccount?.name || "-"}</TableCell>
              <TableCell className="text-right font-medium">
                {payment.amount.toLocaleString()} {payment.currency}
              </TableCell>
              <TableCell>{getStatusBadge(payment.paymentStatus)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}