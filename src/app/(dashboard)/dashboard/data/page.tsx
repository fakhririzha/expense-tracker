"use client";

import { getImportTemplate } from "@/actions/import-actions";
import { ExportDialog } from "@/components/export/ExportDialog";
import { ImportDialog } from "@/components/export/ImportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  FileDown,
  FileUp,
  Package,
  FileText,
  Table,
  Wallet,
  Target,
  TrendingUp,
  Repeat,
  Layers,
} from "lucide-react";
import { useState } from "react";

const exportCards = [
  {
    title: "Transactions",
    description: "Export all your income, expenses, and transfers",
    icon: Table,
    type: "transactions" as const,
  },
  {
    title: "Accounts",
    description: "Export your bank accounts, cash, and cards",
    icon: Wallet,
    type: "accounts" as const,
  },
  {
    title: "Budgets",
    description: "Export your budget configurations",
    icon: Target,
    type: "budgets" as const,
  },
  {
    title: "Categories",
    description: "Export your transaction categories",
    icon: Layers,
    type: "categories" as const,
  },
  {
    title: "Investments",
    description: "Export your investment portfolio",
    icon: TrendingUp,
    type: "investments" as const,
  },
  {
    title: "Recurring Rules",
    description: "Export your recurring transaction rules",
    icon: Repeat,
    type: "recurring" as const,
  },
];

/**
 * Renders the Data Management page for exporting, importing, and downloading CSV templates.
 *
 * The page provides: an Export Data section with per-entity CSV exports and a full JSON backup; an
 * Import Data section with a transactions importer and downloadable CSV templates (transactions,
 * accounts, budgets) that show download state; and a concise Import/Export guide describing formats
 * and requirements.
 *
 * @returns The React element for the Data Management UI.
 */
export default function DataManagementPage() {
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<string | null>(null);

  const handleDownloadTemplate = async (type: "transactions" | "accounts" | "budgets") => {
    setIsDownloadingTemplate(type);
    try {
      const template = await getImportTemplate(type);
      
      // Create and trigger download
      const blob = new Blob([template], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download template:", error);
    } finally {
      setIsDownloadingTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">
          Export and import your financial data
        </p>
      </div>

      {/* Export Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Export Data</h2>
          <p className="text-sm text-muted-foreground">
            Download your data in CSV format for backup or analysis
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exportCards.map((card) => (
            <Card key={card.type} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {card.description}
                </p>
                <ExportDialog
                  defaultType={card.type}
                  trigger={
                    <Button variant="outline" size="sm" className="w-full">
                      <FileDown className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Full Backup Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Full Backup</CardTitle>
            </div>
            <CardDescription>
              Export all your data as a JSON file for complete backup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This includes all your accounts, transactions, budgets, categories,
              investments, recurring rules, and savings goals. Perfect for backup
              or migrating to another device.
            </p>
            <ExportDialog
              defaultType="all"
              trigger={
                <Button>
                  <Package className="mr-2 h-4 w-4" />
                  Export All Data
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Import Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Import Data</h2>
          <p className="text-sm text-muted-foreground">
            Import transactions from CSV files
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                <CardTitle>Import Transactions</CardTitle>
              </div>
              <CardDescription>
                Upload a CSV file to import transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Import transactions from other financial apps or spreadsheets.
                The system will automatically detect column mappings and validate
                your data before importing.
              </p>
              <ImportDialog
                trigger={
                  <Button className="w-full">
                    <FileUp className="mr-2 h-4 w-4" />
                    Import from CSV
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {/* Templates Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>CSV Templates</CardTitle>
              </div>
              <CardDescription>
                Download templates for proper formatting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use these templates to ensure your CSV files are formatted correctly
                for import.
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleDownloadTemplate("transactions")}
                  disabled={isDownloadingTemplate !== null}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloadingTemplate === "transactions"
                    ? "Downloading..."
                    : "Transactions Template"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleDownloadTemplate("accounts")}
                  disabled={isDownloadingTemplate !== null}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloadingTemplate === "accounts"
                    ? "Downloading..."
                    : "Accounts Template"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleDownloadTemplate("budgets")}
                  disabled={isDownloadingTemplate !== null}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloadingTemplate === "budgets"
                    ? "Downloading..."
                    : "Budgets Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import/Export Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Export Format</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• CSV files with headers</li>
                <li>• Dates in ISO format (YYYY-MM-DD)</li>
                <li>• Amounts as numbers without currency symbols</li>
                <li>• Full backup exports as JSON</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Import Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• CSV file with header row</li>
                <li>• Required: Date, Amount, Type, Account</li>
                <li>• Type must be: INCOME, EXPENSE, or TRANSFER</li>
                <li>• Account names must match existing accounts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}