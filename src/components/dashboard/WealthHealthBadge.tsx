"use client";

import { HEALTH_TIERS, HealthTier, HealthTierInfo } from "@/lib/executive-types";
import { cn } from "@/lib/utils";

interface WealthHealthBadgeProps {
  tier: HealthTier;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

export function WealthHealthBadge({
  tier,
  size = "md",
  showDescription = false,
}: WealthHealthBadgeProps) {
  const tierInfo: HealthTierInfo = HEALTH_TIERS[tier];

  const sizeClasses = {
    sm: "h-8 w-8 text-lg",
    md: "h-12 w-12 text-2xl",
    lg: "h-16 w-16 text-4xl",
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold",
          sizeClasses[size],
          tierInfo.bgColor,
          tierInfo.color
        )}
      >
        {tier}
      </div>
      <div>
        <div className={cn("font-semibold", tierInfo.color)}>
          {tierInfo.label}
        </div>
        {showDescription && (
          <div className="text-sm text-muted-foreground">
            {tierInfo.description}
          </div>
        )}
      </div>
    </div>
  );
}

interface WealthHealthCardProps {
  tier: HealthTier;
  debtToWealthRatio: number;
  monthsOfRunway: number;
}

export function WealthHealthCard({
  tier,
  debtToWealthRatio,
  monthsOfRunway,
}: WealthHealthCardProps) {
  const tierInfo = HEALTH_TIERS[tier];

  return (
    <div className={cn("rounded-lg p-6 border-2", tierInfo.bgColor)}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Financial Health Score
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on your debt-to-wealth ratio and emergency fund
          </p>
        </div>
        <WealthHealthBadge tier={tier} size="lg" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Debt-to-Wealth Ratio</p>
          <p className="text-2xl font-bold">
            {debtToWealthRatio.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {debtToWealthRatio < 30
              ? "Healthy"
              : debtToWealthRatio < 60
              ? "Moderate"
              : "High"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Emergency Fund</p>
          <p className="text-2xl font-bold">
            {monthsOfRunway.toFixed(1)} mo
          </p>
          <p className="text-xs text-muted-foreground">
            {monthsOfRunway >= 6
              ? "Excellent"
              : monthsOfRunway >= 3
              ? "Good"
              : "Build more"}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <p className={cn("text-sm font-medium", tierInfo.color)}>
          {tierInfo.description}
        </p>
      </div>
    </div>
  );
}
