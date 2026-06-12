"use client";

import { useState } from "react";
import { format } from "date-fns";
import { History, Loader2, Plus } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useArchivePersonalAsset,
  useCreatePersonalAsset,
  usePersonalAssetValuations,
  useRecordPersonalAssetValuation,
  useUpdatePersonalAsset,
} from "@/hooks/usePersonalAssetQueries";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PERSONAL_ASSET_CATEGORIES,
  PERSONAL_ASSET_CATEGORY_LABELS,
  type PersonalAssetCategory,
  type PersonalAssetRecord,
} from "@/types/personal-assets";

const today = () => format(new Date(), "yyyy-MM-dd");

function toInputDate(date?: Date | string | null): string {
  return date ? format(new Date(date), "yyyy-MM-dd") : "";
}

function parseInputDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

interface AssetDraft {
  name: string;
  category: PersonalAssetCategory;
  currentValue: number | null;
  currency: string;
  valuedAt: string;
  purchaseDate: string;
  purchasePrice: number | null;
  purchaseCurrency: string;
  notes: string;
}

const emptyDraft = (): AssetDraft => ({
  name: "",
  category: "ELECTRONICS",
  currentValue: null,
  currency: "IDR",
  valuedAt: today(),
  purchaseDate: "",
  purchasePrice: null,
  purchaseCurrency: "IDR",
  notes: "",
});

function AssetMetadataFields({
  draft,
  setDraft,
  showValuation,
}: {
  draft: AssetDraft;
  setDraft: (draft: AssetDraft) => void;
  showValuation: boolean;
}) {
  const update = <K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => {
    setDraft({ ...draft, [key]: value });
  };

  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="asset-name">Name</Label>
        <Input
          id="asset-name"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="Home office laptop"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select
            value={draft.category}
            onValueChange={(value) => update("category", value as PersonalAssetCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONAL_ASSET_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {PERSONAL_ASSET_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showValuation && (
          <div className="grid gap-2">
            <Label htmlFor="asset-valued-at">Valuation date</Label>
            <Input
              id="asset-valued-at"
              type="date"
              max={today()}
              value={draft.valuedAt}
              onChange={(event) => update("valuedAt", event.target.value)}
            />
          </div>
        )}
      </div>

      {showValuation && (
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div className="grid gap-2">
            <Label htmlFor="asset-value">Initial value</Label>
            <MoneyInput
              id="asset-value"
              value={draft.currentValue}
              onValueChange={(value) => update("currentValue", value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-currency">Currency</Label>
            <Input
              id="asset-currency"
              value={draft.currency}
              maxLength={3}
              onChange={(event) => update("currency", event.target.value.toUpperCase())}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-date">Purchase date</Label>
          <Input
            id="asset-purchase-date"
            type="date"
            max={today()}
            value={draft.purchaseDate}
            onChange={(event) => update("purchaseDate", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-price">Purchase price</Label>
          <MoneyInput
            id="asset-purchase-price"
            value={draft.purchasePrice}
            onValueChange={(value) => update("purchasePrice", value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-currency">Currency</Label>
          <Input
            id="asset-purchase-currency"
            value={draft.purchaseCurrency}
            maxLength={3}
            onChange={(event) =>
              update("purchaseCurrency", event.target.value.toUpperCase())
            }
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="asset-notes">Notes</Label>
        <textarea
          id="asset-notes"
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Optional details"
          className="border-input min-h-20 w-full border-2 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message?: string }) {
  return message ? <p className="text-sm font-medium text-destructive">{message}</p> : null;
}

export function AddPersonalAssetDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(emptyDraft);
  const [error, setError] = useState<string>();
  const createMutation = useCreatePersonalAsset();

  const handleSubmit = async () => {
    setError(undefined);
    try {
      await createMutation.mutateAsync({
        name: draft.name,
        category: draft.category,
        currentValue: draft.currentValue ?? 0,
        currency: draft.currency,
        valuedAt: parseInputDate(draft.valuedAt),
        purchaseDate: draft.purchaseDate ? parseInputDate(draft.purchaseDate) : null,
        purchasePrice: draft.purchasePrice && draft.purchasePrice > 0 ? draft.purchasePrice : null,
        purchaseCurrency:
          draft.purchasePrice && draft.purchasePrice > 0 ? draft.purchaseCurrency : null,
        notes: draft.notes || null,
      });
      setDraft(emptyDraft());
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create asset");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Personal Asset</DialogTitle>
          <DialogDescription>
            Add an owned item and its first dated valuation.
          </DialogDescription>
        </DialogHeader>
        <AssetMetadataFields draft={draft} setDraft={setDraft} showValuation />
        <ErrorMessage message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !draft.name || !draft.valuedAt}
          >
            {createMutation.isPending ? "Adding..." : "Add Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditPersonalAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: PersonalAssetRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<AssetDraft>(() =>
    asset
      ? {
          name: asset.name,
          category: asset.category,
          currentValue: null,
          currency: asset.currency,
          valuedAt: "",
          purchaseDate: toInputDate(asset.purchaseDate),
          purchasePrice: asset.purchasePrice ?? null,
          purchaseCurrency: asset.purchaseCurrency ?? asset.currency,
          notes: asset.notes ?? "",
        }
      : emptyDraft()
  );
  const [error, setError] = useState<string>();
  const updateMutation = useUpdatePersonalAsset();

  const handleSubmit = async () => {
    if (!asset) return;
    setError(undefined);
    try {
      await updateMutation.mutateAsync({
        id: asset.id,
        data: {
          name: draft.name,
          category: draft.category,
          purchaseDate: draft.purchaseDate ? parseInputDate(draft.purchaseDate) : null,
          purchasePrice:
            draft.purchasePrice && draft.purchasePrice > 0 ? draft.purchasePrice : null,
          purchaseCurrency:
            draft.purchasePrice && draft.purchasePrice > 0 ? draft.purchaseCurrency : null,
          notes: draft.notes || null,
        },
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update asset");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Asset Details</DialogTitle>
          <DialogDescription>
            Update inventory details. Record value changes as a new valuation.
          </DialogDescription>
        </DialogHeader>
        <AssetMetadataFields draft={draft} setDraft={setDraft} showValuation={false} />
        <ErrorMessage message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending || !draft.name}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevaluePersonalAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: PersonalAssetRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState<number | null>(() => asset?.currentValue ?? null);
  const [currency, setCurrency] = useState(() => asset?.currency ?? "IDR");
  const [valuedAt, setValuedAt] = useState(today());
  const [error, setError] = useState<string>();
  const mutation = useRecordPersonalAssetValuation();

  const handleSubmit = async () => {
    if (!asset) return;
    setError(undefined);
    try {
      await mutation.mutateAsync({
        id: asset.id,
        data: { value: value ?? 0, currency, valuedAt: parseInputDate(valuedAt) },
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to record valuation");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Valuation</DialogTitle>
          <DialogDescription>
            Add a dated value for {asset?.name}. Backdated values remain in history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-[1fr_110px] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valuation-value">Value</Label>
              <MoneyInput
                id="valuation-value"
                value={value}
                onValueChange={setValue}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valuation-currency">Currency</Label>
              <Input
                id="valuation-currency"
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="valuation-date">Effective date</Label>
            <Input
              id="valuation-date"
              type="date"
              max={today()}
              value={valuedAt}
              onChange={(event) => setValuedAt(event.target.value)}
            />
          </div>
        </div>
        <ErrorMessage message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !valuedAt}>
            {mutation.isPending ? "Recording..." : "Record Valuation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchivePersonalAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: PersonalAssetRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [disposedAt, setDisposedAt] = useState(today());
  const [error, setError] = useState<string>();
  const mutation = useArchivePersonalAsset();

  const handleSubmit = async () => {
    if (!asset) return;
    setError(undefined);
    try {
      await mutation.mutateAsync({ id: asset.id, disposedAt: parseInputDate(disposedAt) });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to archive asset");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive Asset</DialogTitle>
          <DialogDescription>
            Record when {asset?.name} left your ownership. It will no longer count toward current net worth.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="disposal-date">Disposal date</Label>
          <Input
            id="disposal-date"
            type="date"
            max={today()}
            value={disposedAt}
            onChange={(event) => setDisposedAt(event.target.value)}
          />
        </div>
        <ErrorMessage message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !disposedAt}>
            {mutation.isPending ? "Archiving..." : "Archive Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PersonalAssetValuationHistoryDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: PersonalAssetRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: valuations = [], isLoading } = usePersonalAssetValuations(asset?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Valuation History
          </DialogTitle>
          <DialogDescription>{asset?.name}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto border-2">
            {valuations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No valuations recorded.</p>
            ) : (
              valuations.map((valuation) => (
                <div
                  key={valuation.id}
                  className="flex items-center justify-between border-b-2 px-4 py-3 last:border-b-0"
                >
                  <div>
                    <p className="font-bold">
                      {formatCurrency(valuation.value, valuation.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recorded {formatDate(valuation.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatDate(valuation.valuedAt)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
