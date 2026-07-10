"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, CircleSlash, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useOnboardingProgress,
  useUpdateChecklistState,
} from "@/hooks/useOnboardingQueries";
import type { OnboardingProgressItem } from "@/actions/onboarding-actions";
import type { OnboardingChecklistId } from "@/lib/onboarding/constants";

function getStatusLabel(status: "complete" | "skipped" | "incomplete") {
  switch (status) {
    case "complete":
      return "Complete";
    case "skipped":
      return "Skipped";
    default:
      return "Not started";
  }
}

function getStatusIcon(status: "complete" | "skipped" | "incomplete") {
  if (status === "complete") {
    return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  }

  if (status === "skipped") {
    return <CircleSlash className="h-5 w-5 text-muted-foreground" />;
  }

  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

export function GettingStartedCard() {
  const { data: progress, isLoading, isError } = useOnboardingProgress();
  const updateChecklistMutation = useUpdateChecklistState();
  const [error, setError] = useState<string | null>(null);

  if (isError || (!isLoading && !progress?.shouldShowChecklist)) {
    return null;
  }

  const completedCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? 6;
  const progressValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isMutating = updateChecklistMutation.isPending;

  async function updateManualState(
    id: OnboardingChecklistId,
    nextState: "complete" | "skipped"
  ) {
    setError(null);

    const now = new Date().toISOString();

    try {
      await updateChecklistMutation.mutateAsync({
        checklistState: {
          [id]: {
            completed: nextState === "complete",
            skipped: nextState === "skipped",
            completedAt: nextState === "complete" ? now : null,
            skippedAt: nextState === "skipped" ? now : null,
          },
        },
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to update Getting Started progress"
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle className="font-heading text-2xl font-black uppercase tracking-wide">
              Getting Started
            </CardTitle>
            <CardDescription className="font-semibold">
              Finish the setup steps that make FinHealth reports, budgets, and
              insights more useful.
            </CardDescription>
          </div>
          <div className="text-sm font-black uppercase tracking-widest">
            {completedCount} of {totalCount} completed
          </div>
        </div>
        <Progress value={progressValue} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading setup progress...
          </div>
        ) : (
          progress?.items.map((item: OnboardingProgressItem) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 border-b-2 border-border pb-4 last:border-b-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="flex gap-3">
                <div className="mt-1 shrink-0">{getStatusIcon(item.status)}</div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{item.title}</h3>
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      {getStatusLabel(item.status)}
                      {item.completionSource === "auto" ? " - Auto" : ""}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button asChild size="sm" variant="outline">
                  <Link href={item.href}>{item.ctaLabel}</Link>
                </Button>
                {item.alternateHref ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={item.alternateHref}>Review alternate</Link>
                  </Button>
                ) : null}
                {item.canManuallyComplete ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void updateManualState(item.id, "complete")}
                    disabled={isMutating}
                  >
                    Complete
                  </Button>
                ) : null}
                {item.canSkip ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void updateManualState(item.id, "skipped")}
                    disabled={isMutating}
                  >
                    Skip
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}

        {error ? (
          <p className="neo-border bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
