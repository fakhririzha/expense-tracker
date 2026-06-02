"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Target, TrendingUp } from "lucide-react";
import Link from "next/link";

interface RetirementProgressProps {
  currentNetWorth: number;
  targetAmount: number | null;
  currency?: string;
}

/**
 * Renders a retirement progress card that visualizes current net worth relative to a target and the remaining amount.
 *
 * If `targetAmount` is not provided or is less than or equal to zero, displays a prompt to set a retirement target.
 *
 * @param currentNetWorth - The user's current net worth used to compute progress.
 * @param targetAmount - The retirement target amount; may be `null` to indicate no target set.
 * @param currency - Currency code used for formatting amounts (defaults to "IDR").
 * @returns The rendered React element for the retirement progress UI.
 */
export function RetirementProgress({
  currentNetWorth,
  targetAmount,
  currency = "IDR",
}: RetirementProgressProps) {
  if (!targetAmount || targetAmount <= 0) {
    return (
      <div className="p-6 neo-border neo-shadow bg-secondary">
        <div className="flex items-center gap-2 font-bold">
          <Target className="h-6 w-6" />
          <span>Set a retirement target to track your progress</span>
        </div>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link href="/dashboard/profile">Set Retirement Target</Link>
        </Button>
      </div>
    );
  }

  const progress = Math.min((currentNetWorth / targetAmount) * 100, 100);
  const remaining = Math.max(targetAmount - currentNetWorth, 0);
  const isComplete = progress >= 100;

  return (
    <div className="p-6 space-y-4 neo-border neo-shadow bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-bold font-heading uppercase">Retirement Progress</h3>
        </div>
        {isComplete && (
          <span className="text-sm font-bold text-green-600 flex items-center gap-1 uppercase tracking-wider">
            <TrendingUp className="h-5 w-5" />
            Goal Reached!
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-4 neo-border shadow-sm border-2 border-black" />
        <div className="flex justify-between text-sm font-bold">
          <span className="opacity-80">
            {progress.toFixed(1)}% complete
          </span>
          <span className="font-black">
            {formatCurrency(currentNetWorth, currency)} /{" "}
            {formatCurrency(targetAmount, currency)}
          </span>
        </div>
      </div>

      {!isComplete && (
        <div className="pt-2 border-t-2 border-black">
          <p className="text-sm font-bold opacity-80">
            <span className="font-black text-foreground">
              {formatCurrency(remaining, currency)}
            </span>{" "}
            remaining to reach your goal
          </p>
        </div>
      )}
    </div>
  );
}

interface RetirementMilestoneProps {
  currentNetWorth: number;
  targetAmount: number;
  currency?: string;
}

/**
 * Renders a vertical list of retirement milestones (25%, 50%, 75%, 100%) showing each milestone's label and its monetary value, with reached milestones visually highlighted.
 *
 * @param currentNetWorth - The current net worth used to compute progress toward the target.
 * @param targetAmount - The retirement target amount used to compute milestone values.
 * @param currency - Currency code used to format milestone values (defaults to "IDR").
 * @returns A JSX element containing the milestone list with reached milestones styled as highlighted and unreached milestones muted.
 */
export function RetirementMilestones({
  currentNetWorth,
  targetAmount,
  currency = "IDR",
}: RetirementMilestoneProps) {
  const milestones = [
    { percent: 25, label: "25%" },
    { percent: 50, label: "50%" },
    { percent: 75, label: "75%" },
    { percent: 100, label: "100%" },
  ];

  const progress = (currentNetWorth / targetAmount) * 100;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold uppercase tracking-wider opacity-80">Milestones</h4>
      <div className="space-y-3">
        {milestones.map((milestone) => {
          const isReached = progress >= milestone.percent;
          const milestoneValue = (targetAmount * milestone.percent) / 100;

          return (
            <div
              key={milestone.percent}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-4 w-4 border-2 border-black ${
                    isReached ? "bg-primary" : "bg-white"
                  }`}
                />
                <span
                  className={`text-sm font-bold ${
                    isReached ? "text-foreground" : "opacity-60"
                  }`}
                >
                  {milestone.label}
                </span>
              </div>
              <span
                className={`text-sm ${
                  isReached ? "text-foreground font-black" : "opacity-60 font-bold"
                }`}
              >
                {formatCurrency(milestoneValue, currency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
