import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const tableCellWidths = ["w-20", "w-20", "w-28", "w-36", "w-28", "w-28", "w-24", "w-8"];

export function TransactionTableSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tableCellWidths.map((width, index) => (
                <TableHead key={index}>
                  <Skeleton className={`h-4 ${width}`} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {tableCellWidths.map((width, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className={`h-4 ${width}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

export function TransactionsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between max-md:flex-col max-md:gap-y-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex items-center gap-2 max-md:w-full">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <TransactionTableSkeleton />
    </div>
  );
}
