"use client";

import { ParsedTransaction } from "@/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ImportPreviewProps {
  transactions: ParsedTransaction[];
  maxRows?: number;
}

/**
 * Component for previewing import data with validation status
 */
export function ImportPreview({ transactions, maxRows = 20 }: ImportPreviewProps) {
  const validCount = transactions.filter((t) => t.isValid).length;
  const invalidCount = transactions.length - validCount;
  const displayTransactions = transactions.slice(0, maxRows);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">{validCount} valid</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium">{invalidCount} invalid</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {displayTransactions.length} of {transactions.length} rows
        </div>
      </div>

      {/* Preview Table */}
      <div className="h-[300px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayTransactions.map((tx) => (
              <TableRow key={tx.rowNumber} className={!tx.isValid ? "bg-red-50" : ""}>
                <TableCell className="font-mono text-xs">{tx.rowNumber}</TableCell>
                <TableCell>{tx.date}</TableCell>
                <TableCell className="font-mono">
                  {tx.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      tx.type === "INCOME"
                        ? "border-green-500 text-green-700"
                        : tx.type === "EXPENSE"
                        ? "border-red-500 text-red-700"
                        : "border-blue-500 text-blue-700"
                    }
                  >
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell>{tx.account}</TableCell>
                <TableCell>{tx.category || "-"}</TableCell>
                <TableCell>
                  {tx.isValid ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Valid
                    </Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        Invalid
                      </Badge>
                      <div className="text-xs text-red-600 max-w-[200px]">
                        {tx.errors.join(", ")}
                      </div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {transactions.length > maxRows && (
        <p className="text-sm text-muted-foreground text-center">
          And {transactions.length - maxRows} more rows...
        </p>
      )}
    </div>
  );
}
