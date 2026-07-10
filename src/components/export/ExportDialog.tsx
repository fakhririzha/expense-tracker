"use client";

import {
  exportTransactionsCSV,
  exportAccountsCSV,
  exportBudgetsCSV,
  exportAllData,
  exportCategoriesCSV,
  exportInvestmentsCSV,
  exportPersonalAssetsCSV,
  exportRecurringRulesCSV,
} from "@/actions/export-actions";
import { getAccounts } from "@/actions/account-actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileDown,
  Loader2,
  Package,
} from "lucide-react";
import { useEffect, useState } from "react";

type ExportType =
  | "transactions"
  | "accounts"
  | "budgets"
  | "categories"
  | "investments"
  | "assets"
  | "recurring"
  | "all";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface ExportDialogProps {
  trigger?: React.ReactNode;
  defaultType?: ExportType;
}

const exportOptions: {
  value: ExportType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "transactions",
    label: "Transactions",
    description: "Export all your income and expense records",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "accounts",
    label: "Accounts",
    description: "Export your financial accounts",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "budgets",
    label: "Budgets",
    description: "Export your budget configurations",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "categories",
    label: "Categories",
    description: "Export your transaction categories",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "investments",
    label: "Investments",
    description: "Export your investment portfolio",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "assets",
    label: "Personal Assets",
    description: "Export your owned item inventory",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "recurring",
    label: "Recurring Rules",
    description: "Export your recurring transaction rules",
    icon: <FileDown className="h-4 w-4" />,
  },
  {
    value: "all",
    label: "Financial Data Archive",
    description: "Download a non-restorable JSON archive of your financial records",
    icon: <Package className="h-4 w-4" />,
  },
];

/**
 * Modal dialog component that lets users select data types and optional filters to export application data as CSV or JSON.
 *
 * @param trigger - Optional React node used as the dialog trigger; if omitted a default "Export Data" button is rendered.
 * @param defaultType - Optional initial export type selection; defaults to `"transactions"` when not provided.
 * @returns The rendered export dialog element.
 */
export function ExportDialog({ trigger, defaultType }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(defaultType ?? "transactions");
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Filter options for transactions
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  const loadAccounts = async () => {
    const result = await getAccounts();
    if (result.success && result.data) {
      setAccounts(result.data);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let result:
        | { success: boolean; data?: string; filename?: string; error?: string; count?: number; summary?: Record<string, number> }
        | null = null;

      switch (exportType) {
        case "transactions":
          result = await exportTransactionsCSV({
            startDate,
            endDate,
            accountId: selectedAccountId || undefined,
            type: selectedType || undefined,
          });
          break;
        case "accounts":
          result = await exportAccountsCSV();
          break;
        case "budgets":
          result = await exportBudgetsCSV();
          break;
        case "categories":
          result = await exportCategoriesCSV();
          break;
        case "investments":
          result = await exportInvestmentsCSV();
          break;
        case "assets":
          result = await exportPersonalAssetsCSV();
          break;
        case "recurring":
          result = await exportRecurringRulesCSV();
          break;
        case "all":
          result = await exportAllData();
          break;
      }

      if (result?.success && result.data) {
        // Create and trigger download
        const blob = new Blob([result.data], {
          type: exportType === "all" ? "application/json" : "text/csv",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || `export-${exportType}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setOpen(false);
        resetForm();
      } else {
        console.error("Export failed:", result?.error);
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const resetForm = () => {
    setExportType("transactions");
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedAccountId("");
    setSelectedType("");
  };

  const showFilters = exportType === "transactions";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose what data to export and apply filters if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Export Type Selection */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Export Type</label>
            <Select
              value={exportType}
              onValueChange={(value) => setExportType(value as ExportType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select what to export" />
              </SelectTrigger>
              <SelectContent>
                {exportOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {exportOptions.find((o) => o.value === exportType)?.description}
            </p>
          </div>

          {/* Transaction Filters */}
          {showFilters && (
            <>
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Account Filter */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Account</label>
                <Select
                  value={selectedAccountId || "all"}
                  onValueChange={(value) => setSelectedAccountId(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Type Filter */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Transaction Type</label>
                <Select value={selectedType || "all"} onValueChange={(value) => setSelectedType(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="LIABILITY_PAYMENT">Liability Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
