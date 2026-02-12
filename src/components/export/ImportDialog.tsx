"use client";

import {
  parseCSVContent,
  detectColumnMapping,
  previewImport,
  importTransactions,
  ColumnMapping as ColumnMappingType,
  ParsedTransaction,
} from "@/actions/import-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useState, useCallback } from "react";
import { ColumnMapping } from "./ColumnMapping";
import { ImportPreview } from "./ImportPreview";

interface ImportDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "result";

/**
 * Dialog for importing transactions from CSV files
 */
export function ImportDialog({ trigger, onSuccess }: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCSVContent] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMappingType>({});
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import options
  const [createMissingAccounts, setCreateMissingAccounts] = useState(false);
  const [createMissingCategories, setCreateMissingCategories] = useState(false);

  // Result
  const [importResult, setImportResult] = useState<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setCSVContent("");
    setHeaders([]);
    setMapping({});
    setTransactions([]);
    setIsProcessing(false);
    setError(null);
    setCreateMissingAccounts(false);
    setCreateMissingCategories(false);
    setImportResult(null);
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // Validate file type
      if (!selectedFile.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Read file content
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        setCSVContent(content);

        // Parse CSV and detect mapping
        setIsProcessing(true);
        try {
          const parseResult = await parseCSVContent(content);
          if (!parseResult.success) {
            setError(parseResult.error || "Failed to parse CSV");
            setIsProcessing(false);
            return;
          }

          setHeaders(parseResult.headers);

          // Auto-detect column mapping
          const detectedMapping = await detectColumnMapping(parseResult.headers);
          setMapping(detectedMapping);

          // Move to mapping step
          setStep("mapping");
        } catch (err) {
          console.error("Error parsing CSV:", err);
          setError("Failed to parse CSV file");
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
      };

      reader.readAsText(selectedFile);
    },
    []
  );

  const handleMappingNext = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await previewImport(csvContent, mapping);

      if (!result.success) {
        setError(result.error || "Failed to preview import");
        setIsProcessing(false);
        return;
      }

      setTransactions(result.transactions);
      setStep("preview");
    } catch (err) {
      console.error("Error previewing import:", err);
      setError("Failed to preview import");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setError(null);
    setStep("importing");

    try {
      const validTransactions = transactions.filter((t) => t.isValid);
      const result = await importTransactions(validTransactions, {
        createMissingAccounts,
        createMissingCategories,
      });

      setImportResult({
        imported: result.imported,
        failed: result.failed,
        errors: result.errors,
      });
      setStep("result");

      if (result.imported > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error importing:", err);
      setError("Failed to import transactions");
      setStep("preview");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const handleBack = () => {
    switch (step) {
      case "mapping":
        setStep("upload");
        break;
      case "preview":
        setStep("mapping");
        break;
      case "result":
        setStep("preview");
        break;
    }
  };

  const canProceedFromMapping = () => {
    return mapping.date && mapping.amount && mapping.type && mapping.account;
  };

  const validCount = transactions.filter((t) => t.isValid).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to import your transactions."}
            {step === "mapping" && "Map your CSV columns to the required fields."}
            {step === "preview" && "Review your data before importing."}
            {step === "importing" && "Importing your transactions..."}
            {step === "result" && "Import completed."}
          </DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="py-4">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center",
                  "hover:border-primary/50 transition-colors",
                  file && "border-green-500 bg-green-50"
                )}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{file.name}</span>
                    <button
                      onClick={() => {
                        setFile(null);
                        setCSVContent("");
                      }}
                      className="ml-2 text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Drag and drop your CSV file here, or
                    </p>
                    <label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isProcessing}
                      />
                      <Button
                        variant="outline"
                        className="cursor-pointer"
                        disabled={isProcessing}
                        asChild
                      >
                        <span>browse files</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Expected CSV format:</p>
                <code className="text-xs bg-muted p-2 rounded block">
                  Date,Amount,Type,Category,Account,Description,Currency
                </code>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === "mapping" && (
            <div className="space-y-4">
              <ColumnMapping
                headers={headers}
                mapping={mapping}
                onMappingChange={setMapping}
              />
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <div className="space-y-4">
              <ImportPreview transactions={transactions} />

              {/* Import Options */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Import Options</p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createAccounts"
                    checked={createMissingAccounts}
                    onCheckedChange={(checked) =>
                      setCreateMissingAccounts(checked as boolean)
                    }
                  />
                  <Label htmlFor="createAccounts" className="text-sm">
                    Create missing accounts automatically
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createCategories"
                    checked={createMissingCategories}
                    onCheckedChange={(checked) =>
                      setCreateMissingCategories(checked as boolean)
                    }
                  />
                  <Label htmlFor="createCategories" className="text-sm">
                    Create missing categories automatically
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                Importing {validCount} transactions...
              </p>
            </div>
          )}

          {/* Result Step */}
          {step === "result" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {importResult.imported}
                  </div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {importResult.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="border rounded-md p-3 max-h-[150px] overflow-auto">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...and {importResult.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step !== "upload" && step !== "importing" && step !== "result" && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step === "result" ? (
            <Button onClick={handleClose}>Done</Button>
          ) : step === "upload" ? (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          ) : step === "mapping" ? (
            <Button
              onClick={handleMappingNext}
              disabled={!canProceedFromMapping() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Next"
              )}
            </Button>
          ) : step === "preview" ? (
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${validCount} Transactions`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
