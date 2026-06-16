"use client";

import { Minus, Plus, Split } from "lucide-react";
import { useFieldArray, useWatch, type Control, type FieldValues, type UseFormSetValue } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
}

interface SplitRowValue {
  categoryId?: string;
  amount?: number;
  description?: string;
  sortOrder?: number;
}

interface TransactionSplitEditorProps<T extends FieldValues> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  categories: CategoryOption[];
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}

function buildDefaultSplitRow(): SplitRowValue {
  return {
    categoryId: "",
    amount: 0,
    description: "",
  };
}

export function TransactionSplitEditor<T extends FieldValues>({
  control,
  setValue,
  categories,
  disabled = false,
  onToggle,
}: TransactionSplitEditorProps<T>) {
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "splits" as never,
  });

  const totalAmount = Number(useWatch({ control, name: "amount" as never }) ?? 0);
  const splits =
    ((useWatch({
      control,
      name: "splits" as never,
    }) as readonly SplitRowValue[] | undefined) ?? []);
  const isEnabled = fields.length > 0;
  const allocated = splits.reduce((sum, split) => sum + Number(split.amount ?? 0), 0);
  const remaining = totalAmount - allocated;

  const handleAddRow = () => {
    append({
      ...buildDefaultSplitRow(),
      sortOrder: fields.length,
    } as never);
  };

  const handleAssignRemaining = (index: number) => {
    const otherAllocated = splits.reduce((sum, split, splitIndex) => {
      if (splitIndex === index) return sum;
      return sum + Number(split.amount ?? 0);
    }, 0);
    const nextAmount = Math.max(0, totalAmount - otherAllocated);
    setValue(`splits.${index}.amount` as never, nextAmount as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleSplitEqually = () => {
    if (fields.length === 0) {
      return;
    }

    const equalAmount = totalAmount / fields.length;
    replace(
      fields.map((field, index) => ({
        ...field,
        categoryId: splits[index]?.categoryId ?? "",
        description: splits[index]?.description ?? "",
        amount: index === fields.length - 1
          ? totalAmount - equalAmount * (fields.length - 1)
          : equalAmount,
        sortOrder: index,
      })) as never
    );
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Split className="h-4 w-4" />
            Split transaction
          </div>
          <p className="text-xs text-muted-foreground">
            Allocate one expense across multiple categories without changing the account balance more than once.
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label="Enable split transaction"
        />
      </div>

      {isEnabled ? (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <div className="space-y-3">
                <FormField
                  control={control}
                  name={`splits.${index}.categoryId` as never}
                  render={({ field: splitField }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={splitField.onChange}
                        value={(splitField.value as string | undefined) ?? ""}
                        disabled={disabled}
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

                <FormField
                  control={control}
                  name={`splits.${index}.description` as never}
                  render={({ field: splitField }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Line item note"
                          {...splitField}
                          value={(splitField.value as string | undefined) ?? ""}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormField
                  control={control}
                  name={`splits.${index}.amount` as never}
                  render={({ field: splitField }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <MoneyInput
                          placeholder="0.00"
                          name={splitField.name}
                          ref={splitField.ref}
                          value={(splitField.value as number | undefined) ?? 0}
                          onBlur={splitField.onBlur}
                          onValueChange={(value) => splitField.onChange(value ?? 0)}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAssignRemaining(index)}
                  disabled={disabled}
                  className="w-full"
                >
                  Assign remaining
                </Button>
              </div>

              <div className="flex items-start justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={disabled || fields.length <= 2}
                  aria-label="Remove split row"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleAddRow} disabled={disabled}>
              <Plus className="mr-2 h-4 w-4" />
              Add row
            </Button>
            <Button type="button" variant="outline" onClick={handleSplitEqually} disabled={disabled || fields.length === 0}>
              Split equally
            </Button>
          </div>

          <div className="grid gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Parent total</div>
              <div className="font-medium">{formatCurrency(totalAmount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Allocated</div>
              <div className="font-medium">{formatCurrency(allocated)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Remaining</div>
              <div className={remaining === 0 ? "font-medium" : "font-medium text-destructive"}>
                {formatCurrency(remaining)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
