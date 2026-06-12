import * as React from "react";

import { Input } from "@/components/ui/input";

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  decimalScale?: number;
};

function groupIntegerDigits(value: string): string {
  const normalized = value.replace(/^0+(?=\d)/, "") || "0";
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function shouldUseDotDecimal(value: string, decimalScale: number): boolean {
  if (decimalScale <= 0) {
    return false;
  }

  const dotCount = (value.match(/\./g) ?? []).length;
  if (dotCount !== 1) {
    return false;
  }

  const [integerPart = "", fractionPart = ""] = value.split(".");
  return (
    integerPart.length > 3 &&
    fractionPart.length > 0 &&
    fractionPart.length <= decimalScale
  );
}

function getDecimalSeparator(value: string, decimalScale: number): "," | "." | null {
  const lastComma = value.lastIndexOf(",");

  if (lastComma >= 0) {
    return ",";
  }

  if (shouldUseDotDecimal(value, decimalScale)) {
    return ".";
  }

  return null;
}

function parseAndFormatInput(
  input: string,
  decimalScale: number
): { displayValue: string; numericValue: number | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { displayValue: "", numericValue: null };
  }

  const isNegative = trimmed.startsWith("-");
  const sign = isNegative ? "-" : "";
  const unsigned = trimmed.replace(/-/g, "").replace(/[^\d.,]/g, "");
  const decimalSeparator = getDecimalSeparator(unsigned, decimalScale);
  const hasDecimalSeparator = decimalSeparator !== null;
  const [rawInteger = "", rawFraction = ""] = hasDecimalSeparator
    ? unsigned.split(decimalSeparator)
    : [unsigned, ""];
  const integerDigits = rawInteger.replace(/\D/g, "");
  const fractionDigits = rawFraction.replace(/\D/g, "").slice(0, decimalScale);

  if (!integerDigits && !fractionDigits) {
    return { displayValue: sign, numericValue: null };
  }

  const groupedInteger = groupIntegerDigits(integerDigits);
  const displayValue =
    sign +
    groupedInteger +
    (hasDecimalSeparator && decimalScale > 0 ? `,${fractionDigits}` : "");
  const numericText =
    sign +
    (integerDigits || "0") +
    (fractionDigits ? `.${fractionDigits}` : "");
  const numericValue = Number(numericText);

  return {
    displayValue,
    numericValue: Number.isFinite(numericValue) ? numericValue : null,
  };
}

function formatValue(value: number | null | undefined, decimalScale: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: decimalScale,
  }).format(value);
}

function MoneyInput({
  value,
  onValueChange,
  decimalScale = 2,
  onBlur,
  onFocus,
  ...props
}: MoneyInputProps) {
  const isFocusedRef = React.useRef(false);
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatValue(value, decimalScale)
  );

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(formatValue(value, decimalScale));
    }
  }, [decimalScale, value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={(event) => {
        isFocusedRef.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        setDisplayValue(formatValue(value, decimalScale));
        onBlur?.(event);
      }}
      onChange={(event) => {
        const parsed = parseAndFormatInput(event.target.value, decimalScale);
        setDisplayValue(parsed.displayValue);
        onValueChange(parsed.numericValue);
      }}
    />
  );
}

export { MoneyInput };
