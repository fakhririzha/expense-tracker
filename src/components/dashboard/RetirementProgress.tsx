"use client";

import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { Target, TrendingUp } from "lucide-react";

interface RetirementProgressProps {
  currentNetWorth: number;
  targetAmount: number | null;
  currency?: string;
}

export function RetirementProgress({
  currentNetWorth,
  targetAmount,
  currency = "IDR",
}: RetirementProgressProps) {
  if (!targetAmount || targetAmount <= 0) {
    return (
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Target className="h-5 w-5" />
          <span>Set a retirement target to track your progress</span>
        </div>
      </div>
    );
  }

  const progress = Math.min((currentNetWorth / targetAmount) * 100, 100);
  const remaining = Math.max(targetAmount - currentNetWorth, 0);
  const isComplete = progress >= 100;

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Retirement Progress</h3>
        </div>
        {isComplete && (
          <span className="text-sm font-medium text-green-600 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Goal Reached!
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {progress.toFixed(1)}% complete
          </span>
          <span className="font-medium">
            {formatCurrency(currentNetWorth, currency)} /{" "}
            {formatCurrency(targetAmount, currency)}
          </span>
        </div>
      </div>

      {!isComplete && (
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
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
      <h4 className="text-sm font-medium text-muted-foreground">Milestones</h4>
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
                  className={`h-3 w-3 rounded-full ${
                    isReached ? "bg-green-500" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-sm ${
                    isReached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {milestone.label}
                </span>
              </div>
              <span
                className={`text-sm ${
                  isReached ? "text-foreground font-medium" : "text-muted-foreground"
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
