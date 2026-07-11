"use client";

import {
  scanTransactionBill,
  type TransactionOcrResult,
} from "@/actions/transaction-ocr-actions";
import { useAccounts } from "@/hooks/useAccountQueries";
import { useCreateTransaction } from "@/hooks/useTransactionQueries";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionAccountCombobox } from "@/components/transactions/TransactionAccountCombobox";
import { TransactionSplitEditor } from "@/components/transactions/TransactionSplitEditor";
import {
  isDepositoAccountType,
  isTransferAccountType,
} from "@/lib/account-types";
import { cn, formatCurrency } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  FileImage,
  Loader2,
  MapPin,
  Plus,
  ScanLine,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

function buildGoogleMapsLink(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

const transactionFormSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  description: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapsLink: z.string().optional(),
  date: z.date(),
  accountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  currency: z.string(),
  exchangeRate: z.number(),
  splits: z
    .array(
      z.object({
        categoryId: z.string().optional(),
        amount: z.number().nonnegative(),
        description: z.string().optional(),
      })
    )
    .default([]),
});

type TransactionFormInput = z.input<typeof transactionFormSchema>;
type TransactionFormValues = z.output<typeof transactionFormSchema>;

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

interface AddTransactionDialogProps {
  onSuccess?: () => void;
}

interface AccountBalanceSummaryProps {
  balance: number;
  currency: string;
  transferNote?: string;
}

type OcrFieldKey =
  | "type"
  | "amount"
  | "date"
  | "description"
  | "location"
  | "categoryId"
  | "splits";

const OCR_FIELD_LABELS: Record<OcrFieldKey, string> = {
  type: "Type",
  amount: "Amount",
  date: "Date",
  description: "Description",
  location: "Location",
  categoryId: "Category",
  splits: "Split rows",
};

const OCR_ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const OCR_ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const OCR_MAX_SOURCE_IMAGE_SIZE = 5 * 1024 * 1024;
const OCR_TARGET_IMAGE_SIZE = 500 * 1024;
const OCR_MAX_COMPRESSED_IMAGE_SIZE = 1 * 1024 * 1024;
const OCR_COMPRESSION_DIMENSIONS = [1600, 1400, 1200, 1000, 850, 700];
const OCR_COMPRESSION_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.45];
const OCR_SPLIT_MIN_CONFIDENCE = 0.7;

function AccountBalanceSummary({
  balance,
  currency,
  transferNote,
}: AccountBalanceSummaryProps) {
  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-primary/80">
          Available balance
        </span>
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(balance, currency)}
        </span>
      </div>
      {transferNote ? (
        <p className="mt-1 text-xs text-muted-foreground">{transferNote}</p>
      ) : null}
    </div>
  );
}

function isDefaultDate(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function parseOcrDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAllowedOcrImage(file: File) {
  return (
    OCR_ALLOWED_IMAGE_TYPES.has(file.type) ||
    OCR_ALLOWED_IMAGE_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    )
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getCompressedOcrFileName(fileName: string, mimeType: string) {
  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "bill-photo";
  return `${baseName}-compressed.${extension}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to compress bill photo."));
        }
      },
      mimeType,
      quality
    );
  });
}

function supportsCanvasMimeType(mimeType: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
}

async function loadImageForCompression(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
          context.drawImage(bitmap, 0, 0, width, height);
        },
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement decoding for browsers without full support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
        context.drawImage(image, 0, 0, width, height);
      },
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function compressOcrImage(file: File) {
  if (file.size <= OCR_TARGET_IMAGE_SIZE) {
    return file;
  }

  let loadedImage: Awaited<ReturnType<typeof loadImageForCompression>>;

  try {
    loadedImage = await loadImageForCompression(file);
  } catch {
    if (file.size < OCR_MAX_COMPRESSED_IMAGE_SIZE) {
      return file;
    }

    throw new Error(
      "This browser could not compress that image. Use a JPEG, PNG, or WebP image under 1 MB."
    );
  }

  try {
    const outputMimeType = supportsCanvasMimeType("image/webp")
      ? "image/webp"
      : "image/jpeg";
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("This browser could not prepare the bill photo.");
    }

    let hardLimitFile: File | null = null;

    for (const maxDimension of OCR_COMPRESSION_DIMENSIONS) {
      const ratio = Math.min(
        1,
        maxDimension / loadedImage.width,
        maxDimension / loadedImage.height
      );
      const width = Math.max(1, Math.round(loadedImage.width * ratio));
      const height = Math.max(1, Math.round(loadedImage.height * ratio));

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      loadedImage.draw(context, width, height);

      for (const quality of OCR_COMPRESSION_QUALITIES) {
        const blob = await canvasToBlob(canvas, outputMimeType, quality);
        const compressedFile = new File(
          [blob],
          getCompressedOcrFileName(file.name, outputMimeType),
          {
            type: outputMimeType,
            lastModified: Date.now(),
          }
        );

        if (compressedFile.size <= OCR_TARGET_IMAGE_SIZE) {
          return compressedFile;
        }

        if (
          compressedFile.size < OCR_MAX_COMPRESSED_IMAGE_SIZE &&
          (!hardLimitFile || compressedFile.size < hardLimitFile.size)
        ) {
          hardLimitFile = compressedFile;
        }
      }
    }

    if (hardLimitFile) {
      return hardLimitFile;
    }

    throw new Error(
      "Compressed bill photo is still larger than 1 MB. Try cropping the receipt and scan again."
    );
  } finally {
    loadedImage.close();
  }
}

function formatOcrValue(
  key: OcrFieldKey,
  result: TransactionOcrResult,
  categories: Category[],
  currency: string
) {
  if (key === "type") return result.type ?? "Not detected";
  if (key === "amount") {
    return result.amount ? formatCurrency(result.amount, currency) : "Not detected";
  }
  if (key === "date") return result.date ?? "Not detected";
  if (key === "description") return result.description ?? "Not detected";
  if (key === "location") return result.location ?? "Not detected";
  if (key === "categoryId") {
    const category = categories.find((item) => item.id === result.categoryId);
    return category
      ? `${category.icon ? `${category.icon} ` : ""}${category.name}`
      : "Not detected";
  }

  return `${result.lineItems.length} line items`;
}

function canUseOcrSplits(result: TransactionOcrResult) {
  if (result.type !== "EXPENSE" || !result.amount) return false;
  if (result.lineItems.length < 2 || result.lineItems.length > 20) return false;

  const total = result.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return (
    result.lineItems.every(
      (item) =>
        Boolean(item.categoryId) &&
        Boolean(item.amount && item.amount > 0) &&
        (item.confidence ?? 0) >= OCR_SPLIT_MIN_CONFIDENCE
    ) && Math.abs(total - result.amount) <= 0.005
  );
}

function getAvailableOcrFields(result: TransactionOcrResult): OcrFieldKey[] {
  const fields: OcrFieldKey[] = [];
  if (result.type) fields.push("type");
  if (result.amount) fields.push("amount");
  if (result.date) fields.push("date");
  if (result.description) fields.push("description");
  if (result.location) fields.push("location");
  if (result.categoryId) fields.push("categoryId");
  if (canUseOcrSplits(result)) fields.push("splits");
  return fields;
}

/**
 * Display a dialog for creating a transaction (income, expense, or transfer).
 *
 * Attempts to create the transaction when the form is submitted; on success the dialog closes and the optional callback is invoked.
 *
 * @param onSuccess - Optional callback invoked after a transaction is successfully created
 * @returns The Add Transaction dialog React element
 */
export function AddTransactionDialog({ onSuccess }: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrFileName, setOcrFileName] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<TransactionOcrResult | null>(null);
  const [selectedOcrFields, setSelectedOcrFields] = useState<OcrFieldKey[]>([]);

  const { data: accountsData = [] } = useAccounts();
  const createMutation = useCreateTransaction();

  const accounts = accountsData.map(
    (a: AccountOption) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      currency: a.currency,
      isActive: a.isActive,
    })
  );
  const activeAccounts = accounts.filter(
    (account) => account.isActive && !isDepositoAccountType(account.type)
  );
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      amount: 0,
      type: "EXPENSE",
      description: "",
      location: "",
      latitude: undefined,
      longitude: undefined,
      googleMapsLink: "",
      date: new Date(),
      accountId: "",
      toAccountId: "",
      categoryId: "",
      currency: "IDR",
      exchangeRate: 1,
      splits: [],
    },
  });

  const selectedType = useWatch({ control: form.control, name: "type" });
  const selectedFromAccountId = useWatch({
    control: form.control,
    name: "accountId",
  });
  const selectedToAccountId = useWatch({
    control: form.control,
    name: "toAccountId",
  });
  const selectedCurrency = useWatch({ control: form.control, name: "currency" });
  const splits = useWatch({ control: form.control, name: "splits" }) ?? [];
  const isSplitEnabled = splits.length > 0;
  const selectedFromAccount = activeAccounts.find(
    (account) => account.id === selectedFromAccountId
  );
  const selectedToAccount = activeAccounts.find(
    (account) => account.id === selectedToAccountId
  );
  const eligibleTransferAccounts = activeAccounts.filter((account) =>
    isTransferAccountType(account.type)
  );
  const eligibleDestinationAccounts = eligibleTransferAccounts.filter(
    (account) =>
      account.id !== selectedFromAccountId &&
      (!selectedFromAccount || account.currency === selectedFromAccount.currency)
  );

  const resetOcrState = () => {
    setIsScanningBill(false);
    setOcrError(null);
    setOcrFileName(null);
    setOcrResult(null);
    setSelectedOcrFields([]);
  };

  const getDefaultSelectedOcrFields = (result: TransactionOcrResult) => {
    return getAvailableOcrFields(result).filter((field) => {
      if (field === "type") {
        return !form.formState.dirtyFields.type;
      }
      if (field === "amount") {
        return !form.formState.dirtyFields.amount && form.getValues("amount") === 0;
      }
      if (field === "date") {
        return !form.formState.dirtyFields.date && isDefaultDate(form.getValues("date"));
      }
      if (field === "description") {
        return !form.getValues("description")?.trim();
      }
      if (field === "location") {
        return !form.getValues("location")?.trim();
      }
      if (field === "categoryId") {
        return (
          !form.getValues("categoryId") &&
          (form.getValues("splits") ?? []).length === 0
        );
      }
      if (field === "splits") {
        return (form.getValues("splits") ?? []).length === 0;
      }
      return false;
    });
  };

  const handleBillFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setOcrError(null);
    setOcrResult(null);
    setSelectedOcrFields([]);
    setOcrFileName(file.name);

    if (!isAllowedOcrImage(file)) {
      setOcrError("Use a JPEG, PNG, WebP, HEIC, or HEIF image.");
      return;
    }

    if (file.size > OCR_MAX_SOURCE_IMAGE_SIZE) {
      setOcrError("Bill photo must be 5 MB or smaller before compression.");
      return;
    }

    setIsScanningBill(true);

    try {
      const compressedFile = await compressOcrImage(file);
      const formData = new FormData();
      formData.append("image", compressedFile);
      setOcrFileName(
        `${file.name} (${formatFileSize(compressedFile.size)} upload)`
      );
      const result = await scanTransactionBill(formData);

      if (!result.success) {
        setOcrError(result.error ?? "Failed to scan bill photo.");
        return;
      }

      setOcrResult(result.data);
      setSelectedOcrFields(getDefaultSelectedOcrFields(result.data));
    } catch (error) {
      console.error("Bill scan error:", error);
      setOcrError(
        error instanceof Error ? error.message : "Failed to scan bill photo."
      );
    } finally {
      setIsScanningBill(false);
    }
  };

  const toggleOcrField = (field: OcrFieldKey, checked: boolean) => {
    setSelectedOcrFields((current) =>
      checked ? [...new Set([...current, field])] : current.filter((item) => item !== field)
    );
  };

  const handleApplyOcrFields = () => {
    if (!ocrResult) return;

    form.clearErrors("root");

    if (
      selectedOcrFields.includes("categoryId") &&
      !selectedOcrFields.includes("type") &&
      ocrResult.type &&
      form.getValues("type") !== ocrResult.type
    ) {
      form.setError("root", {
        message: "Apply the detected type together with its category.",
      });
      return;
    }

    if (selectedOcrFields.includes("type") && ocrResult.type) {
      form.setValue("type", ocrResult.type, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (selectedOcrFields.includes("amount") && ocrResult.amount) {
      form.setValue("amount", ocrResult.amount, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (selectedOcrFields.includes("date")) {
      const date = parseOcrDate(ocrResult.date);
      if (date) {
        form.setValue("date", date, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }

    if (selectedOcrFields.includes("description") && ocrResult.description) {
      form.setValue("description", ocrResult.description, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (selectedOcrFields.includes("location") && ocrResult.location) {
      form.setValue("location", ocrResult.location, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (selectedOcrFields.includes("splits") && canUseOcrSplits(ocrResult)) {
      form.setValue("type", "EXPENSE", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("amount", ocrResult.amount ?? 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("categoryId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue(
        "splits",
        ocrResult.lineItems.map((item) => ({
          categoryId: item.categoryId ?? "",
          amount: item.amount ?? 0,
          description: item.description ?? "",
        })),
        { shouldDirty: true, shouldValidate: true }
      );
    } else if (selectedOcrFields.includes("categoryId") && ocrResult.categoryId) {
      form.setValue("categoryId", ocrResult.categoryId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("splits", [], { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleSplitToggle = (enabled: boolean) => {
    if (!enabled) {
      const firstSplitCategoryId = form.getValues("splits.0.categoryId");
      if (!form.getValues("categoryId") && firstSplitCategoryId) {
        form.setValue("categoryId", firstSplitCategoryId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      form.setValue("splits", [], { shouldDirty: true, shouldValidate: true });
      return;
    }

    const totalAmount = form.getValues("amount");
    const parentCategoryId = form.getValues("categoryId");
    form.setValue(
      "splits",
      [
        {
          categoryId: parentCategoryId || "",
          amount: totalAmount > 0 ? totalAmount : 0,
          description: "",
        },
        {
          categoryId: "",
          amount: 0,
          description: "",
        },
      ],
      { shouldDirty: true, shouldValidate: true }
    );
    form.setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      form.setError("root", {
        message: "Geolocation is not supported by this browser.",
      });
      return;
    }

    setIsFetchingLocation(true);
    form.clearErrors("root");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue("latitude", latitude, { shouldValidate: true });
        form.setValue("longitude", longitude, { shouldValidate: true });
        form.setValue("googleMapsLink", buildGoogleMapsLink(latitude, longitude), {
          shouldValidate: true,
        });
        setIsFetchingLocation(false);
      },
      () => {
        form.setError("root", {
          message: "Unable to retrieve your location. Permission may have been denied.",
        });
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    /**
     * Loads category data based on the selected transaction type.
     */
    async function loadCategories() {
      try {
        const allResponse = await fetch("/api/categories");
        if (allResponse.ok) {
          setAllCategories(await allResponse.json());
        }

        if (selectedType === "TRANSFER") {
          setCategories([]);
          return;
        }

        const typedResponse = await fetch(`/api/categories?type=${selectedType}`);
        if (typedResponse.ok) {
          setCategories(await typedResponse.json());
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    }
    if (open && selectedType) {
      loadCategories();
    }
  }, [open, selectedType]);

  useEffect(() => {
    if (selectedType !== "EXPENSE" && isSplitEnabled) {
      form.setValue("splits", [], { shouldDirty: true, shouldValidate: true });
    }
  }, [form, isSplitEnabled, selectedType]);

  useEffect(() => {
    if (selectedType !== "TRANSFER") {
      return;
    }

    if (
      selectedToAccount &&
      (selectedToAccount.id === selectedFromAccountId ||
        (selectedFromAccount &&
          selectedToAccount.currency !== selectedFromAccount.currency))
    ) {
      form.setValue("toAccountId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    form,
    selectedFromAccount,
    selectedFromAccountId,
    selectedToAccount,
    selectedType,
  ]);

  const onSubmit = async (data: TransactionFormValues) => {
    if (
      data.type === "EXPENSE" &&
      data.splits.length > 0 &&
      Math.abs(
        data.amount - data.splits.reduce((sum, split) => sum + (split.amount || 0), 0)
      ) > 0.005
    ) {
      form.setError("root", {
        message: "Split amounts must exactly equal the parent amount.",
      });
      return;
    }

    if (
      data.type === "TRANSFER" &&
      selectedFromAccount &&
      selectedToAccount &&
      selectedFromAccount.currency !== selectedToAccount.currency
    ) {
      form.setError("root", {
        message:
          "Transfers require source and destination accounts to use the same currency.",
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        ...data,
        isRecurring: false,
        clientMutationId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : undefined,
      });
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create transaction",
      });
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetOcrState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-160 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a new income, expense, or transfer transaction.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-3 rounded-md border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ScanLine className="h-4 w-4" />
                    Scan bill photo
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload one receipt image. It will be compressed before scanning.
                  </p>
                </div>
                <div>
                  <Input
                    id="bill-photo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    onChange={handleBillFileChange}
                    disabled={isScanningBill || createMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isScanningBill || createMutation.isPending}
                    onClick={() =>
                      document.getElementById("bill-photo-upload")?.click()
                    }
                  >
                    {isScanningBill ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="mr-2 h-4 w-4" />
                    )}
                    {isScanningBill ? "Scanning..." : "Choose photo"}
                  </Button>
                </div>
              </div>

              {ocrFileName ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" />
                  <span className="truncate">{ocrFileName}</span>
                </div>
              ) : null}

              {isScanningBill ? (
                <div className="space-y-2 rounded-md border bg-background p-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-5/6" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
              ) : null}

              {ocrError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              ) : null}

              {ocrResult && !isScanningBill ? (
                <div className="space-y-3 rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Bill scan preview
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select fields to apply. Account and transfer fields stay unchanged.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyOcrFields}
                      disabled={selectedOcrFields.length === 0}
                    >
                      Apply selected
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {getAvailableOcrFields(ocrResult).map((field) => (
                      <div
                        key={field}
                        className="flex items-start gap-3 rounded-md border p-3"
                      >
                        <Checkbox
                          id={`ocr-field-${field}`}
                          checked={selectedOcrFields.includes(field)}
                          onCheckedChange={(checked) =>
                            toggleOcrField(field, checked === true)
                          }
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label
                            htmlFor={`ocr-field-${field}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            {OCR_FIELD_LABELS[field]}
                          </Label>
                          <div className="wrap-break-word text-sm">
                            {formatOcrValue(
                              field,
                              ocrResult,
                              allCategories,
                              selectedCurrency ?? "IDR"
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canUseOcrSplits(ocrResult) ? (
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      {ocrResult.lineItems.length} itemized rows can be applied as
                      split expense rows.
                    </div>
                  ) : ocrResult.lineItems.length > 0 ? (
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      Itemized rows were detected, but they need matching expense
                      categories and totals before they can be applied as splits.
                    </div>
                  ) : null}

                  {ocrResult.warnings.length > 0 ? (
                    <div className="space-y-1 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
                      {ocrResult.warnings.map((warning) => (
                        <div key={warning} className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <MoneyInput
                      placeholder="0.00"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onValueChange={(value) => field.onChange(value ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "TRANSFER" ? (
            <>
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <FormControl>
                      <TransactionAccountCombobox
                        emptyMessage="No source accounts found."
                        onChange={(value) => {
                          field.onChange(value);
                          if (form.getValues("toAccountId") === value) {
                            form.setValue("toAccountId", "");
                          }
                        }}
                        options={eligibleTransferAccounts}
                        placeholder="Select source account"
                        selectedAccount={selectedFromAccount}
                        showCurrencyInTrigger
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    {selectedFromAccount ? (
                      <AccountBalanceSummary
                        balance={selectedFromAccount.balance}
                        currency={selectedFromAccount.currency}
                        transferNote={`Destination accounts must use ${selectedFromAccount.currency}.`}
                      />
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <FormControl>
                      <TransactionAccountCombobox
                        emptyMessage={
                          selectedFromAccount
                            ? "No destination accounts found."
                            : "Select a source account first."
                        }
                        onChange={field.onChange}
                        options={eligibleDestinationAccounts}
                        placeholder="Select destination account"
                        selectedAccount={selectedToAccount}
                        showCurrencyInTrigger
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <FormControl>
                    <TransactionAccountCombobox
                      emptyMessage="No accounts found."
                      onChange={field.onChange}
                      options={activeAccounts}
                      placeholder="Select account"
                      selectedAccount={selectedFromAccount}
                      showCurrencyInList={false}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  {selectedFromAccount ? (
                    <AccountBalanceSummary
                      balance={selectedFromAccount.balance}
                      currency={selectedFromAccount.currency}
                    />
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

            {selectedType !== "TRANSFER" && (
              <>
                {!isSplitEnabled ? (
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {selectedType === "EXPENSE" ? (
                  <TransactionSplitEditor
                    control={form.control}
                    setValue={form.setValue}
                    categories={categories}
                    onToggle={handleSplitToggle}
                    disabled={createMutation.isPending}
                  />
                ) : null}
              </>
            )}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Place, address, or venue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="Enter your latitude or use current location"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : parseFloat(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="Enter your longitude or use current location"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : parseFloat(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentLocation}
                disabled={isFetchingLocation}
                className="w-full sm:w-auto"
              >
                {isFetchingLocation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Use current location
              </Button>
              <p className="text-xs text-muted-foreground">
                Captures your browser-reported coordinates only when you choose to.
              </p>
            </div>

            <FormField
              control={form.control}
              name="googleMapsLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Maps Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://www.google.com/maps/search/?api=1&query=..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
