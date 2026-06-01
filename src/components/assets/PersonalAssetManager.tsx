"use client";

import { useState } from "react";
import {
  Archive,
  Box,
  Boxes,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Shapes,
  Trash2,
  WalletCards,
} from "lucide-react";

import {
  AddPersonalAssetDialog,
  ArchivePersonalAssetDialog,
  EditPersonalAssetDialog,
  PersonalAssetValuationHistoryDialog,
  RevaluePersonalAssetDialog,
} from "@/components/assets/PersonalAssetDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeletePersonalAsset,
  usePersonalAssets,
  usePersonalAssetSummary,
  useRestorePersonalAsset,
} from "@/hooks/usePersonalAssetQueries";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PERSONAL_ASSET_CATEGORIES,
  PERSONAL_ASSET_CATEGORY_LABELS,
  type PersonalAssetCategory,
  type PersonalAssetRecord,
} from "@/types/personal-assets";

type AssetStatus = "active" | "archived" | "all";

export function PersonalAssetManager() {
  const [status, setStatus] = useState<AssetStatus>("active");
  const [category, setCategory] = useState<PersonalAssetCategory | "all">("all");
  const [selectedAsset, setSelectedAsset] = useState<PersonalAssetRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [revalueOpen, setRevalueOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = usePersonalAssetSummary();
  const {
    data: assets = [],
    isLoading,
    error,
  } = usePersonalAssets({
    status,
    category: category === "all" ? undefined : category,
  });
  const restoreMutation = useRestorePersonalAsset();
  const deleteMutation = useDeletePersonalAsset();

  const openDialog = (
    asset: PersonalAssetRecord,
    setter: (open: boolean) => void
  ) => {
    setSelectedAsset(asset);
    setter(true);
  };

  const handleRestore = async (asset: PersonalAssetRecord) => {
    try {
      await restoreMutation.mutateAsync(asset.id);
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : "Failed to restore asset");
    }
  };

  const handleDelete = async (asset: PersonalAssetRecord) => {
    if (!confirm(`Permanently delete "${asset.name}" and its valuation history?`)) return;
    try {
      await deleteMutation.mutateAsync(asset.id);
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Failed to delete asset");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personal Assets</h1>
          <p className="text-muted-foreground">
            Track owned items and maintain dated valuations
          </p>
        </div>
        <AddPersonalAssetDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Current Value"
          value={
            summaryLoading
              ? "Loading..."
              : formatCurrency(summary?.totalValue ?? 0, summary?.displayCurrency)
          }
          detail="Included in net worth"
          icon={WalletCards}
        />
        <SummaryCard
          title="Active Assets"
          value={summaryLoading ? "..." : String(summary?.activeCount ?? 0)}
          detail="Currently owned"
          icon={Boxes}
        />
        <SummaryCard
          title="Archived"
          value={summaryLoading ? "..." : String(summary?.archivedCount ?? 0)}
          detail="Disposed or sold"
          icon={Archive}
        />
        <SummaryCard
          title="Categories"
          value={summaryLoading ? "..." : String(summary?.categoryCount ?? 0)}
          detail="Represented in active assets"
          icon={Shapes}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Asset Inventory</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Values update through dated valuation records
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={(value) => setStatus(value as AssetStatus)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All assets</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as PersonalAssetCategory | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {PERSONAL_ASSET_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {PERSONAL_ASSET_CATEGORY_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </p>
          )}
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <Box className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-bold">No assets in this view</p>
                <p className="text-sm text-muted-foreground">
                  Add an owned item or adjust the filters.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                    <TableHead>Valued At</TableHead>
                    <TableHead>Purchase Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="min-w-48">
                        <p className="font-bold">{asset.name}</p>
                        {asset.notes && (
                          <p className="max-w-64 truncate text-xs text-muted-foreground">
                            {asset.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PERSONAL_ASSET_CATEGORY_LABELS[asset.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(asset.currentValue, asset.currency)}
                      </TableCell>
                      <TableCell>{formatDate(asset.currentValuedAt)}</TableCell>
                      <TableCell className="min-w-40">
                        {asset.purchasePrice !== null ? (
                          <>
                            <p className="font-medium">
                              {formatCurrency(
                                asset.purchasePrice,
                                asset.purchaseCurrency ?? asset.currency
                              )}
                            </p>
                            {asset.purchaseDate && (
                              <p className="text-xs text-muted-foreground">
                                {formatDate(asset.purchaseDate)}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not recorded</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {asset.disposedAt ? (
                          <div>
                            <Badge variant="secondary">Archived</Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(asset.disposedAt)}
                            </p>
                          </div>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${asset.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(asset, setHistoryOpen)}>
                              <History className="mr-2 h-4 w-4" />
                              Valuation History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(asset, setEditOpen)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            {!asset.disposedAt ? (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(asset, setRevalueOpen)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Record Valuation
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog(asset, setArchiveOpen)}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => handleRestore(asset)}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(asset)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAsset && editOpen && (
        <EditPersonalAssetDialog
          key={`edit-${selectedAsset.id}`}
          asset={selectedAsset}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {selectedAsset && revalueOpen && (
        <RevaluePersonalAssetDialog
          key={`revalue-${selectedAsset.id}`}
          asset={selectedAsset}
          open={revalueOpen}
          onOpenChange={setRevalueOpen}
        />
      )}
      {selectedAsset && archiveOpen && (
        <ArchivePersonalAssetDialog
          key={`archive-${selectedAsset.id}`}
          asset={selectedAsset}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
        />
      )}
      {selectedAsset && historyOpen && (
        <PersonalAssetValuationHistoryDialog
          key={`history-${selectedAsset.id}`}
          asset={selectedAsset}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Box;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
