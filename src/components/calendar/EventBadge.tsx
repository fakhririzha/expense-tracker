"use client";

import { TransactionType } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
} from "lucide-react";

interface EventBadgeProps {
  type: TransactionType;
  name: string;
  amount: number;
  currency: string;
  compact?: boolean;
  onClick?: () => void;
}

const typeConfig = {
  INCOME: {
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    icon: ArrowDownCircle,
  },
  EXPENSE: {
    color: "bg-red-500",
    textColor: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    icon: ArrowUpCircle,
  },
  TRANSFER: {
    color: "bg-blue-500",
    textColor: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    icon: ArrowLeftRight,
  },
  LIABILITY_PAYMENT: {
    color: "bg-orange-500",
    textColor: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    icon: ArrowUpCircle,
  },
};

/**
 * Renders a clickable transaction badge showing an icon, name, and formatted amount, with a compact variant.
 *
 * The badge appearance (colors and icon) is determined by the transaction `type`. Amounts are formatted using the Indonesian locale (`id-ID`) with the provided `currency` and no fractional digits.
 *
 * @param type - Transaction type that controls the badge's icon and color scheme
 * @param name - Display name for the transaction
 * @param amount - Numeric amount to display (formatted as currency)
 * @param currency - Currency code used to format `amount` (e.g., "IDR")
 * @param compact - When true, renders a condensed badge showing only a color dot and the name
 * @param onClick - Optional click handler for the badge button
 * @returns A JSX element representing the event badge (compact or full) suitable for rendering in the UI
 */
export function EventBadge({
  type,
  name,
  amount,
  currency,
  compact = false,
  onClick,
}: EventBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  const formatAmount = (amt: number, curr: string) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amt);
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate",
          "hover:opacity-80 transition-opacity",
          config.bgColor
        )}
        title={`${name}: ${formatAmount(amount, currency)}`}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.color)} />
        <span className="truncate font-medium">{name}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md",
        "hover:opacity-80 transition-opacity text-left",
        config.bgColor
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", config.textColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className={cn("text-xs", config.textColor)}>
          {formatAmount(amount, currency)}
        </p>
      </div>
    </button>
  );
}

/**
 * Render a small colored dot that visually represents a transaction type.
 *
 * @param type - The transaction type used to select the dot's color
 * @returns A span element styled as a small colored dot corresponding to `type`
 */
export function EventDot({ type }: { type: TransactionType }) {
  const config = typeConfig[type];

  return (
    <span
      className={cn("w-2 h-2 rounded-full flex-shrink-0", config.color)}
      title={type.toLowerCase().replace("_", " ")}
    />
  );
}

/**
 * Get the color utility class for a given transaction type.
 *
 * @param type - The transaction type to retrieve the color for
 * @returns The color utility class associated with the provided `type`
 */
export function getTypeColor(type: TransactionType): string {
  return typeConfig[type].color;
}

/**
 * Get the text color utility class for a transaction type.
 *
 * @param type - The transaction type to look up
 * @returns The text/icon color utility class associated with `type`
 */
export function getTypeTextColor(type: TransactionType): string {
  return typeConfig[type].textColor;
}

/**
 * Returns the Tailwind background color utility for a transaction type.
 *
 * @param type - The transaction type to look up
 * @returns The background color utility class associated with `type`
 */
export function getTypeBgColor(type: TransactionType): string {
  return typeConfig[type].bgColor;
}