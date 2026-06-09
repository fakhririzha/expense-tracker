"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetWorthSnapshotEmptyStateProps {
  hasCurrencyMismatch?: boolean;
}

export function NetWorthSnapshotEmptyState({
  hasCurrencyMismatch = false,
}: NetWorthSnapshotEmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No Month-End Snapshots Yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 py-10 text-sm text-muted-foreground">
        <p>
          Month-end net worth snapshots will appear here after the monthly snapshot
          job runs for your reporting currency.
        </p>
        {hasCurrencyMismatch ? (
          <p>
            Existing snapshots were found in a different currency, so the current
            chart stays empty until matching-currency snapshots exist.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
