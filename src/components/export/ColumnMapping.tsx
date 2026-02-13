"use client";

import { ColumnMapping as ColumnMappingType } from "@/actions/import-actions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ColumnMappingProps {
  headers: string[];
  mapping: ColumnMappingType;
  onMappingChange: (mapping: ColumnMappingType) => void;
}

const fieldOptions: { value: keyof ColumnMappingType; label: string; required: boolean }[] = [
  { value: "date", label: "Date", required: true },
  { value: "amount", label: "Amount", required: true },
  { value: "type", label: "Type", required: true },
  { value: "account", label: "Account", required: true },
  { value: "toAccount", label: "To Account", required: false },
  { value: "category", label: "Category", required: false },
  { value: "description", label: "Description", required: false },
  { value: "currency", label: "Currency", required: false },
];

/**
 * Render a UI for mapping CSV header names to predefined system fields.
 *
 * Shows a select for each target field, marks required fields, prevents selecting the same header for multiple fields,
 * allows skipping fields, and displays a summary of mapped and missing required fields.
 *
 * @param headers - Available CSV header names to choose from
 * @param mapping - Current mapping from system field keys to selected header names
 * @param onMappingChange - Callback invoked with the updated mapping object when selections change
 * @returns The React element that renders the column-mapping form
 */
export function ColumnMapping({ headers, mapping, onMappingChange }: ColumnMappingProps) {
  const handleFieldChange = (field: keyof ColumnMappingType, value: string) => {
    // If "skip" is selected, remove the mapping
    if (value === "__skip__") {
      const newMapping = { ...mapping };
      delete newMapping[field];
      onMappingChange(newMapping);
      return;
    }

    onMappingChange({
      ...mapping,
      [field]: value,
    });
  };

  // Check which headers are already mapped
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Map your CSV columns to the required fields. Required fields are marked with a red asterisk.
      </div>

      <div className="grid gap-3">
        {fieldOptions.map((field) => {
          const isMapped = mapping[field.value];
          const isRequired = field.required;

          return (
            <div key={field.value} className="flex items-center gap-4">
              <div className="w-32 flex items-center gap-1">
                <Label className="text-sm font-medium">{field.label}</Label>
                {isRequired && <span className="text-red-500">*</span>}
              </div>

              <Select
                value={mapping[field.value] || "__skip__"}
                onValueChange={(value) => handleFieldChange(field.value, value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">
                    <span className="text-muted-foreground">-- Skip --</span>
                  </SelectItem>
                  {headers.map((header) => (
                    <SelectItem
                      key={header}
                      value={header}
                      disabled={mappedHeaders.has(header) && mapping[field.value] !== header}
                    >
                      {header}
                      {mappedHeaders.has(header) && mapping[field.value] !== header && (
                        <span className="ml-2 text-xs text-muted-foreground">(already mapped)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isMapped ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Mapped
                </Badge>
              ) : isRequired ? (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  Required
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Optional
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mapped:</span>
          <span className="font-medium">
            {Object.values(mapping).filter(Boolean).length} of {headers.length} columns
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm mt-1">
          <span className="text-muted-foreground">Required fields:</span>
          <span className="font-medium">
            {fieldOptions
              .filter((f) => f.required)
              .every((f) => mapping[f.value]) ? (
              <span className="text-green-600">All required fields mapped ✓</span>
            ) : (
              <span className="text-red-600">
                {fieldOptions.filter((f) => f.required && !mapping[f.value]).length} missing
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}